import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';
import { NotFoundError, BusinessRuleError } from '../../lib/errors';
import { emitToStore, emitToDeliverers } from '../../lib/socket';
import { orderService } from '../orders/order.service';

const delivererSchema = z.object({
  storeId: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  document: z.string().optional(),
  vehicle: z.string().optional(),
  plate: z.string().optional(),
  commissionType: z.enum(['FIXED', 'PERCENTAGE', 'PER_KM']).optional(),
  commissionValue: z.number().nonnegative().optional(),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ═══════════ ENTREGADORES ═══════════

  app.get<{ Querystring: { storeId?: string } }>('/deliverers', async (request) => {
    const deliverers = await prisma.deliverer.findMany({
      where: withTenant(request.user, {
        deletedAt: null,
        ...(request.query.storeId ? { storeId: request.query.storeId } : {}),
      }),
      orderBy: { name: 'asc' },
    });
    return { deliverers };
  });

  app.post('/deliverers', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const body = delivererSchema.parse(request.body);
    const deliverer = await prisma.deliverer.create({
      data: { ...body, tenantId: request.user!.tenantId! },
    });
    return reply.status(201).send({ deliverer });
  });

  app.patch<{ Params: { id: string } }>('/deliverers/:id', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request) => {
    const body = delivererSchema.partial().parse(request.body);
    const target = await prisma.deliverer.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Entregador');

    const deliverer = await prisma.deliverer.update({
      where: { id: target.id },
      data: body,
    });
    return { deliverer };
  });

  // ═══════════ ENTREGAS (deliveries) ═══════════

  app.get<{ Querystring: { storeId?: string; status?: string; date?: string } }>('/', async (request) => {
    const { storeId, status, date } = request.query;
    const businessDate = date ? new Date(date) : orderService.getBusinessDate();

    // Para DELIVERER sem loja fixa: mostra todas as entregas ativas do tenant
    const isDeliverer = request.user?.role === 'DELIVERER';
    const orderFilter = withTenant(request.user, {
      ...(storeId ? { storeId } : {}),
      businessDate,
    });

    // Deliverers sem loja vêem apenas statuses ativos (não entregue/retornado)
    const statusFilter = status
      ? { status: status as any }
      : isDeliverer && !storeId
      ? { status: { in: ['WAITING', 'READY', 'DISPATCHED'] as any[] } }
      : {};

    const deliveries = await prisma.delivery.findMany({
      where: {
        ...statusFilter,
        order: orderFilter,
      },
      include: {
        order: {
          include: {
            items: { include: { modifiers: true } },
            payments: true,
            customer: true,
            address: true,
          },
        },
        deliverer: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return { deliveries };
  });

  // Atribuir entregador
  app.post<{ Params: { id: string } }>('/:id/assign', async (request) => {
    const { delivererId } = z.object({ delivererId: z.string() }).parse(request.body);

    const delivery = await prisma.delivery.findFirst({
      where: { id: request.params.id, order: withTenant(request.user, {}) },
      include: { order: true },
    });
    if (!delivery) throw new NotFoundError('Entrega');

    const deliverer = await prisma.deliverer.findFirst({
      where: withTenant(request.user, { id: delivererId, isActive: true, deletedAt: null }),
    });
    if (!deliverer) throw new NotFoundError('Entregador');

    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data: { delivererId },
      include: { order: true, deliverer: true },
    });

    const tenantId = request.user!.tenantId!;
    emitToStore(tenantId, delivery.order.storeId, 'delivery:assigned', updated);
    emitToDeliverers(tenantId, delivery.order.storeId, 'delivery:assigned', updated);
    return { delivery: updated };
  });

  // Atualizar status
  app.post<{ Params: { id: string } }>('/:id/status', async (request) => {
    const { status } = z.object({
      status: z.enum(['WAITING', 'READY', 'DISPATCHED', 'DELIVERED', 'RETURNED']),
    }).parse(request.body);

    const delivery = await prisma.delivery.findFirst({
      where: { id: request.params.id, order: withTenant(request.user, {}) },
      include: { order: true },
    });
    if (!delivery) throw new NotFoundError('Entrega');

    // Regras de transição
    const validTransitions: Record<string, string[]> = {
      WAITING: ['READY', 'RETURNED'],
      READY: ['DISPATCHED', 'WAITING'],
      DISPATCHED: ['DELIVERED', 'RETURNED'],
      DELIVERED: [],
      RETURNED: ['WAITING'],
    };
    if (!validTransitions[delivery.status]?.includes(status)) {
      throw new BusinessRuleError(`Transição inválida: ${delivery.status} → ${status}`);
    }

    const now = new Date();
    const updateData: any = { status };
    if (status === 'DISPATCHED') updateData.dispatchedAt = now;
    if (status === 'DELIVERED') {
      updateData.deliveredAt = now;
      if (delivery.dispatchedAt) {
        updateData.actualMinutes = Math.round((now.getTime() - delivery.dispatchedAt.getTime()) / 60000);
      }
    }
    if (status === 'RETURNED') updateData.returnedAt = now;

    // Sincronizar com order
    if (status === 'DISPATCHED') {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: 'DELIVERING' },
      });
    }
    if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: 'DELIVERED' },
      });
    }

    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data: updateData,
      include: { order: { include: { customer: true, address: true } }, deliverer: true },
    });

    const tid = request.user!.tenantId!;
    emitToStore(tid, delivery.order.storeId, 'delivery:status-changed', updated);
    emitToDeliverers(tid, delivery.order.storeId, 'delivery:status-changed', updated);
    return { delivery: updated };
  });
};

export default routes;
