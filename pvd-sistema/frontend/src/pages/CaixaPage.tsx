import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  DollarSign, Lock, Unlock, ArrowDownLeft, ArrowUpRight,
  AlertTriangle, CheckCircle, X, Receipt,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cashSessionsApi, storesApi } from '@/services/endpoints';
import { formatBRL } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/lib/types';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Dinheiro', PIX: 'PIX', CREDIT_CARD: 'Crédito',
  DEBIT_CARD: 'Débito', MEAL_VOUCHER: 'Voucher',
  STORE_CREDIT: 'Fiado', IFOOD_ONLINE: 'iFood', OTHER: 'Outro',
};

export default function CaixaPage() {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string>(user?.storeId || '');
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showMovement, setShowMovement] = useState(false);

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: storesApi.list,
    enabled: ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user?.role || ''),
  });

  const { data: session, isLoading } = useQuery({
    queryKey: ['cash-session', storeId],
    queryFn: () => cashSessionsApi.getCurrent(storeId),
    enabled: !!storeId,
    refetchInterval: 30_000,
  });

  const isOpen = !!session && !session.closedAt;

  if (!storeId && stores.length > 0 && !user?.storeId) {
    setStoreId(stores[0].id);
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-font text-3xl text-white">CAIXA</h2>
          <p className="text-stone-400 text-sm">Controle de abertura e fechamento</p>
        </div>

        {/* Seletor de loja */}
        {stores.length > 1 && (
          <select value={storeId} onChange={e => setStoreId(e.target.value)} className="input text-sm">
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Status do caixa */}
      <div className="rounded-xl p-5"
        style={{
          background: isOpen
            ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.03))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.03))',
          border: `1px solid ${isOpen ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
        <div className="flex items-center gap-3 mb-4">
          {isOpen
            ? <CheckCircle size={28} className="text-green-400" />
            : <AlertTriangle size={28} className="text-red-400" />}
          <div>
            <div className="font-black text-white text-lg">
              {isOpen ? 'Caixa Aberto' : 'Caixa Fechado'}
            </div>
            {isOpen && session && (
              <div className="text-stone-400 text-xs">
                Aberto às {new Date(session.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {session.user && ` · por ${session.user.name}`}
              </div>
            )}
          </div>
        </div>

        {isOpen && session ? (
          <SessionInfo session={session} />
        ) : (
          <div className="text-center py-4 text-stone-400 text-sm">
            {isLoading ? 'Carregando...' : 'Nenhum caixa aberto hoje.'}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 mt-4">
          {!isOpen ? (
            <button onClick={() => setShowOpen(true)} disabled={!storeId}
              className="btn-primary flex-1 py-2.5">
              <Unlock size={16} /> Abrir Caixa
            </button>
          ) : (
            <>
              <button onClick={() => setShowMovement(true)}
                className="btn flex-1 py-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30">
                <DollarSign size={15} /> Sangria/Suprimento
              </button>
              <button onClick={() => setShowClose(true)}
                className="btn flex-1 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                <Lock size={15} /> Fechar Caixa
              </button>
            </>
          )}
        </div>
      </div>

      {/* Movimentações */}
      {isOpen && session?.movements && session.movements.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-4 py-3 bg-white/5">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Movimentações</span>
          </div>
          <div className="divide-y divide-white/5">
            {session.movements.map(m => (
              <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {['WITHDRAWAL', 'EXPENSE'].includes(m.type)
                    ? <ArrowUpRight size={16} className="text-red-400" />
                    : <ArrowDownLeft size={16} className="text-green-400" />}
                  <div>
                    <div className="text-sm text-white font-semibold">{m.description}</div>
                    <div className="text-xs text-stone-500">{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <span className={cn('font-bold text-sm',
                  ['WITHDRAWAL', 'EXPENSE'].includes(m.type) ? 'text-red-400' : 'text-green-400')}>
                  {['WITHDRAWAL', 'EXPENSE'].includes(m.type) ? '-' : '+'}{formatBRL(m.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modais */}
      {showOpen && storeId && (
        <OpenCaixaModal storeId={storeId} onClose={() => setShowOpen(false)}
          onOpened={() => { setShowOpen(false); qc.invalidateQueries({ queryKey: ['cash-session'] }); }} />
      )}
      {showClose && session && (
        <CloseCaixaModal session={session} onClose={() => setShowClose(false)}
          onClosed={() => { setShowClose(false); qc.invalidateQueries({ queryKey: ['cash-session'] }); }} />
      )}
      {showMovement && session && (
        <MovementModal sessionId={session.id} onClose={() => setShowMovement(false)}
          onAdded={() => { setShowMovement(false); qc.invalidateQueries({ queryKey: ['cash-session'] }); }} />
      )}
    </div>
  );
}

function SessionInfo({ session }: { session: CashSession }) {
  const opening = Number(session.openingAmount);
  const cashIn = session.movements
    .filter(m => ['OPENING', 'REINFORCEMENT'].includes(m.type))
    .reduce((s, m) => s + Number(m.amount), 0);
  const cashOut = session.movements
    .filter(m => ['WITHDRAWAL', 'EXPENSE'].includes(m.type))
    .reduce((s, m) => s + Number(m.amount), 0);
  const balance = cashIn - cashOut;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Abertura" value={formatBRL(opening)} />
      <Stat label="Entradas" value={formatBRL(cashIn)} color="text-green-400" />
      <Stat label="Saídas" value={formatBRL(cashOut)} color="text-red-400" />
      <div className="col-span-3 pt-2 border-t border-white/10">
        <Stat label="Saldo Estimado em Caixa" value={formatBRL(balance)} color="text-brand-400" large />
      </div>
    </div>
  );
}

function Stat({ label, value, color = 'text-white', large = false }: { label: string; value: string; color?: string; large?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-stone-500 uppercase tracking-wider">{label}</div>
      <div className={cn('font-bold mt-0.5', color, large ? 'text-xl' : 'text-base')}>{value}</div>
    </div>
  );
}

function OpenCaixaModal({ storeId, onClose, onOpened }: {
  storeId: string; onClose: () => void; onOpened: () => void;
}) {
  const [amount, setAmount] = useState('');

  const open = useMutation({
    mutationFn: () => cashSessionsApi.open(storeId, parseFloat(amount) || 0),
    onSuccess: () => { toast.success('Caixa aberto!'); onOpened(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao abrir caixa'),
  });

  return (
    <Modal title="Abrir Caixa" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Fundo de Caixa (R$)</label>
          <input type="number" step="0.50" min="0" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0,00 (deixe vazio se não houver)"
            className="input mt-1 text-center text-xl font-bold"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && open.mutate()} />
          <p className="text-xs text-stone-500 mt-1">Informe o valor em notas que está no caixa antes das vendas.</p>
        </div>
        <button onClick={() => open.mutate()} disabled={open.isPending} className="btn-primary w-full py-3">
          <Unlock size={16} /> {open.isPending ? 'Abrindo...' : 'Confirmar Abertura'}
        </button>
      </div>
    </Modal>
  );
}

function CloseCaixaModal({ session, onClose, onClosed }: {
  session: CashSession; onClose: () => void; onClosed: () => void;
}) {
  const [closing, setClosing] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<{ expectedAmount: number; difference: number } | null>(null);

  const close = useMutation({
    mutationFn: () => cashSessionsApi.close(session.id, parseFloat(closing), notes || undefined),
    onSuccess: (data) => {
      setResult(data.summary);
      if (Math.abs(data.summary.difference) < 0.05) {
        toast.success('Caixa fechado. Saldo conferido!');
      } else {
        toast(`Caixa fechado. Diferença: ${formatBRL(Math.abs(data.summary.difference))}`, { icon: '⚠️' });
      }
      onClosed();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao fechar caixa'),
  });

  const closingNum = parseFloat(closing) || 0;

  return (
    <Modal title="Fechar Caixa" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Valor Contado no Caixa (R$)</label>
          <input type="number" step="0.50" min="0" value={closing}
            onChange={e => setClosing(e.target.value)}
            placeholder="0,00"
            className="input mt-1 text-center text-xl font-bold" autoFocus />
        </div>
        <div>
          <label className="label">Observações (opcional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Faltou troco de R$5"
            className="input mt-1" />
        </div>
        <button onClick={() => close.mutate()}
          disabled={close.isPending || !closing}
          className="btn w-full py-3 bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 font-bold">
          <Lock size={16} /> {close.isPending ? 'Fechando...' : 'Confirmar Fechamento'}
        </button>
      </div>
    </Modal>
  );
}

function MovementModal({ sessionId, onClose, onAdded }: {
  sessionId: string; onClose: () => void; onAdded: () => void;
}) {
  const [type, setType] = useState<'WITHDRAWAL' | 'REINFORCEMENT' | 'EXPENSE'>('WITHDRAWAL');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const add = useMutation({
    mutationFn: () => cashSessionsApi.addMovement(sessionId, type, parseFloat(amount), description),
    onSuccess: () => {
      const label = type === 'WITHDRAWAL' ? 'Sangria' : type === 'REINFORCEMENT' ? 'Suprimento' : 'Despesa';
      toast.success(`${label} registrada!`);
      onAdded();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  const TYPES = [
    { id: 'WITHDRAWAL' as const,    emoji: '↑', label: 'Sangria',    color: 'text-red-400',   border: 'border-red-500/30',   bg: 'bg-red-500/15' },
    { id: 'REINFORCEMENT' as const, emoji: '↓', label: 'Suprimento', color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/15' },
    { id: 'EXPENSE' as const,       emoji: '💸', label: 'Despesa',    color: 'text-orange-400',border: 'border-orange-500/30',bg: 'bg-orange-500/15' },
  ];

  const QUICK_DESC: Record<string, string[]> = {
    WITHDRAWAL: ['Retirada para cofre', 'Retirada do proprietário', 'Sangria operacional'],
    REINFORCEMENT: ['Troco adicional', 'Reforço de caixa', 'Entrada de fundo extra'],
    EXPENSE: ['Gás/botijão', 'Material de limpeza', 'Embalagens', 'Manutenção'],
  };

  return (
    <Modal title="Movimentação de Caixa" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={cn('py-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all',
                type === t.id ? `${t.bg} ${t.color} ${t.border}` : 'bg-white/5 text-stone-400 border-white/10')}>
              <span className="text-lg">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Valor (R$)</label>
          <input type="number" step="0.50" min="0.01" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0,00"
            className="input mt-1 text-center text-xl font-bold" autoFocus />
        </div>

        <div>
          <label className="label">Descrição</label>
          <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
            {QUICK_DESC[type].map(d => (
              <button key={d} onClick={() => setDescription(d)}
                className={cn('px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  description === d
                    ? 'bg-brand-500/30 text-brand-300 border border-brand-500/50'
                    : 'bg-white/5 text-stone-400 hover:bg-white/10')}>
                {d}
              </button>
            ))}
          </div>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Ou descreva aqui..."
            className="input mt-1" />
        </div>

        <button onClick={() => add.mutate()}
          disabled={add.isPending || !amount || !description.trim()}
          className="btn-primary w-full py-3 font-bold">
          <Receipt size={16} /> {add.isPending ? 'Registrando...' : 'Confirmar Movimentação'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }: {
  children: React.ReactNode; onClose: () => void; title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}>
      <div className="slide-in w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'linear-gradient(180deg, #2d1810 0%, #1a0f0a 100%)', border: '1px solid rgba(232,93,47,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="display-font text-2xl text-white">{title}</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
