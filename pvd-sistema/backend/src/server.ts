/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LANCHE PDV SaaS — Servidor Principal
 * ═══════════════════════════════════════════════════════════════════════════
 * Fastify + Socket.io + Prisma + Redis
 * Arquitetura modular, multi-tenant, escalável horizontalmente.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import Fastify from 'fastify';

// Prisma Decimal → number em todas as respostas JSON
(Prisma.Decimal.prototype as any).toJSON = function () {
  return parseFloat(this.toString());
};
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketServer } from 'socket.io';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { env } from './lib/env';

// Plugins
import authPlugin from './plugins/auth';
import tenantPlugin from './plugins/tenant';
import errorHandler from './plugins/errorHandler';

// Módulos (cada um registra suas rotas)
import authRoutes from './modules/auth/auth.routes';
import tenantRoutes from './modules/tenants/tenant.routes';
import userRoutes from './modules/users/user.routes';
import categoryRoutes from './modules/categories/category.routes';
import productRoutes from './modules/products/product.routes';
import orderRoutes from './modules/orders/order.routes';
import customerRoutes from './modules/customers/customer.routes';
import deliveryRoutes from './modules/deliveries/delivery.routes';
import reportRoutes from './modules/reports/report.routes';
import storeRoutes from './modules/stores/store.routes';
import couponRoutes from './modules/coupons/coupon.routes';
import cashSessionRoutes from './modules/cash-sessions/cash-session.routes';

// Realtime
import { registerSocketHandlers, setIO } from './lib/socket';

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
      } : undefined,
    },
    trustProxy: true,
  });

  // ─────── Segurança ───────
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: env.CORS_ORIGINS.split(',').map(s => s.trim()),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    redis: redis,
  });

  // ─────── JWT ───────
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  // ─────── Plugins internos ───────
  await app.register(errorHandler);
  await app.register(authPlugin);
  await app.register(tenantPlugin);

  // ─────── Health check ───────
  app.get('/health', async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const redisOk = await redis.ping().then(() => true).catch(() => false);
    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database: dbOk, redis: redisOk },
    };
  });

  // ─────── Registrar rotas ───────
  await app.register(authRoutes,     { prefix: '/api/v1/auth' });
  await app.register(tenantRoutes,   { prefix: '/api/v1/tenants' });
  await app.register(userRoutes,     { prefix: '/api/v1/users' });
  await app.register(categoryRoutes, { prefix: '/api/v1/categories' });
  await app.register(productRoutes,  { prefix: '/api/v1/products' });
  await app.register(orderRoutes,    { prefix: '/api/v1/orders' });
  await app.register(customerRoutes, { prefix: '/api/v1/customers' });
  await app.register(deliveryRoutes, { prefix: '/api/v1/deliveries' });
  await app.register(reportRoutes,   { prefix: '/api/v1/reports' });
  await app.register(storeRoutes,       { prefix: '/api/v1/stores' });
  await app.register(couponRoutes,      { prefix: '/api/v1/coupons' });
  await app.register(cashSessionRoutes, { prefix: '/api/v1/cash-sessions' });

  // ─────── Socket.io — ANTES do listen para evitar race condition ───────
  const io = new SocketServer(app.server, {
    cors: { origin: env.CORS_ORIGINS.split(',').map(s => s.trim()), credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  setIO(io);
  registerSocketHandlers(io);

  // ─────── Subir o servidor ───────
  try {
    await app.listen({ port: env.PORT, host: env.HOST });

    app.log.info(`🔌 Socket.io pronto`);
    app.log.info(`🚀 API rodando em http://${env.HOST}:${env.PORT}`);
    app.log.info(`📊 Health: http://${env.HOST}:${env.PORT}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} recebido, encerrando...`);
    await app.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
