import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';
import { NotFoundError, BusinessRuleError, ConflictError } from '../../lib/errors';
import { emitToStore } from '../../lib/socket';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ─────────────────────────────────────────────────────────────────
  // GET /cash-sessions/current?storeId=
  // Retorna a sessão de caixa aberta do dia (ou null)
  // ─────────────────────────────────────────────────────────────────
  app.get<{ Querystring: { storeId: string } }>('/current', async (request) => {
    const { storeId } = request.query;
    const businessDate = getBusinessDate();

    const session = await prisma.cashSession.findFirst({
      where: withTenant(request.user, {
        storeId,
        businessDate,
        closedAt: null,
      }),
      include: {
        user: { select: { id: true, name: true } },
        movements: { orderBy: { createdAt: 'asc' } },
        _count: { select: { orders: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    return { session };
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /cash-sessions?storeId=&from=&to=
  // Histórico de sessões
  // ─────────────────────────────────────────────────────────────────
  app.get<{ Querystring: { storeId: string; from?: string; to?: string } }>('/', {
    onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')],
  }, async (request) => {
    const { storeId, from, to } = request.query;

    const sessions = await prisma.cashSession.findMany({
      where: withTenant(request.user, {
        storeId,
        ...(from || to ? {
          businessDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to) }   : {}),
          },
        } : {}),
      }),
      include: {
        user: { select: { id: true, name: true } },
        movements: true,
        _count: { select: { orders: true } },
      },
      orderBy: { businessDate: 'desc' },
      take: 30,
    });

    return { sessions };
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /cash-sessions/open — Abre o caixa
  // ─────────────────────────────────────────────────────────────────
  app.post('/open', {
    onRequest: [app.requireRole('CASHIER', 'MANAGER', 'OWNER', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const { storeId, openingAmount } = z.object({
      storeId: z.string(),
      openingAmount: z.number().nonnegative().default(0),
    }).parse(request.body);

    const tenantId = request.user!.tenantId!;
    const businessDate = getBusinessDate();

    // Verifica se já tem caixa aberto hoje nessa loja
    const existing = await prisma.cashSession.findFirst({
      where: withTenant(request.user, { storeId, businessDate, closedAt: null }),
    });
    if (existing) {
      throw new ConflictError('Já existe um caixa aberto hoje. Feche-o antes de abrir um novo.');
    }

    const session = await prisma.$transaction(async (tx) => {
      const s = await tx.cashSession.create({
        data: {
          tenantId,
          storeId,
          userId: request.user!.id,
          businessDate,
          openingAmount,
        },
      });

      // Registra movimento de abertura
      await tx.cashMovement.create({
        data: {
          sessionId: s.id,
          type: 'OPENING',
          amount: openingAmount,
          description: 'Abertura de caixa',
          createdBy: request.user!.id,
        },
      });

      return s;
    });

    emitToStore(tenantId, storeId, 'cash-session:opened', {
      sessionId: session.id,
      openingAmount,
      openedBy: request.user!.id,
    });

    const full = await prisma.cashSession.findUnique({
      where: { id: session.id },
      include: { user: { select: { id: true, name: true } }, movements: true },
    });

    return reply.status(201).send({ session: full });
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /cash-sessions/:id/close — Fecha o caixa
  // ─────────────────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/:id/close', {
    onRequest: [app.requireRole('CASHIER', 'MANAGER', 'OWNER', 'SUPER_ADMIN')],
  }, async (request) => {
    const { closingAmount, notes } = z.object({
      closingAmount: z.number().nonnegative(),
      notes: z.string().optional(),
    }).parse(request.body);

    const tenantId = request.user!.tenantId!;

    const session = await prisma.cashSession.findFirst({
      where: withTenant(request.user, { id: request.params.id, closedAt: null }),
      include: { movements: true },
    });
    if (!session) throw new NotFoundError('Sessão de caixa');

    // Calcula o valor esperado no caixa
    const expectedAmount = await calculateExpectedAmount(session.id, session.storeId);

    const difference = closingAmount - expectedAmount;

    const closed = await prisma.$transaction(async (tx) => {
      const s = await tx.cashSession.update({
        where: { id: session.id },
        data: {
          closedAt: new Date(),
          closingAmount,
          expectedAmount,
          difference,
          notes,
        },
      });

      await tx.cashMovement.create({
        data: {
          sessionId: session.id,
          type: 'CLOSING',
          amount: closingAmount,
          description: `Fechamento de caixa. Diferença: ${difference >= 0 ? '+' : ''}${difference.toFixed(2)}`,
          createdBy: request.user!.id,
        },
      });

      return s;
    });

    emitToStore(tenantId, session.storeId, 'cash-session:closed', {
      sessionId: session.id,
      closingAmount,
      expectedAmount,
      difference,
    });

    return {
      session: closed,
      summary: {
        openingAmount: Number(session.openingAmount),
        expectedAmount,
        closingAmount,
        difference,
        isBalanced: Math.abs(difference) < 0.05,
      },
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /cash-sessions/:id/movement — Sangria, suprimento, despesa
  // ─────────────────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/:id/movement', {
    onRequest: [app.requireRole('CASHIER', 'MANAGER', 'OWNER', 'SUPER_ADMIN')],
  }, async (request) => {
    const { type, amount, description } = z.object({
      type: z.enum(['WITHDRAWAL', 'REINFORCEMENT', 'EXPENSE']),
      amount: z.number().positive(),
      description: z.string().min(3),
    }).parse(request.body);

    const session = await prisma.cashSession.findFirst({
      where: withTenant(request.user, { id: request.params.id, closedAt: null }),
    });
    if (!session) throw new NotFoundError('Sessão de caixa aberta');

    const movement = await prisma.cashMovement.create({
      data: {
        sessionId: session.id,
        type,
        amount,
        description,
        createdBy: request.user!.id,
      },
    });

    emitToStore(request.user!.tenantId!, session.storeId, 'cash-session:movement', {
      sessionId: session.id,
      type,
      amount,
      description,
    });

    return { movement };
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /cash-sessions/:id — Detalhes de uma sessão
  // ─────────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const session = await prisma.cashSession.findFirst({
      where: withTenant(request.user, { id: request.params.id }),
      include: {
        user: { select: { id: true, name: true } },
        movements: { orderBy: { createdAt: 'asc' } },
        orders: {
          where: { status: 'CLOSED' },
          include: { payments: true },
          orderBy: { closedAt: 'desc' },
        },
      },
    });
    if (!session) throw new NotFoundError('Sessão de caixa');

    const expectedAmount = session.closedAt
      ? Number(session.expectedAmount)
      : await calculateExpectedAmount(session.id, session.storeId);

    const paymentBreakdown = computePaymentBreakdown(session.orders as any[]);

    return {
      session,
      summary: {
        expectedAmount,
        paymentBreakdown,
        openingAmount: Number(session.openingAmount),
      },
    };
  });
};

// ─── Helpers ───

function getBusinessDate(): Date {
  const d = new Date();
  if (d.getHours() < 5) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function calculateExpectedAmount(sessionId: string, storeId: string): Promise<number> {
  // Soma os pagamentos em dinheiro das ordens dessa sessão
  const payments = await prisma.payment.findMany({
    where: {
      order: { cashSessionId: sessionId, status: 'CLOSED' },
      method: 'CASH',
    },
    select: { amount: true, change: true },
  });

  const cashRevenue = payments.reduce((sum, p) => sum + Number(p.amount) - Number(p.change ?? 0), 0);

  // Soma os movimentos de caixa (abertura + suprimentos - sangrias - despesas)
  const movements = await prisma.cashMovement.findMany({
    where: { sessionId },
    select: { type: true, amount: true },
  });

  const movementsBalance = movements.reduce((sum, m) => {
    switch (m.type) {
      case 'OPENING':
      case 'REINFORCEMENT':
        return sum + Number(m.amount);
      case 'WITHDRAWAL':
      case 'EXPENSE':
        return sum - Number(m.amount);
      case 'CLOSING':
        return sum; // não conta o fechamento aqui
      default:
        return sum;
    }
  }, 0);

  return parseFloat((movementsBalance + cashRevenue).toFixed(2));
}

function computePaymentBreakdown(orders: Array<{ payments: Array<{ method: string; amount: any }> }>) {
  const breakdown: Record<string, number> = {};
  for (const order of orders) {
    for (const payment of order.payments) {
      const m = payment.method;
      breakdown[m] = (breakdown[m] || 0) + Number(payment.amount);
    }
  }
  return Object.entries(breakdown).map(([method, amount]) => ({
    method,
    amount: parseFloat(amount.toFixed(2)),
  }));
}

export default routes;
