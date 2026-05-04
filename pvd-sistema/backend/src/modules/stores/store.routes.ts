import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';
import { NotFoundError, BusinessRuleError } from '../../lib/errors';

const createStoreSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
  taxFee: z.number().min(0).max(100).default(0),
  serviceFee: z.number().min(0).default(0),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ─── GET /stores ─── lista lojas do tenant
  app.get('/', async (request) => {
    const stores = await prisma.store.findMany({
      where: { tenantId: request.user!.tenantId!, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return { stores };
  });

  // ─── POST /stores ─── criar nova loja
  app.post('/', {
    onRequest: [app.requireRole('OWNER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const body = createStoreSchema.parse(request.body);
    const tenantId = request.user!.tenantId!;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const storeCount = await prisma.store.count({ where: { tenantId, deletedAt: null } });
    if (tenant && storeCount >= tenant.maxStores) {
      throw new BusinessRuleError(`Limite de ${tenant.maxStores} lojas no plano atual.`);
    }

    const store = await prisma.store.create({
      data: { tenantId, ...body },
    });
    return reply.status(201).send({ store });
  });

  // ─── PATCH /stores/:id ───
  app.patch<{ Params: { id: string } }>('/:id', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request) => {
    const body = createStoreSchema.partial().parse(request.body);
    const store = await prisma.store.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!store) throw new NotFoundError('Loja');
    const updated = await prisma.store.update({ where: { id: store.id }, data: body });
    return { store: updated };
  });
};

export default routes;
