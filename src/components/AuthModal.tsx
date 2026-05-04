"use client";

import { useState } from "react";

interface AuthModalProps {
  onClose: () => void;
}

type Tab = "login" | "register";

export default function AuthModal({ onClose }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>("login");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!loginData.email || !loginData.password) {
      setError("Preencha todos os campos.");
      return;
    }
    const users = JSON.parse(localStorage.getItem("adonay_users") || "[]");
    const user = users.find(
      (u: { email: string; password: string }) =>
        u.email === loginData.email && u.password === loginData.password
    );
    if (!user) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    localStorage.setItem("adonay_current_user", JSON.stringify(user));
    window.dispatchEvent(new Event("userChanged"));
    onClose();
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { name, email, phone, password, confirmPassword } = registerData;
    if (!name || !email || !phone || !password || !confirmPassword) {
      setError("Preencha todos os campos.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    const users = JSON.parse(localStorage.getItem("adonay_users") || "[]");
    if (users.find((u: { email: string }) => u.email === email)) {
      setError("Este e-mail já está cadastrado.");
      return;
    }
    const newUser = { name, email, phone, password };
    users.push(newUser);
    localStorage.setItem("adonay_users", JSON.stringify(users));
    localStorage.setItem("adonay_current_user", JSON.stringify(newUser));
    window.dispatchEvent(new Event("userChanged"));
    setSuccess("Cadastro realizado com sucesso!");
    setTimeout(() => onClose(), 1200);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgb(200, 200, 200)",
    borderRadius: "4px",
    padding: "8px 12px",
    fontSize: "15px",
    outline: "none",
    color: "rgb(33, 37, 41)",
    marginBottom: "12px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 700,
    color: "rgb(33, 37, 41)",
    marginBottom: "4px",
    display: "block",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          backgroundColor: "white",
          borderRadius: "8px",
          width: "100%",
          maxWidth: "420px",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "12px",
            right: "16px",
            background: "none",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
            color: "rgb(144,144,144)",
          }}
        >
          ×
        </button>

        {/* Tabs */}
        <div style={{ display: "flex", marginBottom: "20px", borderBottom: "1px solid rgb(220,220,220)" }}>
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); setSuccess(""); }}
              style={{
                flex: 1,
                padding: "10px",
                background: "none",
                border: "none",
                borderBottom: tab === t ? "2px solid rgb(83, 113, 209)" : "2px solid transparent",
                fontWeight: tab === t ? 700 : 400,
                fontSize: "15px",
                color: tab === t ? "rgb(83, 113, 209)" : "rgb(144,144,144)",
                cursor: "pointer",
                marginBottom: "-1px",
              }}
            >
              {t === "login" ? "Entrar" : "Cadastrar"}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ backgroundColor: "rgb(254,226,226)", color: "rgb(185,28,28)", padding: "8px 12px", borderRadius: "4px", fontSize: "13px", marginBottom: "12px" }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ backgroundColor: "rgb(220,252,231)", color: "rgb(21,128,61)", padding: "8px 12px", borderRadius: "4px", fontSize: "13px", marginBottom: "12px" }}>
            {success}
          </div>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin}>
            <label style={labelStyle}>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              style={inputStyle}
            />
            <label style={labelStyle}>Senha</label>
            <input
              type="password"
              placeholder="••••••"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              style={inputStyle}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                backgroundColor: "rgb(44, 62, 80)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "10px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                marginTop: "4px",
              }}
            >
              Entrar
            </button>
            <p style={{ textAlign: "center", fontSize: "13px", color: "rgb(144,144,144)", marginTop: "12px" }}>
              Não tem conta?{" "}
              <button
                type="button"
                onClick={() => setTab("register")}
                style={{ background: "none", border: "none", color: "rgb(83,113,209)", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
              >
                Cadastre-se
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <label style={labelStyle}>Nome completo</label>
            <input
              type="text"
              placeholder="Seu nome"
              value={registerData.name}
              onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
              style={inputStyle}
            />
            <label style={labelStyle}>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={registerData.email}
              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              style={inputStyle}
            />
            <label style={labelStyle}>Telefone / WhatsApp</label>
            <input
              type="tel"
              placeholder="(92) 99999-9999"
              value={registerData.phone}
              onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
              style={inputStyle}
            />
            <label style={labelStyle}>Senha</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={registerData.password}
              onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              style={inputStyle}
            />
            <label style={labelStyle}>Confirmar senha</label>
            <input
              type="password"
              placeholder="Repita a senha"
              value={registerData.confirmPassword}
              onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
              style={inputStyle}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                backgroundColor: "rgb(83, 113, 209)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "10px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                marginTop: "4px",
              }}
            >
              Criar conta
            </button>
          </form>
        )}
      </div>
    </>
  );
}
