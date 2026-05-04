import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Tag, GripVertical, Store } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { categoriesApi, storesApi } from '@/services/endpoints';
import type { Category } from '@/lib/types';
import { cn } from '@/lib/utils';

const PRESET_CATEGORIES = [
  { name: 'Lanches', icon: '🍔', color: '#E85D2F' },
  { name: 'Prato do Dia', icon: '🍽️', color: '#22c55e' },
  { name: 'Pratos', icon: '🥘', color: '#f59e0b' },
  { name: 'Bebidas', icon: '🥤', color: '#3b82f6' },
  { name: 'Sobremesas', icon: '🍰', color: '#ec4899' },
  { name: 'Porções', icon: '🍟', color: '#f97316' },
  { name: 'Pizzas', icon: '🍕', color: '#ef4444' },
  { name: 'Saladas', icon: '🥗', color: '#84cc16' },
  { name: 'Combos', icon: '🎁', color: '#8b5cf6' },
  { name: 'Outros', icon: '📦', color: '#94a3b8' },
];

const COLORS = [
  '#E85D2F', '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#84cc16', '#14b8a6', '#94a3b8',
];

interface FormState {
  name: string;
  icon: string;
  color: string;
  kitchenStation: string;
  displayOrder: string;
  isActive: boolean;
}

const emptyForm = (): FormState => ({
  name: '', icon: '', color: '#E85D2F', kitchenStation: '', displayOrder: '0', isActive: true,
});

function CategoryModal({
  category,
  storeId,
  onClose,
}: {
  category: Category | null;
  storeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(
    category
      ? {
          name: category.name,
          icon: category.icon || '',
          color: category.color || '#E85D2F',
          kitchenStation: category.kitchenStation || '',
          displayOrder: String(category.displayOrder),
          isActive: category.isActive,
        }
      : emptyForm()
  );

  const save = useMutation({
    mutationFn: () => {
      const data = {
        name: form.name.trim(),
        icon: form.icon.trim() || undefined,
        color: form.color || undefined,
        kitchenStation: form.kitchenStation.trim() || undefined,
        displayOrder: parseInt(form.displayOrder) || 0,
        isActive: form.isActive,
        storeId,
      };
      return category
        ? categoriesApi.update(category.id, data)
        : categoriesApi.create({ ...data, storeId });
    },
    onSuccess: () => {
      toast.success(category ? 'Categoria atualizada!' : 'Categoria criada!');
      qc.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao salvar'),
  });

  const applyPreset = (preset: typeof PRESET_CATEGORIES[0]) => {
    setForm(f => ({ ...f, name: preset.name, icon: preset.icon, color: preset.color }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: '#1c1008', border: '1px solid rgba(232,93,47,0.25)' }}>
        <h3 className="display-font text-xl text-white">
          {category ? 'Editar Categoria' : 'Nova Categoria'}
        </h3>

        {!category && (
          <div>
            <label className="label text-xs mb-2">Categorias prontas</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CATEGORIES.map(p => (
                <button key={p.name} onClick={() => applyPreset(p)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-stone-300 hover:bg-white/10 transition-all border border-white/5">
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-[56px_1fr] gap-3">
            <div>
              <label className="label text-xs">Ícone</label>
              <input
                type="text"
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="🍔"
                className="input mt-1 text-center text-2xl"
                maxLength={4}
              />
            </div>
            <div>
              <label className="label text-xs">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Lanches"
                className="input mt-1"
                autoFocus={!category}
              />
            </div>
          </div>

          <div>
            <label className="label text-xs">Cor</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={cn(
                    'w-8 h-8 rounded-lg transition-all border-2',
                    form.color === c ? 'scale-110 border-white' : 'border-transparent'
                  )}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded-lg cursor-pointer border border-white/20 bg-transparent p-0.5"
                title="Cor personalizada"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Estação Cozinha</label>
              <select
                value={form.kitchenStation}
                onChange={e => setForm(f => ({ ...f, kitchenStation: e.target.value }))}
                className="input mt-1">
                <option value="">Padrão</option>
                <option value="grill">Grill / Chapa</option>
                <option value="fryer">Fritadeira</option>
                <option value="cold">Fria / Saladas</option>
                <option value="bar">Bar / Bebidas</option>
                <option value="assembly">Montagem</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Ordem de Exibição</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))}
                min={0}
                className="input mt-1"
              />
            </div>
          </div>

          {category && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-brand-500 rounded"
              />
              <span className="text-sm text-stone-300">Categoria ativa</span>
            </label>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="btn flex-1 bg-white/5 text-stone-300 border border-white/10 hover:bg-white/10">
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!form.name.trim() || save.isPending}
            className="btn-primary flex-1">
            {save.isPending ? 'Salvando...' : category ? 'Salvar Alterações' : 'Criar Categoria'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const user = useAuthStore(s => s.user);
  const isManager = ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user?.role || '');
  const qc = useQueryClient();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(user?.storeId || null);
  const [editingCategory, setEditingCategory] = useState<Category | null | 'new'>(null);

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: storesApi.list,
    enabled: isManager,
  });

  const storeId = selectedStoreId;

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => categoriesApi.list(storeId!),
    enabled: !!storeId,
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      toast.success('Categoria removida');
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao remover'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      categoriesApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  const handleDelete = (cat: Category) => {
    if ((cat._count?.products || 0) > 0) {
      toast.error(`Remova os ${cat._count?.products} produto(s) antes de excluir a categoria`);
      return;
    }
    if (!confirm(`Excluir a categoria "${cat.name}"?`)) return;
    deleteCategory.mutate(cat.id);
  };

  if (!isManager) {
    return (
      <div className="flex items-center justify-center h-full text-stone-500">
        Acesso restrito a gerentes
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div>
          <h2 className="display-font text-2xl text-white">CATEGORIAS</h2>
          <p className="text-stone-400 text-xs">Organize o cardápio por categorias</p>
        </div>

        <div className="flex items-center gap-2">
          {isManager && stores.length > 1 && (
            <div className="flex items-center gap-2">
              <Store size={13} className="text-stone-400" />
              {stores.map(s => (
                <button key={s.id} onClick={() => setSelectedStoreId(s.id)}
                  className={cn('px-3 py-1 rounded-lg text-xs font-bold transition-all',
                    storeId === s.id ? 'bg-brand-500 text-white' : 'bg-white/5 text-stone-400 hover:bg-white/10')}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {storeId && (
            <button onClick={() => setEditingCategory('new')}
              className="btn-primary px-4 py-2 text-sm">
              <Plus size={15} /> Nova Categoria
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        {!storeId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-stone-500">
            <Store size={48} className="opacity-30" />
            <p>Selecione uma loja para gerenciar categorias</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full text-stone-500">Carregando...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-20 text-stone-500">
            <Tag size={72} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">Nenhuma categoria cadastrada</p>
            <p className="text-sm mt-1">Clique em "Nova Categoria" para começar</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {PRESET_CATEGORIES.slice(0, 5).map(p => (
                <button
                  key={p.name}
                  onClick={() => {
                    setEditingCategory('new');
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-stone-300 hover:bg-white/10 transition-all">
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map(cat => (
              <div key={cat.id}
                className={cn(
                  'rounded-xl p-4 flex items-center gap-3 transition-all',
                  !cat.isActive && 'opacity-50'
                )}
                style={{
                  background: `linear-gradient(135deg, ${cat.color || '#E85D2F'}18, ${cat.color || '#E85D2F'}06)`,
                  border: `1px solid ${cat.color || '#E85D2F'}40`,
                }}>
                <GripVertical size={14} className="text-stone-600 cursor-grab shrink-0" />

                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: `${cat.color || '#E85D2F'}30` }}>
                  {cat.icon || <Tag size={20} style={{ color: cat.color || '#E85D2F' }} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate">{cat.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-stone-500">
                      {cat._count?.products || 0} produto{cat._count?.products !== 1 ? 's' : ''}
                    </span>
                    {cat.kitchenStation && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-stone-400 uppercase font-bold">
                        {cat.kitchenStation}
                      </span>
                    )}
                    {!cat.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
                        inativa
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleActive.mutate({ id: cat.id, isActive: !cat.isActive })}
                    title={cat.isActive ? 'Desativar' : 'Ativar'}
                    className={cn(
                      'w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all',
                      cat.isActive
                        ? 'bg-green-500/15 text-green-400 hover:bg-green-500/30'
                        : 'bg-white/5 text-stone-500 hover:bg-white/10'
                    )}>
                    {cat.isActive ? '●' : '○'}
                  </button>
                  <button
                    onClick={() => setEditingCategory(cat)}
                    className="w-7 h-7 rounded flex items-center justify-center bg-white/5 text-stone-400 hover:text-white hover:bg-white/10 transition-all">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    disabled={deleteCategory.isPending}
                    className="w-7 h-7 rounded flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {editingCategory !== null && storeId && (
        <CategoryModal
          category={editingCategory === 'new' ? null : editingCategory}
          storeId={storeId}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </div>
  );
}
