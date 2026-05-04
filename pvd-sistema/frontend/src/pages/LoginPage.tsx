import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import { LogIn, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);
  const loginByPin = useAuthStore(s => s.loginByPin);

  const [mode, setMode] = useState<'email' | 'pin'>('email');
  const [tenantSlug, setTenantSlug] = useState('demo');
  const [email, setEmail] = useState('jailson@lanchedemo.com');
  const [password, setPassword] = useState('senha123');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'email') {
        await login(email, password, tenantSlug || undefined);
      } else {
        await loginByPin(tenantSlug, pin);
      }
      toast.success('Bem-vindo!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center text-4xl mb-4"
            style={{ background: 'linear-gradient(135deg, #E85D2F, #C73E18)' }}>
            🍔
          </div>
          <h1 className="display-font text-4xl text-white">ADONAY LANCHE</h1>
          <p className="text-sm text-stone-400 mt-1">Sistema PDV · Lanche & Restaurante</p>
        </div>

        <div className="card p-6 space-y-5">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-lg">
            <button onClick={() => setMode('email')} className="flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all"
              style={{ background: mode === 'email' ? 'linear-gradient(135deg, #E85D2F, #C73E18)' : 'transparent', color: mode === 'email' ? '#fff' : '#a8a29e' }}>
              <LogIn size={14} /> Email
            </button>
            <button onClick={() => setMode('pin')} className="flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all"
              style={{ background: mode === 'pin' ? 'linear-gradient(135deg, #E85D2F, #C73E18)' : 'transparent', color: mode === 'pin' ? '#fff' : '#a8a29e' }}>
              <KeyRound size={14} /> PIN
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-stone-400 font-semibold uppercase">Estabelecimento</label>
              <input type="text" value={tenantSlug} onChange={e => setTenantSlug(e.target.value)}
                placeholder="demo" required className="input mt-1" />
            </div>

            {mode === 'email' ? (
              <>
                <div>
                  <label className="text-xs text-stone-400 font-semibold uppercase">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input mt-1" autoFocus />
                </div>
                <div>
                  <label className="text-xs text-stone-400 font-semibold uppercase">Senha</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="input mt-1" />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs text-stone-400 font-semibold uppercase">PIN (4-6 dígitos)</label>
                <input type="password" inputMode="numeric" pattern="\d{4,6}" value={pin} onChange={e => setPin(e.target.value)}
                  required className="input mt-1 text-center text-2xl tracking-widest" autoFocus maxLength={6} />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="pt-4 border-t border-white/5 text-xs text-stone-500 text-center">
            Demo: <code className="text-brand-500">demo</code> · PIN <code className="text-brand-500">1234</code> (dono)
          </div>
        </div>
      </div>
    </div>
  );
}
