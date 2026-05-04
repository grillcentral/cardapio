import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../lib/errors';

// Declara o tipo do usuário autenticado no @fastify/jwt (forma correta no v10)
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string;
      tenantId: string | null;
      storeId: string | null;
      role: string;
      email: string;
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  // Middleware: exige token JWT válido
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any; // JWT payload bruto (tem 'sub' ao invés de 'id')
      // Normaliza para o tipo padrão da app
      request.user = {
        id: payload.sub,
        tenantId: payload.tenantId ?? null,
        storeId: payload.storeId ?? null,
        role: payload.role,
        email: payload.email,
      };
    } catch {
      throw new UnauthorizedError('Token inválido ou expirado');
    }
  });

  // Middleware fábrica: exige role específica
  app.decorate('requireRole', (...roles: string[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user) throw new UnauthorizedError();
      if (!roles.includes(request.user.role)) {
        throw new ForbiddenError(`Ação permitida apenas para: ${roles.join(', ')}`);
      }
    };
  });
});
