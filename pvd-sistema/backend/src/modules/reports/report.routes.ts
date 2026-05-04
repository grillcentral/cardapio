import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // ═══════════ DASHBOARD DO DIA ═══════════
  app.get<{ Querystring: { storeId: string; date?: string } }>('/dashboard', async (request) => {
    const { storeId, date } = request.query;
    const businessDate = date ? new Date(date) : (() => {
      const d = new Date();
      if (d.getHours() < 5) d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const baseWhere = withTenant(request.user, {
      storeId,
      businessDate,
      status: 'CLOSED' as const,
    });

    const [stats, paymentBreakdown, topProducts, hourlyDistribution] = await Promise.all([
      // Estatísticas gerais
      prisma.order.aggregate({
        where: baseWhere,
        _count: true,
        _sum: { total: true, discount: true },
        _avg: { total: true },
      }),

      // Por forma de pagamento
      prisma.payment.groupBy({
        by: ['method'],
        where: { order: baseWhere },
        _sum: { amount: true },
        _count: true,
      }),

      // Top 10 produtos
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: baseWhere, status: { not: 'CANCELLED' } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),

      // Distribuição por hora via Prisma (sem raw SQL para garantir isolamento de tenant)
      prisma.order.findMany({
        where: baseWhere,
        select: { closedAt: true, total: true },
      }).then(rows =>
        Array.from({ length: 24 }, (_, hour) => {
          const hourOrders = rows.filter(r => r.closedAt && new Date(r.closedAt).getHours() === hour);
          return {
            hour,
            orders: hourOrders.length,
            total: hourOrders.reduce((s, r) => s + Number(r.total), 0),
          };
        }).filter(h => h.orders > 0)
      ),
    ]);

    // Ticket médio, etc
    const closedOrders = stats._count;
    const revenue = Number(stats._sum.total ?? 0);
    const avgTicket = Number(stats._avg.total ?? 0);
    const totalDiscount = Number(stats._sum.discount ?? 0);

    // Contagem por tipo
    const byType = await prisma.order.groupBy({
      by: ['type'],
      where: baseWhere,
      _count: true,
      _sum: { total: true },
    });

    // Cancelados
    const cancelled = await prisma.order.aggregate({
      where: withTenant(request.user, {
        storeId,
        businessDate,
        status: 'CANCELLED',
      }),
      _count: true,
      _sum: { total: true },
    });

    return {
      businessDate: businessDate.toISOString().split('T')[0],
      summary: {
        closedOrders,
        revenue,
        avgTicket,
        totalDiscount,
        cancelled: {
          count: cancelled._count,
          totalLost: Number(cancelled._sum.total ?? 0),
        },
      },
      paymentBreakdown: paymentBreakdown.map(p => ({
        method: p.method,
        amount: Number(p._sum.amount ?? 0),
        count: p._count,
        percentage: revenue > 0 ? (Number(p._sum.amount ?? 0) / revenue) * 100 : 0,
      })),
      topProducts: topProducts.map(p => ({
        productId: p.productId,
        name: p.productName,
        quantity: p._sum.quantity ?? 0,
        revenue: Number(p._sum.subtotal ?? 0),
      })),
      byType: byType.map(t => ({
        type: t.type,
        count: t._count,
        total: Number(t._sum.total ?? 0),
      })),
      hourlyDistribution: hourlyDistribution.map(h => ({
        hour: Number(h.hour),
        orders: Number(h.orders),
        total: Number(h.total),
      })),
    };
  });

  // ═══════════ RELATÓRIO DE PERÍODO ═══════════
  app.get<{ Querystring: { storeId: string; from: string; to: string } }>('/period', async (request) => {
    const { storeId, from, to } = request.query;
    const dateRange = { gte: new Date(from), lte: new Date(to) };

    const baseWherePeriod = withTenant(request.user, {
      storeId,
      status: 'CLOSED' as const,
      businessDate: dateRange,
    });

    // Busca todos os pedidos do período com Prisma (isolamento de tenant garantido)
    const orders = await prisma.order.findMany({
      where: baseWherePeriod,
      select: { businessDate: true, total: true },
    });

    // Agrupa por data
    const byDate = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      const key = o.businessDate.toISOString().split('T')[0];
      const entry = byDate.get(key) ?? { orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += Number(o.total);
      byDate.set(key, entry);
    }

    const dailyRevenue = Array.from(byDate.entries())
      .map(([date, data]) => ({ date, orders: data.orders, revenue: parseFloat(data.revenue.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      from: dateRange.gte.toISOString().split('T')[0],
      to: dateRange.lte.toISOString().split('T')[0],
      dailyRevenue,
    };
  });

  // ═══════════ ALERTAS DE ESTOQUE BAIXO ═══════════
  app.get<{ Querystring: { storeId: string } }>('/low-stock', async (request) => {
    const { storeId } = request.query;
    const tenantId = request.user?.role === 'SUPER_ADMIN' ? null : request.user?.tenantId;

    // Raw SQL necessário para comparação campo-a-campo (stock <= minStock)
    // TenantId incluído para garantir isolamento multi-tenant
    const products = tenantId
      ? await prisma.$queryRaw<Array<{ id: string; name: string; stock: number; minStock: number; price: number }>>`
          SELECT id, name, stock, "minStock", price::float
          FROM products
          WHERE "storeId" = ${storeId}
            AND "tenantId" = ${tenantId}
            AND "deletedAt" IS NULL
            AND "trackStock" = true
            AND "isActive" = true
            AND stock <= "minStock"
          ORDER BY stock ASC
        `
      : await prisma.$queryRaw<Array<{ id: string; name: string; stock: number; minStock: number; price: number }>>`
          SELECT id, name, stock, "minStock", price::float
          FROM products
          WHERE "storeId" = ${storeId}
            AND "deletedAt" IS NULL
            AND "trackStock" = true
            AND "isActive" = true
            AND stock <= "minStock"
          ORDER BY stock ASC
        `;

    return { products };
  });
};

export default routes;
