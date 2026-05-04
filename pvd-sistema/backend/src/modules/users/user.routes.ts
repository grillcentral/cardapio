import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authService } from '../auth/auth.service';
import { withTenant } from '../../plugins/tenant';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';

const userRoleSchema = z.enum([
  'OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DELIVERER',
]);

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: userRoleSchema,
  storeId: z.string().optional(),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true });

const routes: FastifyPluginAsync = async (app) => {

  // Todas as rotas aqui precisam de autenticação + tenant
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ─────────── GET /users ───────────
  app.get('/', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request) => {
    const users = await prisma.user.findMany({
      where: withTenant(request.user, { deletedAt: null }),
      select: {
        id: true, name: true, email: true, role: true, storeId: true,
        isActive: true, lastLoginAt: true, createdAt: true,
        store: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { users };
  });

  // ─────────── POST /users ───────────
  app.post('/', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);

    // Limite por plano
    const tenantId = request.user!.tenantId!;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const activeUsers = await prisma.user.count({
      where: { tenantId, deletedAt: null, isActive: true },
    });
    if (tenant && activeUsers >= tenant.maxUsers) {
      throw new BusinessRuleError(
        `Limite de ${tenant.maxUsers} usuários atingido no plano ${tenant.plan}. Faça upgrade.`
      );
    }

    // Nota: PIN é hasheado, não é possível verificar unicidade diretamente.
    // A unicidade é garantida por orientação operacional (PIN por pessoa).

    const hashedPwd = await authService.hashPassword(body.password);
    // PIN deve ser hasheado — nunca armazenar texto puro
    const hashedPin = body.pin ? await authService.hashPassword(body.pin) : undefined;

    const user = await prisma.user.create({
      data: {
        tenantId,
        storeId: body.storeId,
        name: body.name,
        email: body.email,
        password: hashedPwd,
        role: body.role,
        pin: hashedPin,
      },
      select: {
        id: true, name: true, email: true, role: true, storeId: true, isActive: true, createdAt: true,
      },
    });

    return reply.status(201).send({ user });
  });

  // ─────────── PATCH /users/:id ───────────
  app.patch<{ Params: { id: string } }>('/:id', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request) => {
    const body = updateUserSchema.parse(request.body);

    const target = await prisma.user.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Usuário');

    const { pin: rawPin, ...restBody } = body;
    const updateData: any = { ...restBody };
    if (rawPin !== undefined) {
      // Re-hash PIN na atualização
      updateData.pin = rawPin ? await authService.hashPassword(rawPin) : null;
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: updateData,
      select: {
        id: true, name: true, email: true, role: true, storeId: true, isActive: true,
      },
    });

    return { user };
  });

  // ─────────── PATCH /users/:id/password ───────────
  app.patch<{ Params: { id: string } }>('/:id/password', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const { password } = z.object({ password: z.string().min(6) }).parse(request.body);

    const target = await prisma.user.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Usuário');

    const hashedPwd = await authService.hashPassword(password);
    await prisma.user.update({ where: { id: target.id }, data: { password: hashedPwd } });

    return reply.status(204).send();
  });

  // ─────────── DELETE /users/:id (soft delete) ───────────
  app.delete<{ Params: { id: string } }>('/:id', {
    onRequest: [app.requireRole('OWNER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const target = await prisma.user.findFirst({
      where: withTenant(request.user, { id: request.params.id, deletedAt: null }),
    });
    if (!target) throw new NotFoundError('Usuário');

    if (target.id === request.user!.id) {
      throw new BusinessRuleError('Você não pode excluir sua própria conta');
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return reply.status(204).send();
  });
};

export default routes;
