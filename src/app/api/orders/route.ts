import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── Whitelists ────────────────────────────────────────────────────────────────
const VALID_ORDER_TYPES = ["delivery", "retirada", "whatsapp_direct"] as const;
const VALID_PAYMENTS = [
  "Dinheiro",
  "Pix",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Vale Alimentação",
  "A confirmar",
] as const;

type OrderType = (typeof VALID_ORDER_TYPES)[number];
type Payment = (typeof VALID_PAYMENTS)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeOrder(order: any) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (order.items as any[]).map((i) => ({ ...i, price: Number(i.price) })),
  };
}

// ── POST /api/orders ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_name, customer_phone, items, order_type, payment, neighborhood, address_json, notes } = body;

    // ── 1. Identificação do cliente ───────────────────────────────
    if (!customer_name || typeof customer_name !== "string" || customer_name.trim().length < 2) {
      return badRequest("Nome do cliente é obrigatório (mínimo 2 caracteres).");
    }

    if (!customer_phone || typeof customer_phone !== "string") {
      return badRequest("Telefone do cliente é obrigatório.");
    }

    const phoneDigits = customer_phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return badRequest("Telefone inválido. Informe DDD + número (10 ou 11 dígitos).");
    }

    // ── 2. Itens — existência e estrutura básica ───────────────────
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest("O pedido deve conter ao menos um item.");
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.productId || !Number.isInteger(item.productId) || item.productId < 1) {
        return badRequest(
          `Item ${i + 1} ("${item.name ?? "?"}"): productId ausente ou inválido.`
        );
      }

      if (!Number.isInteger(item.qty) || item.qty < 1) {
        return badRequest(`Item ${i + 1} ("${item.name ?? "?"}"): quantidade inválida.`);
      }
    }

    // ── 3. Tipo de pedido ─────────────────────────────────────────
    if (!(VALID_ORDER_TYPES as readonly string[]).includes(order_type)) {
      return badRequest(
        `Tipo de pedido inválido. Valores aceitos: ${VALID_ORDER_TYPES.join(", ")}.`
      );
    }

    // ── 4. Forma de pagamento ─────────────────────────────────────
    if (!payment || typeof payment !== "string" || payment.trim().length === 0) {
      return badRequest("Forma de pagamento é obrigatória.");
    }

    if (!(VALID_PAYMENTS as readonly string[]).includes(payment.trim())) {
      return badRequest(
        `Forma de pagamento inválida. Valores aceitos: ${VALID_PAYMENTS.join(", ")}.`
      );
    }

    // ── 5. Endereço obrigatório para delivery ─────────────────────
    if (order_type === "delivery") {
      const endereco = address_json?.endereco;
      if (!endereco || typeof endereco !== "string" || endereco.trim().length < 5) {
        return badRequest("Endereço é obrigatório para pedidos de delivery.");
      }
    }

    // ── 6. Buscar produtos reais no banco ─────────────────────────
    const incomingProductIds: number[] = items.map(
      (item: { productId: number }) => item.productId
    );

    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: incomingProductIds },
        restaurantId: 1,
        isActive: true,
      },
      select: { id: true, name: true, price: true },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Garantir que todos os itens têm produto ativo correspondente
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!productMap.has(item.productId)) {
        return badRequest(
          `Item ${i + 1} (productId: ${item.productId}): produto não encontrado ou inativo.`
        );
      }
    }

    // ── 7. Recalcular preços no backend ───────────────────────────
    let calculatedSubtotal = 0;

    const orderItemsData = items.map(
      (item: { productId: number; qty: number; obs?: string }) => {
        const product = productMap.get(item.productId)!;
        calculatedSubtotal = Math.round((calculatedSubtotal + product.price * item.qty) * 100) / 100;
        return {
          productId: product.id,
          name: product.name,           // nome canônico do banco
          price: product.price,         // preço real do banco
          qty: item.qty,
          obs: item.obs?.trim() || null,
        };
      }
    );

    const deliveryFee = 0; // TODO: buscar taxa de entrega configurada por restaurante
    const calculatedTotal = Math.round((calculatedSubtotal + deliveryFee) * 100) / 100;

    // ── 8. Upsert do Cliente ──────────────────────────────────────
    const customer = await prisma.customer.upsert({
      where: { phone: phoneDigits },
      create: {
        phone: phoneDigits,
        name: customer_name.trim(),
        address: address_json?.endereco?.trim() || null,
        complement: address_json?.complemento?.trim() || null,
      },
      update: {
        name: customer_name.trim(),
        ...(address_json?.endereco ? { address: address_json.endereco.trim() } : {}),
        ...(address_json?.complemento ? { complement: address_json.complemento.trim() } : {}),
      },
    });

    // ── 9. Criar Order + OrderItems ───────────────────────────────
    const order = await prisma.order.create({
      data: {
        restaurantId: 1,
        customerName: customer.name,
        customerPhone: customer.phone,
        orderType: order_type as OrderType,
        payment: payment.trim() as Payment,
        subtotal: calculatedSubtotal,
        deliveryFee,
        total: calculatedTotal,
        neighborhood: neighborhood?.trim() || null,
        addressJson: address_json ? JSON.stringify(address_json) : null,
        status: "RECEIVED",
        notes: notes?.trim() || null,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    return NextResponse.json(serializeOrder(order), { status: 201 });
  } catch (err) {
    console.error("Orders POST error:", err);
    return NextResponse.json({ error: "Erro interno ao criar pedido." }, { status: 500 });
  }
}

// ── GET /api/orders ───────────────────────────────────────────────────────────
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId: 1 },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(
      orders.map((o) => ({
        ...o,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.deliveryFee),
        total: Number(o.total),
        items: o.items.map((i) => ({ ...i, price: Number(i.price) })),
      }))
    );
  } catch (err) {
    console.error("Orders GET error:", err);
    return NextResponse.json({ error: "Erro ao buscar pedidos." }, { status: 500 });
  }
}
