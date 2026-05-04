"use client";

import { useState, useEffect } from "react";

export interface QuickUser {
  name: string;
  phone: string;
  address?: string;
  complement?: string;
  lat?: number;
  lng?: number;
}

interface Props {
  onConfirm: (user: QuickUser) => void;
  onClose: () => void;
}

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
  marginBottom: 5,
  display: "block",
};

export default function QuickUserModal({ onConfirm, onClose }: Props) {
  const [name, setName]           = useState("");
  const [phone, setPhone]         = useState("");
  const [address, setAddress]     = useState("");
  const [complement, setComplement] = useState("");
  const [lat, setLat]             = useState<number | undefined>();
  const [lng, setLng]             = useState<number | undefined>();
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [err, setErr]             = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("adonay_quick_user") || "null"
      ) as QuickUser | null;
      if (saved?.name)       setName(saved.name);
      if (saved?.phone)      setPhone(fmtPhone(saved.phone));
      if (saved?.address)    setAddress(saved.address);
      if (saved?.complement) setComplement(saved.complement);
      if (saved?.lat)        setLat(saved.lat);
      if (saved?.lng)        setLng(saved.lng);
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
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
            { headers: { "Accept-Language": "pt-BR" } }
          );
          const data = await res.json();
          const road   = data.address?.road || data.address?.pedestrian || "";
          const number = data.address?.house_number || "";
          const suburb = data.address?.suburb || data.address?.neighbourhood || data.address?.district || "";
          const city   = data.address?.city || data.address?.town || "";
          const parts  = [road, number, suburb, city].filter(Boolean);
          if (parts.length > 0 && !address) setAddress(parts.join(", "));
        } catch {}
        setGeoStatus("ok");
      },
      () => setGeoStatus("err"),
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    if (!name.trim())                         { setErr("Digite seu nome."); return; }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10)                   { setErr("Digite um telefone válido com DDD."); return; }

    const user: QuickUser = {
      name:       name.trim(),
      phone:      digits,
      address:    address.trim() || undefined,
      complement: complement.trim() || undefined,
      lat,
      lng,
    };
    localStorage.setItem("adonay_quick_user", JSON.stringify(user));
    onConfirm(user);
  };

  const geoLabel = {
    idle:    "📍 Usar minha localização",
    loading: "📍 Obtendo localização...",
    ok:      "✓ Localização obtida",
    err:     "⚠ Localização indisponível",
  }[geoStatus];

  const geoColor = geoStatus === "ok" ? "#25D366"
    : geoStatus === "err" ? "#e84040"
    : "#9e9a90";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        zIndex: 1500, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 16, backdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111420", borderRadius: 18, width: "100%", maxWidth: 400,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)", overflow: "hidden",
          maxHeight: "90vh", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>
            ⚡ Pedir agora
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9e9a90", fontSize: 24, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 22px 22px", overflowY: "auto" }}>
          <p style={{ fontSize: 12, color: "#9e9a90", marginBottom: 16, lineHeight: 1.6 }}>
            Preencha seus dados para enviarmos o pedido pelo WhatsApp.<br />
            Salvamos para as próximas vezes!
          </p>

          {/* Nome */}
          <label style={lbl}>Seu nome *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome e sobrenome"
            autoFocus
            style={{ ...inp, marginBottom: 12 }}
          />

          {/* Telefone */}
          <label style={lbl}>WhatsApp / Telefone *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(fmtPhone(e.target.value))}
            placeholder="(92) 99999-9999"
            style={{ ...inp, marginBottom: 16 }}
          />

          {/* Divisor */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }} />

          {/* Endereço */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <label style={{ ...lbl, marginBottom: 0 }}>Endereço de entrega</label>
            <button
              onClick={handleGeo}
              disabled={geoStatus === "loading" || geoStatus === "ok"}
              style={{
                background: "none", border: "none", cursor: geoStatus === "loading" || geoStatus === "ok" ? "default" : "pointer",
                color: geoColor, fontSize: 11, fontFamily: "'DM Sans',sans-serif",
                padding: 0, display: "flex", alignItems: "center", gap: 3,
              }}
            >
              {geoLabel}
            </button>
          </div>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, número, bairro (deixe vazio p/ combinar)"
            style={{ ...inp, marginBottom: 10 }}
          />
          {lat && lng && (
            <div style={{ fontSize: 11, color: "#25D366", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              📌 Coordenadas salvas — link do Maps será enviado no pedido
            </div>
          )}

          {/* Complemento */}
          <label style={lbl}>Complemento / Ponto de referência</label>
          <input
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
            placeholder="Apto, bloco, portão, ponto de referência..."
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            style={{ ...inp, marginBottom: 16 }}
          />

          {/* Erro */}
          {err && (
            <div style={{ fontSize: 12, color: "#e84040", marginBottom: 12, padding: "7px 12px", background: "rgba(232,64,64,0.1)", borderRadius: 7 }}>
              {err}
            </div>
          )}

          {/* Confirmar */}
          <button
            onClick={handleConfirm}
            style={{
              width: "100%", padding: "12px 0",
              background: "linear-gradient(135deg,#1db954,#25D366)",
              border: "none", borderRadius: 10, cursor: "pointer",
              color: "#fff", fontWeight: 700, fontSize: 14,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Confirmar e pedir pelo WhatsApp →
          </button>

          <p style={{ fontSize: 11, color: "#3a3a3a", textAlign: "center", marginTop: 10 }}>
            * Campos obrigatórios · Endereço é opcional
          </p>
        </div>
      </div>
    </div>
  );
}
