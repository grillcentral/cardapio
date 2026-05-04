import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../lib/errors';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Garante que o usuário está em um tenant.
     * Super admins passam direto, outros precisam ter tenantId.
     */
    requireTenant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  app.decorate('requireTenant', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) throw new ForbiddenError('Não autenticado');

    // Super admin não precisa de tenant (opera no meta-nível)
    if (request.user.role === 'SUPER_ADMIN') return;

    if (!request.user.tenantId) {
      throw new ForbiddenError('Usuário sem tenant vinculado');
    }
  });
});

/**
 * Helper: adiciona filtro de tenant em qualquer query Prisma
 * Uso: const where = withTenant(request.user, { someFilter: ... });
 */
export function withTenant(
  user: { tenantId: string | null; role: string } | undefined,
  extra: Record<string, any> = {}
) {
  if (!user) throw new ForbiddenError();
  if (user.role === 'SUPER_ADMIN') return extra; // super admin vê tudo
  return { tenantId: user.tenantId, ...extra };
}
