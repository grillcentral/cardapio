import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer_name,
      customer_phone,
      items,
      subtotal,
      delivery_fee,
      total,
      order_type,
      payment,
      neighborhood,
      address_json,
      notes,
    } = body;

    if (!items || !order_type || !payment) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Itens inválidos" }, { status: 400 });
    }

    const order = await prisma.order.create({
      data: {
        restaurantId: 1,
        customerName: customer_name || null,
        customerPhone: customer_phone || null,
        orderType: String(order_type),
        payment: String(payment),
        subtotal: Number(subtotal) || 0,
        deliveryFee: Number(delivery_fee) || 0,
        total: Number(total) || 0,
        neighborhood: neighborhood || null,
        addressJson: address_json ? JSON.stringify(address_json) : null,
        status: "RECEIVED",
        notes: notes || null,
        items: {
          create: items.map((item: { name: string; price: number; qty: number; obs?: string; productId?: number }) => ({
            name: String(item.name),
            price: Number(item.price),
            qty: Number(item.qty) || 1,
            obs: item.obs || null,
            productId: item.productId ? Number(item.productId) : null,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(
      {
        ...order,
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.deliveryFee),
        total: Number(order.total),
        items: order.items.map((i) => ({ ...i, price: Number(i.price) })),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Orders POST error:", err);
    return NextResponse.json({ error: "Erro ao criar pedido." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId: 1 },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const result = orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.deliveryFee),
      total: Number(o.total),
      items: o.items.map((i) => ({ ...i, price: Number(i.price) })),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Orders GET error:", err);
    return NextResponse.json({ error: "Erro ao buscar pedidos." }, { status: 500 });
  }
}
