import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isRestaurantOpen } from "@/lib/isRestaurantOpen";
import { haversineKm, calcDeliveryFee } from "@/lib/haversine";

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
type Payment   = (typeof VALID_PAYMENTS)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeOrder(order: any) {
  return {
    ...order,
    subtotal:    Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    total:       Number(order.total),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (order.items as any[]).map((i) => ({ ...i, price: Number(i.price) })),
  };
}

/** Extrai todos os campos diagnósticos de um erro Prisma/genérico */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractError(err: unknown): { message: string; code?: string; meta?: unknown; stack?: string } {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message: typeof e.message === "string" ? e.message : String(err),
      code:    typeof e.code    === "string" ? e.code    : undefined,
      meta:    e.meta ?? undefined,
      stack:   typeof e.stack   === "string" ? e.stack   : undefined,
    };
  }
  return { message: String(err) };
}

// ── POST /api/orders ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // eslint-disable-next-line no-console
  console.log("=== POST /api/orders START ===");

  let body: Record<string, unknown> = {};

  try {
    body = await req.json();
  } catch {
    return badRequest("Body inválido — JSON malformado.");
  }

  // eslint-disable-next-line no-console
  console.log("BODY_RECEBIDO:", JSON.stringify({
    customer_name:  body.customer_name,
    customer_phone: body.customer_phone,
    order_type:     body.order_type,
    payment:        body.payment,
    address_json:   body.address_json,
    items_count:    Array.isArray(body.items) ? body.items.length : "não é array",
    items:          body.items,
  }));

  try {
    const {
      customer_name,
      customer_phone,
      items,
      order_type,
      payment,
      neighborhood,
      address_json,
      notes,
    } = body as {
      customer_name?: unknown; customer_phone?: unknown;
      items?: unknown; order_type?: unknown; payment?: unknown;
      neighborhood?: unknown; address_json?: Record<string, unknown>;
      notes?: unknown;
    };

    // ── 1. Cliente ────────────────────────────────────────────────
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

    // ── 2. Itens ──────────────────────────────────────────────────
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest("O pedido deve conter ao menos um item.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsArr = items as any[];

    for (let i = 0; i < itemsArr.length; i++) {
      const item = itemsArr[i];
      if (!item.name || typeof item.name !== "string" || !item.name.trim()) {
        return badRequest(`Item ${i + 1}: nome obrigatório.`);
      }
      if (item.productId !== undefined && item.productId !== null) {
        const pid = Number(item.productId);
        if (!Number.isInteger(pid) || pid < 1) {
          return badRequest(`Item ${i + 1} ("${item.name}"): productId inválido.`);
        }
      }
      if (!Number.isInteger(item.qty) || item.qty < 1) {
        return badRequest(`Item ${i + 1} ("${item.name}"): quantidade inválida.`);
      }
    }

    // ── 3. Tipo de pedido ─────────────────────────────────────────
    if (!(VALID_ORDER_TYPES as readonly string[]).includes(order_type as string)) {
      return badRequest(`Tipo inválido. Aceitos: ${VALID_ORDER_TYPES.join(", ")}.`);
    }

    // ── 4. Pagamento ──────────────────────────────────────────────
    if (!payment || typeof payment !== "string" || !payment.trim()) {
      return badRequest("Forma de pagamento é obrigatória.");
    }
    if (!(VALID_PAYMENTS as readonly string[]).includes(payment.trim())) {
      return badRequest(`Pagamento inválido. Aceitos: ${VALID_PAYMENTS.join(", ")}.`);
    }

    // ── 5. Endereço (delivery) — texto OU GPS ────────────────────
    if (order_type === "delivery") {
      const endereco = String(address_json?.endereco ?? "").trim();
      const hasGps   = address_json?.lat != null && address_json?.lng != null;
      if (!hasGps && endereco.length < 5) {
        return badRequest("Informe o endereço ou envie sua localização GPS.");
      }
    }

    // ── 6. Lookup de produtos no banco ────────────────────────────
    const idsToLookup: number[] = itemsArr
      .map((item) => Number(item.productId))
      .filter((id) => Number.isInteger(id) && id >= 1);

    // eslint-disable-next-line no-console
    console.log("STEP6_IDS_LOOKUP:", idsToLookup);

    const productMap = new Map<number, { id: number; name: string; price: number }>();

    if (idsToLookup.length > 0) {
      // eslint-disable-next-line no-console
      console.log("STEP6_DB_QUERY: product.findMany restaurantId=1 isActive=true ids=", idsToLookup);
      const dbProducts = await prisma.product.findMany({
        where: { id: { in: idsToLookup }, restaurantId: 1, isActive: true },
        select: { id: true, name: true, price: true },
      });
      // eslint-disable-next-line no-console
      console.log("STEP6_DB_RESULT:", dbProducts);
      dbProducts.forEach((p) => productMap.set(p.id, { ...p, price: Number(p.price) }));
    }

    // ── 7. Recalcular preços ──────────────────────────────────────
    let calculatedSubtotal = 0;
    const orderItemsData = itemsArr.map((item) => {
      const dbProduct  = item.productId ? productMap.get(item.productId) : undefined;
      const unitPrice  = dbProduct
        ? dbProduct.price
        : (typeof item.price === "number" && item.price > 0 ? item.price : 0);
      const productName = dbProduct ? dbProduct.name : String(item.name).trim();
      calculatedSubtotal = Math.round((calculatedSubtotal + unitPrice * item.qty) * 100) / 100;
      return {
        productId: dbProduct?.id ?? null,
        name:      productName,
        price:     unitPrice,
        qty:       item.qty,
        obs:       item.obs ? String(item.obs).trim() : null,
      };
    });

    // ── 7b. Delivery fee (Haversine) ──────────────────────────────
    let deliveryFee   = 0;
    let freightStatus = "ok";

    if (order_type === "delivery") {
      const customerLat = typeof address_json?.lat === "number" ? address_json.lat : null;
      const customerLng = typeof address_json?.lng === "number" ? address_json.lng : null;

      // Fetch restaurant delivery config (non-blocking)
      try {
        const rest = await prisma.restaurant.findUnique({
          where: { id: 1 },
          select: { deliveryMaxKm: true, deliveryPricePerKm: true, restaurantLat: true, restaurantLng: true },
        });

        if (
          rest &&
          rest.restaurantLat != null &&
          rest.restaurantLng != null &&
          customerLat != null &&
          customerLng != null
        ) {
          const distKm = haversineKm(rest.restaurantLat, rest.restaurantLng, customerLat, customerLng);
          // eslint-disable-next-line no-console
          console.log(`STEP7b_HAVERSINE: dist=${distKm.toFixed(2)}km maxKm=${rest.deliveryMaxKm}`);

          if (distKm > rest.deliveryMaxKm) {
            freightStatus = "blocked";
            deliveryFee   = 0;
            // eslint-disable-next-line no-console
            console.log("STEP7b_FREIGHT: fora do raio → freightStatus=blocked");
          } else {
            deliveryFee   = calcDeliveryFee(distKm, rest.deliveryPricePerKm);
            freightStatus = "ok";
            // eslint-disable-next-line no-console
            console.log(`STEP7b_FREIGHT: R$${deliveryFee} → freightStatus=ok`);
          }
        } else if (customerLat == null || customerLng == null) {
          freightStatus = "pending";
          deliveryFee   = 0;
          // eslint-disable-next-line no-console
          console.log("STEP7b_FREIGHT: sem GPS do cliente → freightStatus=pending");
        } else {
          // Restaurant has no GPS configured
          freightStatus = "pending";
          deliveryFee   = 0;
          // eslint-disable-next-line no-console
          console.log("STEP7b_FREIGHT: restaurante sem GPS → freightStatus=pending");
        }
      } catch (freightErr) {
        freightStatus = "pending";
        deliveryFee   = 0;
        // eslint-disable-next-line no-console
        console.warn("STEP7b_FREIGHT_ERROR:", freightErr);
      }
    }

    const calculatedTotal  = Math.round((calculatedSubtotal + deliveryFee) * 100) / 100;

    // eslint-disable-next-line no-console
    console.log("STEP7_ORDER_ITEMS:", orderItemsData, "subtotal:", calculatedSubtotal, "deliveryFee:", deliveryFee, "freightStatus:", freightStatus);

    // ── 8. Upsert do Cliente (não-bloqueante) ─────────────────────
    // eslint-disable-next-line no-console
    console.log("STEP8_CUSTOMER_UPSERT phone:", phoneDigits);
    try {
      await prisma.customer.upsert({
        where:  { phone: phoneDigits },
        create: {
          phone:      phoneDigits,
          name:       customer_name.trim(),
          address:    String(address_json?.endereco ?? "").trim() || null,
          complement: String(address_json?.complemento ?? "").trim() || null,
        },
        update: {
          name: customer_name.trim(),
          ...(address_json?.endereco    ? { address:    String(address_json.endereco).trim()    } : {}),
          ...(address_json?.complemento ? { complement: String(address_json.complemento).trim() } : {}),
        },
      });
      // eslint-disable-next-line no-console
      console.log("STEP8_CUSTOMER_OK");
    } catch (customerErr) {
      const ce = extractError(customerErr);
      // eslint-disable-next-line no-console
      console.warn("STEP8_CUSTOMER_SKIP:", ce.message, "code:", ce.code, "meta:", ce.meta);
    }

    // ── 9. Auto-aceite: checar configuração + horário ─────────────
    let initialStatus = "RECEIVED";
    let autoAccepted  = false;

    try {
      const restaurant = await prisma.restaurant.findUnique({
        where:  { id: 1 },
        select: {
          autoAcceptOrders: true,
          openingHours: {
            select: { dayOfWeek: true, openTime: true, closeTime: true, isOpen: true },
          },
        },
      });

      if (restaurant?.autoAcceptOrders) {
        const open = isRestaurantOpen(restaurant.openingHours, new Date());
        if (open) {
          initialStatus = "CONFIRMED";
          autoAccepted  = true;
          // eslint-disable-next-line no-console
          console.log("STEP9_AUTO_ACCEPT: restaurante aberto → status=CONFIRMED");
        } else {
          // eslint-disable-next-line no-console
          console.log("STEP9_AUTO_ACCEPT: restaurante fechado → status=RECEIVED (segurança)");
        }
      }
    } catch (autoErr) {
      // Falha na leitura da config → manter RECEIVED por segurança
      // eslint-disable-next-line no-console
      console.warn("STEP9_AUTO_ACCEPT_ERROR (usando RECEIVED):", autoErr);
    }

    // ── 10. Criar Order + OrderItems ──────────────────────────────
    // eslint-disable-next-line no-console
    console.log("STEP10_ORDER_CREATE start, restaurantId=1, status=", initialStatus);

    const orderData = {
      restaurantId:  1,
      customerName:  customer_name.trim(),
      customerPhone: phoneDigits,
      orderType:     order_type as OrderType,
      payment:       (payment as string).trim() as Payment,
      subtotal:      calculatedSubtotal,
      deliveryFee,
      total:         calculatedTotal,
      neighborhood:  neighborhood ? String(neighborhood).trim() || null : null,
      addressJson:   address_json ? JSON.stringify(address_json) : null,
      status:        initialStatus,
      freightStatus,
      autoAccepted,
      notes:         notes ? String(notes).trim() || null : null,
      items:         { create: orderItemsData },
    };

    // eslint-disable-next-line no-console
    console.log("STEP10_ORDER_DATA (sem items):", { ...orderData, items: `[${orderItemsData.length} items]` });

    const order = await prisma.order.create({
      data:    orderData,
      include: { items: true },
    });

    // eslint-disable-next-line no-console
    console.log("STEP10_ORDER_CREATED id:", order.id, "autoAccepted:", autoAccepted);

    // ── 11. Notificação WhatsApp pro restaurante (fire-and-forget) ────────────
    void (async () => {
      try {
        const EVOL_BASE = "http://24.144.95.205:8080";
        const EVOL_KEY  = "ea6325bd7f51e1143bb659457870010cec875fb6f32997f6";
        const INSTANCE  = "grillcentral";
        const NOTIFY_TO = "5548988362576";

        const itensTxt = orderItemsData
          .map((i) => `  • ${i.qty}x ${i.name}${i.obs ? ` (${i.obs})` : ""}`)
          .join("\n");

        const tipoEmoji =
          order.orderType === "delivery" ? "🛵 Delivery"
          : order.orderType === "retirada" ? "🏃 Retirada"
          : "💬 WhatsApp";

        let addrLine = "";
        if (order.addressJson) {
          try {
            const a = JSON.parse(order.addressJson) as Record<string, string>;
            if (a.endereco) addrLine = `📍 ${a.endereco}${a.complemento ? `, ${a.complemento}` : ""}`;
          } catch { /* ignore */ }
        }

        const linhas = [
          `🔔 *PEDIDO #${order.id} — NOVO!*`,
          `👤 ${order.customerName} | 📞 ${order.customerPhone}`,
          `${tipoEmoji} | 💳 ${order.payment}`,
          ...(addrLine ? [addrLine] : []),
          ``,
          itensTxt,
          ``,
          `💰 Total: R$${Number(order.total).toFixed(2)}`,
        ];

        // 1. Mensagem de texto com resumo do pedido
        await fetch(`${EVOL_BASE}/message/sendText/${INSTANCE}`, {
          method:  "POST",
          headers: { apikey: EVOL_KEY, "Content-Type": "application/json" },
          body:    JSON.stringify({ number: NOTIFY_TO, text: linhas.join("\n") }),
        });

        // 2. Áudio "ding" como PTT para alertar sonoramente
        await fetch(`${EVOL_BASE}/message/sendWhatsAppAudio/${INSTANCE}`, {
          method:  "POST",
          headers: { apikey: EVOL_KEY, "Content-Type": "application/json" },
          body:    JSON.stringify({
            number:   NOTIFY_TO,
            audio:    "https://grillcardapio.com.br/notificacao.wav",
            encoding: true,
          }),
        });

        // eslint-disable-next-line no-console
        console.log("STEP11_NOTIFY_OK order", order.id);
      } catch (notifyErr) {
        // eslint-disable-next-line no-console
        console.warn("STEP11_NOTIFY_FAIL:", notifyErr);
      }
    })();
    // ─────────────────────────────────────────────────────────────────────────

    // eslint-disable-next-line no-console
    console.log("=== POST /api/orders SUCCESS ===");

    return NextResponse.json(serializeOrder(order), { status: 201 });

  } catch (err) {
    const e = extractError(err);

    // eslint-disable-next-line no-console
    console.error("=== POST /api/orders ERROR ===");
    // eslint-disable-next-line no-console
    console.error("message:", e.message);
    // eslint-disable-next-line no-console
    console.error("code:", e.code);
    // eslint-disable-next-line no-console
    console.error("meta:", JSON.stringify(e.meta));
    // eslint-disable-next-line no-console
    console.error("stack:", e.stack);
    // eslint-disable-next-line no-console
    console.error("body_snapshot:", JSON.stringify(body));

    return NextResponse.json(
      {
        error:   "Erro interno ao criar pedido.",
        details: e.message,
        code:    e.code,
        meta:    e.meta,
      },
      { status: 500 }
    );
  }
}

// ── GET /api/orders ───────────────────────────────────────────────────────────
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where:   { restaurantId: 1 },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take:    100,
    });

    return NextResponse.json(
      orders.map((o) => ({
        ...o,
        subtotal:    Number(o.subtotal),
        deliveryFee: Number(o.deliveryFee),
        total:       Number(o.total),
        items:       o.items.map((i) => ({ ...i, price: Number(i.price) })),
      }))
    );
  } catch (err) {
    console.error("Orders GET error:", err);
    return NextResponse.json({ error: "Erro ao buscar pedidos." }, { status: 500 });
  }
}
