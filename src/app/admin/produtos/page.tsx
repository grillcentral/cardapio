"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  categoryId: number;
  category: { id: number; name: string; emoji: string | null };
}

interface Category {
  id: number;
  name: string;
  emoji: string | null;
}

const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

const PAGE_SIZE = 15;

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (activeFilter) params.set("active", activeFilter);

      const [prodRes, catRes] = await Promise.all([
        fetch(`/api/admin/produtos?${params}`),
        fetch("/api/admin/categorias"),
      ]);

      const [prods, cats] = await Promise.all([prodRes.json(), catRes.json()]);
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, activeFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggleActive = async (id: number, current: boolean) => {
    await fetch(`/api/admin/produtos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !current } : p)));
  };

  const deleteProduct = async (id: number) => {
    if (!confirm("Desativar este produto?")) return;
    setDeleting(id);
    await fetch(`/api/admin/produtos/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: false } : p)));
    setDeleting(null);
  };

  const paged = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(products.length / PAGE_SIZE);

  const inp: React.CSSProperties = {
    background: "#0b0d12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    color: "#f0ede6", padding: "9px 13px", fontSize: 13, fontFamily: "DM Sans, sans-serif",
    outline: "none",
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1200 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0ede6", margin: 0 }}>Produtos</h1>
            <p style={{ color: "#5a5650", fontSize: 13, margin: "4px 0 0" }}>
              {products.length} produto{products.length !== 1 ? "s" : ""} encontrado{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/admin/produtos/novo" style={{
            padding: "10px 20px", background: "linear-gradient(135deg,#c9a84c,#e4c97e)",
            border: "none", borderRadius: 10, cursor: "pointer", color: "#0b0d12",
            fontWeight: 700, fontSize: 13, fontFamily: "DM Sans, sans-serif", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            + Novo Produto
          </Link>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar produtos..."
            style={{ ...inp, flex: 1, minWidth: 200 }}
          />

          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            style={{ ...inp, minWidth: 160 }}
          >
            <option value="">Todas categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>

          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            style={{ ...inp, minWidth: 130 }}
          >
            <option value="">Todos status</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: "#111420", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#5a5650" }}>Carregando...</div>
          ) : paged.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#5a5650", fontSize: 14 }}>
              Nenhum produto encontrado.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["Imagem", "Nome", "Categoria", "Preço", "Status", "Ações"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5650", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", opacity: p.isActive ? 1 : 0.5 }}>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0b0d12", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} style={{ width: 44, height: 44, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <span style={{ fontSize: 20 }}>{p.category.emoji || "🍽️"}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#f0ede6", marginBottom: 2 }}>{p.name}</div>
                        {p.description && <div style={{ fontSize: 11, color: "#5a5650", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                        {p.isFeatured && <span style={{ fontSize: 10, color: "#e8833a", fontWeight: 600 }}>⭐ Destaque</span>}
                      </td>
                      <td style={{ padding: "10px 16px", color: "#9e9a90", whiteSpace: "nowrap" }}>
                        {p.category.emoji} {p.category.name}
                      </td>
                      <td style={{ padding: "10px 16px", color: "#c9a84c", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {fmt(p.price)}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <button
                          onClick={() => toggleActive(p.id, p.isActive)}
                          style={{
                            padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            background: p.isActive ? "rgba(76,175,80,0.15)" : "rgba(232,64,64,0.1)",
                            color: p.isActive ? "#4caf50" : "#e84040",
                            border: `1px solid ${p.isActive ? "rgba(76,175,80,0.3)" : "rgba(232,64,64,0.2)"}`,
                            fontFamily: "DM Sans, sans-serif",
                          }}
                        >
                          {p.isActive ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Link href={`/admin/produtos/${p.id}`} style={{
                            padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 7, fontSize: 12, color: "#f0ede6", textDecoration: "none", whiteSpace: "nowrap",
                          }}>
                            Editar
                          </Link>
                          <button
                            onClick={() => deleteProduct(p.id)}
                            disabled={deleting === p.id}
                            style={{
                              padding: "6px 10px", background: "rgba(232,64,64,0.1)", border: "1px solid rgba(232,64,64,0.2)",
                              borderRadius: 7, fontSize: 12, color: "#e84040", cursor: "pointer",
                              fontFamily: "DM Sans, sans-serif",
                            }}
                          >
                            {deleting === p.id ? "..." : "✕"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#5a5650" }}>
                Página {page} de {totalPages} · {products.length} itens
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: "6px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#f0ede6", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "DM Sans, sans-serif", opacity: page === 1 ? 0.4 : 1 }}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: "6px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#f0ede6", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "DM Sans, sans-serif", opacity: page === totalPages ? 0.4 : 1 }}
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
