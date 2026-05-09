"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { printOrder } from "@/lib/printOrder";

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrderItem {
  id: number;
  name: string;
  qty: number;
  price: number;
  obs: string | null;
}

interface Order {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  orderType: string;
  payment: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  addressJson: string | null;
  notes: string | null;
  status: string;
  autoAccepted: boolean;
  createdAt: string;
  items: OrderItem[];
}

// ── Constants ──────────────────────────────────────────────────────────────────
const KITCHEN_STATUSES = [
  { value: "RECEIVED",  label: "NOVO",       color: "#e84040", bg: "rgba(232,64,64,0.12)",   glow: "rgba(232,64,64,0.35)",  icon: "🔔" },
  { value: "CONFIRMED", label: "CONFIRMADO", color: "#7b8ee8", bg: "rgba(123,142,232,0.10)", glow: "rgba(123,142,232,0.3)", icon: "✅" },
  { value: "PREPARING", label: "PREPARANDO", color: "#e8833a", bg: "rgba(232,131,58,0.10)",  glow: "rgba(232,131,58,0.3)",  icon: "🍳" },
  { value: "READY",     label: "PRONTO",     color: "#4caf50", bg: "rgba(76,175,80,0.12)",   glow: "rgba(76,175,80,0.4)",   icon: "✔" },
] as const;

const STATUS_NEXT: Record<string, string | null> = {
  RECEIVED: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: null,
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery:        "🛵 Entrega",
  retirada:        "🏠 Retirada",
  whatsapp_direct: "💬 WhatsApp",
};

function statusInfo(value: string) {
  return KITCHEN_STATUSES.find((s) => s.value === value) ?? {
    value, label: value, color: "#9e9a90", bg: "rgba(158,154,144,0.1)", glow: "transparent", icon: "❓",
  };
}

// ── Sound ──────────────────────────────────────────────────────────────────────
function playNewOrderSound() {
  try {
    const audio = new Audio("/sounds/new-order.mp3");
    audio.volume = 0.7;
    audio.play().catch(() => {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
      } catch { /* silencioso */ }
    });
  } catch { /* silencioso */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

// ── Kitchen Card ──────────────────────────────────────────────────────────────
function KitchenCard({
  order,
  onAdvance,
  isNew,
}: {
  order: Order;
  onAdvance: (id: number, nextStatus: string) => void;
  isNew: boolean;
}) {
  const si = statusInfo(order.status);
  const next = STATUS_NEXT[order.status];
  const isReady = order.status === "READY";
  const mins = minutesAgo(order.createdAt);
  const isUrgent = mins >= 15 && order.status !== "READY";
  const [pressing, setPressing] = useState(false);
  const advancingRef = useRef(false);

  const handleClick = async () => {
    if (!next || advancingRef.current) return;
    advancingRef.current = true;
    setPressing(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) onAdvance(order.id, next);
    } catch { /* silent */ }
    finally {
      setPressing(false);
      advancingRef.current = false;
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: isReady ? "rgba(76,175,80,0.1)" : "#12151f",
        border: `2px solid ${si.color}`,
        borderRadius: 16,
        overflow: "hidden",
        cursor: next ? "pointer" : "default",
        opacity: pressing ? 0.75 : 1,
        transition: "opacity 0.15s, box-shadow 0.2s",
        boxShadow: isReady
          ? `0 0 0 1px ${si.glow}, 0 0 24px ${si.glow}`
          : isNew
          ? `0 0 0 1px ${si.glow}, 0 0 16px ${si.glow}`
          : `0 2px 12px rgba(0,0,0,0.5)`,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* ── Card header ── */}
      <div style={{
        background: si.bg,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: `1px solid ${si.color}30`,
      }}>
        {/* Order number */}
        <div style={{ fontWeight: 900, fontSize: 22, color: si.color, letterSpacing: "-0.5px", lineHeight: 1 }}>
          #{order.id}
        </div>

        {/* NEW badge */}
        {isNew && (
          <span style={{
            background: "#e84040", color: "#fff", fontSize: 10, fontWeight: 800,
            padding: "2px 7px", borderRadius: 10, letterSpacing: "0.06em",
            animation: "pulseNew 1.2s ease-in-out infinite",
          }}>
            NOVO
          </span>
        )}

        {/* Auto-aceito badge */}
        {order.autoAccepted && (
          <span style={{
            background: "rgba(76,175,80,0.18)", color: "#4caf50",
            border: "1px solid rgba(76,175,80,0.4)",
            fontSize: 9, fontWeight: 700,
            padding: "2px 7px", borderRadius: 10, letterSpacing: "0.05em",
          }}>
            ⚡ AUTO
          </span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Time + urgency */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: isUrgent ? "#e84040" : "#9e9a90" }}>
            {fmtTime(order.createdAt)}
          </div>
          <div style={{ fontSize: 11, color: isUrgent ? "#e84040" : "#5a5650", fontWeight: isUrgent ? 700 : 400 }}>
            {mins}min{isUrgent ? " ⚠" : ""}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "12px 14px" }}>

        {/* Customer + type */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#f0ede6", lineHeight: 1.2 }}>
            {order.customerName || "Cliente"}
          </div>
          <div style={{ fontSize: 12, color: "#9e9a90", flexShrink: 0 }}>
            {ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}
          </div>
        </div>

        {/* Items — large and readable */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {order.items.map((item) => (
            <div key={item.id} style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "8px 10px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 10,
              borderLeft: `3px solid ${si.color}60`,
            }}>
              {/* Qty */}
              <span style={{
                fontWeight: 900, fontSize: 20, color: si.color,
                lineHeight: 1, minWidth: 28, textAlign: "center",
              }}>
                {item.qty}×
              </span>
              {/* Name + obs */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#f0ede6", lineHeight: 1.3 }}>
                  {item.name}
                </div>
                {item.obs && (
                  <div style={{
                    fontSize: 13, color: "#e8833a", fontStyle: "italic",
                    marginTop: 3, fontWeight: 600,
                    background: "rgba(232,131,58,0.1)", padding: "2px 6px", borderRadius: 6,
                    display: "inline-block",
                  }}>
                    ⚠ {item.obs}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* General notes */}
        {order.notes && (
          <div style={{
            marginTop: 10, padding: "8px 10px",
            background: "rgba(232,131,58,0.08)",
            border: "1px solid rgba(232,131,58,0.3)",
            borderRadius: 10, fontSize: 13, color: "#e8833a", fontWeight: 600,
          }}>
            📝 {order.notes}
          </div>
        )}

        {/* Footer: total + imprimir + action hint */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#c9a84c" }}>
              R$ {order.total.toFixed(2).replace(".", ",")}
            </div>
            {/* Botão imprimir — stopPropagation para não avançar o status */}
            <button
              onClick={(e) => { e.stopPropagation(); printOrder(order); }}
              style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 600,
                background: "rgba(255,255,255,0.07)",
                color: "#9e9a90",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 16, cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              🖨️
            </button>
          </div>

          {next && (
            <div style={{
              fontSize: 11, color: si.color, fontWeight: 700,
              background: si.bg, padding: "4px 10px", borderRadius: 20,
              border: `1px solid ${si.color}40`,
            }}>
              Toque → {statusInfo(next).label}
            </div>
          )}
          {!next && (
            <div style={{ fontSize: 12, color: "#4caf50", fontWeight: 700 }}>
              ✔ Finalizado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────
function KitchenColumn({
  statusValue,
  orders,
  newIds,
  onAdvance,
}: {
  statusValue: string;
  orders: Order[];
  newIds: Set<number>;
  onAdvance: (id: number, nextStatus: string) => void;
}) {
  const si = statusInfo(statusValue);

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 0, minWidth: 0,
    }}>
      {/* Column header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px",
        background: si.bg,
        borderRadius: "12px 12px 0 0",
        border: `1px solid ${si.color}40`,
        borderBottom: "none",
        marginBottom: 0,
      }}>
        <span style={{ fontSize: 18 }}>{si.icon}</span>
        <span style={{ fontWeight: 800, fontSize: 14, color: si.color, letterSpacing: "0.04em" }}>
          {si.label}
        </span>
        {orders.length > 0 && (
          <span style={{
            background: si.color, color: "#0a0c10",
            borderRadius: "50%", width: 22, height: 22,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 900, marginLeft: "auto",
          }}>
            {orders.length}
          </span>
        )}
      </div>

      {/* Cards */}
      <div style={{
        border: `1px solid ${si.color}30`,
        borderRadius: "0 0 12px 12px",
        borderTop: `2px solid ${si.color}`,
        background: "#0d0f18",
        minHeight: 80,
        padding: orders.length > 0 ? 10 : 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {orders.length === 0 ? (
          <div style={{
            padding: "30px 0", textAlign: "center",
            color: "#2a2d38", fontSize: 14, fontWeight: 600,
          }}>
            —
          </div>
        ) : (
          orders.map((order) => (
            <KitchenCard
              key={order.id}
              order={order}
              onAdvance={onAdvance}
              isNew={newIds.has(order.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CozinhaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [now, setNow] = useState<Date>(new Date());
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);

  const lastKnownMaxIdRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track IDs já impressos automaticamente para não reimprimir no próximo poll
  const autoPrintedRef = useRef<Set<number>>(new Set());
  // Ref espelho de autoPrintEnabled para uso dentro do callback sem re-criar
  const autoPrintEnabledRef = useRef(false);

  // Busca configuração de auto-print ao montar (uma única vez)
  useEffect(() => {
    fetch("/api/admin/restaurante")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.autoPrintOnAccept) {
          setAutoPrintEnabled(true);
          autoPrintEnabledRef.current = true;
        }
      })
      .catch(() => { /* silencioso — auto-print permanece desativado */ });
  }, []);

  const fetchOrders = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch("/api/admin/pedidos?limit=200");
      if (!res.ok) return;
      const data = await res.json();

      const list: Order[] = Array.isArray(data.orders) ? data.orders : [];
      const active = list.filter((o) =>
        ["RECEIVED", "CONFIRMED", "PREPARING", "READY"].includes(o.status)
      );

      // Detect new orders
      const maxId = list.reduce((m, o) => Math.max(m, o.id), 0);
      if (!isInitialLoadRef.current && maxId > lastKnownMaxIdRef.current) {
        const incoming = list.filter((o) => o.id > lastKnownMaxIdRef.current);
        setNewIds((prev) => new Set([...prev, ...incoming.map((o) => o.id)]));
        playNewOrderSound();

        // Auto-print: disparar impressão para pedidos auto-aceitos novos
        if (autoPrintEnabledRef.current) {
          incoming
            .filter((o) => o.autoAccepted && o.status === "CONFIRMED" && !autoPrintedRef.current.has(o.id))
            .forEach((o) => {
              autoPrintedRef.current.add(o.id);
              // Pequeno delay para dar tempo ao browser de renderizar antes do print
              setTimeout(() => printOrder(o), 600);
            });
        }
      }
      lastKnownMaxIdRef.current = Math.max(lastKnownMaxIdRef.current, maxId);
      isInitialLoadRef.current = false;

      setOrders(active);
      setLastRefresh(new Date());
    } catch { /* silent */ }
    finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  // Initial load + 15s auto-refresh
  useEffect(() => {
    fetchOrders(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchOrders(), 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchOrders]);

  // Live clock
  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 30_000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  // Tab title
  const receivedCount = orders.filter((o) => o.status === "RECEIVED").length;
  useEffect(() => {
    document.title = receivedCount > 0 ? `(${receivedCount}) 🔔 Cozinha` : "🍳 Cozinha";
    return () => { document.title = "Cozinha"; };
  }, [receivedCount]);

  const handleAdvance = useCallback((id: number, nextStatus: string) => {
    setOrders((prev) => {
      const updated = prev
        .map((o) => (o.id === id ? { ...o, status: nextStatus } : o))
        // Remove from active if status went beyond READY (shouldn't happen here, but safety)
        .filter((o) => ["RECEIVED", "CONFIRMED", "PREPARING", "READY"].includes(o.status));
      return updated;
    });
    // Remove "new" badge once order is advanced
    setNewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Group by status
  const byStatus = KITCHEN_STATUSES.reduce((acc, s) => {
    acc[s.value] = orders
      .filter((o) => o.status === s.value)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return acc;
  }, {} as Record<string, Order[]>);

  const totalActive = orders.length;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0c10; }
        @keyframes pulseNew {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.6; transform: scale(1.12); }
        }
        @keyframes pulseBadge {
          0%,100% { box-shadow: 0 0 0 0 rgba(232,64,64,0.7); }
          50%      { box-shadow: 0 0 0 6px rgba(232,64,64,0); }
        }
        ::-webkit-scrollbar { width: 6px; background: #0a0c10; }
        ::-webkit-scrollbar-thumb { background: #1e2130; border-radius: 3px; }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "#0a0c10",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: "#f0ede6", display: "flex", flexDirection: "column",
      }}>
        {/* ── Top bar ── */}
        <header style={{
          height: 56, background: "#0d0f18",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 16, flexShrink: 0,
          position: "sticky", top: 0, zIndex: 50,
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🍳</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#c9a84c", letterSpacing: "-0.3px" }}>
              COZINHA
            </span>
          </div>

          {/* Status pills */}
          <div style={{ display: "flex", gap: 6, flex: 1, overflowX: "auto" }}>
            {KITCHEN_STATUSES.map((s) => {
              const count = byStatus[s.value]?.length ?? 0;
              return (
                <div key={s.value} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                  background: count > 0 ? s.bg : "rgba(255,255,255,0.04)",
                  border: `1px solid ${count > 0 ? s.color + "50" : "rgba(255,255,255,0.07)"}`,
                }}>
                  <span style={{ fontSize: 12 }}>{s.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: count > 0 ? s.color : "#3a3d48" }}>
                    {s.label}
                  </span>
                  <span style={{
                    background: count > 0 ? s.color : "#2a2d38",
                    color: count > 0 ? "#0a0c10" : "#5a5650",
                    borderRadius: "50%", width: 18, height: 18,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 900,
                    animation: s.value === "RECEIVED" && count > 0 ? "pulseBadge 1.5s ease-in-out infinite" : "none",
                  }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right: clock + total + refresh */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            {autoPrintEnabled && (
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#4caf50",
                background: "rgba(76,175,80,0.12)", border: "1px solid rgba(76,175,80,0.3)",
                borderRadius: 8, padding: "3px 8px", letterSpacing: "0.04em",
              }}>
                ⚡ AUTO-PRINT
              </div>
            )}
            {totalActive > 0 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c" }}>
                {totalActive} ativo{totalActive !== 1 ? "s" : ""}
              </div>
            )}
            <div style={{ fontSize: 13, color: "#5a5650", fontWeight: 600 }}>
              {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <button
              onClick={() => fetchOrders(true)}
              style={{
                background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)",
                borderRadius: 8, padding: "5px 12px", cursor: "pointer",
                color: "#c9a84c", fontSize: 12, fontWeight: 600,
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              🔄
            </button>
            <a
              href="/admin/pedidos"
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "5px 12px", cursor: "pointer",
                color: "#9e9a90", fontSize: 12, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Admin
            </a>
          </div>
        </header>

        {/* ── Main grid ── */}
        <main style={{ flex: 1, padding: "16px", overflow: "auto" }}>
          {loading ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "60vh", fontSize: 18, color: "#5a5650",
            }}>
              Carregando pedidos...
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 14,
              alignItems: "start",
            }}
            className="kitchen-grid"
            >
              {KITCHEN_STATUSES.map((s) => (
                <KitchenColumn
                  key={s.value}
                  statusValue={s.value}
                  orders={byStatus[s.value] ?? []}
                  newIds={newIds}
                  onAdvance={handleAdvance}
                />
              ))}
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer style={{
          height: 32, background: "#0d0f18",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center",
          padding: "0 20px", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: "#3a3d48" }}>
            Auto-refresh 15s · Toque no card para avançar status
          </span>
          <span style={{ fontSize: 11, color: "#3a3d48" }}>
            Atualizado {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </footer>
      </div>

      {/* Responsive: tablet 2 cols, mobile 1 col */}
      <style>{`
        @media (max-width: 900px) {
          .kitchen-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 520px) {
          .kitchen-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
