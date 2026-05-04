import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ShoppingCart, ChefHat, Bike, Package, TrendingUp,
  LogOut, Users, Tag, Store, Menu, X, Clock, Banknote, LayoutGrid,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket, disconnectSocket } from '@/services/socket';
import { cn } from '@/lib/utils';
import { unlockAudio, playDeliveryReady, playOrderKitchen, playAlert } from '@/lib/sounds';
import toast from 'react-hot-toast';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OWNER: 'Proprietário', MANAGER: 'Gerente',
  CASHIER: 'Caixa', WAITER: 'Garçom', KITCHEN: 'Cozinha', DELIVERER: 'Entregador',
};

const NAV = [
  { path: '/pdv',        label: 'PDV',         icon: ShoppingCart, roles: ['OWNER','MANAGER','CASHIER','WAITER'] },
  { path: '/cozinha',    label: 'Cozinha',      icon: ChefHat,      roles: ['OWNER','MANAGER','KITCHEN','CASHIER'] },
  { path: '/entregas',   label: 'Entregas',     icon: Bike,         roles: ['OWNER','MANAGER','CASHIER','DELIVERER'] },
  { path: '/caixa',      label: 'Caixa',        icon: Banknote,     roles: ['OWNER','MANAGER','CASHIER'] },
  { path: '/categorias', label: 'Categorias',   icon: LayoutGrid,   roles: ['OWNER','MANAGER'] },
  { path: '/produtos',   label: 'Produtos',     icon: Package,      roles: ['OWNER','MANAGER'] },
  { path: '/descontos',  label: 'Cupons',       icon: Tag,          roles: ['OWNER','MANAGER'] },
  { path: '/equipe',     label: 'Equipe',       icon: Users,        roles: ['OWNER','MANAGER'] },
  { path: '/relatorios', label: 'Relatórios',   icon: TrendingUp,   roles: ['OWNER','MANAGER'] },
];

function Clock24() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm text-stone-300">
      {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deliveryAlert, setDeliveryAlert] = useState(0);

  // Desbloqueia áudio no primeiro clique — obrigatório no Chrome
  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener('click', handler, { once: true });
    return () => window.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleDeliveryReady = (data: any) => {
      playDeliveryReady();
      setDeliveryAlert(n => n + 1);
      toast(`🛵 ${data.message || 'Pedido pronto para entrega!'}`, {
        icon: '🔔',
        duration: 8000,
        style: { background: '#1e3a2f', color: '#4ade80', border: '1px solid #22c55e66' },
      });
    };

    const handleKitchen = () => {
      if (user?.role === 'KITCHEN') playOrderKitchen();
    };

    const handleUrgent = (data: any) => {
      if (data?.urgent) playAlert();
    };

    socket.on('delivery:ready', handleDeliveryReady);
    socket.on('order:kitchen', handleKitchen);
    socket.on('order:updated', handleUrgent);

    return () => {
      socket.off('delivery:ready', handleDeliveryReady);
      socket.off('order:kitchen', handleKitchen);
      socket.off('order:updated', handleUrgent);
      disconnectSocket();
    };
  }, [user?.role]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const tabs = NAV.filter(t => !user?.role || t.roles.includes(user.role));

  return (
    <div className="h-full flex overflow-hidden">
      {/* ─── SIDEBAR ─── */}
      <aside className={cn(
        'flex flex-col flex-shrink-0 transition-all duration-300 z-40',
        'md:relative md:translate-x-0',
        mobileOpen ? 'fixed inset-y-0 left-0 translate-x-0' : 'fixed inset-y-0 -translate-x-full md:translate-x-0',
        'w-56'
      )} style={{ background: 'linear-gradient(180deg, #1a0d07 0%, #120906 100%)', borderRight: '1px solid rgba(232,93,47,0.15)' }}>

        {/* Logo */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #E85D2F, #C73E18)' }}>🍔</div>
            <div>
              <div className="display-font text-lg text-white leading-none">ADONAY</div>
              <div className="text-[10px] font-bold text-brand-500 tracking-widest">LANCHE</div>
            </div>
          </div>
          {user?.tenant?.name && (
            <div className="text-[11px] text-stone-500 mt-2 truncate">{user.tenant.name}</div>
          )}
        </div>

        {/* Navegação */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {tabs.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} onClick={() => { setMobileOpen(false); if (path === '/entregas') setDeliveryAlert(0); }}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all',
                isActive
                  ? 'text-white'
                  : 'text-stone-400 hover:text-white hover:bg-white/5'
              )}
              style={({ isActive }) => isActive
                ? { background: 'linear-gradient(90deg, rgba(232,93,47,0.25), rgba(232,93,47,0.05))', borderLeft: '3px solid #E85D2F', paddingLeft: '9px' }
                : {}}>
              <div className="relative">
                <Icon size={17} />
                {path === '/entregas' && deliveryAlert > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {deliveryAlert}
                  </span>
                )}
              </div>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Usuário + logout */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/5 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #E85D2F, #C73E18)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{user?.name}</div>
              <div className="text-[10px] text-stone-500">{ROLE_LABELS[user?.role || '']}</div>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-stone-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={14} /> Sair do sistema
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ─── CONTEÚDO PRINCIPAL ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-8 h-8 rounded-md flex items-center justify-center text-stone-400 hover:text-white">
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-stone-500 text-xs">
              <Store size={12} />
              <span>{user?.store?.name || user?.tenant?.name || 'Sistema PDV'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-stone-400">
              <Clock size={13} />
              <Clock24 />
            </div>
            <div className="text-xs text-stone-500 hidden sm:block">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
          </div>
        </header>

        {/* Rota ativa */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
