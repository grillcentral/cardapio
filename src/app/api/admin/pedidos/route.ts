import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

const VALID_STATUSES = ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "DELIVERED", "CANCELLED"] as const;
type OrderStatus = (typeof VALID_STATUSES)[number];

// ── GET /api/admin/pedidos ─────────────────────────────────────────────────────
// Query params: ?status=RECEIVED&limit=50&page=1
export async function GET(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || "100"), 200);
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { restaurantId: payload.restaurantId };
    if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            orderBy: { id: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Contagem por status para os badges de filtro
    const counts = await prisma.order.groupBy({
      by: ["status"],
      where: { restaurantId: payload.restaurantId },
      _count: { status: true },
    });

    const statusCounts = Object.fromEntries(
      counts.map((c) => [c.status, c._count.status])
    );

    const result = orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.deliveryFee),
      total: Number(o.total),
      items: o.items.map((i) => ({ ...i, price: Number(i.price) })),
    }));

    return NextResponse.json({ orders: result, total, statusCounts });
  } catch (err) {
    console.error("GET /api/admin/pedidos error:", err);
    return NextResponse.json({ error: "Erro ao buscar pedidos." }, { status: 500 });
  }
}

// ── PATCH /api/admin/pedidos — atualiza status em lote (não usado, mas disponível)
export async function PATCH(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { id, status } = await req.json();

    if (!id || !status) return NextResponse.json({ error: "id e status obrigatórios." }, { status: 400 });
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: `Status inválido. Use: ${VALID_STATUSES.join(", ")}.` },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({ where: { id: Number(id), restaurantId: payload.restaurantId } });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: { status: status as OrderStatus },
      include: { items: true },
    });

    return NextResponse.json({
      ...updated,
      subtotal: Number(updated.subtotal),
      deliveryFee: Number(updated.deliveryFee),
      total: Number(updated.total),
      items: updated.items.map((i) => ({ ...i, price: Number(i.price) })),
    });
  } catch (err) {
    console.error("PATCH /api/admin/pedidos error:", err);
    return NextResponse.json({ error: "Erro ao atualizar pedido." }, { status: 500 });
  }
}
