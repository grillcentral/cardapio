"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";

interface Stats {
  totalProducts: number;
  totalCategories: number;
  ordersToday: number;
  ordersTotal: number;
}

interface Order {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  orderType: string;
  payment: string;
  total: number;
  status: string;
  createdAt: string;
}

const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

const statusColors: Record<string, string> = {
  RECEIVED: "#c9a84c",
  PREPARING: "#7b8ee8",
  READY: "#4caf50",
  DELIVERED: "#9e9a90",
  CANCELLED: "#e84040",
};

const statusLabels: Record<string, string> = {
  RECEIVED: "Recebido",
  PREPARING: "Preparando",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalCategories: 0, ordersToday: 0, ordersTotal: 0 });
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [prodRes, catRes, ordRes] = await Promise.all([
          fetch("/api/admin/produtos?active=true"),
          fetch("/api/admin/categorias"),
          fetch("/api/orders"),
        ]);

        const [products, categories, allOrders] = await Promise.all([
          prodRes.json(),
          catRes.json(),
          ordRes.json(),
        ]);

        const today = new Date().toDateString();
        const ordersToday = Array.isArray(allOrders)
          ? allOrders.filter((o: Order) => new Date(o.createdAt).toDateString() === today).length
          : 0;

        setStats({
          totalProducts: Array.isArray(products) ? products.length : 0,
          totalCategories: Array.isArray(categories) ? categories.length : 0,
          ordersToday,
          ordersTotal: Array.isArray(allOrders) ? allOrders.length : 0,
        });

        setOrders(Array.isArray(allOrders) ? allOrders.slice(0, 10) : []);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const cardStyle: React.CSSProperties = {
    background: "#111420", borderRadius: 16, padding: "20px 24px",
    border: "1px solid rgba(255,255,255,0.07)", flex: 1, minWidth: 160,
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0ede6", margin: 0 }}>Dashboard</h1>
          <p style={{ color: "#5a5650", fontSize: 13, margin: "4px 0 0" }}>Visão geral do restaurante</p>
        </div>

        {/* Stats cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🍽️</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#c9a84c" }}>
              {loading ? "..." : stats.totalProducts}
            </div>
            <div style={{ fontSize: 12, color: "#9e9a90", marginTop: 4 }}>Produtos Ativos</div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#7b8ee8" }}>
              {loading ? "..." : stats.totalCategories}
            </div>
            <div style={{ fontSize: 12, color: "#9e9a90", marginTop: 4 }}>Categorias</div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#4caf50" }}>
              {loading ? "..." : stats.ordersToday}
            </div>
            <div style={{ fontSize: 12, color: "#9e9a90", marginTop: 4 }}>Pedidos Hoje</div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📈</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#f0ede6" }}>
              {loading ? "..." : stats.ordersTotal}
            </div>
            <div style={{ fontSize: 12, color: "#9e9a90", marginTop: 4 }}>Pedidos Total</div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          <Link href="/admin/produtos/novo" style={{
            padding: "12px 20px", background: "linear-gradient(135deg,#c9a84c,#e4c97e)",
            border: "none", borderRadius: 10, cursor: "pointer", color: "#0b0d12",
            fontWeight: 700, fontSize: 13, fontFamily: "DM Sans, sans-serif", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            + Adicionar Produto
          </Link>

          <a href="/" target="_blank" style={{
            padding: "12px 20px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer",
            color: "#f0ede6", fontSize: 13, fontFamily: "DM Sans, sans-serif", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            🌐 Ver Cardápio
          </a>
        </div>

        {/* Recent orders */}
        <div style={{ background: "#111420", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#f0ede6", margin: 0 }}>Pedidos Recentes</h2>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#5a5650" }}>Carregando...</div>
          ) : orders.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#5a5650", fontSize: 13 }}>
              Nenhum pedido ainda.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["#", "Cliente", "Tipo", "Pagamento", "Total", "Status", "Data"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5650", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 16px", color: "#c9a84c", fontWeight: 600 }}>#{order.id}</td>
                      <td style={{ padding: "12px 16px", color: "#f0ede6" }}>{order.customerName || "—"}</td>
                      <td style={{ padding: "12px 16px", color: "#9e9a90" }}>{order.orderType}</td>
                      <td style={{ padding: "12px 16px", color: "#9e9a90" }}>{order.payment}</td>
                      <td style={{ padding: "12px 16px", color: "#c9a84c", fontWeight: 600 }}>{fmt(order.total)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: `${statusColors[order.status] || "#9e9a90"}20`,
                          color: statusColors[order.status] || "#9e9a90",
                        }}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#5a5650", fontSize: 12 }}>
                        {new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
