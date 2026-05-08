"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  restaurantId: number;
  restaurant: { name: string; slug: string; logoUrl: string | null };
}

const NAV_ITEMS = [
  { href: "/admin/dashboard",   label: "Dashboard",    icon: "📊" },
  { href: "/admin/pedidos",     label: "Pedidos",       icon: "📦" },
  { href: "/admin/produtos",    label: "Produtos",      icon: "🍽️" },
  { href: "/admin/categorias",  label: "Categorias",    icon: "📂" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/me");
      if (!res.ok) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setUser(data);
    } catch {
      router.push("/admin/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const handleLogout = async () => {
    await fetch("/api/admin/login", { method: "GET" });
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0b0d12", display: "flex",
        alignItems: "center", justifyContent: "center", color: "#c9a84c",
        fontFamily: "DM Sans, sans-serif", fontSize: 16,
      }}>
        Carregando...
      </div>
    );
  }

  if (!user) return null;

  const sidebarStyle: React.CSSProperties = {
    width: 240,
    background: "#111420",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    height: "100vh",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 100,
    transition: "transform 0.25s ease",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d12", fontFamily: "DM Sans, sans-serif", color: "#f0ede6" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            zIndex: 99, display: "none",
          }}
          className="mob-overlay"
        />
      )}

      {/* Sidebar */}
      <aside style={{
        ...sidebarStyle,
        transform: sidebarOpen ? "translateX(0)" : undefined,
      }} className="admin-sidebar">
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#c9a84c,#e4c97e)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
            }}>🍔</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c", lineHeight: 1.2 }}>
                {user.restaurant?.name || "Grill Central"}
              </div>
              <div style={{ fontSize: 10, color: "#5a5650" }}>Painel Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 10, marginBottom: 2, textDecoration: "none",
                  background: active ? "rgba(201,168,76,0.12)" : "transparent",
                  color: active ? "#c9a84c" : "#9e9a90",
                  fontWeight: active ? 600 : 400, fontSize: 13,
                  transition: "all 0.15s",
                  borderLeft: active ? "3px solid #c9a84c" : "3px solid transparent",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 12, paddingTop: 12 }}>
            <a
              href="/"
              target="_blank"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 10, textDecoration: "none", color: "#5a5650", fontSize: 13,
                borderLeft: "3px solid transparent",
              }}
            >
              <span>🌐</span> Ver Cardápio
            </a>
          </div>
        </nav>

        {/* User info */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 12, color: "#9e9a90", marginBottom: 2 }}>{user.name}</div>
          <div style={{ fontSize: 10, color: "#5a5650", marginBottom: 10 }}>{user.email}</div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%", padding: "8px 0", background: "rgba(232,64,64,0.1)",
              border: "1px solid rgba(232,64,64,0.2)", borderRadius: 8, cursor: "pointer",
              color: "#e84040", fontSize: 12, fontFamily: "DM Sans, sans-serif", fontWeight: 600,
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ marginLeft: 240, minHeight: "100vh", display: "flex", flexDirection: "column" }} className="admin-main">
        {/* Top bar */}
        <header style={{
          height: 56, background: "#111420", borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", padding: "0 24px", gap: 12,
          position: "sticky", top: 0, zIndex: 50,
        }}>
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none", border: "none", cursor: "pointer", color: "#9e9a90",
              fontSize: 22, display: "none", padding: 4,
            }}
            className="mob-menu-btn"
          >
            ☰
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f0ede6" }}>
              {NAV_ITEMS.find((n) => pathname === n.href || (n.href !== "/admin/dashboard" && pathname.startsWith(n.href)))?.label || "Dashboard"}
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#5a5650" }}>
            Olá, {user.name.split(" ")[0]}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: "24px" }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar {
            transform: translateX(-100%) !important;
          }
          .admin-sidebar.open {
            transform: translateX(0) !important;
          }
          .admin-main {
            margin-left: 0 !important;
          }
          .mob-menu-btn {
            display: flex !important;
          }
          .mob-overlay {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
