import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';
import { NotFoundError } from '../../lib/errors';

const categorySchema = z.object({
  storeId: z.string(),
  name: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  displayOrder: z.number().int().optional(),
  kitchenStation: z.string().optional(),
  isActive: z.boolean().optional(),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ─────── GET /categories?storeId=xxx ───────
  app.get<{ Querystring: { storeId?: string } }>('/', async (request) => {
    const where = withTenant(request.user, {
      deletedAt: null,
      ...(request.query.storeId ? { storeId: request.query.storeId } : {}),
    });
    const categories = await prisma.category.findMany({
      where,
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return { categories };
  });

  // ─────── POST /categories ───────
  app.post('/', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const body = categorySchema.parse(request.body);
    const category = await prisma.category.create({
      data: { ...body, tenantId: request.user!.tenantId! },
    });
    return reply.status(201).send({ category });
  });

  // ─────── PATCH /categories/:id ───────
  app.patch<{ Params: { id: string } }>('/:id', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request) => {
    const body = categorySchema.partial().parse(request.body);
    const target = await prisma.category.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Categoria');

    const category = await prisma.category.update({
      where: { id: target.id },
      data: body,
    });
    return { category };
  });

  // ─────── DELETE /categories/:id ───────
  app.delete<{ Params: { id: string } }>('/:id', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const target = await prisma.category.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Categoria');

    await prisma.category.update({
      where: { id: target.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return reply.status(204).send();
  });
};

export default routes;
