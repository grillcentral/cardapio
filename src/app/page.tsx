"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import QuickUserModal, { type QuickUser } from "@/components/QuickUserModal";

/* ═══════════════════════════════════════════
   TYPES
═══════════════════════════════════════════ */
interface MenuItem {
  name: string;
  desc?: string | null;
  price: number;
  img?: string | null;
  destaque?: boolean;
  badge?: string;
}

interface MenuCategory {
  category: string;
  id: string;
  emoji: string;
  badge?: string;
  desc?: string;
  items: MenuItem[];
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  obs: string;
}

interface User {
  name: string;
  phone: string;
  address: string;
  password: string;
}

/* ═══════════════════════════════════════════
   MENU DATA
═══════════════════════════════════════════ */
const ALMOCO: MenuCategory[] = [
  {
    category: "Pratos Executivos", id: "pratos-executivos", emoji: "🍽️",
    badge: "Almoço",
    items: [
      { name: "Carne na Chapa", desc: "arroz, macarrão, maionese, farofa, fritas e queijo coalho", price: 25, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770858678698d28b60e873_75_75.jpeg" },
      { name: "Filé de Frango Grelhado", desc: "arroz, macarrão, maionese, fritas e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285114769ab8fcb8dc4f_75_75.jpeg" },
      { name: "Bife Acebolado", desc: "arroz, macarrão, salada crua, farofa e fritas", price: 22 },
      { name: "Bife a Cavalo", desc: "arroz, macarrão, salada crua, farofa e fritas", price: 24 },
      { name: "Strogonoff de Frango", desc: "arroz, purê, batata palha e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770859072698d2a406c4ff_75_75.jpeg" },
      { name: "Strogonoff de Carne", desc: "arroz, purê, batata palha e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177319053969b0bd8b6e45c_75_75.jpeg" },
      { name: "Panqueca Gratinada de Frango", desc: "arroz, purê, batata palha e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285085369ab8ea52663c_75_75.jpeg" },
      { name: "Panqueca Gratinada de Carne", desc: "arroz, purê, batata palha e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177319074969b0be5d60c55_75_75.jpeg" },
      { name: "Parmegiana de Frango", desc: "arroz, purê e batata frita", price: 25, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285096469ab8f3c25e81_75_75.jpeg" },
      { name: "Parmegiana de Carne", desc: "arroz, purê e batata frita", price: 25 },
      { name: "Filé de Frango a Milanesa", desc: "arroz, macarrão, feijão, maionese e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285102169ab8f69df2f8_75_75.jpeg" },
      { name: "Bisteca Bovina Grelhada", desc: "arroz, macarrão, maionese e farofa", price: 22 },
    ],
  },
];

const NOITE: MenuCategory[] = [
  {
    category: "Cardápio da Noite", id: "cardapio-noite", emoji: "🌙",
    badge: "Noite",
    desc: "Pratos especiais disponíveis das 19h às 23h",
    items: [
      { name: "Filé de Frango Grelhado", desc: "arroz, macarrão, maionese, fritas e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285114769ab8fcb8dc4f_75_75.jpeg" },
      { name: "Tambaqui Frito", desc: "baião e vinagrete", price: 25, destaque: true },
      { name: "Strogonoff de Frango", desc: "arroz, purê, batata palha e farofa", price: 21, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770859072698d2a406c4ff_75_75.jpeg" },
      { name: "Carne na Chapa", desc: "arroz, macarrão, maionese, farofa e batata fritas", price: 25, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770858678698d28b60e873_75_75.jpeg" },
      { name: "Panqueca de Carne", desc: "arroz, purê, batata palha e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177319074969b0be5d60c55_75_75.jpeg" },
      { name: "Panqueca de Frango", desc: "arroz, purê, batata palha e farofa", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285085369ab8ea52663c_75_75.jpeg" },
      { name: "Parmegiana de Frango", desc: "arroz, purê e batata frita", price: 25, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285096469ab8f3c25e81_75_75.jpeg" },
    ],
  },
  {
    category: "Combos", id: "combos", emoji: "🤝",
    badge: "Noite",
    items: [
      { name: "Combo Solteirinho", desc: "1 x-salada + 150g de batata + 1 coca em lata", price: 25, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285199369ab93f1b0a94_75_75.jpeg" },
      { name: "Combo Casadinho", desc: "2 x-saladas + hot dog + fritas + 2 coca em lata", price: 30 },
      { name: "Combo Triplo", desc: "3 x-saladas + fritas + refrigerante", price: 40 },
      { name: "Combo Família", desc: "variedade de lanches + fritas + 1 refrigerante pet 2 litros", price: 70 },
    ],
  },
  {
    category: "X-Saladas", id: "x-saladas", emoji: "🍔",
    badge: "Noite",
    items: [
      { name: "X-Salada", desc: "pão, hamburger, alface, tomate, maionese", price: 8 },
      { name: "X-Salada Bacon", desc: "pão, hamburger, bacon, alface, tomate, maionese, queijo", price: 15 },
      { name: "X-Tudo", desc: "pão, hamburger, bacon, ovo, alface, tomate, maionese, queijo", price: 18 },
      { name: "X-Calabresa", desc: "pão, calabresa, alface, tomate, maionese", price: 13 },
    ],
  },
  {
    category: "Kikão 🔥", id: "kikao", emoji: "🌭",
    badge: "Noite",
    items: [
      { name: "Kikão Simples", desc: "pão de hot dog recheado artesanal", price: 8 },
      { name: "Kikão Especial", desc: "pão de hot dog recheado premium", price: 10 },
    ],
  },
];

const SEMPRE: MenuCategory[] = [
  {
    category: "Porções de Batata", id: "porcoes-batata", emoji: "🍟",
    items: [
      { name: "Batata Pequena (150g)", price: 10, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285215069ab94ce428b5_75_75.jpeg" },
      { name: "Batata Média (200g)", price: 15, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285219069ab94fe62de5_75_75.jpeg" },
      { name: "Batata Grande (300g)", price: 20, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285223569ab952793b5e_75_75.jpeg" },
      { name: "Batata com Bacon (300g)", desc: "batata frita crocante com bacon", price: 25 },
    ],
  },
  {
    category: "Porções de Pastelzinhos", id: "pastelzinhos", emoji: "🥟",
    items: [
      { name: "Pastelzinho de Carne (6 un)", price: 10 },
      { name: "Pastelzinho de Frango (6 un)", price: 10 },
      { name: "Pastelzinho de Queijo (6 un)", price: 10 },
    ],
  },
  {
    category: "Sucos Naturais", id: "sucos-naturais", emoji: "🍹",
    desc: "100% naturais · Feitos na hora",
    items: [
      { name: "Taperebá 300ml", price: 7 },
      { name: "Cupuaçu 300ml", price: 7, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285273069ab9838f10ab_75_75.jpeg" },
      { name: "Graviola 300ml", price: 7, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285280369ab98c38b5c9_75_75.jpeg" },
      { name: "Manga 300ml", price: 7 },
      { name: "Goiaba 300ml", price: 7, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285291769ab994f5c5b6_75_75.jpeg" },
      { name: "Acerola 300ml", price: 7, img: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285263169ab97c3ab64e_75_75.jpeg" },
      { name: "Maracujá 300ml", price: 7 },
      { name: "Laranja 300ml", price: 7 },
      { name: "Morango 300ml", price: 7 },
      { name: "Abacaxi 300ml", price: 7 },
      { name: "Cupuaçu 500ml", price: 10 },
      { name: "Graviola 500ml", price: 10 },
      { name: "Manga 500ml", price: 10 },
      { name: "Goiaba 500ml", price: 10 },
      { name: "Acerola 500ml", price: 10 },
      { name: "Maracujá 500ml", price: 10 },
      { name: "Laranja 1 litro", price: 18 },
      { name: "Cupuaçu 1 litro", price: 18 },
      { name: "Graviola 1 litro", price: 18 },
      { name: "Manga 1 litro", price: 18 },
      { name: "Goiaba 1 litro", price: 18 },
      { name: "Maracujá 1 litro", price: 18 },
      { name: "Morango 1 litro", price: 18 },
    ],
  },
  {
    category: "Refrigerantes", id: "refrigerantes", emoji: "🥤",
    items: [
      { name: "Coca-Cola lata 350ml", price: 5 },
      { name: "Guaraná Antarctica lata 350ml", price: 5 },
      { name: "Fanta Laranja lata 350ml", price: 5 },
      { name: "Sprite lata 350ml", price: 5 },
      { name: "Coca-Cola 600ml", price: 8 },
      { name: "Guaraná Antarctica 600ml", price: 8 },
      { name: "Água mineral 500ml", price: 3 },
    ],
  },
];

const PERIODS = {
  almoco: { label: "Almoço", icon: "☀️", time: "Seg–Sáb · 11h–15h", color: "#e8a84c", data: [...ALMOCO, ...SEMPRE] },
  noite: { label: "Noite", icon: "🌙", time: "Todos os dias · 19h–23h", color: "#7b8ee8", data: [...NOITE, ...SEMPRE] },
  tudo: { label: "Cardápio Completo", icon: "📋", time: "Todos os itens", color: "#9e9a90", data: [...ALMOCO, ...NOITE, ...SEMPRE] },
};

type PeriodKey = keyof typeof PERIODS;

const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

/* ─── SVG Icons ─── */
const CartIcon = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
const SearchIcon = ({ s = 15 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const PlusIcon = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const MinusIcon = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14" />
  </svg>
);
const TrashIcon = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const WaIcon = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
const MapPin = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const Clock = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

/* ─── AUTH MODAL ─── */
function AuthModal({ onClose, onLogin }: { onClose: () => void; onLogin: (u: User) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", phone: "", address: "", password: "" });
  const [err, setErr] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleRegister = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.password.trim()) { setErr("Preencha nome, telefone e senha."); return; }
    const users: User[] = JSON.parse(localStorage.getItem("grillcentral_users") || "[]");
    if (users.find((u) => u.phone === form.phone)) { setErr("Telefone já cadastrado. Faça login."); return; }
    const user: User = { name: form.name, phone: form.phone, address: form.address, password: form.password };
    users.push(user);
    localStorage.setItem("grillcentral_users", JSON.stringify(users));
    localStorage.setItem("grillcentral_current_user", JSON.stringify(user));
    onLogin(user); onClose();
  };

  const handleLogin = () => {
    if (!form.phone.trim() || !form.password.trim()) { setErr("Informe telefone e senha."); return; }
    const users: User[] = JSON.parse(localStorage.getItem("grillcentral_users") || "[]");
    const user = users.find((u) => u.phone === form.phone && u.password === form.password);
    if (!user) { setErr("Telefone ou senha incorretos."); return; }
    localStorage.setItem("grillcentral_current_user", JSON.stringify(user));
    onLogin(user); onClose();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  const inp: React.CSSProperties = { width: "100%", background: "#0b0d12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f0ede6", padding: "10px 13px", fontSize: 13, fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 10 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#111420", borderRadius: 18, width: "100%", maxWidth: 420, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", overflow: "hidden" }}>
        <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "#c9a84c" }}>{tab === "login" ? "Entrar" : "Cadastrar-se"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9e9a90", fontSize: 24, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", margin: "16px 22px 0", background: "#0b0d12", borderRadius: 10, padding: 3 }}>
          {([["login", "Já tenho conta"], ["register", "Novo cadastro"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setErr(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: tab === k ? 600 : 400, background: tab === k ? "#2a2a2a" : "transparent", color: tab === k ? "#c9a84c" : "#9e9a90", transition: "all 0.15s" }}>{l}</button>
          ))}
        </div>
        <div style={{ padding: "18px 22px 22px" }}>
          {tab === "register" && <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Seu nome completo" style={inp} />}
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Telefone / WhatsApp" style={inp} />
          {tab === "register" && <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Endereço de entrega (opcional)" style={inp} />}
          <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Senha" style={inp} />
          {err && <div style={{ fontSize: 12, color: "#e84040", marginBottom: 10, padding: "8px 12px", background: "rgba(232,64,64,0.1)", borderRadius: 7 }}>{err}</div>}
          <button onClick={tab === "login" ? handleLogin : handleRegister} style={{ width: "100%", padding: "12px 0", background: "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 10, cursor: "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 14, fontFamily: "DM Sans,sans-serif" }}>
            {tab === "login" ? "Entrar" : "Criar conta"}
          </button>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#5a5650" }}>
            {tab === "login" ? "Não tem conta? " : "Já tem conta? "}
            <button onClick={() => { setTab(tab === "login" ? "register" : "login"); setErr(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c", fontSize: 12, fontFamily: "DM Sans,sans-serif", fontWeight: 600 }}>
              {tab === "login" ? "Cadastre-se" : "Faça login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ITEM MODAL ─── */
function ItemModal({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (item: MenuItem, qty: number, obs: string) => void }) {
  const [qty, setQty] = useState(1);
  const [obs, setObs] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#111420", borderRadius: 18, width: "100%", maxWidth: 460, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", overflow: "hidden" }}>
        <div style={{ height: 210, background: "#0b0d12", position: "relative", overflow: "hidden" }}>
          {item.img
            ? <img src={item.img} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 72, opacity: 0.3 }}>🍽️</div>
          }
          {item.destaque && <div style={{ position: "absolute", top: 12, left: 12, background: "#e8833a", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>⭐ Destaque</div>}
          {item.badge && <div style={{ position: "absolute", top: 12, right: 44, background: item.badge === "Noite" ? "rgba(123,142,232,0.9)" : "rgba(232,168,76,0.9)", color: "#fff", fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20 }}>{item.badge === "Noite" ? "🌙" : "☀️"} {item.badge}</div>}
          <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "20px 22px 22px" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "#f0ede6", marginBottom: 4 }}>{item.name}</div>
          {item.desc && <div style={{ fontSize: 12, color: "#9e9a90", marginBottom: 10, lineHeight: 1.5 }}>{item.desc}</div>}
          <div style={{ fontSize: 24, fontWeight: 700, color: "#c9a84c", marginBottom: 16 }}>{fmt(item.price)}</div>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações (ex: sem cebola, bem passado...)" style={{ width: "100%", height: 60, background: "#0b0d12", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, color: "#f0ede6", padding: "9px 12px", resize: "none", fontFamily: "DM Sans,sans-serif", fontSize: 13, marginBottom: 14, outline: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", background: "#0b0d12", borderRadius: 8, border: "1px solid rgba(255,255,255,0.09)", overflow: "hidden" }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 38, height: 40, background: "none", border: "none", cursor: "pointer", color: "#9e9a90", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ width: 28, textAlign: "center", fontWeight: 600, fontSize: 15 }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 38, height: 40, background: "none", border: "none", cursor: "pointer", color: "#c9a84c", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>
            <button onClick={() => { onAdd(item, qty, obs); onClose(); }} style={{ flex: 1, height: 40, background: "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", borderRadius: 8, cursor: "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 14, fontFamily: "DM Sans,sans-serif" }}>
              Adicionar · {fmt(item.price * qty)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CART SIDEBAR ─── */
function CartSidebar({ cart, onUpdate, onRemove, onClear, mobileOpen, onCloseMobile, onCheckout, whatsapp }: {
  cart: CartItem[]; onUpdate: (id: string, qty: number) => void;
  onRemove: (id: string) => void; onClear: () => void;
  mobileOpen: boolean; onCloseMobile: () => void; onCheckout: () => void;
  whatsapp: string;
}) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const waMsg = () => {
    const u: User | null = (() => { try { return JSON.parse(localStorage.getItem("grillcentral_current_user") || "null"); } catch { return null; } })();
    let m = "🛒 *Pedido — Grill Central*\n\n";
    if (u?.name) m += `👤 *Cliente:* ${u.name}\n`;
    cart.forEach((i) => { m += `• ${i.qty}x ${i.name} — ${fmt(i.price * i.qty)}\n`; if (i.obs) m += `  _(${i.obs})_\n`; });
    m += `\n*Total: ${fmt(total)}*\n\n`;
    m += u?.address ? `📍 *Endereço:* ${u.address}` : "📍 *Endereço para entrega:* ";
    return encodeURIComponent(m);
  };

  const [waLoading, setWaLoading] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);

  const getQuickUser = () => {
    try { return JSON.parse(localStorage.getItem("grillcentral_quick_user") || "null") as QuickUser | null; } catch { return null; }
  };

  const doPostAndOpenWA = async (user: QuickUser) => {
    setWaLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: user.name,
          customer_phone: user.phone,
          items: cart,
          subtotal: total,
          delivery_fee: 0,
          total,
          order_type: "whatsapp_direct",
          payment: "A confirmar",
        }),
      });
      if (!res.ok) throw new Error("api_error");
      const order = await res.json();
      let m = `🛒 *Pedido #${order.id} — Grill Central*\n\n`;
      m += `👤 *Cliente:* ${user.name}\n`;
      m += `📱 *Telefone:* ${user.phone}\n\n`;
      m += `*Itens:*\n`;
      cart.forEach((i) => { m += `• ${i.qty}x ${i.name} — ${fmt(i.price * i.qty)}\n`; if (i.obs) m += `  _(${i.obs})_\n`; });
      m += `\n✅ *Total: ${fmt(total)}*\n\n`;
      m += `📍 *Endereço:* ${user.address || "a combinar"}\n`;
      if (user.complement) m += `🏷️ *Ref:* ${user.complement}\n`;
      if (user.lat && user.lng) m += `📌 *Mapa:* https://maps.google.com/?q=${user.lat},${user.lng}\n`;
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(m)}`, "_blank");
    } catch {
      window.open(`https://wa.me/${whatsapp}?text=${waMsg()}`, "_blank");
    } finally {
      setWaLoading(false);
    }
  };

  const handleWaDirect = () => {
    const user = getQuickUser();
    if (!user) { setShowQuickModal(true); return; }
    doPostAndOpenWA(user);
  };

  const Inner = () => (
    <div style={{ background: "#0f1118", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CartIcon s={17} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Carrinho</span>
          {count > 0 && <span style={{ background: "#c9a84c", color: "#0b0d12", fontSize: 10, fontWeight: 800, borderRadius: "50%", width: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {cart.length > 0 && <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a5650", fontSize: 11, fontFamily: "DM Sans,sans-serif" }}>Limpar</button>}
          <button className="hide-desk" onClick={onCloseMobile} style={{ background: "none", border: "none", cursor: "pointer", color: "#9e9a90", fontSize: 24, lineHeight: 1, paddingLeft: 4 }}>×</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {cart.length === 0
          ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 20px", gap: 10, color: "#5a5650" }}>
            <span style={{ fontSize: 36 }}>🛒</span>
            <span style={{ fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>Carrinho vazio.<br />Adicione itens do cardápio!</span>
          </div>
          : cart.map((item) => (
            <div key={item.id} style={{ padding: "9px 14px", display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#f0ede6", marginBottom: 1, lineHeight: 1.3 }}>{item.name}</div>
                {item.obs && <div style={{ fontSize: 10, color: "#5a5650", marginBottom: 3, fontStyle: "italic" }}>{item.obs}</div>}
                <div style={{ fontSize: 13, color: "#c9a84c", fontWeight: 700 }}>{fmt(item.price * item.qty)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <button onClick={() => onUpdate(item.id, item.qty - 1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.09)", background: "#0b0d12", cursor: "pointer", color: "#9e9a90", display: "flex", alignItems: "center", justifyContent: "center" }}><MinusIcon s={11} /></button>
                <span style={{ width: 20, textAlign: "center", fontSize: 12, fontWeight: 600 }}>{item.qty}</span>
                <button onClick={() => onUpdate(item.id, item.qty + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.09)", background: "#0b0d12", cursor: "pointer", color: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center" }}><PlusIcon s={11} /></button>
                <button onClick={() => onRemove(item.id)} style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(232,64,64,0.1)", cursor: "pointer", color: "#e84040", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 3 }}><TrashIcon s={11} /></button>
              </div>
            </div>
          ))
        }
      </div>
      {cart.length > 0 && (
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: "#9e9a90", fontSize: 12 }}>Total do pedido</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#c9a84c" }}>{fmt(total)}</span>
          </div>
          <button onClick={onCheckout}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "11px 0", background: "linear-gradient(135deg,#e8833a,#c9a84c)", borderRadius: 10, border: "none", cursor: "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 13, fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>
            Finalizar Pedido →
          </button>
          <button onClick={handleWaDirect} disabled={waLoading}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "9px 0", background: "rgba(37,211,102,0.1)", borderRadius: 10, border: "1px solid rgba(37,211,102,0.25)", cursor: waLoading ? "not-allowed" : "pointer", color: "#25D366", fontWeight: 600, fontSize: 12, fontFamily: "DM Sans,sans-serif", opacity: waLoading ? 0.7 : 1 }}>
            <WaIcon s={14} /> {waLoading ? "Registrando pedido..." : "Pedir direto pelo WhatsApp"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="hide-mob" style={{ width: 300, flexShrink: 0, position: "sticky", top: 104, maxHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
        <Inner />
      </div>
      {mobileOpen && (
        <div className="hide-desk" style={{ position: "fixed", inset: 0, zIndex: 500 }}>
          <div onClick={onCloseMobile} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "82vh", animation: "slideIn 0.3s ease", background: "#0b0d12", borderTop: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Inner />
          </div>
        </div>
      )}
      {showQuickModal && (
        <QuickUserModal
          onConfirm={(user) => { setShowQuickModal(false); doPostAndOpenWA(user); }}
          onClose={() => setShowQuickModal(false)}
        />
      )}
    </>
  );
}

/* ─── GRID CARD ─── */
function ListCard({ item, onAdd, onOpen, onQuickOrder, quickOrderingName }: {
  item: MenuItem;
  onAdd: (item: MenuItem, qty: number, obs: string) => void;
  onOpen: (item: MenuItem) => void;
  onQuickOrder?: (item: MenuItem) => void;
  quickOrderingName?: string | null;
}) {
  const [hov, setHov] = useState(false);
  const isOrdering = quickOrderingName === item.name;
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={() => onOpen(item)}
      style={{ borderRadius: 12, overflow: "hidden", cursor: "pointer", position: "relative", background: hov ? "#141720" : "#111420", border: "1px solid rgba(255,255,255,0.07)", boxShadow: hov ? "0 8px 28px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.3)", transform: hov ? "translateY(-3px)" : "translateY(0)", transition: "all 0.18s ease", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 160, background: "#0b0d12", position: "relative", overflow: "hidden", flexShrink: 0 }}>
        {item.img
          ? <img src={item.img} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s", transform: hov ? "scale(1.06)" : "scale(1)" }} onError={(e) => { const p = (e.target as HTMLImageElement).parentNode as HTMLElement; p.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:44px;opacity:0.2">🍽️</div>'; }} />
          : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, opacity: 0.2 }}>🍽️</div>
        }
        {item.destaque && <div style={{ position: "absolute", top: 8, left: 8, background: "#e8833a", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 10 }}>⭐ DESTAQUE</div>}
        {item.badge && <div style={{ position: "absolute", top: 8, right: 8, background: item.badge === "Noite" ? "rgba(100,115,200,0.85)" : "rgba(200,150,60,0.85)", color: "#fff", fontSize: 9, fontWeight: 600, padding: "3px 7px", borderRadius: 10 }}>{item.badge === "Noite" ? "🌙" : "☀️"} {item.badge}</div>}
      </div>
      <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#f0ede6", lineHeight: 1.35, flex: 1 }}>{item.name}</div>
        {item.desc && <div style={{ fontSize: 11, color: "#5a5650", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{item.desc}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#c9a84c" }}>{fmt(item.price)}</div>
          <button onClick={(e) => { e.stopPropagation(); onAdd(item, 1, ""); }}
            style={{ width: 30, height: 30, borderRadius: 8, background: hov ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.35)", cursor: "pointer", color: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s", flexShrink: 0 }}>
            <PlusIcon s={14} />
          </button>
        </div>
        {onQuickOrder && (
          <button
            onClick={(e) => { e.stopPropagation(); if (!isOrdering) onQuickOrder(item); }}
            disabled={isOrdering}
            style={{ width: "100%", marginTop: 6, padding: "6px 0", background: isOrdering ? "rgba(232,131,58,0.35)" : "linear-gradient(135deg,#e8833a,#c9a84c)", border: "none", borderRadius: 7, cursor: isOrdering ? "not-allowed" : "pointer", color: "#0b0d12", fontWeight: 700, fontSize: 11, fontFamily: "DM Sans,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, opacity: isOrdering ? 0.7 : 1, transition: "opacity 0.15s" }}>
            {isOrdering ? "Registrando..." : "⚡ Pedir agora"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function App() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("grillcentral_period") as PeriodKey) || "tudo";
    return "tudo";
  });
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") { try { return JSON.parse(localStorage.getItem("grillcentral_cart") || "[]"); } catch { return []; } }
    return [];
  });
  const [modal, setModal] = useState<MenuItem | null>(null);
  const [mobCart, setMobCart] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") { try { return JSON.parse(localStorage.getItem("grillcentral_current_user") || "null"); } catch { return null; } }
    return null;
  });
  const catNavRef = useRef<HTMLDivElement>(null);
  const secRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── API-driven menu (replaces hardcoded data when DB is available) ─────────
  const [apiCategories, setApiCategories] = useState<MenuCategory[] | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.restaurant?.whatsapp) setWhatsapp(data.restaurant.whatsapp);
        if (data?.categories && Array.isArray(data.categories)) {
          const mapped: MenuCategory[] = data.categories.map((cat: {
            id: number; name: string; emoji: string | null; periodTag: string | null;
            description?: string;
            products: Array<{ id: number; name: string; description?: string | null; price: number; imageUrl?: string | null; isFeatured?: boolean }>;
          }) => ({
            category: cat.name,
            id: String(cat.id),
            emoji: cat.emoji || "🍽️",
            badge: cat.periodTag === "almoco" ? "Almoço" : cat.periodTag === "noite" ? "Noite" : undefined,
            desc: cat.description,
            items: cat.products.map((p) => ({
              name: p.name,
              desc: p.description,
              price: p.price,
              img: p.imageUrl,
              destaque: p.isFeatured,
            })),
          }));
          setApiCategories(mapped);
        }
      })
      .catch(() => { /* fallback to hardcoded */ })
      .finally(() => setApiLoading(false));
  }, []);

  useEffect(() => { localStorage.setItem("grillcentral_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("grillcentral_period", period); }, [period]);

  // Build menu data: use API data if available, else fallback to hardcoded
  const menuData = useMemo(() => {
    if (!apiCategories) return PERIODS[period].data;
    const almocoCats = apiCategories.filter((c) => !c.badge || c.badge === "Almoço");
    const noiteCats = apiCategories.filter((c) => !c.badge || c.badge === "Noite");
    const sempreCats = apiCategories.filter((c) => !c.badge);
    if (period === "almoco") return [...apiCategories.filter((c) => c.badge === "Almoço"), ...sempreCats];
    if (period === "noite") return [...apiCategories.filter((c) => c.badge === "Noite"), ...sempreCats];
    return apiCategories;
    void almocoCats; void noiteCats;
  }, [period, apiCategories]);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActiveId(e.target.id); });
    }, { rootMargin: "-100px 0px -55% 0px" });
    Object.values(secRefs.current).forEach((el) => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [menuData]);

  const addToCart = useCallback((item: MenuItem, qty: number, obs: string) => {
    const id = item.name + "|" + obs;
    setCart((prev) => {
      const ex = prev.find((i) => i.id === id);
      if (ex) return prev.map((i) => i.id === id ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { id, name: item.name, price: item.price, qty, obs }];
    });
    setToast(item.name);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const updateCart = (id: string, qty: number) => { if (qty <= 0) setCart((p) => p.filter((i) => i.id !== id)); else setCart((p) => p.map((i) => i.id === id ? { ...i, qty } : i)); };
  const removeCart = (id: string) => setCart((p) => p.filter((i) => i.id !== id));
  const clearCart = () => setCart([]);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  const [quickOrderingName, setQuickOrderingName] = useState<string | null>(null);
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false);
  const [pendingQuickItem, setPendingQuickItem] = useState<MenuItem | null>(null);

  const getQuickUserApp = () => {
    try { return JSON.parse(localStorage.getItem("grillcentral_quick_user") || "null") as QuickUser | null; } catch { return null; }
  };

  const doItemPost = async (item: MenuItem, user: QuickUser) => {
    setQuickOrderingName(item.name);
    const itemTotal = item.price;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: user.name,
          customer_phone: user.phone,
          items: [{ name: item.name, price: item.price, qty: 1, obs: "" }],
          subtotal: itemTotal,
          delivery_fee: 0,
          total: itemTotal,
          order_type: "whatsapp_direct",
          payment: "A confirmar",
        }),
      });
      if (!res.ok) throw new Error("api_error");
      const order = await res.json();
      let m = `🛒 *Pedido #${order.id} — Grill Central*\n\n`;
      m += `👤 *Cliente:* ${user.name}\n`;
      m += `📱 *Telefone:* ${user.phone}\n\n`;
      m += `*Itens:*\n• 1x ${item.name} — ${fmt(itemTotal)}\n`;
      m += `\n✅ *Total: ${fmt(itemTotal)}*\n\n`;
      m += `📍 *Endereço:* ${user.address || "a combinar"}\n`;
      if (user.complement) m += `🏷️ *Ref:* ${user.complement}\n`;
      if (user.lat && user.lng) m += `📌 *Mapa:* https://maps.google.com/?q=${user.lat},${user.lng}\n`;
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(m)}`, "_blank");
    } catch {
      let m = `🛒 *Pedido — Grill Central*\n\n`;
      m += `👤 *Cliente:* ${user.name}\n📱 *Telefone:* ${user.phone}\n\n• 1x ${item.name} — ${fmt(itemTotal)}\n`;
      m += `\n✅ *Total: ${fmt(itemTotal)}*\n\n`;
      m += `📍 *Endereço:* ${user.address || "a combinar"}\n`;
      if (user.complement) m += `🏷️ *Ref:* ${user.complement}\n`;
      if (user.lat && user.lng) m += `📌 *Mapa:* https://maps.google.com/?q=${user.lat},${user.lng}\n`;
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(m)}`, "_blank");
    } finally {
      setQuickOrderingName(null);
    }
  };

  const handleQuickOrderItem = (item: MenuItem) => {
    const user = getQuickUserApp();
    if (!user) { setPendingQuickItem(item); setShowQuickOrderModal(true); return; }

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      setQuickOrderingName(item.name);
      let called = false;
      const userWithoutGeo: QuickUser = { ...user, lat: undefined, lng: undefined };
      const proceed = (u: QuickUser) => {
        if (called) return;
        called = true;
        doItemPost(item, u);
      };
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const enriched: QuickUser = { ...user, lat: pos.coords.latitude, lng: pos.coords.longitude };
          localStorage.setItem("grillcentral_quick_user", JSON.stringify(enriched));
          proceed(enriched);
        },
        () => proceed(userWithoutGeo),
        { timeout: 3500, enableHighAccuracy: false, maximumAge: 0 }
      );
      setTimeout(() => proceed(userWithoutGeo), 4000);
    } else {
      doItemPost(item, { ...user, lat: undefined, lng: undefined });
    }
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) { const top = el.getBoundingClientRect().top + window.scrollY - 115; window.scrollTo({ top, behavior: "smooth" }); }
    const btn = catNavRef.current?.querySelector(`[data-cat="${id}"]`) as HTMLElement | null;
    if (btn) btn.scrollIntoView({ inline: "center", block: "nearest" });
  };

  const filtered = (items: MenuItem[]) => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q) || (i.desc || "").toLowerCase().includes(q));
  };

  const P = PERIODS[period];

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d12" }}>

      {/* ══ TOPBAR ══ */}
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(11,13,18,0.97)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", gap: 10, height: 52 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/restaurant-logo.jpeg" alt="Grill Central" style={{ width: 34, height: 34, borderRadius: 7, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(201,168,76,0.3)" }} />
          <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 15, color: "#c9a84c", whiteSpace: "nowrap" }}>Grill Central</span>
          <div style={{ flex: 1, maxWidth: 340, display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0 11px", height: 34 }}>
            <SearchIcon s={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no cardápio..."
              style={{ flex: 1, background: "none", border: "none", color: "#f0ede6", outline: "none", fontSize: 12, fontFamily: "DM Sans,sans-serif" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a5650", fontSize: 16 }}>×</button>}
          </div>
          {currentUser
            ? <div className="hide-mob" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 7, cursor: "pointer" }} onClick={() => setAuthOpen(true)}>
                <span style={{ fontSize: 18 }}>👤</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#c9a84c" }}>Olá, {currentUser.name.split(" ")[0]}</span>
              </div>
              <button onClick={() => { localStorage.removeItem("grillcentral_current_user"); setCurrentUser(null); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, cursor: "pointer", color: "#9e9a90", fontSize: 11, padding: "5px 10px", fontFamily: "DM Sans,sans-serif" }}>Sair</button>
            </div>
            : <button onClick={() => setAuthOpen(true)} className="hide-mob" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 14px", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 7, cursor: "pointer", color: "#c9a84c", fontSize: 12, fontWeight: 600, fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap" }}>
              👤 Entrar / Cadastrar
            </button>
          }
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="hide-mob"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 7, textDecoration: "none", color: "#25D366", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>
            <WaIcon s={14} /> WhatsApp
          </a>
          <button className="hide-desk" onClick={() => setMobCart(true)} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "#c9a84c", display: "flex", alignItems: "center", padding: 4 }}>
            <CartIcon s={22} />
            {totalItems > 0 && <span style={{ position: "absolute", top: 0, right: 0, background: "#c9a84c", color: "#0b0d12", fontSize: 9, fontWeight: 800, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{totalItems}</span>}
          </button>
        </div>
      </div>

      {/* ══ HERO ══ */}
      <div style={{ background: "linear-gradient(160deg,#18100a 0%,#0b0d12 45%,#0a0f14 100%)", position: "relative", overflow: "hidden", paddingBottom: 4 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 80% at 20% 40%, rgba(201,168,76,0.07) 0%, transparent 65%)" }} />
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 16px 20px", position: "relative", display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/restaurant-logo.jpeg" alt="Logo" style={{ width: 100, height: 100, borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.6)", flexShrink: 0, objectFit: "cover", border: "3px solid rgb(0,0,0)" }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: "#c9a84c", lineHeight: 1.1, marginBottom: 4 }}>Grill Central</div>
            <div style={{ fontSize: 12, color: "#9e9a90", marginBottom: 8 }}>Sabor das Carnes e Lanches</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ background: "rgba(201,168,76,0.1)", color: "#e8a84c", border: "1px solid rgba(201,168,76,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                <Clock s={11} /> Terça a Domingo · 18:30–23:30
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#5a5650", fontSize: 11 }}>
              <MapPin s={11} /> www.grillcardapio.com.br
            </div>
          </div>
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="hide-mob"
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "linear-gradient(135deg,#1db954,#25D366)", borderRadius: 10, textDecoration: "none", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "DM Sans,sans-serif", boxShadow: "0 4px 20px rgba(37,211,102,0.3)", flexShrink: 0 }}>
            <WaIcon s={16} /> Pedir agora
          </a>
        </div>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 16px 18px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.entries(PERIODS) as [PeriodKey, typeof PERIODS[PeriodKey]][]).map(([k, v]) => (
            <button key={k} onClick={() => { setPeriod(k); setActiveId(""); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 20, border: `1px solid ${period === k ? v.color + "60" : "rgba(255,255,255,0.08)"}`, background: period === k ? v.color + "18" : "transparent", color: period === k ? v.color : "#9e9a90", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: period === k ? 600 : 400, transition: "all 0.2s" }}>
              {v.icon} {v.label}
              <span style={{ fontSize: 11, opacity: 0.7 }}>{v.time}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ CATEGORY NAV ══ */}
      <div style={{ position: "sticky", top: 52, zIndex: 100, background: "rgba(11,13,18,0.99)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div ref={catNavRef} className="no-scroll" style={{ maxWidth: 1120, margin: "0 auto", padding: "0 16px", display: "flex", gap: 2, overflowX: "auto", height: 44, alignItems: "center" }}>
          {menuData.map((cat) => (
            <button key={cat.id} data-cat={cat.id} onClick={() => scrollTo(cat.id)}
              style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 16, border: activeId === cat.id ? "1px solid rgba(201,168,76,0.4)" : "1px solid transparent", background: activeId === cat.id ? "rgba(201,168,76,0.1)" : "transparent", color: activeId === cat.id ? "#c9a84c" : "#6b6760", cursor: "pointer", fontSize: 12, fontWeight: activeId === cat.id ? 600 : 400, fontFamily: "DM Sans,sans-serif", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 4 }}>
              {cat.emoji} {cat.category}
            </button>
          ))}
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 16px", display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {search && <div style={{ marginBottom: 14, color: "#9e9a90", fontSize: 13 }}>Resultados para <strong style={{ color: "#c9a84c" }}>&quot;{search}&quot;</strong></div>}

          {menuData.map((cat) => {
            const items = filtered(cat.items);
            if (!items.length) return null;
            return (
              <div key={cat.id} id={cat.id} ref={(el) => { secRefs.current[cat.id] = el; }} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: "#f0ede6", lineHeight: 1 }}>{cat.category}</h2>
                    {cat.desc && <div style={{ fontSize: 11, color: "#5a5650", marginTop: 2 }}>{cat.desc}</div>}
                  </div>
                  {cat.badge && (
                    <span style={{ background: cat.badge === "Noite" ? "rgba(123,142,232,0.12)" : "rgba(232,168,76,0.12)", color: cat.badge === "Noite" ? "#8f9fe8" : "#e8a84c", border: `1px solid ${cat.badge === "Noite" ? "rgba(123,142,232,0.25)" : "rgba(232,168,76,0.25)"}`, fontSize: 10, padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>
                      {cat.badge === "Noite" ? "🌙" : "☀️"} {cat.badge}
                    </span>
                  )}
                  <span style={{ color: "#3a3a3a", fontSize: 12 }}>({items.length})</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
                  {items.map((item, i) => (
                    <ListCard key={i} item={{ ...item, badge: cat.badge }} onAdd={addToCart} onOpen={setModal} onQuickOrder={handleQuickOrderItem} quickOrderingName={quickOrderingName} />
                  ))}
                </div>
              </div>
            );
          })}

          {search && menuData.every((cat) => filtered(cat.items).length === 0) && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#5a5650" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 15 }}>Nenhum item encontrado para &quot;<strong style={{ color: "#c9a84c" }}>{search}</strong>&quot;</div>
            </div>
          )}
        </div>

        <CartSidebar cart={cart} onUpdate={updateCart} onRemove={removeCart} onClear={clearCart} mobileOpen={mobCart} onCloseMobile={() => setMobCart(false)} onCheckout={() => router.push("/carrinho")} whatsapp={whatsapp} />
      </div>

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "30px 16px", marginTop: 8 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 24 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "#c9a84c", marginBottom: 8 }}>Grill Central</div>
            <div style={{ fontSize: 12, color: "#5a5650", lineHeight: 1.8 }}>Sabor das Carnes e Lanches</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9e9a90", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Localização</div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#6b6760", lineHeight: 1.7 }}>
              <MapPin s={13} /> www.grillcardapio.com.br
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9e9a90", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Horários</div>
            <div style={{ fontSize: 12, color: "#6b6760", lineHeight: 1.9 }}>
              <span style={{ color: "#e8a84c" }}>🔥 Grill Central</span> · Terça a Domingo · 18:30–23:30
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9e9a90", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contato</div>
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, color: "#25D366", textDecoration: "none", fontSize: 12, marginBottom: 5 }}>
              <WaIcon s={13} /> {whatsapp.replace(/^55(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")}
            </a>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: 24, paddingTop: 16, textAlign: "center", fontSize: 11, color: "#3a3a3a" }}>
          © 2025 Grill Central · grillcardapio.com.br
        </div>
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onLogin={(u) => setCurrentUser(u)} />}
      {modal && <ItemModal item={modal} onClose={() => setModal(null)} onAdd={addToCart} />}
      {showQuickOrderModal && pendingQuickItem && (
        <QuickUserModal
          onConfirm={(user) => { setShowQuickOrderModal(false); doItemPost(pendingQuickItem, user); setPendingQuickItem(null); }}
          onClose={() => { setShowQuickOrderModal(false); setPendingQuickItem(null); }}
        />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "rgba(30,30,30,0.98)", color: "#c9a84c", padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 2000, pointerEvents: "none", whiteSpace: "nowrap", border: "1px solid rgba(201,168,76,0.3)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "fadeUp 0.25s ease", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: "#25D366", fontSize: 15 }}>✓</span> Adicionado ao carrinho
        </div>
      )}

      <button className="hide-desk" onClick={() => totalItems > 0 ? router.push("/carrinho") : setMobCart(true)} style={{ position: "fixed", bottom: 24, right: 20, zIndex: 300, width: 54, height: 54, borderRadius: "50%", background: "linear-gradient(135deg,#c9a84c,#e4c97e)", border: "none", cursor: "pointer", color: "#0b0d12", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px rgba(201,168,76,0.35)" }}>
        <CartIcon s={22} />
        {totalItems > 0 && <span style={{ position: "absolute", top: 3, right: 3, background: "#e84040", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: "50%", width: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>{totalItems}</span>}
      </button>
    </div>
  );
}
