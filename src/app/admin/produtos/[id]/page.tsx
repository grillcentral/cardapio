"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";

interface Category {
  id: number;
  name: string;
  emoji: string | null;
}

export default function EditarProdutoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    imageUrl: "",
    isActive: true,
    isFeatured: false,
    sortOrder: "0",
  });
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [prodRes, catRes] = await Promise.all([
        fetch(`/api/admin/produtos/${id}`),
        fetch("/api/admin/categorias"),
      ]);

      if (!prodRes.ok) { router.push("/admin/produtos"); return; }

      const [prod, cats] = await Promise.all([prodRes.json(), catRes.json()]);
      setCategories(Array.isArray(cats) ? cats : []);
      setForm({
        name: prod.name || "",
        description: prod.description || "",
        price: String(prod.price || ""),
        categoryId: String(prod.categoryId || ""),
        imageUrl: prod.imageUrl || "",
        isActive: prod.isActive !== false,
        isFeatured: prod.isFeatured === true,
        sortOrder: String(prod.sortOrder || "0"),
      });
      if (prod.imageUrl) setImagePreview(prod.imageUrl);
      setLoading(false);
    };
    load();
  }, [id, router]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) { set("imageUrl", data.url); setImagePreview(data.url); }
      else setError(data.error || "Erro no upload.");
    } catch { setError("Erro ao fazer upload."); }
    finally { setUploading(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    if (!form.price || isNaN(Number(form.price))) { setError("Preço inválido."); return; }
    if (!form.categoryId) { setError("Selecione uma categoria."); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/produtos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: Number(form.price),
          categoryId: Number(form.categoryId),
          imageUrl: form.imageUrl || null,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao salvar."); return; }
      router.push("/admin/produtos");
    } catch { setError("Erro de conexão."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/produtos/${id}?hard=true`, { method: "DELETE" });
      router.push("/admin/produtos");
    } catch { setError("Erro ao excluir."); setDeleting(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "#0b0d12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    color: "#f0ede6", padding: "11px 14px", fontSize: 14, fontFamily: "DM Sans, sans-serif",
    outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: 12, color: "#9e9a90", display: "block", marginBottom: 6, fontWeight: 500 };

  if (loading) return (
    <AdminLayout>
      <div style={{ padding: 48, textAlign: "center", color: "#5a5650" }}>Carregando...</div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9e9a90", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans, sans-serif", marginBottom: 8, padding: 0 }}>
            ← Voltar
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0ede6", margin: 0 }}>Editar Produto</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ background: "#111420", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0ede6", margin: "0 0 20px" }}>Informações Básicas</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Nome *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: X-Salada Especial" style={inp} required />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Descrição</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ingredientes, detalhes..." rows={3} style={{ ...inp, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>Preço (R$) *</label>
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0,00" style={inp} required />
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={lbl}>Categoria *</label>
                <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} style={inp} required>
                  <option value="">Selecione...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 100 }}>
                <label style={lbl}>Ordem</label>
                <input type="number" min="0" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} style={inp} />
              </div>
            </div>
          </div>

          {/* Image */}
          <div style={{ background: "#111420", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0ede6", margin: "0 0 16px" }}>Imagem</h3>

            {(imagePreview || form.imageUrl) && (
              <div style={{ marginBottom: 12, position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview || form.imageUrl} alt="Preview" style={{ width: 120, height: 120, borderRadius: 10, objectFit: "cover", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                <button type="button" onClick={() => { set("imageUrl", ""); setImagePreview(""); }}
                  style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: "#e84040", border: "none", color: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
            )}

            <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed rgba(255,255,255,0.1)", borderRadius: 12, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
              <div style={{ fontSize: 13, color: "#9e9a90" }}>{uploading ? "Enviando..." : "Arraste ou clique para mudar"}</div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Ou cole uma URL</label>
              <input type="text" value={form.imageUrl} onChange={(e) => { set("imageUrl", e.target.value); setImagePreview(e.target.value); }} placeholder="https://..." style={inp} />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ background: "#111420", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0ede6", margin: "0 0 16px" }}>Opções</h3>
            {[
              { key: "isActive", label: "Produto ativo", desc: "Visível no cardápio" },
              { key: "isFeatured", label: "Produto em destaque", desc: "Aparece como destaque" },
            ].map(({ key, label: lbl2, desc }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#f0ede6", fontWeight: 500 }}>{lbl2}</div>
                  <div style={{ fontSize: 11, color: "#5a5650" }}>{desc}</div>
                </div>
                <button type="button" onClick={() => set(key, !form[key as keyof typeof form])}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: form[key as keyof typeof form] ? "#c9a84c" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, transition: "left 0.2s", left: form[key as keyof typeof form] ? 23 : 3 }} />
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ fontSize: 13, color: "#e84040", marginBottom: 16, padding: "10px 14px", background: "rgba(232,64,64,0.1)", borderRadius: 8, border: "1px solid rgba(232,64,64,0.2)" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" disabled={saving}
              style={{ flex: 1, padding: "13px 0", background: saving ? "#5a5650" : "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 14, fontFamily: "DM Sans, sans-serif" }}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>

            <button type="button" onClick={() => router.back()}
              style={{ padding: "13px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer", color: "#f0ede6", fontSize: 14, fontFamily: "DM Sans, sans-serif" }}>
              Cancelar
            </button>

            <button type="button" onClick={handleDelete} disabled={deleting}
              style={{ padding: "13px 16px", background: "rgba(232,64,64,0.1)", border: "1px solid rgba(232,64,64,0.2)", borderRadius: 10, cursor: deleting ? "not-allowed" : "pointer", color: "#e84040", fontSize: 14, fontFamily: "DM Sans, sans-serif" }}>
              {deleting ? "..." : "Excluir"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
