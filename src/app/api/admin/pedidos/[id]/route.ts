import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

const VALID_STATUSES = ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "DELIVERED", "CANCELLED"] as const;
type OrderStatus = (typeof VALID_STATUSES)[number];

// ── PATCH /api/admin/pedidos/[id] — atualiza status do pedido ─────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);
    if (!orderId || isNaN(orderId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: `Status inválido. Use: ${VALID_STATUSES.join(", ")}.` },
        { status: 400 }
      );
    }

    // Garante que o pedido pertence ao restaurante do admin
    const existing = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: payload.restaurantId },
    });
    if (!existing) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    const updated = await prisma.order.update({
      where: { id: orderId },
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
    console.error("PATCH /api/admin/pedidos/[id] error:", err);
    return NextResponse.json({ error: "Erro ao atualizar pedido." }, { status: 500 });
  }
}
