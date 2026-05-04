import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authService } from '../auth/auth.service';
import { NotFoundError } from '../../lib/errors';

const createTenantSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífen'),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  cnpj: z.string().optional(),
  plan: z.enum(['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE']).default('TRIAL'),
  owner: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  }),
  store: z.object({
    name: z.string().min(2),
    address: z.string().optional(),
  }),
});

const routes: FastifyPluginAsync = async (app) => {

  // ─────────── POST /tenants — cria novo tenant (onboarding) ───────────
  app.post('/', {
    onRequest: [app.authenticate, app.requireRole('SUPER_ADMIN')],
  }, async (request, reply) => {
    const body = createTenantSchema.parse(request.body);

    // Tudo em transação: tenant + store + owner user
    const result = await prisma.$transaction(async (tx) => {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      const tenant = await tx.tenant.create({
        data: {
          slug: body.slug,
          name: body.name,
          email: body.email,
          phone: body.phone,
          cnpj: body.cnpj,
          plan: body.plan,
          planExpiresAt: body.plan === 'TRIAL' ? trialEnd : null,
        },
      });

      const store = await tx.store.create({
        data: {
          tenantId: tenant.id,
          name: body.store.name,
          address: body.store.address,
        },
      });

      const hashedPwd = await authService.hashPassword(body.owner.password);
      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          name: body.owner.name,
          email: body.owner.email,
          password: hashedPwd,
          role: 'OWNER',
        },
      });

      return { tenant, store, owner };
    });

    return reply.status(201).send({
      tenant: result.tenant,
      store: result.store,
      owner: { id: result.owner.id, email: result.owner.email, name: result.owner.name },
    });
  });

  // ─────────── GET /tenants — lista tenants (SUPER_ADMIN) ───────────
  app.get('/', {
    onRequest: [app.authenticate, app.requireRole('SUPER_ADMIN')],
  }, async (request) => {
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { stores: true, users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { tenants };
  });

  // ─────────── GET /tenants/me — dados do tenant atual ───────────
  app.get('/me', {
    onRequest: [app.authenticate, app.requireTenant],
  }, async (request) => {
    if (!request.user?.tenantId) throw new NotFoundError('Tenant');

    const tenant = await prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      include: { stores: true },
    });
    return { tenant };
  });

  // ─────────── PATCH /tenants/:id/plan — atualizar plano ───────────
  app.patch<{ Params: { id: string } }>('/:id/plan', {
    onRequest: [app.authenticate, app.requireRole('SUPER_ADMIN')],
  }, async (request) => {
    const schema = z.object({
      plan: z.enum(['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE']),
      planExpiresAt: z.string().datetime().optional(),
    });
    const body = schema.parse(request.body);

    const tenant = await prisma.tenant.update({
      where: { id: request.params.id },
      data: {
        plan: body.plan,
        planExpiresAt: body.planExpiresAt ? new Date(body.planExpiresAt) : null,
      },
    });
    return { tenant };
  });

  // ─────────── POST /tenants/:id/suspend ───────────
  app.post<{ Params: { id: string } }>('/:id/suspend', {
    onRequest: [app.authenticate, app.requireRole('SUPER_ADMIN')],
  }, async (request) => {
    const tenant = await prisma.tenant.update({
      where: { id: request.params.id },
      data: { status: 'SUSPENDED' },
    });
    return { tenant };
  });
};

export default routes;
