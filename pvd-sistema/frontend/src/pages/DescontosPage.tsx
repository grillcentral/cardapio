import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { couponsApi } from '@/services/endpoints';
import type { CouponCode } from '@/lib/types';
import { Tag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const EMPTY_FORM = {
  code: '',
  description: '',
  type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
  value: '',
  minOrder: '',
  maxUses: '',
  isActive: true,
  expiresAt: '',
};

export default function DescontosPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CouponCode | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: couponsApi.list,
  });

  const create = useMutation({
    mutationFn: couponsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); closeForm(); toast.success('Cupom criado!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao criar cupom'),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => couponsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); closeForm(); toast.success('Cupom atualizado!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao atualizar'),
  });

  const remove = useMutation({
    mutationFn: couponsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); setDeleteId(null); toast.success('Cupom removido'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao remover'),
  });

  const toggleActive = (c: CouponCode) => {
    update.mutate({ id: c.id, data: { isActive: !c.isActive } });
  };

  const openEdit = (c: CouponCode) => {
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description || '',
      type: c.type,
      value: String(c.value),
      minOrder: String(c.minOrder || ''),
      maxUses: c.maxUses ? String(c.maxUses) : '',
      isActive: c.isActive,
      expiresAt: c.expiresAt ? c.expiresAt.split('T')[0] : '',
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code.toUpperCase(),
      description: form.description || undefined,
      type: form.type,
      value: parseFloat(form.value),
      minOrder: form.minOrder ? parseFloat(form.minOrder) : undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      isActive: form.isActive,
      expiresAt: form.expiresAt || undefined,
    };
    if (editing) {
      update.mutate({ id: editing.id, data: payload });
    } else {
      create.mutate(payload as any);
    }
  };

  const isExpired = (c: CouponCode) => !!c.expiresAt && new Date(c.expiresAt) < new Date();
  const isExhausted = (c: CouponCode) => !!c.maxUses && c.usedCount >= c.maxUses;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #E85D2F, #C73E18)' }}>
              <Tag size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Cupons e Descontos</h1>
              <p className="text-xs text-stone-500">{coupons.length} cupom{coupons.length !== 1 ? 's' : ''} cadastrado{coupons.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={() => { closeForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #E85D2F, #C73E18)' }}>
            <Plus size={16} /> Novo Cupom
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="rounded-xl border border-brand-700/30 mb-6 p-5"
            style={{ background: 'rgba(232,93,47,0.05)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">{editing ? 'Editar Cupom' : 'Novo Cupom'}</h2>
              <button onClick={closeForm} className="text-stone-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              {/* Código */}
              <div className="col-span-2 md:col-span-1">
                <label className="label">Código do Cupom *</label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="EX: LANCHE10"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-stone-600 focus:outline-none focus:border-brand-500"
                  required maxLength={20} />
              </div>
              {/* Descrição */}
              <div className="col-span-2 md:col-span-1">
                <label className="label">Descrição</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Ex: 10% de desconto no lanche"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-brand-500" />
              </div>
              {/* Tipo */}
              <div>
                <label className="label">Tipo de Desconto *</label>
                <div className="flex gap-2">
                  {(['PERCENTAGE', 'FIXED'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(p => ({ ...p, type: t }))}
                      className={cn('flex-1 py-2 rounded-lg text-sm font-semibold border transition-all',
                        form.type === t
                          ? 'border-brand-500 text-brand-400 bg-brand-500/10'
                          : 'border-white/10 text-stone-400 bg-white/5 hover:border-white/20')}>
                      {t === 'PERCENTAGE' ? 'Percentual (%)' : 'Valor Fixo (R$)'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Valor */}
              <div>
                <label className="label">Valor {form.type === 'PERCENTAGE' ? '(%)' : '(R$)'} *</label>
                <input value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  type="number" step="0.01" min="0.01" placeholder={form.type === 'PERCENTAGE' ? '10' : '5.00'}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-brand-500"
                  required />
              </div>
              {/* Pedido mínimo */}
              <div>
                <label className="label">Pedido Mínimo (R$)</label>
                <input value={form.minOrder} onChange={e => setForm(p => ({ ...p, minOrder: e.target.value }))}
                  type="number" step="0.01" min="0" placeholder="0.00"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-brand-500" />
              </div>
              {/* Máx. usos */}
              <div>
                <label className="label">Máximo de Usos</label>
                <input value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                  type="number" min="1" placeholder="Ilimitado"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-brand-500" />
              </div>
              {/* Expiração */}
              <div>
                <label className="label">Validade</label>
                <input value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                  type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500" />
              </div>
              {/* Ativo */}
              <div className="col-span-2 flex items-center gap-3">
                <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}>
                  {form.isActive
                    ? <ToggleRight size={28} className="text-green-400" />
                    : <ToggleLeft size={28} className="text-stone-500" />}
                </button>
                <span className="text-sm text-stone-400">Cupom {form.isActive ? 'ativo' : 'inativo'}</span>
              </div>
              {/* Botões */}
              <div className="col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm}
                  className="px-4 py-2 rounded-lg text-sm text-stone-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={create.isPending || update.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #E85D2F, #C73E18)' }}>
                  <Check size={15} /> {editing ? 'Salvar' : 'Criar Cupom'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-stone-500">Carregando...</div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Tag size={40} className="text-stone-700" />
            <p className="text-stone-500">Nenhum cupom cadastrado</p>
            <button onClick={() => setShowForm(true)}
              className="text-brand-400 hover:text-brand-300 text-sm font-semibold">
              Criar primeiro cupom →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map(c => {
              const expired = isExpired(c);
              const exhausted = isExhausted(c);
              const unavailable = !c.isActive || expired || exhausted;

              return (
                <div key={c.id} className={cn(
                  'rounded-xl border p-4 flex items-center gap-4 transition-all',
                  unavailable
                    ? 'border-white/5 bg-white/2 opacity-60'
                    : 'border-white/10 bg-white/5 hover:border-white/15'
                )}>
                  {/* Badge tipo */}
                  <div className={cn(
                    'w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center',
                    c.type === 'PERCENTAGE' ? 'bg-purple-500/20' : 'bg-green-500/20'
                  )}>
                    <span className={cn('text-lg font-black leading-none',
                      c.type === 'PERCENTAGE' ? 'text-purple-400' : 'text-green-400')}>
                      {c.type === 'PERCENTAGE' ? `${c.value}%` : `R$${c.value}`}
                    </span>
                    <span className="text-[9px] text-stone-500 font-bold">
                      {c.type === 'PERCENTAGE' ? 'DESCONTO' : 'FIXO'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-base">{c.code}</span>
                      {expired && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">EXPIRADO</span>}
                      {exhausted && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400">ESGOTADO</span>}
                      {!c.isActive && !expired && !exhausted && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-500/20 text-stone-400">INATIVO</span>}
                      {c.isActive && !expired && !exhausted && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">ATIVO</span>}
                    </div>
                    {c.description && <p className="text-xs text-stone-400 mt-0.5 truncate">{c.description}</p>}
                    <div className="flex gap-3 mt-1 text-[11px] text-stone-500 flex-wrap">
                      {Number(c.minOrder) > 0 && <span>Pedido mín. R$ {Number(c.minOrder).toFixed(2)}</span>}
                      {c.maxUses && <span>{c.usedCount}/{c.maxUses} usos</span>}
                      {!c.maxUses && c.usedCount > 0 && <span>{c.usedCount} uso{c.usedCount !== 1 ? 's' : ''}</span>}
                      {c.expiresAt && <span>Válido até {new Date(c.expiresAt).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleActive(c)}
                      title={c.isActive ? 'Desativar' : 'Ativar'}
                      className="p-2 rounded-lg hover:bg-white/5 transition-all">
                      {c.isActive
                        ? <ToggleRight size={20} className="text-green-400" />
                        : <ToggleLeft size={20} className="text-stone-500" />}
                    </button>
                    <button onClick={() => openEdit(c)}
                      className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition-all">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setDeleteId(c.id)}
                      className="p-2 rounded-lg text-stone-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="rounded-xl border border-white/10 p-6 max-w-sm w-full"
            style={{ background: '#1a0d07' }}>
            <h3 className="text-white font-bold mb-2">Remover cupom?</h3>
            <p className="text-stone-400 text-sm mb-5">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-lg text-sm text-stone-400 border border-white/10 hover:border-white/20">
                Cancelar
              </button>
              <button onClick={() => remove.mutate(deleteId!)} disabled={remove.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
