import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';
import { NotFoundError } from '../../lib/errors';
import { emitToStore } from '../../lib/socket';

const productSchema = z.object({
  storeId: z.string(),
  categoryId: z.string(),
  sku: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  cost: z.number().nonnegative().optional(),
  imageUrl: z.string().url().optional(),
  trackStock: z.boolean().optional(),
  stock: z.number().int().nonnegative().optional(),
  minStock: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  availableInDelivery: z.boolean().optional(),
  availableInStore: z.boolean().optional(),
  prepTimeMinutes: z.number().int().positive().optional(),
  displayOrder: z.number().int().optional(),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ─────── GET /products ───────
  app.get<{ Querystring: { storeId?: string; categoryId?: string; search?: string; activeOnly?: string } }>('/', async (request) => {
    const { storeId, categoryId, search, activeOnly } = request.query;

    const where = withTenant(request.user, {
      deletedAt: null,
      ...(storeId ? { storeId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(activeOnly === 'true' ? { isActive: true } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    });

    const products = await prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return { products };
  });

  // ─────── GET /products/:id ───────
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const product = await prisma.product.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
      include: {
        category: true,
        modifierGroups: { include: { group: { include: { modifiers: true } } } },
      },
    });
    if (!product) throw new NotFoundError('Produto');
    return { product };
  });

  // ─────── POST /products ───────
  app.post('/', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const body = productSchema.parse(request.body);
    const product = await prisma.product.create({
      data: { ...body, tenantId: request.user!.tenantId! },
      include: { category: true },
    });

    // Emitir evento realtime para outros dispositivos da loja
    emitToStore(product.tenantId, product.storeId, 'product:created', product);

    return reply.status(201).send({ product });
  });

  // ─────── PATCH /products/:id ───────
  app.patch<{ Params: { id: string } }>('/:id', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request) => {
    const body = productSchema.partial().parse(request.body);

    const target = await prisma.product.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Produto');

    // Se o preço mudou, registrar histórico
    const priceChanged = body.price !== undefined && Number(body.price) !== Number(target.price);

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: target.id },
        data: body,
        include: { category: true },
      });

      if (priceChanged) {
        await tx.productPriceHistory.create({
          data: {
            productId: target.id,
            price: body.price!,
            changedBy: request.user!.id,
          },
        });
      }

      return updated;
    });

    emitToStore(product.tenantId, product.storeId, 'product:updated', product);
    return { product };
  });

  // ─────── POST /products/:id/stock-adjust ───────
  app.post<{ Params: { id: string } }>('/:id/stock-adjust', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'CASHIER', 'SUPER_ADMIN')],
  }, async (request) => {
    const { delta, reason } = z.object({
      delta: z.number().int(),
      reason: z.string().optional(),
    }).parse(request.body);

    const target = await prisma.product.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Produto');

    const product = await prisma.product.update({
      where: { id: target.id },
      data: { stock: { increment: delta } },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: target.tenantId,
        userId: request.user!.id,
        action: 'STOCK_ADJUSTED',
        entityType: 'Product',
        entityId: target.id,
        oldValue: { stock: target.stock },
        newValue: { stock: product.stock, delta, reason },
      },
    });

    emitToStore(product.tenantId, product.storeId, 'product:stock-updated', {
      productId: product.id, stock: product.stock,
    });

    // Alertar se atingiu estoque mínimo
    if (product.trackStock && product.stock <= product.minStock) {
      emitToStore(product.tenantId, product.storeId, 'product:stock-low', {
        productId: product.id, name: product.name, stock: product.stock,
      });
    }

    return { product };
  });

  // ─────── DELETE /products/:id ───────
  app.delete<{ Params: { id: string } }>('/:id', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const target = await prisma.product.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Produto');

    await prisma.product.update({
      where: { id: target.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    emitToStore(target.tenantId, target.storeId, 'product:deleted', { id: target.id });
    return reply.status(204).send();
  });
};

export default routes;
