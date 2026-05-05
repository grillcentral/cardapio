"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    fetch("/api/admin/me").then((r) => {
      if (r.ok) router.push("/admin/dashboard");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login.");
        return;
      }

      router.push("/admin/dashboard");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "#0b0d12", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, color: "#f0ede6", padding: "13px 16px", fontSize: 14,
    fontFamily: "DM Sans, sans-serif", outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0b0d12", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      fontFamily: "DM Sans, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,#c9a84c,#e4c97e)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
            margin: "0 auto 16px",
          }}>🍔</div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700,
            color: "#c9a84c", margin: 0,
          }}>Grill Central</h1>
          <p style={{ color: "#5a5650", fontSize: 13, marginTop: 6 }}>Painel Administrativo</p>
        </div>

        {/* Card */}
        <div style={{
          background: "#111420", borderRadius: 20, padding: "32px 28px",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f0ede6", margin: "0 0 24px" }}>
            Entrar na conta
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#9e9a90", display: "block", marginBottom: 6, fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@grillcentral.com"
                required
                style={inp}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: "#9e9a90", display: "block", marginBottom: 6, fontWeight: 500 }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
                style={inp}
              />
            </div>

            {error && (
              <div style={{
                fontSize: 13, color: "#e84040", marginBottom: 16, padding: "10px 14px",
                background: "rgba(232,64,64,0.1)", borderRadius: 8,
                border: "1px solid rgba(232,64,64,0.2)",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "14px 0",
                background: loading ? "#5a5650" : "linear-gradient(135deg,#c9a84c,#e4c97e)",
                border: "none", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
                color: "#0b0d12", fontWeight: 700, fontSize: 15,
                fontFamily: "DM Sans, sans-serif", transition: "all 0.15s",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", color: "#3a3830", fontSize: 12, marginTop: 20 }}>
          Grill Central &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
