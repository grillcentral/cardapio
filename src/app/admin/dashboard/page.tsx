"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────
interface HourSlot { hour: number; count: number; }
interface RecentOrder {
  id: number;
  customerName: string | null;
  orderType: string;
  total: number;
  status: string;
  createdAt: string;
}
interface TopProduct { name: string; qty: number; }

interface DashData {
  period: string;
  ordersCount: number;
  revenue: number;
  avgTicket: number;
  openOrders: number;
  delivered: number;
  cancelled: number;
  hourlyOrders: HourSlot[];
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
}

// ── Constants ──────────────────────────────────────────────────────────────────
type Period = "today" | "7d" | "30d";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d",   label: "7 dias" },
  { key: "30d",  label: "30 dias" },
];

const STATUS_LABELS: Record<string, string> = {
  RECEIVED:  "Recebido",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  READY:     "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  RECEIVED:  "#c9a84c",
  CONFIRMED: "#7b8ee8",
  PREPARING: "#e8833a",
  READY:     "#4caf50",
  DELIVERED: "#9e9a90",
  CANCELLED: "#e84040",
};
const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery:        "🛵 Entrega",
  retirada:        "🏠 Retirada",
  whatsapp_direct: "💬 WhatsApp",
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 20, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg, #1a1d2a 25%, #222538 50%, #1a1d2a 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s ease-in-out infinite",
    }} />
  );
}

// ── Metric Card ────────────────────────────────────────────────────────────────
function MetricCard({
  icon, label, value, sub, color, loading,
}: {
  icon: string; label: string; value: string; sub?: string;
  color: string; loading: boolean;
}) {
  return (
    <div style={{
      background: "#111420", borderRadius: 14, padding: "18px 20px",
      border: "1px solid rgba(255,255,255,0.07)",
      borderTop: `3px solid ${color}`,
      flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      {loading ? (
        <>
          <Skeleton h={28} r={6} />
          <div style={{ marginTop: 6 }}><Skeleton h={12} w="60%" r={4} /></div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: "#5a5650", marginTop: 5 }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: "#3a3d48", marginTop: 2 }}>{sub}</div>}
        </>
      )}
    </div>
  );
}

// ── Hourly Bar Chart ───────────────────────────────────────────────────────────
function HourlyChart({ data, loading }: { data: HourSlot[]; loading: boolean }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const nowHour = new Date().getHours();

  return (
    <div style={{
      background: "#111420", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.07)", padding: "18px 20px",
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#f0ede6", marginBottom: 4 }}>
        Pedidos por hora
      </div>
      <div style={{ fontSize: 11, color: "#5a5650", marginBottom: 16 }}>
        Últimas 24h · horário de Brasília
      </div>

      {loading ? (
        <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 80 }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton key={i} w="100%" h={Math.random() * 70 + 10} r={3} />
          ))}
        </div>
      ) : (
        <>
          {/* Bars */}
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 80, marginBottom: 4 }}>
            {data.map((slot) => {
              const pct = max > 0 ? (slot.count / max) * 100 : 0;
              const isCurrent = slot.hour === nowHour;
              return (
                <div
                  key={slot.hour}
                  title={`${String(slot.hour).padStart(2, "0")}h: ${slot.count} pedido${slot.count !== 1 ? "s" : ""}`}
                  style={{
                    flex: 1,
                    height: `${Math.max(pct, slot.count > 0 ? 8 : 2)}%`,
                    background: isCurrent
                      ? "#c9a84c"
                      : slot.count > 0
                      ? "rgba(201,168,76,0.5)"
                      : "rgba(255,255,255,0.05)",
                    borderRadius: "3px 3px 0 0",
                    transition: "height 0.3s ease",
                    cursor: "default",
                    minHeight: 2,
                  }}
                />
              );
            })}
          </div>

          {/* Hour labels — show every 4 hours */}
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
            {data.map((slot) => (
              <div key={slot.hour} style={{
                flex: 1, textAlign: "center",
                fontSize: 9, color: slot.hour % 4 === 0 ? "#5a5650" : "transparent",
                lineHeight: 1, userSelect: "none",
              }}>
                {String(slot.hour).padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, background: "#c9a84c", borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: "#5a5650" }}>Hora atual</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, background: "rgba(201,168,76,0.5)", borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: "#5a5650" }}>Com pedidos</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Top Products ───────────────────────────────────────────────────────────────
function TopProducts({ data, loading }: { data: TopProduct[]; loading: boolean }) {
  const maxQty = Math.max(...data.map((p) => p.qty), 1);

  return (
    <div style={{
      background: "#111420", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.07)", padding: "18px 20px",
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#f0ede6", marginBottom: 16 }}>
        Top 5 produtos
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[80, 65, 50, 40, 30].map((w, i) => (
            <Skeleton key={i} h={32} r={6} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: "#3a3d48", fontSize: 13 }}>
          Sem dados no período
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.map((p, i) => {
            const pct = (p.qty / maxQty) * 100;
            return (
              <div key={p.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#f0ede6", fontWeight: 600 }}>
                    <span style={{ color: "#5a5650", marginRight: 6, fontSize: 11 }}>#{i + 1}</span>
                    {p.name}
                  </span>
                  <span style={{ fontSize: 12, color: "#c9a84c", fontWeight: 700 }}>
                    {p.qty}×
                  </span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: "linear-gradient(90deg, #c9a84c, #e4c97e)",
                    borderRadius: 2, transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Recent Orders Table ────────────────────────────────────────────────────────
function RecentOrdersTable({ orders, loading }: { orders: RecentOrder[]; loading: boolean }) {
  return (
    <div style={{
      background: "#111420", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#f0ede6" }}>Últimos pedidos</div>
        <Link href="/admin/pedidos" style={{
          fontSize: 11, color: "#c9a84c", textDecoration: "none", fontWeight: 600,
        }}>
          Ver todos →
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3,4,5].map((i) => <Skeleton key={i} h={20} r={5} />)}
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "#3a3d48", fontSize: 13 }}>
          Nenhum pedido ainda.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["#", "Cliente", "Tipo", "Total", "Status", "Horário"].map((h) => (
                  <th key={h} style={{
                    padding: "9px 16px", textAlign: "left",
                    color: "#3a3d48", fontWeight: 600, fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const sc = STATUS_COLORS[o.status] ?? "#9e9a90";
                return (
                  <tr key={o.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "11px 16px", color: "#c9a84c", fontWeight: 700 }}>#{o.id}</td>
                    <td style={{ padding: "11px 16px", color: "#f0ede6" }}>{o.customerName || "—"}</td>
                    <td style={{ padding: "11px 16px", color: "#9e9a90", whiteSpace: "nowrap" }}>
                      {ORDER_TYPE_LABELS[o.orderType] ?? o.orderType}
                    </td>
                    <td style={{ padding: "11px 16px", color: "#c9a84c", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {fmt(o.total)}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{
                        padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: `${sc}18`, color: sc,
                      }}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", color: "#5a5650", fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtShort(o.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Dashboard Page ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (p: Period, showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`/api/admin/dashboard?period=${p}`);
      if (!res.ok) return;
      const d: DashData = await res.json();
      setData(d);
      setLastRefresh(new Date());
    } catch { /* silent */ }
    finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  // Load on period change
  useEffect(() => {
    load(period, true);
  }, [load, period]);

  // Auto-refresh 30s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => load(period), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load, period]);

  const d = data;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  return (
    <AdminLayout>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ maxWidth: 1100 }}>
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 24,
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0ede6", margin: 0 }}>Dashboard</h1>
            <p style={{ color: "#5a5650", fontSize: 12, margin: "4px 0 0" }}>
              Atualizado às {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              &nbsp;·&nbsp;auto-refresh 30s
            </p>
          </div>

          {/* Period filters + refresh */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
                    background: active ? "rgba(201,168,76,0.15)" : "transparent",
                    color: active ? "#c9a84c" : "#5a5650",
                    border: `1px solid ${active ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.08)"}`,
                    cursor: "pointer", fontFamily: "DM Sans, sans-serif", transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              onClick={() => load(period, true)}
              style={{
                padding: "7px 14px", borderRadius: 20, fontSize: 12,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#9e9a90", cursor: "pointer", fontFamily: "DM Sans, sans-serif",
              }}
            >
              🔄
            </button>
          </div>
        </div>

        {/* ── Metric cards ── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <MetricCard
            icon="📦" label={`Pedidos — ${periodLabel}`} color="#7b8ee8"
            value={loading ? "—" : String(d?.ordersCount ?? 0)}
            sub="todos os status"
            loading={loading}
          />
          <MetricCard
            icon="💰" label={`Faturamento — ${periodLabel}`} color="#c9a84c"
            value={loading ? "—" : fmt(d?.revenue ?? 0)}
            sub="excluindo cancelados"
            loading={loading}
          />
          <MetricCard
            icon="🎯" label="Ticket médio" color="#e8833a"
            value={loading ? "—" : fmt(d?.avgTicket ?? 0)}
            sub="por pedido válido"
            loading={loading}
          />
          <MetricCard
            icon="🔥" label="Em aberto agora" color="#e84040"
            value={loading ? "—" : String(d?.openOrders ?? 0)}
            sub="recebido · confirmado · prep. · pronto"
            loading={loading}
          />
          <MetricCard
            icon="✅" label={`Entregues — ${periodLabel}`} color="#4caf50"
            value={loading ? "—" : String(d?.delivered ?? 0)}
            loading={loading}
          />
          <MetricCard
            icon="✖" label={`Cancelados — ${periodLabel}`} color="#9e9a90"
            value={loading ? "—" : String(d?.cancelled ?? 0)}
            loading={loading}
          />
        </div>

        {/* ── Chart + Top products ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 16,
          marginBottom: 20,
          alignItems: "start",
        }}
          className="dash-grid"
        >
          <HourlyChart data={d?.hourlyOrders ?? Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))} loading={loading} />
          <TopProducts data={d?.topProducts ?? []} loading={loading} />
        </div>

        {/* ── Recent orders ── */}
        <RecentOrdersTable orders={d?.recentOrders ?? []} loading={loading} />

        {/* ── Quick actions ── */}
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <Link href="/admin/produtos/novo" style={{
            padding: "10px 18px", background: "linear-gradient(135deg,#c9a84c,#e4c97e)",
            borderRadius: 10, cursor: "pointer", color: "#0b0d12",
            fontWeight: 700, fontSize: 13, fontFamily: "DM Sans, sans-serif",
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            + Produto
          </Link>
          <Link href="/admin/pedidos" style={{
            padding: "10px 18px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
            color: "#f0ede6", fontSize: 13, fontFamily: "DM Sans, sans-serif",
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            📦 Ver pedidos
          </Link>
          <a href="/cozinha" target="_blank" style={{
            padding: "10px 18px", background: "rgba(232,131,58,0.1)",
            border: "1px solid rgba(232,131,58,0.25)", borderRadius: 10,
            color: "#e8833a", fontSize: 13, fontFamily: "DM Sans, sans-serif",
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
            fontWeight: 600,
          }}>
            🍳 Modo Cozinha
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AdminLayout>
  );
}
