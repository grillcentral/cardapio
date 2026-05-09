"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { openRestaurantWhatsApp } from "@/lib/whatsapp";

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  obs: string;
  /** ID do produto no banco — obrigatório para POST /api/orders. */
  productId?: number;
}

const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

// Valores exatos aceitos pelo backend (POST /api/orders whitelist)
const PAYMENTS = [
  "Dinheiro",
  "Pix",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Vale Alimentação",
  "A confirmar",
];

const inp: React.CSSProperties = {
  width: "100%",
  background: "#0b0d12",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#f0ede6",
  padding: "10px 13px",
  fontSize: 14,
  fontFamily: "'DM Sans',sans-serif",
  outline: "none",
};

const lbl: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#9e9a90",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
  display: "block",
};

/* ─── Checkout Modal unificado ─── */
function CheckoutModal({ cart, subtotal, whatsapp, onClose, onSuccess }: {
  cart: CartItem[];
  subtotal: number;
  whatsapp: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "retirada">("delivery");
  const [address, setAddress] = useState("");
  const [complement, setComplement] = useState("");
  const [payment, setPayment] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("grillcentral_quick_user") || "null");
      if (saved?.name) setName(saved.name);
      if (saved?.phone) setPhone(fmtPhone(String(saved.phone)));
      if (saved?.address) setAddress(saved.address);
      if (saved?.complement) setComplement(saved.complement);
      // lat/lng não é reutilizado — cliente deve capturar localização a cada pedido
    } catch {}
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const fmtPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleGeo = () => {
    if (!navigator.geolocation) { setGeoStatus("err"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setGeoStatus("ok"); },
      () => setGeoStatus("err"),
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = async () => {
    const digits = phone.replace(/\D/g, "");
    if (!name.trim()) { setErr("Digite seu nome."); return; }
    if (digits.length < 10) { setErr("Digite um telefone válido com DDD."); return; }
    if (!payment) { setErr("Escolha a forma de pagamento."); return; }
    if (orderType === "delivery" && !address.trim() && !(lat && lng)) {
      setErr("Informe seu endereço ou capture sua localização."); return;
    }

    const savedUser = {
      name: name.trim(), phone: digits,
      address: address.trim() || undefined,
      complement: complement.trim() || undefined,
    };
    localStorage.setItem("grillcentral_quick_user", JSON.stringify(savedUser));

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: savedUser.name,
          customer_phone: savedUser.phone,
          items: cart.map((i) => ({ productId: i.productId ?? null, name: i.name, price: i.price, qty: i.qty, obs: i.obs })),
          subtotal,
          delivery_fee: 0,
          total: subtotal,
          order_type: orderType,
          payment,
          address_json: orderType === "delivery"
            ? { endereco: address.trim(), complemento: complement.trim(), lat, lng }
            : null,
        }),
      });
      const order = await res.json();
      if (!res.ok) {
        const detail = order.details ? `\n(${order.details})` : order.code ? `\n(code: ${order.code})` : "";
        setErr((order.error || "Erro ao registrar pedido.") + detail);
        return;
      }

      let msg = `🛒 *Pedido #${order.id} — Grill Central*\n\n`;
      msg += `👤 *Cliente:* ${savedUser.name}\n`;
      msg += `📱 *Telefone:* ${savedUser.phone}\n\n`;
      msg += `*Itens:*\n`;
      cart.forEach((i) => {
        msg += `• ${i.qty}x ${i.name} — ${fmt(i.price * i.qty)}\n`;
        if (i.obs) msg += `  _(${i.obs})_\n`;
      });
      msg += `\n✅ *Total:* ${fmt(subtotal)}\n`;
      msg += `💳 *Pagamento:* ${payment}\n\n`;
      if (orderType === "delivery") {
        const endText = address.trim() || "enviado por localização GPS";
        msg += `📍 *Endereço:* ${endText}\n`;
        if (complement.trim()) msg += `🏷️ *Ref:* ${complement.trim()}\n`;
        if (lat && lng) {
          msg += `📍 *Localização enviada pelo cliente*\n`;
          msg += `📌 *Mapa:* https://www.google.com/maps?q=${lat},${lng}\n`;
        }
      } else {
        msg += `🏠 *Retirada no local*\n`;
        if (lat && lng) msg += `📌 *Mapa:* https://www.google.com/maps?q=${lat},${lng}\n`;
      }

      localStorage.setItem("grillcentral_cart", "[]");
      // eslint-disable-next-line no-console
      console.log("FLUXO_PEDIDO_USADO", "checkout-modal");
      openRestaurantWhatsApp(msg);
      onSuccess();
    } catch {
      setErr("Erro ao registrar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const geoLabel = geoStatus === "ok" ? "✅ Localização capturada"
    : geoStatus === "err" ? "⚠ Indisponível"
    : geoStatus === "loading" ? "📍 Obtendo..."
    : "📍 Enviar minha localização";
  const geoColor = geoStatus === "ok" ? "#25D366" : geoStatus === "err" ? "#e84040" : "#9e9a90";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#111420", borderRadius: 18, width: "100%", maxWidth: 440, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>Confirmar Pedido</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9e9a90", fontSize: 24, lineHeight: 1 }}>×</button>
        </div>

        {/* Resumo */}
        <div style={{ margin: "12px 22px 0", padding: "10px 13px", background: "#0b0d12", borderRadius: 9, border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#9e9a90", marginBottom: 4 }}>{cart.reduce((s, i) => s + i.qty, 0)} item(ns)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#c9a84c" }}>Total: {fmt(subtotal)}</div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 22px 22px", overflowY: "auto" }}>

          {/* Nome */}
          <label style={lbl}>Nome completo *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e sobrenome" autoFocus style={{ ...inp, marginBottom: 12 }} />

          {/* Telefone */}
          <label style={lbl}>WhatsApp / Telefone *</label>
          <input value={phone} onChange={(e) => setPhone(fmtPhone(e.target.value))} placeholder="(92) 99999-9999" style={{ ...inp, marginBottom: 14 }} />

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }} />

          {/* Tipo */}
          <label style={lbl}>Tipo de pedido</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {([["delivery", "🛵 Entrega"], ["retirada", "🏠 Retirada"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setOrderType(v)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${orderType === v ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.1)"}`, background: orderType === v ? "rgba(201,168,76,0.12)" : "transparent", color: orderType === v ? "#c9a84c" : "#9e9a90", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: orderType === v ? 700 : 400, fontSize: 13, transition: "all 0.15s" }}>
                {l}
              </button>
            ))}
          </div>

          {/* Endereço + Geo (só delivery) */}
          {orderType === "delivery" && (
            <>
              {/* Botão de localização — destaque total */}
              {geoStatus !== "ok" ? (
                <button
                  onClick={handleGeo}
                  disabled={geoStatus === "loading"}
                  style={{ width: "100%", marginBottom: 12, padding: "13px 16px", background: geoStatus === "err" ? "rgba(232,64,64,0.1)" : "linear-gradient(135deg,rgba(37,211,102,0.18),rgba(29,185,84,0.22))", border: `1px solid ${geoStatus === "err" ? "rgba(232,64,64,0.35)" : "rgba(37,211,102,0.45)"}`, borderRadius: 12, cursor: geoStatus === "loading" ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.15s" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: geoStatus === "err" ? "#e84040" : "#25D366", fontFamily: "'DM Sans',sans-serif" }}>
                    {geoStatus === "loading" ? "📍 Obtendo localização..." : geoStatus === "err" ? "⚠ Localização indisponível" : "📍 Usar minha localização para entrega"}
                  </span>
                  {geoStatus !== "err" && geoStatus !== "loading" && (
                    <span style={{ fontSize: 11, color: "#9e9a90", fontFamily: "'DM Sans',sans-serif" }}>
                      Mais rápido, não precisa digitar endereço.
                    </span>
                  )}
                </button>
              ) : (
                <div style={{ width: "100%", marginBottom: 12, padding: "13px 16px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.4)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#25D366", fontFamily: "'DM Sans',sans-serif" }}>
                    ✅ Localização capturada — você pode finalizar sem endereço
                  </span>
                  <span style={{ fontSize: 11, color: "#9e9a90", fontFamily: "'DM Sans',sans-serif" }}>
                    Link do Maps será enviado no pedido.
                  </span>
                </div>
              )}

              <label style={{ ...lbl, marginBottom: 6 }}>Endereço {lat && lng ? "(opcional)" : "*"}</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro (ou use localização acima)" style={{ ...inp, marginBottom: 8 }} />
              <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Complemento / ponto de referência (opcional)" style={{ ...inp, marginBottom: 14 }} />
            </>
          )}

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }} />

          {/* Pagamento */}
          <label style={lbl}>Forma de pagamento *</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
            {PAYMENTS.map((p) => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 9, border: `1px solid ${payment === p ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.07)"}`, background: payment === p ? "rgba(201,168,76,0.08)" : "transparent", cursor: "pointer" }}>
                <input type="radio" name="pay" value={p} checked={payment === p} onChange={() => setPayment(p)} style={{ accentColor: "#c9a84c" }} />
                <span style={{ fontSize: 13, color: payment === p ? "#c9a84c" : "#f0ede6", fontWeight: payment === p ? 600 : 400 }}>{p}</span>
              </label>
            ))}
          </div>

          {err && (
            <div style={{ fontSize: 12, color: "#e84040", marginBottom: 12, padding: "7px 12px", background: "rgba(232,64,64,0.1)", borderRadius: 7 }}>
              {err}
            </div>
          )}

          <button onClick={handleConfirm} disabled={loading}
            style={{ width: "100%", padding: "13px 0", background: loading ? "rgba(37,211,102,0.3)" : "linear-gradient(135deg,#1db954,#25D366)", border: "none", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'DM Sans',sans-serif", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Registrando pedido..." : "Confirmar e enviar no WhatsApp →"}
          </button>

          <p style={{ fontSize: 11, color: "#3a3a3a", textAlign: "center", marginTop: 10 }}>* Campos obrigatórios · Endereço dispensável com localização</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Página do Carrinho ─── */
export default function Carrinho() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  // Número fixo como fallback garantido — atualizado pela API se disponível
  const [whatsapp, setWhatsapp] = useState("5548988362576");

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem("grillcentral_cart") || "[]")); } catch { setCart([]); }
    fetch("/api/menu").then((r) => r.ok ? r.json() : null).then((data) => {
      if (data?.restaurant?.whatsapp) setWhatsapp(data.restaurant.whatsapp);
    }).catch(() => {});
  }, []);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const update = (id: string, qty: number) => {
    const next = qty <= 0 ? cart.filter((i) => i.id !== id) : cart.map((i) => i.id === id ? { ...i, qty } : i);
    setCart(next);
    localStorage.setItem("grillcentral_cart", JSON.stringify(next));
  };

  const handleCheckoutClose = () => {
    setShowCheckout(false);
    try { setCart(JSON.parse(localStorage.getItem("grillcentral_cart") || "[]")); } catch {}
  };

  const [sending, setSending] = useState(false);

  const sendDirect = async (user: { name: string; phone: string; address?: string; complement?: string; lat?: number; lng?: number }) => {
    const orderType: "delivery" | "retirada" = "delivery";
    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: user.name,
          customer_phone: user.phone,
          items: cart.map((i) => ({ productId: i.productId ?? null, name: i.name, price: i.price, qty: i.qty, obs: i.obs })),
          subtotal,
          delivery_fee: 0,
          total: subtotal,
          order_type: orderType,
          payment: "A confirmar",
          address_json: orderType === "delivery" ? { endereco: user.address || "", complemento: user.complement || "" } : null,
        }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || "api_error");

      let msg = `🛒 *Pedido #${order.id} — Grill Central*\n\n`;
      msg += `👤 *Cliente:* ${user.name}\n`;
      msg += `📱 *Telefone:* ${user.phone}\n\n`;
      msg += `*Itens:*\n`;
      cart.forEach((i) => { msg += `• ${i.qty}x ${i.name} — ${fmt(i.price * i.qty)}\n`; if (i.obs) msg += `  _(${i.obs})_\n`; });
      msg += `\n✅ *Total:* ${fmt(subtotal)}\n`;
      msg += `💳 *Pagamento:* A confirmar\n\n`;
      if (orderType === "delivery") {
        msg += `📍 *Endereço:* ${user.address || "a combinar"}\n`;
        if (user.complement) msg += `🏷️ *Ref:* ${user.complement}\n`;
      } else {
        msg += `🏠 *Retirada no local*\n`;
      }

      localStorage.setItem("grillcentral_cart", "[]");
      setCart([]);
      // eslint-disable-next-line no-console
      console.log("FLUXO_PEDIDO_USADO", "send-direct");
      openRestaurantWhatsApp(msg);
    } catch {
      setShowCheckout(true);
    } finally {
      setSending(false);
    }
  };

  const handleEnviar = () => {
    if (cart.length === 0) return;
    setShowCheckout(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d12", color: "#f0ede6", fontFamily: "'DM Sans',sans-serif", paddingBottom: 100 }}>

      {/* TopBar */}
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(11,13,18,0.97)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c", fontSize: 13, fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
          ← Cardápio
        </button>
        <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 15, color: "#c9a84c" }}>Carrinho</span>
        <div style={{ width: 70 }} />
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>

        {/* Itens */}
        <div style={{ background: "#111420", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700, color: "#c9a84c" }}>🛒 Seus itens</div>
            <button onClick={() => router.push("/")} style={{ background: "#c9a84c18", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, cursor: "pointer", color: "#c9a84c", fontSize: 12, fontWeight: 600, padding: "5px 12px", fontFamily: "'DM Sans',sans-serif" }}>
              + Adicionar
            </button>
          </div>

          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 20px", color: "#5a5650" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div>
              <div style={{ fontSize: 13 }}>Carrinho vazio.</div>
            </div>
          ) : (
            <>
              {cart.map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => update(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(232,64,64,0.15)", border: "1px solid rgba(232,64,64,0.3)", cursor: "pointer", color: "#e84040", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>−</button>
                    <span style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 600 }}>{item.qty}x</span>
                    <button onClick={() => update(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.3)", cursor: "pointer", color: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>+</button>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#f0ede6", lineHeight: 1.3 }}>{item.name}</div>
                    {item.obs && <div style={{ fontSize: 11, color: "#5a5650", fontStyle: "italic" }}>{item.obs}</div>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c", flexShrink: 0 }}>{fmt(item.price * item.qty)}</div>
                  <button onClick={() => update(item.id, 0)} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(232,64,64,0.1)", border: "none", cursor: "pointer", color: "#e84040", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                  </button>
                </div>
              ))}

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#9e9a90", fontSize: 13 }}>Subtotal</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: "#c9a84c" }}>{fmt(subtotal)}</span>
              </div>
            </>
          )}
        </div>

      </div>

      {/* Sticky button */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "rgba(11,13,18,0.97)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.06)", zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <button onClick={handleEnviar} disabled={sending}
            style={{ width: "100%", padding: "15px 0", background: cart.length === 0 ? "rgba(255,255,255,0.05)" : sending ? "rgba(201,168,76,0.4)" : "linear-gradient(135deg,#e8833a,#c9a84c)", border: "none", borderRadius: 12, cursor: cart.length === 0 || sending ? "not-allowed" : "pointer", color: cart.length === 0 ? "#5a5650" : "#0b0d12", fontWeight: 800, fontSize: 16, fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: sending ? 0.7 : 1 }}>
            {cart.length === 0 ? "Carrinho vazio" : sending ? "Registrando pedido..." : `ENVIAR PEDIDO → ${fmt(subtotal)}`}
          </button>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          cart={cart}
          subtotal={subtotal}
          whatsapp={whatsapp}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => { localStorage.setItem("grillcentral_cart", "[]"); setCart([]); setShowCheckout(false); router.push("/"); }}
        />
      )}
    </div>
  );
}
