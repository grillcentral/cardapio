import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Singleton pattern — evita criar conexões demais durante hot-reload
declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (env.NODE_ENV !== 'production') global.__prisma = prisma;
