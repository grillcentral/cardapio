"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

interface Category {
  id: number;
  name: string;
  description: string | null;
  emoji: string | null;
  periodTag: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

const periodLabels: Record<string, string> = {
  almoco: "Almoço",
  noite: "Noite",
};

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const emptyForm = { name: "", description: "", emoji: "🍽️", periodTag: "", sortOrder: "0", isActive: true };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categorias");
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const startEdit = (cat: Category) => {
    setShowNew(false);
    setEditId(cat.id);
    setForm({
      name: cat.name,
      description: cat.description || "",
      emoji: cat.emoji || "🍽️",
      periodTag: cat.periodTag || "",
      sortOrder: String(cat.sortOrder),
      isActive: cat.isActive,
    });
    setError("");
  };

  const cancelEdit = () => { setEditId(null); setShowNew(false); setForm(emptyForm); setError(""); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        emoji: form.emoji || "🍽️",
        periodTag: form.periodTag || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };

      let res;
      if (showNew) {
        res = await fetch("/api/admin/categorias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        res = await fetch(`/api/admin/categorias/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao salvar."); return; }

      cancelEdit();
      load();
    } catch { setError("Erro de conexão."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Excluir a categoria "${name}"? Certifique-se de que não há produtos nela.`)) return;
    try {
      const res = await fetch(`/api/admin/categorias/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Erro ao excluir."); return; }
      load();
    } catch { alert("Erro de conexão."); }
  };

  const toggleActive = async (id: number, current: boolean) => {
    await fetch(`/api/admin/categorias/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, isActive: !current } : c));
  };

  const inp: React.CSSProperties = { width: "100%", background: "#0b0d12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f0ede6", padding: "9px 12px", fontSize: 13, fontFamily: "DM Sans, sans-serif", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, color: "#9e9a90", display: "block", marginBottom: 4, fontWeight: 500 };

  const FormPanel = () => (
    <div style={{ background: "#111420", borderRadius: 16, padding: 20, border: "1px solid rgba(201,168,76,0.2)", marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "#c9a84c", margin: "0 0 16px" }}>
        {showNew ? "Nova Categoria" : "Editar Categoria"}
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Nome *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Pratos Executivos" style={inp} />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Descrição</label>
          <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Descrição breve..." style={inp} />
        </div>

        <div>
          <label style={lbl}>Emoji</label>
          <input value={form.emoji} onChange={(e) => set("emoji", e.target.value)} placeholder="🍽️" style={{ ...inp, width: 80 }} />
        </div>

        <div>
          <label style={lbl}>Período</label>
          <select value={form.periodTag} onChange={(e) => set("periodTag", e.target.value)} style={inp}>
            <option value="">Sempre disponível</option>
            <option value="almoco">Almoço</option>
            <option value="noite">Noite</option>
          </select>
        </div>

        <div>
          <label style={lbl}>Ordem</label>
          <input type="number" min="0" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} style={inp} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
          <button type="button" onClick={() => set("isActive", !form.isActive)}
            style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: form.isActive ? "#c9a84c" : "rgba(255,255,255,0.1)", position: "relative", flexShrink: 0 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: form.isActive ? 21 : 3, transition: "left 0.2s" }} />
          </button>
          <span style={{ fontSize: 12, color: "#9e9a90" }}>Ativa</span>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: "#e84040", marginBottom: 12, padding: "8px 12px", background: "rgba(232,64,64,0.1)", borderRadius: 7 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "9px 20px", background: "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={cancelEdit}
          style={{ padding: "9px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", color: "#9e9a90", fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0ede6", margin: 0 }}>Categorias</h1>
            <p style={{ color: "#5a5650", fontSize: 13, margin: "4px 0 0" }}>{categories.length} categoria{categories.length !== 1 ? "s" : ""}</p>
          </div>
          {!showNew && !editId && (
            <button onClick={() => { setShowNew(true); setEditId(null); setForm(emptyForm); setError(""); }}
              style={{ padding: "10px 20px", background: "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 10, cursor: "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
              + Nova Categoria
            </button>
          )}
        </div>

        {(showNew || editId !== null) && <FormPanel />}

        <div style={{ background: "#111420", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#5a5650" }}>Carregando...</div>
          ) : categories.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#5a5650", fontSize: 14 }}>Nenhuma categoria.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["", "Nome", "Período", "Produtos", "Ordem", "Status", "Ações"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5650", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: editId === cat.id ? "rgba(201,168,76,0.04)" : "transparent", opacity: cat.isActive ? 1 : 0.55 }}>
                      <td style={{ padding: "12px 16px", fontSize: 22 }}>{cat.emoji || "🍽️"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#f0ede6" }}>{cat.name}</div>
                        {cat.description && <div style={{ fontSize: 11, color: "#5a5650" }}>{cat.description}</div>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#9e9a90" }}>
                        {cat.periodTag ? periodLabels[cat.periodTag] || cat.periodTag : "Sempre"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#c9a84c", fontWeight: 600 }}>
                        {cat._count?.products ?? 0}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#9e9a90" }}>{cat.sortOrder}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => toggleActive(cat.id, cat.isActive)}
                          style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", background: cat.isActive ? "rgba(76,175,80,0.15)" : "rgba(232,64,64,0.1)", color: cat.isActive ? "#4caf50" : "#e84040", border: `1px solid ${cat.isActive ? "rgba(76,175,80,0.3)" : "rgba(232,64,64,0.2)"}`, fontFamily: "DM Sans, sans-serif" }}>
                          {cat.isActive ? "Ativa" : "Inativa"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => startEdit(cat)}
                            style={{ padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, fontSize: 12, color: "#f0ede6", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
                            Editar
                          </button>
                          <button onClick={() => handleDelete(cat.id, cat.name)}
                            style={{ padding: "6px 10px", background: "rgba(232,64,64,0.1)", border: "1px solid rgba(232,64,64,0.2)", borderRadius: 7, fontSize: 12, color: "#e84040", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
                            ✕
                          </button>
                        </div>
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
