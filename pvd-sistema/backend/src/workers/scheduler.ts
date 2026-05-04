/**
 * Scheduler de jobs em background.
 * Executa tarefas periódicas sem depender de cron externo.
 * Usa Redis para garantir que apenas UMA instância execute cada job
 * em ambientes com múltiplas réplicas (lock distribuído).
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const LOCK_TTL_MS = 50_000; // 50s — job deve terminar antes do TTL

// ─────────────────────────────────────────────────────────────────────────────
// Utilitário: distributed lock via Redis
// Evita que 2 instâncias rodem o mesmo job ao mesmo tempo
// ─────────────────────────────────────────────────────────────────────────────
async function withLock(lockName: string, fn: () => Promise<void>): Promise<void> {
  const key = `scheduler:lock:${lockName}`;
  const acquired = await redis.set(key, '1', 'PX', LOCK_TTL_MS, 'NX');
  if (!acquired) return; // outro processo já está rodando
  try {
    await fn();
  } finally {
    await redis.del(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 1: Expirar trials vencidos (roda a cada hora)
// ─────────────────────────────────────────────────────────────────────────────
async function expireTrials() {
  await withLock('expire-trials', async () => {
    const expired = await prisma.tenant.updateMany({
      where: {
        plan: 'TRIAL',
        status: 'ACTIVE',
        planExpiresAt: { lt: new Date() },
      },
      data: { status: 'TRIAL_EXPIRED' },
    });

    if (expired.count > 0) {
      console.log(`[Scheduler] ${expired.count} tenant(s) tiveram o trial expirado`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 2: Alertas de estoque baixo no Redis (roda a cada 30 min)
// Frontend pode polling ou SSE para esses alertas
// ─────────────────────────────────────────────────────────────────────────────
async function checkLowStock() {
  await withLock('check-low-stock', async () => {
    const products = await prisma.$queryRaw<Array<{
      tenantId: string; storeId: string; id: string; name: string; stock: number; minStock: number;
    }>>`
      SELECT "tenantId", "storeId", id, name, stock, "minStock"
      FROM products
      WHERE "deletedAt" IS NULL
        AND "trackStock" = true
        AND "isActive" = true
        AND stock <= "minStock"
        AND stock >= 0
    `;

    // Agrupa por tenant+store e salva no Redis (TTL 1h)
    const grouped: Record<string, typeof products> = {};
    for (const p of products) {
      const key = `${p.tenantId}:${p.storeId}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    }

    for (const [key, items] of Object.entries(grouped)) {
      await redis.setex(`low-stock:${key}`, 3600, JSON.stringify(items));
    }

    if (products.length > 0) {
      console.log(`[Scheduler] ${products.length} produto(s) com estoque baixo detectados`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 3: Fechar automaticamente sessões de caixa abertas há mais de 16h
// Evita sessões "fantasmas" que bloqueiam reabertura no dia seguinte
// ─────────────────────────────────────────────────────────────────────────────
async function cleanupStaleCashSessions() {
  await withLock('cleanup-cash-sessions', async () => {
    const threshold = new Date(Date.now() - 16 * 60 * 60 * 1000); // 16 horas atrás

    const stale = await prisma.cashSession.findMany({
      where: {
        closedAt: null,
        openedAt: { lt: threshold },
      },
      select: { id: true, storeId: true, tenantId: true },
    });

    for (const session of stale) {
      await prisma.cashSession.update({
        where: { id: session.id },
        data: {
          closedAt: new Date(),
          notes: '[Fechamento automático — sessão aberta há mais de 16h]',
        },
      });
    }

    if (stale.length > 0) {
      console.log(`[Scheduler] ${stale.length} sessão(ões) de caixa fechada(s) automaticamente`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 4: Limpar refresh tokens expirados (roda uma vez por dia)
// ─────────────────────────────────────────────────────────────────────────────
async function cleanupExpiredTokens() {
  await withLock('cleanup-tokens', async () => {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    if (result.count > 0) {
      console.log(`[Scheduler] ${result.count} refresh token(s) expirado(s) removidos`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 5: Auto-marcar pedidos READY há mais de 2h como CLOSED se for delivery entregue
// ─────────────────────────────────────────────────────────────────────────────
async function autoCloseDeliveredOrders() {
  await withLock('auto-close-delivered', async () => {
    const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Pedidos de delivery marcados como DELIVERED mas order ainda não está CLOSED
    const orders = await prisma.order.findMany({
      where: {
        type: 'DELIVERY',
        status: { in: ['DELIVERING', 'DELIVERED', 'READY'] },
        delivery: {
          status: 'DELIVERED',
          deliveredAt: { lt: threshold },
        },
      },
      select: { id: true },
    });

    for (const order of orders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          updatedAt: new Date(),
        },
      });
    }

    if (orders.length > 0) {
      console.log(`[Scheduler] ${orders.length} pedido(s) delivery sincronizados para DELIVERED`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Loop principal
// ─────────────────────────────────────────────────────────────────────────────
async function runScheduler() {
  console.log('[Scheduler] Iniciado');

  let iteration = 0;

  async function tick() {
    iteration++;

    // A cada tick (30s)
    await checkLowStock().catch(err => console.error('[Scheduler] checkLowStock:', err.message));

    // A cada 2 ticks (1 min)
    if (iteration % 2 === 0) {
      await autoCloseDeliveredOrders().catch(err => console.error('[Scheduler] autoClose:', err.message));
    }

    // A cada 120 ticks (~1h)
    if (iteration % 120 === 0) {
      await expireTrials().catch(err => console.error('[Scheduler] expireTrials:', err.message));
      await cleanupStaleCashSessions().catch(err => console.error('[Scheduler] cashSessions:', err.message));
    }

    // A cada 2880 ticks (~24h)
    if (iteration % 2880 === 0) {
      await cleanupExpiredTokens().catch(err => console.error('[Scheduler] cleanupTokens:', err.message));
      iteration = 0; // reseta pra não virar número enorme
    }
  }

  // Roda imediatamente na inicialização
  await tick();

  // Depois a cada 30 segundos
  setInterval(tick, 30_000);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Scheduler] SIGTERM recebido, encerrando...');
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

runScheduler().catch(err => {
  console.error('[Scheduler] Erro fatal:', err);
  process.exit(1);
});
