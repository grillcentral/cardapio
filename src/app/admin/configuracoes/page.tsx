"use client";

import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

interface Restaurant {
  id: number;
  name: string;
  description: string | null;
  phone: string | null;
  whatsapp: string;
  address: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  autoAcceptOrders: boolean;
  autoPrintOnAccept: boolean;
  deliveryMaxKm: number;
  deliveryPricePerKm: number;
  restaurantLat: number | null;
  restaurantLng: number | null;
}

interface OpeningHour {
  id: number;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isOpen: boolean;
  periodName: string | null;
}

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export default function ConfiguracoesPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [hours, setHours] = useState<OpeningHour[]>([]);
  const [form, setForm] = useState({ name: "", description: "", phone: "", whatsapp: "", address: "", logoUrl: "" });
  const [autoForm, setAutoForm] = useState({ autoAcceptOrders: false, autoPrintOnAccept: false });
  const [deliveryForm, setDeliveryForm] = useState({
    deliveryMaxKm: 12,
    deliveryPricePerKm: 1.5,
    restaurantLat: "" as string,
    restaurantLng: "" as string,
  });
  const [saving, setSaving] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [rRes, hRes] = await Promise.all([
        fetch("/api/admin/restaurante"),
        fetch("/api/admin/horarios"),
      ]);

      if (rRes.ok) {
        const r: Restaurant = await rRes.json();
        setRestaurant(r);
        setForm({
          name: r.name || "",
          description: r.description || "",
          phone: r.phone || "",
          whatsapp: r.whatsapp || "",
          address: r.address || "",
          logoUrl: r.logoUrl || "",
        });
        setAutoForm({
          autoAcceptOrders:  r.autoAcceptOrders  ?? false,
          autoPrintOnAccept: r.autoPrintOnAccept ?? false,
        });
        setDeliveryForm({
          deliveryMaxKm: r.deliveryMaxKm ?? 12,
          deliveryPricePerKm: r.deliveryPricePerKm ?? 1.5,
          restaurantLat: r.restaurantLat != null ? String(r.restaurantLat) : "",
          restaurantLng: r.restaurantLng != null ? String(r.restaurantLng) : "",
        });
      }

      if (hRes.ok) {
        const h: OpeningHour[] = await hRes.json();
        if (Array.isArray(h) && h.length > 0) {
          setHours(h);
        } else {
          setHours(DAY_NAMES.map((_, i) => ({
            id: -(i + 1),
            dayOfWeek: i,
            openTime: "11:00",
            closeTime: "23:00",
            isOpen: true,
            periodName: DAY_NAMES[i],
          })));
        }
      }
    };
    load();
  }, []);

  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setF("logoUrl", data.url);
      else setError(data.error || "Erro no upload.");
    } catch { setError("Erro no upload."); }
    finally { setUploading(false); }
  };

  const handleSaveRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/restaurante", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao salvar."); return; }
      setSuccess("Configurações salvas com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Erro de conexão."); }
    finally { setSaving(false); }
  };

  const updateHour = (dayOfWeek: number, field: string, value: string | boolean) => {
    setHours((prev) =>
      prev.map((h) => h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h)
    );
  };

  const handleSaveHours = async () => {
    setSavingHours(true);
    setError("");
    try {
      const res = await fetch("/api/admin/horarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: hours.map((h) => ({ dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime, isOpen: h.isOpen, periodName: h.periodName || DAY_NAMES[h.dayOfWeek] })) }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erro."); return; }
      setSuccess("Horários salvos!");
      setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Erro de conexão."); }
    finally { setSavingHours(false); }
  };

  const handleSaveAutomation = async () => {
    setSavingAuto(true);
    setError("");
    try {
      const res = await fetch("/api/admin/restaurante", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoAcceptOrders:  autoForm.autoAcceptOrders,
          autoPrintOnAccept: autoForm.autoPrintOnAccept,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erro."); return; }
      setSuccess("Configurações de automação salvas!");
      setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Erro de conexão."); }
    finally { setSavingAuto(false); }
  };

  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setError("Geolocalização não suportada neste navegador.");
      return;
    }
    setGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryForm((f) => ({
          ...f,
          restaurantLat: String(pos.coords.latitude.toFixed(6)),
          restaurantLng: String(pos.coords.longitude.toFixed(6)),
        }));
        setGettingGps(false);
      },
      () => {
        setError("Não foi possível obter localização. Verifique as permissões do navegador.");
        setGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveDelivery = async () => {
    setSavingDelivery(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        deliveryMaxKm: Number(deliveryForm.deliveryMaxKm),
        deliveryPricePerKm: Number(deliveryForm.deliveryPricePerKm),
        restaurantLat: deliveryForm.restaurantLat !== "" ? Number(deliveryForm.restaurantLat) : null,
        restaurantLng: deliveryForm.restaurantLng !== "" ? Number(deliveryForm.restaurantLng) : null,
      };
      const res = await fetch("/api/admin/restaurante", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erro."); return; }
      setSuccess("Configurações de entrega salvas!");
      setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Erro de conexão."); }
    finally { setSavingDelivery(false); }
  };

  const inp: React.CSSProperties = { width: "100%", background: "#0b0d12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f0ede6", padding: "11px 14px", fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, color: "#9e9a90", display: "block", marginBottom: 6, fontWeight: 500 };
  const inpSm: React.CSSProperties = { background: "#0b0d12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#f0ede6", padding: "7px 10px", fontSize: 13, fontFamily: "DM Sans, sans-serif", outline: "none", width: 90 };

  if (!restaurant) return (
    <AdminLayout>
      <div style={{ padding: 48, textAlign: "center", color: "#5a5650" }}>Carregando...</div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div style={{ maxWidth: 750 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0ede6", margin: 0 }}>Configurações</h1>
          <p style={{ color: "#5a5650", fontSize: 13, margin: "4px 0 0" }}>Dados do restaurante e horários</p>
        </div>

        {success && (
          <div style={{ fontSize: 13, color: "#4caf50", marginBottom: 16, padding: "10px 14px", background: "rgba(76,175,80,0.1)", borderRadius: 8, border: "1px solid rgba(76,175,80,0.2)" }}>
            {success}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: "#e84040", marginBottom: 16, padding: "10px 14px", background: "rgba(232,64,64,0.1)", borderRadius: 8, border: "1px solid rgba(232,64,64,0.2)" }}>
            {error}
          </div>
        )}

        {/* Restaurant form */}
        <form onSubmit={handleSaveRestaurant}>
          <div style={{ background: "#111420", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#f0ede6", margin: "0 0 20px" }}>Dados do Restaurante</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Nome do Restaurante</label>
              <input value={form.name} onChange={(e) => setF("name", e.target.value)} style={inp} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Descrição</label>
              <textarea value={form.description} onChange={(e) => setF("description", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={lbl}>Telefone</label>
                <input value={form.phone} onChange={(e) => setF("phone", e.target.value)} placeholder="(92) 98621-0138" style={inp} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={lbl}>WhatsApp (apenas números)</label>
                <input value={form.whatsapp} onChange={(e) => setF("whatsapp", e.target.value)} placeholder="Ex: 5592999999999" style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Endereço</label>
              <input value={form.address} onChange={(e) => setF("address", e.target.value)} placeholder="Rua, número, bairro..." style={inp} />
            </div>

            {/* Logo upload */}
            <div style={{ marginBottom: 8 }}>
              <label style={lbl}>Logo</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {form.logoUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={form.logoUrl} alt="Logo" style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover" }} />
                )}
                <div>
                  <input value={form.logoUrl} onChange={(e) => setF("logoUrl", e.target.value)} placeholder="URL da logo ou faça upload..." style={{ ...inp, marginBottom: 8 }} />
                  <button type="button" onClick={() => logoRef.current?.click()}
                    style={{ padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, cursor: "pointer", color: "#f0ede6", fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>
                    {uploading ? "Enviando..." : "Fazer upload"}
                  </button>
                  <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                </div>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            style={{ padding: "12px 28px", background: saving ? "#5a5650" : "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 14, fontFamily: "DM Sans, sans-serif", marginBottom: 28 }}>
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </form>

        {/* Opening hours */}
        <div style={{ background: "#111420", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#f0ede6", margin: "0 0 20px" }}>Horários de Funcionamento</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hours.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((h) => (
              <div key={h.dayOfWeek} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
                {/* Toggle */}
                <button type="button" onClick={() => updateHour(h.dayOfWeek, "isOpen", !h.isOpen)}
                  style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: h.isOpen ? "#c9a84c" : "rgba(255,255,255,0.1)", position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: h.isOpen ? 21 : 3, transition: "left 0.2s" }} />
                </button>

                <div style={{ width: 110, fontSize: 13, color: h.isOpen ? "#f0ede6" : "#5a5650", fontWeight: h.isOpen ? 600 : 400, flexShrink: 0 }}>
                  {DAY_NAMES[h.dayOfWeek]}
                </div>

                {h.isOpen ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="time" value={h.openTime || ""} onChange={(e) => updateHour(h.dayOfWeek, "openTime", e.target.value)} style={inpSm} />
                    <span style={{ color: "#5a5650", fontSize: 12 }}>até</span>
                    <input type="time" value={h.closeTime || ""} onChange={(e) => updateHour(h.dayOfWeek, "closeTime", e.target.value)} style={inpSm} />
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "#5a5650" }}>Fechado</span>
                )}
              </div>
            ))}
          </div>

          <button onClick={handleSaveHours} disabled={savingHours}
            style={{ marginTop: 20, padding: "12px 28px", background: savingHours ? "#5a5650" : "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 10, cursor: savingHours ? "not-allowed" : "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 14, fontFamily: "DM Sans, sans-serif" }}>
            {savingHours ? "Salvando..." : "Salvar Horários"}
          </button>
        </div>

        {/* Configurações de Entrega */}
        <div style={{ background: "#111420", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)", marginTop: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#f0ede6", margin: "0 0 6px" }}>Configurações de Entrega</h2>
          <p style={{ fontSize: 12, color: "#5a5650", margin: "0 0 20px", lineHeight: 1.5 }}>
            Taxa calculada por distância em linha reta (Haversine). Mínimo R$3, valores inteiros.
            Fórmula: <strong style={{ color: "#9e9a90" }}>máx(R$3, arredondar(km × preço/km))</strong>
          </p>

          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lbl}>Raio máximo de entrega (km)</label>
              <input
                type="number" min={1} max={50} step={0.5}
                value={deliveryForm.deliveryMaxKm}
                onChange={(e) => setDeliveryForm((f) => ({ ...f, deliveryMaxKm: Number(e.target.value) }))}
                style={inp}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lbl}>Preço por km (R$)</label>
              <input
                type="number" min={0.5} max={10} step={0.1}
                value={deliveryForm.deliveryPricePerKm}
                onChange={(e) => setDeliveryForm((f) => ({ ...f, deliveryPricePerKm: Number(e.target.value) }))}
                style={inp}
              />
            </div>
          </div>

          {/* Preview */}
          <div style={{ fontSize: 11, color: "#5a5650", marginBottom: 20, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
            Exemplos com preço R${Number(deliveryForm.deliveryPricePerKm).toFixed(2)}/km:{" "}
            {[1, 2, 3, 5, 8, 10].filter(km => km <= deliveryForm.deliveryMaxKm).map((km) => {
              const fee = Math.max(3, Math.round(km * Number(deliveryForm.deliveryPricePerKm)));
              return `${km}km→R$${fee}`;
            }).join(" · ")}
          </div>

          {/* GPS Location */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Localização do Restaurante (GPS)</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ ...lbl, fontSize: 11 }}>Latitude</label>
                <input
                  type="text" placeholder="-27.5954"
                  value={deliveryForm.restaurantLat}
                  onChange={(e) => setDeliveryForm((f) => ({ ...f, restaurantLat: e.target.value }))}
                  style={inp}
                />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ ...lbl, fontSize: 11 }}>Longitude</label>
                <input
                  type="text" placeholder="-48.5480"
                  value={deliveryForm.restaurantLng}
                  onChange={(e) => setDeliveryForm((f) => ({ ...f, restaurantLng: e.target.value }))}
                  style={inp}
                />
              </div>
            </div>
            <button type="button" onClick={handleGetGps} disabled={gettingGps}
              style={{ padding: "9px 16px", background: gettingGps ? "rgba(255,255,255,0.05)" : "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, cursor: gettingGps ? "not-allowed" : "pointer", color: gettingGps ? "#5a5650" : "#c9a84c", fontSize: 12, fontFamily: "DM Sans, sans-serif", fontWeight: 600 }}>
              {gettingGps ? "Obtendo localização..." : "📍 Usar minha localização atual"}
            </button>
            {deliveryForm.restaurantLat && deliveryForm.restaurantLng && (
              <div style={{ fontSize: 11, color: "#4caf50", marginTop: 8 }}>
                ✓ Localização definida: {deliveryForm.restaurantLat}, {deliveryForm.restaurantLng}
              </div>
            )}
            {(!deliveryForm.restaurantLat || !deliveryForm.restaurantLng) && (
              <div style={{ fontSize: 11, color: "#e8833a", marginTop: 8 }}>
                ⚠ Sem localização — bot não conseguirá calcular frete por distância
              </div>
            )}
          </div>

          <button onClick={handleSaveDelivery} disabled={savingDelivery}
            style={{ marginTop: 4, padding: "12px 28px", background: savingDelivery ? "#5a5650" : "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 10, cursor: savingDelivery ? "not-allowed" : "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 14, fontFamily: "DM Sans, sans-serif" }}>
            {savingDelivery ? "Salvando..." : "Salvar Entrega"}
          </button>
        </div>

        {/* Automação de Pedidos */}
        <div style={{ background: "#111420", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)", marginTop: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#f0ede6", margin: "0 0 6px" }}>Automação de Pedidos</h2>
          <p style={{ fontSize: 12, color: "#5a5650", margin: "0 0 20px", lineHeight: 1.5 }}>
            Aceite automático só funciona dentro do horário de funcionamento cadastrado acima. Fora do horário, todo pedido fica em <strong style={{ color: "#9e9a90" }}>RECEBIDO</strong> aguardando confirmação manual.
          </p>

          {[
            {
              key: "autoAcceptOrders" as const,
              label: "Aceitar pedidos automaticamente",
              desc: "Novo pedido passa direto para CONFIRMADO se o restaurante estiver aberto",
              warning: true,
            },
            {
              key: "autoPrintOnAccept" as const,
              label: "Imprimir ao aceitar automaticamente",
              desc: "Na tela /cozinha, aciona impressão quando um pedido é auto-aceito",
              warning: false,
            },
          ].map(({ key, label, desc, warning }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ flex: 1, paddingRight: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, color: "#f0ede6", fontWeight: 500 }}>{label}</span>
                  {warning && autoForm[key] && (
                    <span style={{ fontSize: 10, background: "rgba(232,131,58,0.2)", color: "#e8833a", border: "1px solid rgba(232,131,58,0.35)", borderRadius: 6, padding: "1px 6px", fontWeight: 600 }}>ATIVO</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#5a5650" }}>{desc}</div>
              </div>
              <button
                type="button"
                onClick={() => setAutoForm((f) => ({ ...f, [key]: !f[key] }))}
                style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: autoForm[key] ? "#c9a84c" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
              >
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, transition: "left 0.2s", left: autoForm[key] ? 23 : 3 }} />
              </button>
            </div>
          ))}

          <button onClick={handleSaveAutomation} disabled={savingAuto}
            style={{ marginTop: 20, padding: "12px 28px", background: savingAuto ? "#5a5650" : "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 10, cursor: savingAuto ? "not-allowed" : "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 14, fontFamily: "DM Sans, sans-serif" }}>
            {savingAuto ? "Salvando..." : "Salvar Automação"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
