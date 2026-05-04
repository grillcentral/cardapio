import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authService } from './auth.service';

const loginSchema = z.object({
  tenantSlug: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(4),
});

const pinSchema = z.object({
  tenantSlug: z.string(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN deve ter 4 a 6 dígitos'),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const authRoutes: FastifyPluginAsync = async (app) => {

  // ─────────── POST /auth/login ───────────
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const { user, refreshToken } = await authService.login({
      ...body,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });

    const accessToken = app.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      storeId: user.storeId,
      role: user.role,
      email: user.email,
    });

    return reply.send({ user, accessToken, refreshToken });
  });

  // ─────────── POST /auth/login-pin ───────────
  app.post('/login-pin', async (request, reply) => {
    const body = pinSchema.parse(request.body);

    const { user, refreshToken } = await authService.loginByPin({
      ...body,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });

    const accessToken = app.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      storeId: user.storeId,
      role: user.role,
      email: user.email,
    });

    return reply.send({ user, accessToken, refreshToken });
  });

  // ─────────── POST /auth/refresh ───────────
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const { user, refreshToken: newRefresh } = await authService.refresh(refreshToken);

    const accessToken = app.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      storeId: user.storeId,
      role: user.role,
      email: user.email,
    });

    return reply.send({ user, accessToken, refreshToken: newRefresh });
  });

  // ─────────── POST /auth/logout ───────────
  app.post('/logout', async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    await authService.logout(refreshToken);
    return reply.send({ ok: true });
  });

  // ─────────── GET /auth/me ───────────
  app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
    return { user: request.user };
  });
};

export default authRoutes;
