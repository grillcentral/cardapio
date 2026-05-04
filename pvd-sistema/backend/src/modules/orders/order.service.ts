import { prisma } from '../../lib/prisma';
import { emitToStore, emitToKitchen, emitToDeliverers } from '../../lib/socket';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { Prisma, OrderStatus, OrderType } from '@prisma/client';

interface Actor {
  id: string;
  tenantId: string;
}

interface CreateOrderInput {
  storeId: string;
  type: OrderType;
  reference?: string;
  customerId?: string;
  addressId?: string;
  notes?: string;
}

interface AddItemInput {
  orderId: string;
  productId: string;
  quantity: number;
  notes?: string;
  modifierIds?: string[];
}

interface PaymentInput {
  orderId: string;
  payments: {
    method: 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'MEAL_VOUCHER' | 'STORE_CREDIT' | 'IFOOD_ONLINE' | 'OTHER';
    amount: number;
    received?: number;   // para dinheiro
    transactionId?: string;
    authCode?: string;
    cardBrand?: string;
    installments?: number;
  }[];
}

export const orderService = {
  /**
   * Calcula a data operacional (businessDate): madrugada até 5h conta como dia anterior
   */
  getBusinessDate(): Date {
    const d = new Date();
    if (d.getHours() < 5) d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  /**
   * Gera número sequencial da loja no dia.
   * THREAD-SAFE: usa pg_advisory_xact_lock para evitar race condition.
   * A lock é por hash do storeId+date, liberada automaticamente ao fim da transação.
   */
  async nextOrderNumber(tx: Prisma.TransactionClient, storeId: string, businessDate: Date): Promise<number> {
    const lockKey = `${storeId}:${businessDate.toISOString().split('T')[0]}`;
    // Converte string para bigint via hashtext (PostgreSQL) — lock por escopo da tx
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const last = await tx.order.findFirst({
      where: { storeId, businessDate },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    return (last?.orderNumber ?? 0) + 1;
  },

  /**
   * Cria um pedido (comanda) vazio
   */
  async create(actor: Actor, input: CreateOrderInput) {
    const businessDate = this.getBusinessDate();

    // Buscar sessão de caixa aberta (opcional, mas essencial pra conciliação)
    const cashSession = await prisma.cashSession.findFirst({
      where: {
        tenantId: actor.tenantId,
        storeId: input.storeId,
        businessDate,
        closedAt: null,
      },
      orderBy: { openedAt: 'desc' },
    });

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await this.nextOrderNumber(tx, input.storeId, businessDate);

      return tx.order.create({
        data: {
          tenantId: actor.tenantId,
          storeId: input.storeId,
          orderNumber,
          businessDate,
          type: input.type,
          status: 'OPEN',
          reference: input.reference,
          customerId: input.customerId,
          addressId: input.addressId,
          notes: input.notes,
          createdById: actor.id,
          cashSessionId: cashSession?.id,
          subtotal: 0,
          total: 0,
        },
        include: {
          items: { include: { modifiers: true } },
          customer: true,
          address: true,
        },
      });
    });

    emitToStore(actor.tenantId, input.storeId, 'order:created', order);
    return order;
  },

  /**
   * Adiciona um item à comanda. Recalcula totais.
   */
  async addItem(actor: Actor, input: AddItemInput) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: input.orderId, tenantId: actor.tenantId },
        include: { items: true },
      });
      if (!order) throw new NotFoundError('Pedido');
      if (order.status !== 'OPEN' && order.status !== 'SENT_KITCHEN' && order.status !== 'PREPARING') {
        throw new BusinessRuleError('Não é possível adicionar itens a um pedido fechado/cancelado');
      }

      const product = await tx.product.findFirst({
        where: { id: input.productId, tenantId: actor.tenantId, deletedAt: null },
        include: {
          category: { select: { kitchenStation: true } },
        },
      });
      if (!product) throw new NotFoundError('Produto');
      if (!product.isActive) throw new BusinessRuleError(`Produto "${product.name}" inativo`);
      if (product.trackStock && product.stock < input.quantity) {
        throw new BusinessRuleError(`Estoque insuficiente de "${product.name}" (disponível: ${product.stock})`);
      }

      // Calcular preço com modificadores
      let modifierTotal = 0;
      const modifiers = input.modifierIds?.length
        ? await tx.modifier.findMany({
            where: { id: { in: input.modifierIds }, group: { tenantId: actor.tenantId } },
          })
        : [];
      modifiers.forEach(m => { modifierTotal += Number(m.priceDelta); });

      const unitPrice = Number(product.price) + modifierTotal;
      const subtotal = unitPrice * input.quantity;

      const item = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          productName: product.name, // snapshot
          unitPrice,
          quantity: input.quantity,
          subtotal,
          notes: input.notes,
          status: 'PENDING',
          kitchenStation: product.category?.kitchenStation ?? null,
          modifiers: {
            create: modifiers.map(m => ({
              modifierId: m.id,
              name: m.name,
              priceDelta: m.priceDelta,
            })),
          },
        },
        include: { modifiers: true, product: true },
      });

      // Baixa de estoque — ATOMIC: evita race condition com verificação no WHERE
      if (product.trackStock) {
        const stockResult = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: input.quantity } },
          data: { stock: { decrement: input.quantity } },
        });
        if (stockResult.count === 0) {
          throw new BusinessRuleError(`Estoque insuficiente de "${product.name}" — outro pedido consumiu o estoque`);
        }
      }

      // Recalcular totais do pedido
      await this.recalculateTotals(tx, order.id);

      const updatedOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: { include: { modifiers: true } },
          customer: true, address: true,
        },
      });

      emitToStore(actor.tenantId, order.storeId, 'order:updated', updatedOrder);
      return updatedOrder!;
    });
  },

  /**
   * Recalcula subtotal/total baseado nos itens atuais
   */
  async recalculateTotals(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { where: { status: { not: 'CANCELLED' } } } },
    });
    if (!order) return;

    const subtotal = order.items.reduce((sum, i) => sum + Number(i.subtotal), 0);
    const total = subtotal + Number(order.serviceFee) + Number(order.deliveryFee) - Number(order.discount);

    await tx.order.update({
      where: { id: orderId },
      data: { subtotal, total: Math.max(0, total) },
    });
  },

  /**
   * Remove item (só se ainda não foi pra cozinha)
   */
  async removeItem(actor: Actor, orderId: string, itemId: string) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: { id: itemId, orderId, order: { tenantId: actor.tenantId } },
        include: { product: true, order: true },
      });
      if (!item) throw new NotFoundError('Item');
      if (item.status !== 'PENDING') {
        throw new BusinessRuleError('Item já foi enviado à cozinha - use cancelamento com motivo');
      }

      // Devolve estoque
      if (item.product.trackStock) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.orderItem.delete({ where: { id: item.id } });
      await this.recalculateTotals(tx, orderId);

      const updated = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { modifiers: true } } },
      });
      emitToStore(actor.tenantId, item.order.storeId, 'order:updated', updated);
      return updated;
    });
  },

  /**
   * Envia itens pendentes para a cozinha (dispara evento KDS e impressão)
   */
  async sendToKitchen(actor: Actor, orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId: actor.tenantId },
        include: { items: { where: { status: 'PENDING' } } },
      });
      if (!order) throw new NotFoundError('Pedido');
      if (order.items.length === 0) {
        throw new BusinessRuleError('Nenhum item novo para enviar à cozinha');
      }

      const now = new Date();
      await tx.orderItem.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'SENT', sentToKitchenAt: now },
      });

      if (order.status === 'OPEN') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'SENT_KITCHEN', sentToKitchenAt: now },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId, fromStatus: 'OPEN', toStatus: 'SENT_KITCHEN',
            changedBy: actor.id,
          },
        });
      }

      const updated = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { modifiers: true, product: { select: { category: { select: { kitchenStation: true } } } } } },
          customer: true,
        },
      });

      // Para delivery: cria registro WAITING assim que vai pra cozinha
      if (order.type === 'DELIVERY') {
        await tx.delivery.upsert({
          where: { orderId },
          create: { orderId, status: 'WAITING' },
          update: {}, // não regride status se já existir
        });
      }

      // Notifica a cozinha em tempo real
      emitToKitchen(actor.tenantId, order.storeId, {
        type: 'NEW_ORDER',
        order: updated,
      });
      emitToStore(actor.tenantId, order.storeId, 'order:updated', updated);
      // Notifica painel de entregas que chegou novo pedido
      if (order.type === 'DELIVERY') {
        emitToStore(actor.tenantId, order.storeId, 'order:closed', { orderId });
        emitToDeliverers(actor.tenantId, order.storeId, 'order:closed', { orderId });
      }

      return updated;
    });
  },

  /**
   * Cozinha marca item como pronto
   */
  async markItemReady(actor: Actor, orderId: string, itemId: string) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: { id: itemId, orderId, order: { tenantId: actor.tenantId } },
        include: { order: true },
      });
      if (!item) throw new NotFoundError('Item');

      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: 'READY', readyAt: new Date() },
      });

      // Se TODOS os itens estão prontos, marcar pedido como READY
      const pending = await tx.orderItem.count({
        where: { orderId, status: { in: ['SENT', 'PREPARING'] } },
      });
      if (pending === 0) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'READY', readyAt: new Date() },
        });

        // ── AUTO-DESPACHO: se for delivery → atualiza entrega e notifica motoboy ──
        if (item.order.type === 'DELIVERY') {
          await tx.delivery.upsert({
            where: { orderId },
            create: { orderId, status: 'READY' },
            update: { status: 'READY' },
          });
          // Notifica módulo de entregas em tempo real (store + motoboys sem loja fixa)
          const deliveryData = {
            orderId,
            orderNumber: item.order.orderNumber,
            reference: item.order.reference,
            message: `Pedido #${item.order.orderNumber} pronto! Aguardando motoboy.`,
          };
          emitToStore(actor.tenantId, item.order.storeId, 'delivery:ready', deliveryData);
          emitToDeliverers(actor.tenantId, item.order.storeId, 'delivery:ready', deliveryData);
        }
      }

      const updated = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { modifiers: true } } },
      });
      emitToStore(actor.tenantId, item.order.storeId, 'order:updated', updated);
      return updated;
    });
  },

  /**
   * Cozinha marca TODOS os itens pendentes como prontos de uma vez.
   * Mais eficiente que chamar markItemReady N vezes — uma única transação.
   */
  async markAllItemsReady(actor: Actor, orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId: actor.tenantId },
        include: {
          items: {
            where: { status: { in: ['SENT', 'PREPARING'] } },
          },
        },
      });
      if (!order) throw new NotFoundError('Pedido');
      if (order.items.length === 0) {
        throw new BusinessRuleError('Nenhum item pendente para marcar como pronto');
      }

      const now = new Date();

      await tx.orderItem.updateMany({
        where: {
          orderId,
          status: { in: ['SENT', 'PREPARING'] },
        },
        data: { status: 'READY', readyAt: now },
      });

      // Marca o pedido como READY
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'READY', readyAt: now },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status as OrderStatus,
          toStatus: 'READY',
          changedBy: actor.id,
        },
      });

      // Auto-despacho para delivery
      if (order.type === 'DELIVERY') {
        await tx.delivery.upsert({
          where: { orderId },
          create: { orderId, status: 'READY' },
          update: { status: 'READY' },
        });
        const deliveryData = {
          orderId,
          orderNumber: order.orderNumber,
          reference: order.reference,
          message: `Pedido #${order.orderNumber} pronto! Aguardando motoboy.`,
        };
        emitToStore(actor.tenantId, order.storeId, 'delivery:ready', deliveryData);
        emitToDeliverers(actor.tenantId, order.storeId, 'delivery:ready', deliveryData);
      }

      const updated = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { modifiers: true } } },
      });

      emitToStore(actor.tenantId, order.storeId, 'order:updated', updated);
      emitToStore(actor.tenantId, order.storeId, 'order:ready', {
        orderId,
        orderNumber: order.orderNumber,
        reference: order.reference,
        type: order.type,
      });

      return updated;
    });
  },

  /**
   * Fechar conta com pagamento (pode ser múltiplos pagamentos - conta dividida)
   */
  async closeOrder(actor: Actor, input: PaymentInput) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: input.orderId, tenantId: actor.tenantId },
        include: { items: true },
      });
      if (!order) throw new NotFoundError('Pedido');
      if (order.status === 'CLOSED') throw new BusinessRuleError('Pedido já foi fechado');
      if (order.status === 'CANCELLED') throw new BusinessRuleError('Pedido foi cancelado');

      const totalPayments = input.payments.reduce((sum, p) => sum + p.amount, 0);
      const orderTotal = Number(order.total);

      // Tolerância de 1 centavo por causa de arredondamento
      if (Math.abs(totalPayments - orderTotal) > 0.01 && totalPayments < orderTotal) {
        throw new BusinessRuleError(
          `Valor pago (R$ ${totalPayments.toFixed(2)}) menor que o total (R$ ${orderTotal.toFixed(2)})`
        );
      }

      // Criar os pagamentos
      for (const p of input.payments) {
        const change = p.method === 'CASH' && p.received
          ? Math.max(0, p.received - p.amount)
          : 0;

        await tx.payment.create({
          data: {
            orderId: order.id,
            method: p.method,
            amount: p.amount,
            received: p.received,
            change,
            transactionId: p.transactionId,
            authCode: p.authCode,
            cardBrand: p.cardBrand,
            installments: p.installments ?? 1,
            processedBy: actor.id,
          },
        });
      }

      // Fechar pedido
      const closed = await tx.order.update({
        where: { id: order.id },
        data: { status: 'CLOSED', closedAt: new Date() },
        include: {
          items: { include: { modifiers: true } },
          payments: true,
          customer: true,
          address: true,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'CLOSED',
          changedBy: actor.id,
        },
      });

      // Post-commit: atualiza stats do cliente em background (não bloqueia o fechamento)
      const customerIdToUpdate = order.customerId;
      const closedOrderTotal = Number(order.total);
      setImmediate(() => {
        if (customerIdToUpdate) {
          prisma.customer.update({
            where: { id: customerIdToUpdate },
            data: {
              totalOrders: { increment: 1 },
              totalSpent: { increment: closedOrderTotal },
              lastOrderAt: new Date(),
            },
          }).catch((err) => {
            console.error('[OrderService] Falha ao atualizar stats do cliente:', err.message);
          });
        }
      });

      // Se for delivery, criar registro de entrega
      if (order.type === 'DELIVERY') {
        await tx.delivery.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            status: 'WAITING',
          },
          update: {},
        });
      }

      emitToStore(actor.tenantId, order.storeId, 'order:closed', closed);
      return closed;
    });
  },

  /**
   * Cancelar pedido (com motivo, registrado em audit)
   */
  async cancelOrder(actor: Actor, orderId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId: actor.tenantId },
        include: { items: { include: { product: true } } },
      });
      if (!order) throw new NotFoundError('Pedido');
      if (order.status === 'CLOSED') throw new BusinessRuleError('Pedido já fechado não pode ser cancelado');
      if (order.status === 'CANCELLED') throw new BusinessRuleError('Pedido já está cancelado');

      // Devolver estoque dos itens
      for (const item of order.items) {
        if (item.product.trackStock && item.status !== 'CANCELLED') {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledReason: reason,
          cancelledById: actor.id,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          changedBy: actor.id,
          notes: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.id,
          action: 'ORDER_CANCELLED',
          entityType: 'Order',
          entityId: order.id,
          newValue: { reason, total: order.total },
        },
      });

      emitToStore(actor.tenantId, order.storeId, 'order:cancelled', { id: order.id, reason });
      return { ok: true };
    });
  },
};
