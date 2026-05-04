import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Edit3, Trash2, Search, Package } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { categoriesApi, productsApi } from '@/services/endpoints';
import { formatBRL, cn } from '@/lib/utils';
import type { Product, Category } from '@/lib/types';

export default function ProductsPage() {
  const user = useAuthStore(s => s.user);
  const storeId = user?.storeId;
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string | 'all'>('all');
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => categoriesApi.list(storeId!),
    enabled: !!storeId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', storeId, search, filterCat],
    queryFn: () => productsApi.list({
      storeId: storeId!,
      search: search || undefined,
      categoryId: filterCat === 'all' ? undefined : filterCat,
    }),
    enabled: !!storeId,
  });

  const remove = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto excluído');
    },
  });

  const toggleActive = useMutation({
    mutationFn: (p: Product) => productsApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="display-font text-4xl text-white">PRODUTOS</h2>
        <button onClick={() => setEditing({})} className="btn-primary">
          <Plus size={16} /> Novo Produto
        </button>
      </div>
      <p className="text-stone-400 text-sm mb-6">Cadastro, preços e estoque</p>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className="input pl-10" />
        </div>
        <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
          <button onClick={() => setFilterCat('all')} className={cn('px-3 py-1.5 rounded-md text-xs font-bold',
            filterCat === 'all' ? 'bg-brand-500 text-white' : 'text-stone-400')}>Todas</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1',
                filterCat === c.id ? 'text-white' : 'text-stone-400')}
              style={filterCat === c.id ? { background: c.color } : {}}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <Package size={64} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="card p-4 slide-in" style={{ opacity: p.isActive ? 1 : 0.5 }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {p.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: `${p.category.color}30`, color: p.category.color, border: `1px solid ${p.category.color}50` }}>
                        {p.category.icon} {p.category.name}
                      </span>
                    )}
                    {!p.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">INATIVO</span>}
                  </div>
                  <h3 className="font-bold text-white text-base">{p.name}</h3>
                  <p className="text-xs text-stone-400 mt-1 line-clamp-2 min-h-[32px]">{p.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded-lg bg-brand-500/10">
                  <div className="text-[10px] text-stone-400 uppercase font-bold">Preço</div>
                  <div className="text-lg font-bold text-brand-500">{formatBRL(p.price)}</div>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <div className="text-[10px] text-stone-400 uppercase font-bold">Estoque</div>
                  <div className="text-lg font-bold text-white">{p.stock}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setEditing(p)} className="btn flex-1 py-2 bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  <Edit3 size={12} /> Editar
                </button>
                <button onClick={() => toggleActive.mutate(p)} className="btn px-3 py-2 bg-white/5 text-stone-300">
                  {p.isActive ? 'Pausar' : 'Ativar'}
                </button>
                <button onClick={() => confirm('Excluir?') && remove.mutate(p.id)} className="btn px-3 py-2 bg-red-500/15 text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <ProductEditor product={editing} categories={categories} storeId={storeId!} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProductEditor({ product, categories, storeId, onClose }: {
  product: Partial<Product>; categories: Category[]; storeId: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const isNew = !product.id;

  const [form, setForm] = useState({
    name: product.name || '',
    description: product.description || '',
    price: product.price ?? 0,
    stock: product.stock ?? 0,
    minStock: product.minStock ?? 5,
    categoryId: product.categoryId || categories[0]?.id || '',
    isActive: product.isActive ?? true,
    trackStock: product.trackStock ?? true,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, storeId, price: Number(form.price) };
      return isNew
        ? productsApi.create(payload as any)
        : productsApi.update(product.id!, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(isNew ? 'Produto criado' : 'Produto atualizado');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="slide-in w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'linear-gradient(180deg, #2d1810 0%, #1a0f0a 100%)', border: '1px solid rgba(232, 93, 47, 0.3)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="display-font text-2xl text-white mb-4">{isNew ? 'Novo Produto' : 'Editar Produto'}</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-400 font-semibold uppercase">Nome</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input mt-1" />
          </div>
          <div>
            <label className="text-xs text-stone-400 font-semibold uppercase">Descrição</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="input mt-1 resize-none" />
          </div>
          <div>
            <label className="text-xs text-stone-400 font-semibold uppercase">Categoria</label>
            <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="input mt-1">
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 font-semibold uppercase">Preço (R$)</label>
              <input type="number" step="0.01" value={form.price}
                onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="input mt-1 text-brand-500 font-bold text-lg" />
            </div>
            <div>
              <label className="text-xs text-stone-400 font-semibold uppercase">Estoque</label>
              <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="input mt-1" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">Cancelar</button>
            <button onClick={() => save.mutate()} disabled={save.isPending || !form.name || form.price <= 0}
              className="btn-primary flex-[2] py-3">
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
