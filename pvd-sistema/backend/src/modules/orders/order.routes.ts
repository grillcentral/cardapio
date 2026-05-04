import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';
import { NotFoundError, BusinessRuleError } from '../../lib/errors';
import { orderService } from './order.service';

const createOrderSchema = z.object({
  storeId: z.string(),
  type: z.enum(['TABLE', 'COUNTER', 'DELIVERY', 'TAKEOUT']),
  reference: z.string().optional(),
  customerId: z.string().optional(),
  addressId: z.string().optional(),
  notes: z.string().optional(),
});

const addItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
  modifierIds: z.array(z.string()).optional(),
});

const paymentSchema = z.object({
  payments: z.array(z.object({
    method: z.enum(['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'MEAL_VOUCHER', 'STORE_CREDIT', 'IFOOD_ONLINE', 'OTHER']),
    amount: z.number().positive(),
    received: z.number().positive().optional(),
    transactionId: z.string().optional(),
    authCode: z.string().optional(),
    cardBrand: z.string().optional(),
    installments: z.number().int().positive().optional(),
  })).min(1),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ─────── GET /orders — lista (com filtros) ───────
  app.get<{ Querystring: { storeId?: string; status?: string; type?: string; date?: string } }>('/', async (request) => {
    const { storeId, status, type, date } = request.query;

    const where = withTenant(request.user, {
      ...(storeId ? { storeId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(type ? { type: type as any } : {}),
      ...(date ? { businessDate: new Date(date) } : { businessDate: orderService.getBusinessDate() }),
    });

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { modifiers: true } },
        payments: true,
        customer: { select: { id: true, name: true, phone: true } },
        address: true,
        delivery: true,
      },
      orderBy: { orderNumber: 'desc' },
    });
    return { orders };
  });

  // ─────── GET /orders/open — apenas comandas abertas ───────
  app.get<{ Querystring: { storeId: string } }>('/open', async (request) => {
    const { storeId } = request.query;
    const orders = await prisma.order.findMany({
      where: withTenant(request.user, {
        storeId,
        status: { in: ['OPEN', 'SENT_KITCHEN', 'PREPARING', 'READY'] },
      }),
      include: {
        items: { include: { modifiers: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { openedAt: 'asc' },
    });
    return { orders };
  });

  // ─────── GET /orders/:id ───────
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const order = await prisma.order.findFirst({
      where: withTenant(request.user, { id: request.params.id }),
      include: {
        items: { include: { modifiers: true, product: true } },
        payments: true,
        customer: true,
        address: true,
        delivery: { include: { deliverer: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundError('Pedido');
    return { order };
  });

  // ─────── POST /orders — criar comanda vazia ───────
  app.post('/', async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    const order = await orderService.create(
      { id: request.user!.id, tenantId: request.user!.tenantId! },
      body
    );
    return reply.status(201).send({ order });
  });

  // ─────── POST /orders/:id/items — adicionar item ───────
  app.post<{ Params: { id: string } }>('/:id/items', async (request) => {
    const body = addItemSchema.parse(request.body);
    const order = await orderService.addItem(
      { id: request.user!.id, tenantId: request.user!.tenantId! },
      { ...body, orderId: request.params.id }
    );
    return { order };
  });

  // ─────── PATCH /orders/:id/items/:itemId — atualizar obs do item ───────
  app.patch<{ Params: { id: string; itemId: string } }>('/:id/items/:itemId', async (request) => {
    const { notes } = z.object({ notes: z.string().max(200) }).parse(request.body);

    const order = await prisma.order.findFirst({
      where: withTenant(request.user, { id: request.params.id }),
    });
    if (!order) throw new NotFoundError('Pedido');

    const item = await prisma.orderItem.findFirst({
      where: { id: request.params.itemId, orderId: order.id },
    });
    if (!item) throw new NotFoundError('Item');
    if (!['PENDING', 'SENT'].includes(item.status)) {
      throw new BusinessRuleError('Não é possível editar observação de item já em preparo');
    }

    const updated = await prisma.orderItem.update({
      where: { id: item.id },
      data: { notes },
    });
    return { item: updated };
  });

  // ─────── DELETE /orders/:id/items/:itemId ───────
  app.delete<{ Params: { id: string; itemId: string } }>('/:id/items/:itemId', async (request, reply) => {
    const order = await orderService.removeItem(
      { id: request.user!.id, tenantId: request.user!.tenantId! },
      request.params.id,
      request.params.itemId
    );
    return reply.send({ order });
  });

  // ─────── POST /orders/:id/send-to-kitchen ───────
  app.post<{ Params: { id: string } }>('/:id/send-to-kitchen', async (request) => {
    const order = await orderService.sendToKitchen(
      { id: request.user!.id, tenantId: request.user!.tenantId! },
      request.params.id
    );
    return { order };
  });

  // ─────── POST /orders/:id/items/:itemId/ready — cozinha marca item pronto ───────
  app.post<{ Params: { id: string; itemId: string } }>('/:id/items/:itemId/ready', {
    onRequest: [app.requireRole('KITCHEN', 'MANAGER', 'OWNER', 'SUPER_ADMIN')],
  }, async (request) => {
    const order = await orderService.markItemReady(
      { id: request.user!.id, tenantId: request.user!.tenantId! },
      request.params.id,
      request.params.itemId
    );
    return { order };
  });

  // ─────── POST /orders/:id/mark-all-ready — cozinha marca TODOS os itens prontos ───────
  app.post<{ Params: { id: string } }>('/:id/mark-all-ready', {
    onRequest: [app.requireRole('KITCHEN', 'MANAGER', 'OWNER', 'SUPER_ADMIN')],
  }, async (request) => {
    const order = await orderService.markAllItemsReady(
      { id: request.user!.id, tenantId: request.user!.tenantId! },
      request.params.id
    );
    return { order };
  });

  // ─────── POST /orders/:id/close — fechar conta ───────
  app.post<{ Params: { id: string } }>('/:id/close', async (request) => {
    const body = paymentSchema.parse(request.body);
    const order = await orderService.closeOrder(
      { id: request.user!.id, tenantId: request.user!.tenantId! },
      { orderId: request.params.id, payments: body.payments }
    );
    return { order };
  });

  // ─────── POST /orders/:id/discount — aplicar desconto ───────
  app.post<{ Params: { id: string } }>('/:id/discount', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'CASHIER', 'SUPER_ADMIN')],
  }, async (request) => {
    const { type, value, reason, couponId } = z.object({
      type: z.enum(['PERCENTAGE', 'FIXED']),
      value: z.number().positive(),
      reason: z.string().optional(),
      couponId: z.string().optional(), // quando aplicado via cupom
    }).parse(request.body);

    const order = await prisma.order.findFirst({
      where: withTenant(request.user, { id: request.params.id }),
      include: { items: true },
    });
    if (!order) throw new NotFoundError('Pedido');
    if (order.status === 'CLOSED' || order.status === 'CANCELLED') {
      throw new BusinessRuleError('Não é possível aplicar desconto neste pedido');
    }

    const subtotal = Number(order.subtotal);
    const discount = type === 'PERCENTAGE'
      ? Math.min(subtotal, (subtotal * value) / 100)
      : Math.min(subtotal, value);

    const total = Math.max(0, subtotal - discount + Number(order.serviceFee) + Number(order.deliveryFee));

    const updated = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: order.id },
        data: {
          discount: parseFloat(discount.toFixed(2)),
          discountReason: reason,
          total: parseFloat(total.toFixed(2)),
        },
        include: { items: { include: { modifiers: true } }, payments: true, customer: true },
      });

      // Incrementa usedCount do cupom atomicamente (evita race condition de cupom esgotado)
      if (couponId) {
        const coupon = await tx.couponCode.findFirst({
          where: {
            id: couponId,
            tenantId: request.user!.tenantId!,
            isActive: true,
          },
        });
        if (coupon) {
          // Verifica limite DENTRO da transação para garantir consistência
          if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
            throw new BusinessRuleError('Cupom atingiu o limite de usos');
          }
          await tx.couponCode.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      return ord;
    });

    return { order: updated };
  });

  // ─────── POST /orders/:id/cancel ───────
  app.post<{ Params: { id: string } }>('/:id/cancel', {
    onRequest: [app.requireRole('MANAGER', 'OWNER', 'SUPER_ADMIN')],
  }, async (request) => {
    const { reason } = z.object({ reason: z.string().min(3) }).parse(request.body);
    await orderService.cancelOrder(
      { id: request.user!.id, tenantId: request.user!.tenantId! },
      request.params.id,
      reason
    );
    return { ok: true };
  });
};

export default routes;
