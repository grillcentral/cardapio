"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

// ── Types ─────────────────────────────────────────────────────────────────────
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
  createdAt: string;
  items: OrderItem[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES = [
  { value: "RECEIVED",   label: "Recebido",   color: "#c9a84c", bg: "rgba(201,168,76,0.15)",   icon: "🔔" },
  { value: "CONFIRMED",  label: "Confirmado", color: "#7b8ee8", bg: "rgba(123,142,232,0.15)",  icon: "✅" },
  { value: "PREPARING",  label: "Preparando", color: "#e8833a", bg: "rgba(232,131,58,0.15)",   icon: "👨‍🍳" },
  { value: "READY",      label: "Pronto",     color: "#4caf50", bg: "rgba(76,175,80,0.15)",    icon: "🟢" },
  { value: "DELIVERED",  label: "Entregue",   color: "#9e9a90", bg: "rgba(158,154,144,0.15)",  icon: "📦" },
  { value: "CANCELLED",  label: "Cancelado",  color: "#e84040", bg: "rgba(232,64,64,0.15)",    icon: "✖" },
] as const;

const STATUS_NEXT: Record<string, string> = {
  RECEIVED:  "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY:     "DELIVERED",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery:       "🛵 Entrega",
  retirada:       "🏠 Retirada",
  whatsapp_direct:"💬 WhatsApp",
};

const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusInfo(value: string) {
  return STATUSES.find((s) => s.value === value) ?? {
    value, label: value, color: "#9e9a90", bg: "rgba(158,154,144,0.15)", icon: "❓",
  };
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = statusInfo(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.color}40`,
      whiteSpace: "nowrap",
    }}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Status Selector Dropdown ──────────────────────────────────────────────────
function StatusSelector({ orderId, current, onChanged }: {
  orderId: number;
  current: string;
  onChanged: (id: number, newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = async (status: string) => {
    if (status === current) { setOpen(false); return; }
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/admin/pedidos/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) onChanged(orderId, status);
    } catch {
      // silent — UI stays unchanged so user retries
    } finally {
      setLoading(false);
    }
  };

  const si = statusInfo(current);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        title="Alterar status"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px 4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: si.bg, color: si.color, border: `1px solid ${si.color}50`,
          cursor: loading ? "wait" : "pointer", whiteSpace: "nowrap",
          transition: "opacity 0.15s", opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "⏳" : si.icon} {si.label}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300,
          background: "#111420", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: 4, minWidth: 150,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => select(s.value)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 12px", border: "none", borderRadius: 7,
                background: s.value === current ? s.bg : "transparent",
                color: s.value === current ? s.color : "#9e9a90",
                fontWeight: s.value === current ? 700 : 400, fontSize: 12,
                cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                textAlign: "left",
              }}
            >
              <span>{s.icon}</span> {s.label}
              {s.value === current && <span style={{ marginLeft: "auto", fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onStatusChange }: {
  order: Order;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(order.status === "RECEIVED" || order.status === "CONFIRMED" || order.status === "PREPARING");

  const address = (() => {
    try {
      if (!order.addressJson) return null;
      const a = JSON.parse(order.addressJson);
      const parts = [a.endereco, a.complemento].filter(Boolean);
      return parts.join(" · ") || null;
    } catch { return null; }
  })();

  const nextStatus = STATUS_NEXT[order.status];

  return (
    <div style={{
      background: "#111420", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.07)",
      overflow: "hidden",
      borderLeft: `3px solid ${statusInfo(order.status).color}`,
      transition: "border-color 0.2s",
    }}>
      {/* ── Card header ── */}
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
          cursor: "pointer", flexWrap: "wrap",
        }}
      >
        {/* ID + hora */}
        <div style={{ minWidth: 90, flexShrink: 0 }}>
          <div style={{ fontWeight: 800, color: "#c9a84c", fontSize: 14 }}>#{order.id}</div>
          <div style={{ fontSize: 11, color: "#5a5650", marginTop: 1 }}>{fmtDate(order.createdAt)}</div>
        </div>

        {/* Cliente */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#f0ede6", lineHeight: 1.2 }}>
            {order.customerName || "Cliente"}
          </div>
          {order.customerPhone && (
            <a
              href={`https://wa.me/55${order.customerPhone.replace(/\D/g, "")}`}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, color: "#25D366", textDecoration: "none" }}
            >
              📱 {order.customerPhone}
            </a>
          )}
        </div>

        {/* Tipo + pagamento */}
        <div style={{ minWidth: 100, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#9e9a90" }}>
            {ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}
          </div>
          <div style={{ fontSize: 11, color: "#5a5650", marginTop: 2 }}>{order.payment}</div>
        </div>

        {/* Total */}
        <div style={{ fontWeight: 800, fontSize: 16, color: "#c9a84c", flexShrink: 0, minWidth: 80, textAlign: "right" }}>
          {fmt(order.total)}
        </div>

        {/* Status selector */}
        <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <StatusSelector orderId={order.id} current={order.status} onChanged={onStatusChange} />
        </div>

        {/* Expand arrow */}
        <span style={{ color: "#5a5650", fontSize: 12, flexShrink: 0, transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▼
        </span>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px" }}>

          {/* Items */}
          <div style={{ marginBottom: address || order.notes ? 12 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#5a5650", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Itens ({order.items.length})
            </div>
            {order.items.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontWeight: 700, color: "#c9a84c", fontSize: 13, minWidth: 24 }}>
                  {item.qty}×
                </span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: "#f0ede6" }}>{item.name}</span>
                  {item.obs && (
                    <div style={{ fontSize: 11, color: "#5a5650", fontStyle: "italic", marginTop: 1 }}>
                      obs: {item.obs}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "#9e9a90", flexShrink: 0 }}>
                  {fmt(item.price * item.qty)}
                </span>
              </div>
            ))}

            {/* Totais */}
            <div style={{ marginTop: 8, paddingTop: 6, display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
              {order.deliveryFee > 0 && (
                <>
                  <span style={{ fontSize: 11, color: "#5a5650" }}>Subtotal: {fmt(order.subtotal)}</span>
                  <span style={{ fontSize: 11, color: "#5a5650" }}>Entrega: {fmt(order.deliveryFee)}</span>
                </>
              )}
              <span style={{ fontWeight: 800, fontSize: 14, color: "#c9a84c" }}>Total: {fmt(order.total)}</span>
            </div>
          </div>

          {/* Endereço */}
          {address && (
            <div style={{ marginBottom: 8, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#5a5650", textTransform: "uppercase", letterSpacing: "0.06em" }}>📍 Endereço</span>
              <div style={{ fontSize: 12, color: "#9e9a90", marginTop: 3 }}>{address}</div>
            </div>
          )}

          {/* Observações */}
          {order.notes && (
            <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#5a5650", textTransform: "uppercase", letterSpacing: "0.06em" }}>Obs</span>
              <div style={{ fontSize: 12, color: "#9e9a90", marginTop: 3 }}>{order.notes}</div>
            </div>
          )}

          {/* Botão de avanço rápido */}
          {nextStatus && (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  fetch(`/api/admin/pedidos/${order.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: nextStatus }),
                  })
                    .then((r) => r.json())
                    .then((updated) => { if (updated.id) onStatusChange(order.id, nextStatus); })
                    .catch(() => {});
                }}
                style={{
                  padding: "7px 16px", fontSize: 12, fontWeight: 700,
                  background: statusInfo(nextStatus).bg,
                  color: statusInfo(nextStatus).color,
                  border: `1px solid ${statusInfo(nextStatus).color}50`,
                  borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                }}
              >
                {statusInfo(nextStatus).icon} Avançar para {statusInfo(nextStatus).label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async (status: string, showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const url = status === "active"
        ? "/api/admin/pedidos?limit=100"
        : status === "all"
        ? "/api/admin/pedidos?limit=100"
        : `/api/admin/pedidos?status=${status}&limit=100`;

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      // "active" = pedidos não finalizados
      const list: Order[] = Array.isArray(data.orders) ? data.orders : [];
      const filtered = status === "active"
        ? list.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status))
        : list;

      setOrders(filtered);
      setTotal(data.total ?? filtered.length);
      setStatusCounts(data.statusCounts ?? {});
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchOrders(filterStatus, true);
  }, [fetchOrders, filterStatus]);

  // Auto-refresh a cada 30s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchOrders(filterStatus), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchOrders, filterStatus]);

  const handleStatusChange = useCallback((id: number, newStatus: string) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
    setStatusCounts((prev) => {
      const updated = { ...prev };
      const old = orders.find((o) => o.id === id)?.status;
      if (old) updated[old] = Math.max((updated[old] ?? 1) - 1, 0);
      updated[newStatus] = (updated[newStatus] ?? 0) + 1;
      return updated;
    });
    // Se estiver no filtro "active" e o status virou DELIVERED/CANCELLED, remover da lista
    if (filterStatus === "active" && ["DELIVERED", "CANCELLED"].includes(newStatus)) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    }
  }, [orders, filterStatus]);

  const totalActive = (statusCounts["RECEIVED"] ?? 0)
    + (statusCounts["CONFIRMED"] ?? 0)
    + (statusCounts["PREPARING"] ?? 0)
    + (statusCounts["READY"] ?? 0);

  const filterBtns = [
    { key: "active",    label: "Em Aberto",   count: totalActive,                      color: "#c9a84c" },
    { key: "all",       label: "Todos",        count: Object.values(statusCounts).reduce((a, b) => a + b, 0), color: "#9e9a90" },
    ...STATUSES.map((s) => ({ key: s.value, label: s.label, count: statusCounts[s.value] ?? 0, color: s.color })),
  ];

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0ede6", margin: 0 }}>Pedidos</h1>
            <p style={{ color: "#5a5650", fontSize: 12, margin: "4px 0 0" }}>
              Atualizado às {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              &nbsp;·&nbsp;auto-refresh 30s
            </p>
          </div>
          <button
            onClick={() => fetchOrders(filterStatus, true)}
            style={{
              padding: "8px 16px", background: "rgba(201,168,76,0.1)",
              border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8,
              color: "#c9a84c", fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            🔄 Atualizar
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {filterBtns.map((f) => {
            const active = filterStatus === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
                  background: active ? `${f.color}20` : "transparent",
                  color: active ? f.color : "#5a5650",
                  border: `1px solid ${active ? f.color + "50" : "rgba(255,255,255,0.07)"}`,
                  cursor: "pointer", fontFamily: "DM Sans, sans-serif", transition: "all 0.15s",
                }}
              >
                {f.label}
                {f.count > 0 && (
                  <span style={{
                    background: active ? f.color : "rgba(255,255,255,0.1)",
                    color: active ? "#0b0d12" : "#9e9a90",
                    borderRadius: "50%", minWidth: 18, height: 18,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, padding: "0 4px",
                  }}>
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Orders list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#5a5650", fontSize: 14 }}>
            Carregando pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#5a5650" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14 }}>
              {filterStatus === "active" ? "Nenhum pedido em aberto." : "Nenhum pedido encontrado."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#5a5650", marginBottom: 2 }}>
              {orders.length} pedido{orders.length !== 1 ? "s" : ""}
              {filterStatus !== "all" && total !== orders.length ? ` de ${total} no total` : ""}
            </div>
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
