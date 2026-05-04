import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';
import { NotFoundError } from '../../lib/errors';

const customerSchema = z.object({
  storeId: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  cpf: z.string().optional(),
  birthday: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const addressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(1),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  reference: z.string().optional(),
  isDefault: z.boolean().optional(),
  deliveryFee: z.number().nonnegative().optional(),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ─────── GET /customers — lista com busca ───────
  app.get<{ Querystring: { storeId?: string; search?: string; phone?: string } }>('/', async (request) => {
    const { storeId, search, phone } = request.query;
    const customers = await prisma.customer.findMany({
      where: withTenant(request.user, {
        deletedAt: null,
        ...(storeId ? { storeId } : {}),
        ...(phone ? { phone: { contains: phone } } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        } : {}),
      }),
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
        _count: { select: { orders: true } },
      },
      orderBy: { lastOrderAt: 'desc' },
      take: 50,
    });
    return { customers };
  });

  // ─────── GET /customers/search-phone/:phone — busca rápida para delivery ───────
  app.get<{ Params: { phone: string } }>('/search-phone/:phone', async (request) => {
    const cleanPhone = request.params.phone.replace(/\D/g, '');
    const customer = await prisma.customer.findFirst({
      where: withTenant(request.user, {
        deletedAt: null,
        phone: { contains: cleanPhone },
      }),
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
      },
    });
    return { customer };
  });

  // ─────── POST /customers ───────
  app.post('/', async (request, reply) => {
    const body = customerSchema.parse(request.body);
    const customer = await prisma.customer.create({
      data: {
        tenantId: request.user!.tenantId!,
        storeId: body.storeId,
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        cpf: body.cpf,
        birthday: body.birthday ? new Date(body.birthday) : null,
        notes: body.notes,
      },
    });
    return reply.status(201).send({ customer });
  });

  // ─────── PATCH /customers/:id ───────
  app.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const body = customerSchema.partial().parse(request.body);
    const target = await prisma.customer.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Cliente');

    const customer = await prisma.customer.update({
      where: { id: target.id },
      data: {
        ...body,
        birthday: body.birthday ? new Date(body.birthday) : undefined,
        email: body.email === '' ? null : body.email,
      },
    });
    return { customer };
  });

  // ─────── POST /customers/:id/addresses ───────
  app.post<{ Params: { id: string } }>('/:id/addresses', async (request, reply) => {
    const body = addressSchema.parse(request.body);
    const customer = await prisma.customer.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!customer) throw new NotFoundError('Cliente');

    // Se é default, desmarcar outros
    if (body.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.customerAddress.create({
      data: { ...body, customerId: customer.id },
    });
    return reply.status(201).send({ address });
  });

  // ─────── DELETE /customers/:id ───────
  app.delete<{ Params: { id: string } }>('/:id', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const target = await prisma.customer.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Cliente');

    await prisma.customer.update({
      where: { id: target.id },
      data: { deletedAt: new Date() },
    });
    return reply.status(204).send();
  });
};

export default routes;
