import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

// Brazil is UTC-3 — adjust "today" to local midnight
const BRT_MS = -3 * 60 * 60 * 1000;

function periodStart(period: string): Date {
  const now = new Date();
  if (period === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (period === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  // "today" → midnight BRT
  const brt = new Date(now.getTime() + BRT_MS);
  const midnight = new Date(
    Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate())
  );
  return new Date(midnight.getTime() - BRT_MS); // back to UTC
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "today";
    const rid = payload.restaurantId;
    const since = periodStart(period);

    // ── Parallel queries ───────────────────────────────────────────────────────
    const [periodOrders, recentOrders, topProducts, openOrders, last24hOrders] =
      await Promise.all([
        // All orders in the selected period
        prisma.order.findMany({
          where: { restaurantId: rid, createdAt: { gte: since } },
          select: { id: true, total: true, status: true, createdAt: true },
        }),

        // 5 most recent orders (always — not period-filtered)
        prisma.order.findMany({
          where: { restaurantId: rid },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            customerName: true,
            total: true,
            status: true,
            createdAt: true,
            orderType: true,
          },
        }),

        // Top 5 items by qty (period-filtered, excluding CANCELLED)
        prisma.orderItem.groupBy({
          by: ["name"],
          where: {
            order: {
              restaurantId: rid,
              createdAt: { gte: since },
              status: { not: "CANCELLED" },
            },
          },
          _sum: { qty: true },
          orderBy: { _sum: { qty: "desc" } },
          take: 5,
        }),

        // Current open orders (no period filter — operational snapshot)
        prisma.order.count({
          where: {
            restaurantId: rid,
            status: { in: ["RECEIVED", "CONFIRMED", "PREPARING", "READY"] },
          },
        }),

        // Orders in the last 24h for the hourly chart
        prisma.order.findMany({
          where: {
            restaurantId: rid,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          select: { createdAt: true },
        }),
      ]);

    // ── Period metrics ─────────────────────────────────────────────────────────
    const nonCancelled = periodOrders.filter((o) => o.status !== "CANCELLED");
    const revenue = nonCancelled.reduce((s, o) => s + Number(o.total), 0);
    const avgTicket = nonCancelled.length > 0 ? revenue / nonCancelled.length : 0;
    const delivered = periodOrders.filter((o) => o.status === "DELIVERED").length;
    const cancelled = periodOrders.filter((o) => o.status === "CANCELLED").length;

    // ── Hourly breakdown (last 24h, BRT hours) ─────────────────────────────────
    const hourlyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = 0;
    last24hOrders.forEach((o) => {
      const brtDate = new Date(new Date(o.createdAt).getTime() + BRT_MS);
      const h = brtDate.getUTCHours();
      hourlyMap[h] = (hourlyMap[h] ?? 0) + 1;
    });
    const hourlyOrders = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: hourlyMap[h],
    }));

    return NextResponse.json({
      period,
      // period-scoped
      ordersCount: periodOrders.length,
      revenue,
      avgTicket,
      delivered,
      cancelled,
      // operational (always current)
      openOrders,
      // chart + lists
      hourlyOrders,
      recentOrders: recentOrders.map((o) => ({ ...o, total: Number(o.total) })),
      topProducts: topProducts.map((p) => ({
        name: p.name,
        qty: p._sum.qty ?? 0,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/dashboard error:", err);
    return NextResponse.json({ error: "Erro ao carregar dashboard." }, { status: 500 });
  }
}
