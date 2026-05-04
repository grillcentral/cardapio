import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus, Minus, ShoppingCart, ChefHat, Receipt, Clock,
  X, Printer, AlertTriangle, Store, Tag, MessageSquare, Check,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { categoriesApi, productsApi, ordersApi, storesApi, couponsApi, customersApi } from '@/services/endpoints';
import { getSocket } from '@/services/socket';
import { formatBRL } from '@/lib/utils';
import type { Order, Category, Product, OrderType, PaymentMethod, OrderItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  OPEN:         { label: 'Aberta',  color: '#4ade80' },
  SENT_KITCHEN: { label: 'Cozinha', color: '#fb923c' },
  PREPARING:    { label: 'Preparo', color: '#fbbf24' },
  READY:        { label: 'Pronto',  color: '#34d399' },
};

export default function PDVPage() {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const isManager = ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user?.role || '');

  // Se usuário tem loja fixa, usa ela; senão permite selecionar
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(user?.storeId || null);
  const storeId = selectedStoreId;

  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);

  // ─── Lojas disponíveis (OWNER/MANAGER podem trocar) ───
  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesApi.list(),
    enabled: isManager,
  });

  // Seleciona primeira loja automaticamente se OWNER/MANAGER não tem loja fixa
  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  // ─── Queries ───
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => categoriesApi.list(storeId!),
    enabled: !!storeId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', storeId, activeCategoryId],
    queryFn: () => productsApi.list({ storeId: storeId!, categoryId: activeCategoryId || undefined, activeOnly: true }),
    enabled: !!storeId,
  });

  const { data: openOrders = [] } = useQuery({
    queryKey: ['orders-open', storeId],
    queryFn: () => ordersApi.listOpen(storeId!),
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  // Reset categoria quando troca de loja
  useEffect(() => {
    setActiveCategoryId(null);
    setActiveOrderId(null);
  }, [storeId]);

  useEffect(() => {
    if (!activeCategoryId && categories.length > 0) setActiveCategoryId(categories[0].id);
  }, [categories, activeCategoryId]);

  // Socket.io realtime
  useEffect(() => {
    if (!storeId) return;
    const socket = getSocket();
    const refresh = () => qc.invalidateQueries({ queryKey: ['orders-open'] });
    socket.on('order:created', refresh);
    socket.on('order:updated', refresh);
    socket.on('order:closed', refresh);
    socket.on('order:cancelled', refresh);
    return () => {
      socket.off('order:created', refresh);
      socket.off('order:updated', refresh);
      socket.off('order:closed', refresh);
      socket.off('order:cancelled', refresh);
    };
  }, [storeId, qc]);

  const activeOrder = useMemo(
    () => openOrders.find(o => o.id === activeOrderId) || null,
    [openOrders, activeOrderId]
  );

  // ─── Mutations ───
  const addItem = useMutation({
    mutationFn: (product: Product) =>
      ordersApi.addItem(activeOrderId!, { productId: product.id, quantity: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders-open'] }),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao adicionar item'),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => ordersApi.removeItem(activeOrderId!, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders-open'] }),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao remover item'),
  });

  const sendKitchen = useMutation({
    mutationFn: () => ordersApi.sendToKitchen(activeOrderId!),
    onSuccess: () => {
      toast.success('Enviado à cozinha!');
      qc.invalidateQueries({ queryKey: ['orders-open'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  function handleAddProduct(product: Product) {
    if (!activeOrderId) { toast.error('Selecione uma comanda primeiro'); return; }
    if (!['OPEN','SENT_KITCHEN','PREPARING','READY'].includes(activeOrder?.status || '')) {
      toast.error('Comanda não está aberta'); return;
    }
    addItem.mutate(product);
  }

  const pendingItems = activeOrder?.items.filter(i => i.status === 'PENDING') || [];
  const sentItems = activeOrder?.items.filter(i => i.status !== 'PENDING') || [];
  const canClose = (activeOrder?.items.length || 0) > 0;
  const currentStore = stores.find(s => s.id === storeId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Seletor de loja (OWNER/MANAGER com múltiplas lojas) */}
      {isManager && stores.length > 1 && (
        <div className="flex gap-2 px-4 py-2 bg-black/50 border-b border-white/5 flex-shrink-0">
          <Store size={14} className="text-stone-400 mt-0.5 flex-shrink-0" />
          {stores.map(s => (
            <button key={s.id} onClick={() => setSelectedStoreId(s.id)}
              className={cn('px-3 py-1 rounded-md text-xs font-bold transition-all',
                storeId === s.id ? 'bg-brand-500 text-white' : 'bg-white/5 text-stone-400 hover:bg-white/10'
              )}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '1fr 400px' }}>
        {/* ═══ ESQUERDA: produtos ═══ */}
        <div className="flex flex-col overflow-hidden">
          {/* Categorias */}
          <div className="flex gap-2 p-3 overflow-x-auto border-b border-white/5 flex-shrink-0">
            {categories.length === 0 && storeId && (
              <div className="text-xs text-stone-500 py-2">Nenhuma categoria cadastrada</div>
            )}
            {categories.map(c => (
              <button key={c.id} onClick={() => setActiveCategoryId(c.id)}
                className={cn('flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all',
                  activeCategoryId === c.id ? 'text-white' : 'bg-white/5 text-stone-400 hover:bg-white/10'
                )}
                style={activeCategoryId === c.id ? { background: `linear-gradient(135deg, ${c.color || '#E85D2F'}, ${c.color || '#E85D2F'}cc)` } : {}}>
                {c.icon && <span>{c.icon}</span>} {c.name}
              </button>
            ))}
          </div>

          {/* Grid de produtos */}
          <div className="flex-1 overflow-y-auto p-3">
            {!activeOrderId && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <AlertTriangle size={12} /> Crie ou selecione uma comanda para adicionar produtos
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.length === 0 && activeCategoryId && (
                <div className="col-span-full text-center py-12 text-stone-500 text-sm">Nenhum produto nesta categoria</div>
              )}
              {products.map(p => (
                <button key={p.id} onClick={() => handleAddProduct(p)}
                  disabled={!activeOrderId || (p.trackStock && p.stock <= 0)}
                  className="slide-in text-left p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(232,93,47,0.08), rgba(232,93,47,0.02))',
                    border: '1px solid rgba(232,93,47,0.15)',
                  }}>
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-bold text-white text-sm leading-tight flex-1 mr-1">{p.name}</h3>
                    {p.trackStock && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: p.stock > 5 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: p.stock > 5 ? '#4ade80' : '#f87171',
                        }}>{p.stock}</span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-[11px] text-stone-400 mb-2 line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex items-end justify-between mt-2">
                    <span style={{ color: '#E85D2F', fontSize: '1.05rem', fontWeight: 800 }}>{formatBRL(p.price)}</span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(232,93,47,0.2)' }}>
                      <Plus size={14} style={{ color: '#E85D2F' }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ DIREITA: comanda ═══ */}
        <div className="flex flex-col overflow-hidden border-l border-white/5 bg-black/30">
          {/* Header */}
          <div className="p-3 border-b border-white/5 flex-shrink-0">
            <button onClick={() => setShowNewOrder(true)} disabled={!storeId}
              className="btn-primary w-full py-2.5 mb-2">
              <Plus size={16} /> Nova Comanda
            </button>

            <div className="flex gap-1 overflow-x-auto pb-1">
              {openOrders.length === 0 ? (
                <div className="text-xs text-stone-500 py-2 px-1">Nenhuma comanda aberta</div>
              ) : openOrders.map(o => {
                const st = STATUS_LABEL[o.status];
                return (
                  <button key={o.id} onClick={() => setActiveOrderId(o.id)}
                    className={cn('flex-shrink-0 px-3 py-2 rounded-md text-xs font-bold transition-all flex flex-col items-start min-w-[70px]',
                      activeOrderId === o.id ? 'bg-brand-500 text-white' : 'bg-white/5 text-stone-400 hover:bg-white/10'
                    )}>
                    <span>
                      {o.type === 'TABLE' ? '🪑' : o.type === 'DELIVERY' ? '🛵' : o.type === 'COUNTER' ? '🛒' : '📦'}
                      {' '}{o.reference || `#${o.orderNumber}`}
                    </span>
                    {st && (
                      <span className="text-[9px] font-semibold mt-0.5"
                        style={{ color: activeOrderId === o.id ? 'rgba(255,255,255,0.7)' : st.color }}>
                        ● {st.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {!activeOrder ? (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-500 p-6 text-center">
              <ShoppingCart size={48} className="mb-3 opacity-20" />
              <p className="text-sm">Selecione ou crie uma comanda</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho da comanda */}
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                <div>
                  <div className="text-xs text-stone-400">#{activeOrder.orderNumber}</div>
                  <div className="font-bold text-white text-sm">{activeOrder.reference || `Pedido #${activeOrder.orderNumber}`}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-stone-400 flex items-center gap-1 justify-end">
                    <Clock size={10} />
                    {new Date(activeOrder.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {STATUS_LABEL[activeOrder.status] && (
                    <div className="text-[11px] font-bold" style={{ color: STATUS_LABEL[activeOrder.status].color }}>
                      ● {STATUS_LABEL[activeOrder.status].label}
                    </div>
                  )}
                </div>
              </div>

              {/* Itens */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {activeOrder.items.length === 0 ? (
                  <div className="text-center text-stone-500 text-sm py-8">
                    Toque em um produto para adicionar
                  </div>
                ) : (
                  <>
                    {sentItems.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <ChefHat size={10} /> Na Cozinha
                        </div>
                        {sentItems.map(i => <ItemRow key={i.id} item={i} orderId={activeOrder.id} onRemove={null} />)}
                      </div>
                    )}

                    {pendingItems.length > 0 && (
                      <div className={sentItems.length > 0 ? 'mt-3' : ''}>
                        {sentItems.length > 0 && (
                          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Plus size={10} /> Nova Remessa
                          </div>
                        )}
                        {pendingItems.map(i => (
                          <ItemRow key={i.id} item={i} orderId={activeOrder.id}
                            onRemove={() => removeItem.mutate(i.id)} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 space-y-2 border-t border-white/5 bg-black/40 flex-shrink-0">
                {activeOrder.discount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-green-400">Desconto</span>
                    <span className="text-green-400">- {formatBRL(activeOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-stone-400 text-sm">TOTAL</span>
                  <span className="display-font text-2xl font-extrabold" style={{ color: '#E85D2F' }}>
                    {formatBRL(activeOrder.total)}
                  </span>
                </div>

                {/* Botões */}
                <div className="space-y-1.5">
                  {pendingItems.length > 0 && (
                    <button onClick={() => sendKitchen.mutate()} disabled={sendKitchen.isPending}
                      className="btn w-full py-2.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30">
                      <ChefHat size={15} />
                      {sentItems.length > 0 ? 'Enviar Nova Remessa' : 'Enviar à Cozinha'}
                    </button>
                  )}
                  {isManager && (
                    <button onClick={() => setShowDiscount(true)} disabled={!canClose}
                      className="btn w-full py-2 bg-purple-500/15 text-purple-400 border border-purple-500/25 hover:bg-purple-500/25">
                      <Tag size={14} /> Aplicar Desconto
                    </button>
                  )}
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: isManager ? '1fr 1fr' : '1fr' }}>
                    <button onClick={() => setShowPayment(true)} disabled={!canClose}
                      className="btn-primary py-2.5">
                      <Receipt size={15} /> Fechar Conta
                    </button>
                    {isManager && (
                      <button onClick={() => setShowCancel(true)}
                        className="btn py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                        <X size={15} /> Cancelar
                      </button>
                    )}
                  </div>
                  <button onClick={() => printReceipt(activeOrder, currentStore?.name)}
                    className="btn w-full py-1.5 bg-white/5 text-stone-400 border border-white/8 hover:bg-white/10 text-xs">
                    <Printer size={12} /> Imprimir Comanda
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modais */}
      {showNewOrder && storeId && (
        <NewOrderModal storeId={storeId} onClose={() => setShowNewOrder(false)}
          onCreated={id => { setActiveOrderId(id); setShowNewOrder(false); }} />
      )}
      {showPayment && activeOrder && (
        <PaymentModal order={activeOrder} storeName={currentStore?.name}
          onClose={() => setShowPayment(false)}
          onPaid={() => { setShowPayment(false); setActiveOrderId(null); }} />
      )}
      {showCancel && activeOrder && (
        <CancelModal orderId={activeOrder.id}
          label={activeOrder.reference || `#${activeOrder.orderNumber}`}
          onClose={() => setShowCancel(false)}
          onCancelled={() => { setShowCancel(false); setActiveOrderId(null); }} />
      )}
      {showDiscount && activeOrder && (
        <DiscountModal order={activeOrder}
          onClose={() => setShowDiscount(false)}
          onApplied={() => { setShowDiscount(false); qc.invalidateQueries({ queryKey: ['orders-open'] }); }} />
      )}
    </div>
  );
}

// ─── Item Row ───
function ItemRow({ item, orderId, onRemove }: {
  item: OrderItem;
  orderId: string;
  onRemove: (() => void) | null;
}) {
  const COLOR: Record<string, string> = {
    SENT: '#fb923c', PREPARING: '#fbbf24', READY: '#34d399', DELIVERED: '#60a5fa',
  };
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(item.notes || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    setNotesValue(item.notes || '');
  }, [item.notes]);

  useEffect(() => {
    if (editingNotes) inputRef.current?.focus();
  }, [editingNotes]);

  const saveNotes = useMutation({
    mutationFn: () => ordersApi.updateItemNotes(orderId, item.id, notesValue.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders-open'] });
      setEditingNotes(false);
    },
    onError: () => { setEditingNotes(false); },
  });

  const canEditNotes = item.status === 'PENDING' || item.status === 'SENT';

  return (
    <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm flex items-center gap-1.5 flex-wrap">
            <span className="text-stone-500 text-xs w-5 text-right flex-shrink-0">{item.quantity}×</span>
            <span className="flex-1">{item.productName}</span>
            {item.status !== 'PENDING' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                style={{ background: `${COLOR[item.status] || '#9ca3af'}22`, color: COLOR[item.status] || '#9ca3af' }}>
                {item.status === 'SENT' ? '↑ cozinha' : item.status === 'PREPARING' ? '🔥 prep.' : '✓ pronto'}
              </span>
            )}
          </div>
          {!editingNotes && item.notes && (
            <div className="text-[11px] text-amber-400 mt-0.5 ml-7">📝 {item.notes}</div>
          )}
          {editingNotes && (
            <div className="flex items-center gap-1 mt-1 ml-7">
              <input
                ref={inputRef}
                type="text"
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveNotes.mutate();
                  if (e.key === 'Escape') { setEditingNotes(false); setNotesValue(item.notes || ''); }
                }}
                maxLength={200}
                placeholder="Ex: sem cebola, bem passado..."
                className="flex-1 bg-black/50 border border-amber-500/40 rounded px-2 py-1 text-xs text-amber-300 placeholder-stone-600 outline-none focus:border-amber-400"
              />
              <button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}
                className="w-6 h-6 rounded flex items-center justify-center bg-green-500/20 text-green-400 hover:bg-green-500/40 flex-shrink-0">
                <Check size={11} />
              </button>
              <button onClick={() => { setEditingNotes(false); setNotesValue(item.notes || ''); }}
                className="w-6 h-6 rounded flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500/40 flex-shrink-0">
                <X size={11} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="font-bold text-white text-sm">{formatBRL(item.subtotal)}</span>
          {canEditNotes && !editingNotes && (
            <button onClick={() => setEditingNotes(true)} title="Adicionar observação"
              className="w-6 h-6 rounded flex items-center justify-center bg-amber-500/15 text-amber-500 hover:bg-amber-500/30">
              <MessageSquare size={11} />
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove}
              className="w-6 h-6 rounded flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500/40">
              <Minus size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Nova Comanda ───
function NewOrderModal({ storeId, onClose, onCreated }: {
  storeId: string; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [type, setType] = useState<OrderType>('TABLE');
  const [reference, setReference] = useState('');
  const qc = useQueryClient();

  // ── campos exclusivos de delivery ──
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundCustomerId, setFoundCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [addrReference, setAddrReference] = useState('');
  const [existingAddresses, setExistingAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const isDelivery = type === 'DELIVERY';

  // Busca cliente pelo telefone
  const searchCustomer = async (p: string) => {
    const digits = p.replace(/\D/g, '');
    if (digits.length < 8) return;
    setSearching(true);
    try {
      const customer = await customersApi.searchByPhone(digits);
      if (customer) {
        setFoundCustomerId(customer.id);
        setCustomerName(customer.name);
        const addrs = customer.addresses || [];
        setExistingAddresses(addrs);
        if (addrs.length > 0) {
          const def = addrs.find((a: any) => a.isDefault) || addrs[0];
          setSelectedAddressId(def.id);
          setStreet(def.street || '');
          setNumber(def.number || '');
          setComplement(def.complement || '');
          setNeighborhood(def.neighborhood || '');
          setCity(def.city || '');
          setAddrReference(def.reference || '');
        }
        toast.success(`Cliente encontrado: ${customer.name}`);
      } else {
        setFoundCustomerId(null);
        setExistingAddresses([]);
        setSelectedAddressId(null);
      }
    } catch {
      setFoundCustomerId(null);
    } finally {
      setSearching(false);
    }
  };

  const selectExistingAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setStreet(addr.street || '');
    setNumber(addr.number || '');
    setComplement(addr.complement || '');
    setNeighborhood(addr.neighborhood || '');
    setCity(addr.city || '');
    setAddrReference(addr.reference || '');
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!isDelivery) {
        return ordersApi.create({ storeId, type, reference: reference.trim() || undefined });
      }

      // Delivery: garante cliente + endereço
      let customerId = foundCustomerId;
      let addressId = selectedAddressId;

      const digits = phone.replace(/\D/g, '');

      if (!customerId) {
        // Cria novo cliente
        const nc = await customersApi.create({
          storeId,
          name: customerName.trim() || (digits ? `Cliente ${digits.slice(-4)}` : 'Cliente'),
          phone: digits || undefined,
        });
        customerId = nc.id;
      }

      // Cria endereço se não selecionou um existente
      if (!addressId && street.trim()) {
        const na = await customersApi.addAddress(customerId, {
          street: street.trim(),
          number: number.trim() || undefined,
          complement: complement.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          city: city.trim() || undefined,
          reference: addrReference.trim() || undefined,
        });
        addressId = na.id;
      }

      return ordersApi.create({
        storeId,
        type: 'DELIVERY',
        reference: customerName.trim() || reference.trim() || undefined,
        customerId: customerId || undefined,
        addressId: addressId || undefined,
      });
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders-open'] });
      onCreated(order.id);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar comanda'),
  });

  const canCreate = !isDelivery
    ? true
    : customerName.trim().length > 0 || phone.replace(/\D/g, '').length >= 8;

  const TYPES: { id: OrderType; emoji: string; label: string }[] = [
    { id: 'TABLE',    emoji: '🪑', label: 'Mesa' },
    { id: 'COUNTER',  emoji: '🛒', label: 'Balcão' },
    { id: 'DELIVERY', emoji: '🛵', label: 'Delivery' },
    { id: 'TAKEOUT',  emoji: '📦', label: 'Retirada' },
  ];

  return (
    <Modal title="Nova Comanda" onClose={onClose}>
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Tipo */}
        <div>
          <label className="label">Tipo do Pedido</label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={cn('py-3 rounded-lg font-semibold text-xs flex flex-col items-center gap-1 transition-all',
                  type === t.id ? 'bg-brand-500 text-white' : 'bg-white/5 text-stone-400 hover:bg-white/10')}>
                <span className="text-xl">{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Campos padrão (não-delivery) ── */}
        {!isDelivery && (
          <div>
            <label className="label">
              {type === 'TABLE' ? 'Número da Mesa' : 'Nome / Referência'}
            </label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
              placeholder={type === 'TABLE' ? 'Ex: 05' : 'Ex: João Silva'}
              autoFocus onKeyDown={e => e.key === 'Enter' && create.mutate()} className="input mt-1" />
          </div>
        )}

        {/* ── Campos de delivery ── */}
        {isDelivery && (
          <div className="space-y-3 rounded-xl p-3 border border-brand-500/20 bg-brand-500/5">
            <div className="text-xs font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
              🛵 Dados da Entrega
            </div>

            {/* Telefone + busca */}
            <div>
              <label className="label">Telefone do Cliente</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onBlur={() => searchCustomer(phone)}
                  placeholder="(99) 99999-9999"
                  autoFocus
                  className="input flex-1"
                />
                <button
                  onClick={() => searchCustomer(phone)}
                  disabled={searching}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-stone-300 border border-white/10 hover:bg-white/10 transition-all">
                  {searching ? '...' : '🔍'}
                </button>
              </div>
              {foundCustomerId && (
                <div className="mt-1 text-xs text-green-400 flex items-center gap-1">
                  ✓ Cliente cadastrado encontrado
                </div>
              )}
            </div>

            {/* Nome */}
            <div>
              <label className="label">Nome do Cliente *</label>
              <input type="text" value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Nome completo"
                className="input mt-1" />
            </div>

            {/* Endereços existentes */}
            {existingAddresses.length > 0 && (
              <div>
                <label className="label">Endereços Salvos</label>
                <div className="space-y-1 mt-1">
                  {existingAddresses.map((a: any) => (
                    <button key={a.id} onClick={() => selectExistingAddress(a)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-xs transition-all border',
                        selectedAddressId === a.id
                          ? 'bg-brand-500/20 border-brand-500/50 text-white'
                          : 'bg-white/5 border-white/5 text-stone-400 hover:bg-white/10'
                      )}>
                      <span className="font-semibold">{a.street}{a.number ? `, ${a.number}` : ''}</span>
                      {a.neighborhood && <span className="text-stone-500"> · {a.neighborhood}</span>}
                      {a.reference && <span className="text-yellow-500"> · 📍 {a.reference}</span>}
                    </button>
                  ))}
                  <button onClick={() => { setSelectedAddressId(null); setStreet(''); setNumber(''); setComplement(''); setNeighborhood(''); setCity(''); setAddrReference(''); }}
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors">
                    + Novo endereço
                  </button>
                </div>
              </div>
            )}

            {/* Endereço (novo ou edição) */}
            {(!selectedAddressId || existingAddresses.length === 0) && (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <div>
                    <label className="label">Rua / Av. *</label>
                    <input type="text" value={street} onChange={e => setStreet(e.target.value)}
                      placeholder="Rua das Flores" className="input mt-1" />
                  </div>
                  <div>
                    <label className="label">Nº</label>
                    <input type="text" value={number} onChange={e => setNumber(e.target.value)}
                      placeholder="123" className="input mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Complemento</label>
                    <input type="text" value={complement} onChange={e => setComplement(e.target.value)}
                      placeholder="Apto 12, Bloco B..." className="input mt-1" />
                  </div>
                  <div>
                    <label className="label">Bairro</label>
                    <input type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)}
                      placeholder="Centro" className="input mt-1" />
                  </div>
                </div>
                <div>
                  <label className="label">Cidade</label>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)}
                    placeholder="Belém" className="input mt-1" />
                </div>
                <div>
                  <label className="label">Ponto de Referência</label>
                  <input type="text" value={addrReference} onChange={e => setAddrReference(e.target.value)}
                    placeholder="Próximo ao mercado X, casa amarela..."
                    className="input mt-1" />
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={() => create.mutate()} disabled={create.isPending || !canCreate}
          className="btn-primary w-full py-3">
          {create.isPending ? 'Criando...' : 'Abrir Comanda'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Fechar Conta ───
function PaymentModal({ order, storeName, onClose, onPaid }: {
  order: Order; storeName?: string; onClose: () => void; onPaid: () => void;
}) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [received, setReceived] = useState('');
  const [split, setSplit] = useState(false);
  const [splitMethod2, setSplitMethod2] = useState<PaymentMethod>('PIX');
  const [amount1Str, setAmount1Str] = useState('');

  // CRÍTICO: converter Decimal do Prisma para number
  const total = Number(order.total);
  const amt1 = split ? (parseFloat(amount1Str) || 0) : total;
  const amt2 = split ? Math.max(0, parseFloat((total - amt1).toFixed(2))) : 0;
  const cashReceived = parseFloat(received) || 0;
  const troco = !split && method === 'CASH' && cashReceived > total
    ? parseFloat((cashReceived - total).toFixed(2))
    : 0;

  useEffect(() => {
    if (split && !amount1Str) setAmount1Str(total.toFixed(2));
  }, [split, total, amount1Str]);

  const pay = useMutation({
    mutationFn: () => {
      let payments: Array<{ method: PaymentMethod; amount: number; received?: number }>;
      if (split) {
        payments = [
          { method, amount: amt1, ...(method === 'CASH' ? { received: amt1 } : {}) },
          { method: splitMethod2, amount: amt2 },
        ].filter(p => p.amount > 0.005);
      } else {
        payments = [{
          method,
          amount: total,
          ...(method === 'CASH' ? { received: cashReceived > 0 ? cashReceived : total } : {}),
        }];
      }
      return ordersApi.close(order.id, payments);
    },
    onSuccess: (closed) => {
      toast.success('✅ Pedido fechado com sucesso!');
      if (troco > 0) {
        toast(`💵 Troco: ${formatBRL(troco)}`, { icon: '💰', duration: 8000 });
      }
      qc.invalidateQueries({ queryKey: ['orders-open'] });
      printReceipt(closed, storeName);
      onPaid();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao fechar pedido'),
  });

  const canPay = split
    ? amt1 > 0 && amt2 > 0.005
    : method !== 'CASH' || cashReceived === 0 || cashReceived >= total;

  const METHODS: { id: PaymentMethod; emoji: string; label: string }[] = [
    { id: 'CASH',         emoji: '💵', label: 'Dinheiro' },
    { id: 'PIX',          emoji: '📱', label: 'PIX' },
    { id: 'CREDIT_CARD',  emoji: '💳', label: 'Crédito' },
    { id: 'DEBIT_CARD',   emoji: '💳', label: 'Débito' },
    { id: 'MEAL_VOUCHER', emoji: '🎫', label: 'Voucher' },
    { id: 'OTHER',        emoji: '💰', label: 'Outro' },
  ];

  return (
    <Modal title="Fechar Conta" onClose={onClose}>
      <div className="space-y-4">
        {/* Resumo do pedido */}
        <div className="bg-black/50 rounded-xl p-4 space-y-1.5">
          <div className="text-xs text-stone-500 font-semibold uppercase mb-2">
            Comanda #{order.orderNumber} {order.reference ? `· ${order.reference}` : ''}
          </div>
          {order.items
            .filter(i => i.status !== 'CANCELLED')
            .map(i => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-stone-400">{Number(i.quantity)}× {i.productName}</span>
                <span className="text-white">{formatBRL(i.subtotal)}</span>
              </div>
            ))}
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-sm pt-1 border-t border-white/5">
              <span className="text-green-400">Desconto</span>
              <span className="text-green-400">- {formatBRL(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10 mt-1">
            <span className="text-white">TOTAL</span>
            <span style={{ color: '#E85D2F' }}>{formatBRL(total)}</span>
          </div>
        </div>

        {/* Dividir pagamento */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)}
            className="w-4 h-4 accent-brand-500 rounded" />
          <span className="text-sm text-stone-300">Dividir em 2 formas de pagamento</span>
        </label>

        {!split ? (
          <>
            {/* Forma única */}
            <div>
              <label className="label">Forma de Pagamento</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {METHODS.map(m => (
                  <button key={m.id} onClick={() => setMethod(m.id)}
                    className={cn('py-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all border',
                      method === m.id
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-white/5 text-stone-400 border-white/5 hover:bg-white/10'
                    )}>
                    <span className="text-2xl">{m.emoji}</span>{m.label}
                  </button>
                ))}
              </div>
            </div>
            {method === 'CASH' && (
              <div>
                <label className="label">Valor Recebido em Dinheiro</label>
                <input type="number" step="0.50" min={0} value={received}
                  onChange={e => setReceived(e.target.value)}
                  placeholder={`${total.toFixed(2)} (deixe vazio p/ exato)`}
                  className="input mt-1 text-center text-lg font-bold" />
                {troco > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex justify-between items-center">
                    <span className="text-green-400 font-semibold">💸 Troco</span>
                    <span className="text-green-300 font-bold text-xl">{formatBRL(troco)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Divisão em 2 */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">1ª Forma</label>
                <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className="input mt-1">
                  {METHODS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" max={total}
                  value={amount1Str} onChange={e => setAmount1Str(e.target.value)}
                  className="input mt-1 font-bold" placeholder="0,00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">2ª Forma</label>
                <select value={splitMethod2} onChange={e => setSplitMethod2(e.target.value as PaymentMethod)} className="input mt-1">
                  {METHODS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Restante</label>
                <div className="input mt-1 font-bold text-brand-500">{formatBRL(amt2)}</div>
              </div>
            </div>
          </div>
        )}

        <button onClick={() => pay.mutate()} disabled={pay.isPending || !canPay}
          className="btn-primary w-full py-3.5 text-base font-bold">
          {pay.isPending ? 'Processando...' : `✅ Confirmar Pagamento · ${formatBRL(total)}`}
        </button>
      </div>
    </Modal>
  );
}

// ─── Cancelar Comanda ───
function CancelModal({ orderId, label, onClose, onCancelled }: {
  orderId: string; label: string; onClose: () => void; onCancelled: () => void;
}) {
  const [reason, setReason] = useState('');
  const qc = useQueryClient();

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(orderId, reason),
    onSuccess: () => {
      toast.success('Comanda cancelada');
      qc.invalidateQueries({ queryKey: ['orders-open'] });
      onCancelled();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao cancelar'),
  });

  const QUICK = ['Pedido duplicado', 'Desistência do cliente', 'Erro no pedido', 'Produto esgotado', 'Teste'];

  return (
    <Modal title="Cancelar Comanda" onClose={onClose}>
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>Cancelando a comanda <strong>{label}</strong>. Estoque será devolvido. Ação irreversível.</span>
        </div>

        <div>
          <label className="label">Motivo do Cancelamento</label>
          <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
            {QUICK.map(r => (
              <button key={r} onClick={() => setReason(r)}
                className={cn('px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  reason === r
                    ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                    : 'bg-white/5 text-stone-400 hover:bg-white/10')}>
                {r}
              </button>
            ))}
          </div>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder="Ou descreva o motivo aqui..."
            className="input w-full resize-none" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="btn flex-1 bg-white/5 text-stone-300 border border-white/10 hover:bg-white/10">
            Voltar
          </button>
          <button onClick={() => cancel.mutate()}
            disabled={reason.trim().length < 3 || cancel.isPending}
            className="btn flex-1 bg-red-500/25 text-red-300 border border-red-500/40 hover:bg-red-500/35">
            {cancel.isPending ? 'Cancelando...' : '🗑 Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Desconto ───
function DiscountModal({ order, onClose, onApplied }: {
  order: Order; onClose: () => void; onApplied: () => void;
}) {
  const [mode, setMode] = useState<'manual' | 'coupon'>('manual');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<{ discountAmount: number; finalTotal: number; coupon: any } | null>(null);
  const [validating, setValidating] = useState(false);
  const qc = useQueryClient();

  const subtotal = Number(order.subtotal);

  const preview = useMemo(() => {
    if (mode === 'coupon' && couponResult) {
      return { discount: couponResult.discountAmount, final: couponResult.finalTotal };
    }
    if (mode === 'manual' && value) {
      const v = parseFloat(value);
      if (isNaN(v) || v <= 0) return null;
      const disc = type === 'PERCENTAGE'
        ? Math.min(subtotal, (subtotal * v) / 100)
        : Math.min(subtotal, v);
      return { discount: parseFloat(disc.toFixed(2)), final: parseFloat((subtotal - disc).toFixed(2)) };
    }
    return null;
  }, [mode, type, value, subtotal, couponResult]);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidating(true);
    try {
      const res = await couponsApi.validate(couponCode.trim(), Number(order.total));
      setCouponResult(res);
      toast.success(`Cupom "${res.coupon.code}" válido! Desconto: ${formatBRL(res.discountAmount)}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Cupom inválido');
      setCouponResult(null);
    } finally {
      setValidating(false);
    }
  };

  const apply = useMutation({
    mutationFn: () => {
      if (mode === 'coupon' && couponResult) {
        // Passa couponId para que o backend incremente usedCount atomicamente
        return ordersApi.applyDiscount(
          order.id, 'FIXED', couponResult.discountAmount,
          `Cupom: ${couponCode}`,
          couponResult.coupon.id,
        );
      }
      return ordersApi.applyDiscount(order.id, type, parseFloat(value), reason || undefined);
    },
    onSuccess: () => {
      toast.success('Desconto aplicado!');
      qc.invalidateQueries({ queryKey: ['orders-open'] });
      onApplied();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao aplicar desconto'),
  });

  const canApply = mode === 'coupon'
    ? !!couponResult
    : !!(value && parseFloat(value) > 0);

  return (
    <Modal title="Aplicar Desconto" onClose={onClose}>
      <div className="space-y-4">
        {/* Toggle manual / cupom */}
        <div className="flex gap-2">
          {(['manual', 'coupon'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setCouponResult(null); }}
              className={cn('flex-1 py-2 rounded-lg text-sm font-semibold border transition-all',
                mode === m
                  ? 'border-purple-500 text-purple-300 bg-purple-500/15'
                  : 'border-white/10 text-stone-400 bg-white/5 hover:border-white/20')}>
              {m === 'manual' ? '✏️ Manual' : '🏷️ Cupom'}
            </button>
          ))}
        </div>

        {mode === 'manual' ? (
          <>
            <div className="flex gap-2">
              {(['PERCENTAGE', 'FIXED'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-semibold border transition-all',
                    type === t
                      ? 'border-brand-500 text-brand-400 bg-brand-500/10'
                      : 'border-white/10 text-stone-400 bg-white/5')}>
                  {t === 'PERCENTAGE' ? 'Percentual (%)' : 'Valor Fixo (R$)'}
                </button>
              ))}
            </div>
            <div>
              <label className="label">Valor {type === 'PERCENTAGE' ? '%' : 'R$'}</label>
              <input type="number" min="0.01" step="0.01" value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={type === 'PERCENTAGE' ? 'Ex: 10' : 'Ex: 5.00'}
                className="input mt-1 text-center text-xl font-bold" autoFocus />
            </div>
            <div>
              <label className="label">Motivo (opcional)</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Ex: cortesia, fidelidade..."
                className="input mt-1" />
            </div>
          </>
        ) : (
          <div>
            <label className="label">Código do Cupom</label>
            <div className="flex gap-2 mt-1">
              <input type="text" value={couponCode}
                onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleValidateCoupon()}
                placeholder="EX: LANCHE10"
                className="input flex-1 font-mono font-bold uppercase" />
              <button onClick={handleValidateCoupon} disabled={validating || !couponCode.trim()}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-50 transition-all">
                {validating ? '...' : 'Validar'}
              </button>
            </div>
            {couponResult && (
              <div className="mt-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm">
                <div className="text-green-400 font-bold">✓ Cupom válido: {couponResult.coupon.code}</div>
                {couponResult.coupon.description && (
                  <div className="text-stone-400 text-xs mt-0.5">{couponResult.coupon.description}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="bg-black/50 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Subtotal</span>
              <span className="text-white">{formatBRL(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-400 font-semibold">
              <span>Desconto</span>
              <span>- {formatBRL(preview.discount)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10">
              <span className="text-white">NOVO TOTAL</span>
              <span style={{ color: '#E85D2F' }}>{formatBRL(preview.final)}</span>
            </div>
          </div>
        )}

        <button onClick={() => apply.mutate()} disabled={!canApply || apply.isPending}
          className="btn-primary w-full py-3 font-bold disabled:opacity-50">
          {apply.isPending ? 'Aplicando...' : '✅ Aplicar Desconto'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Impressão ───
function printReceipt(order: Order, storeName?: string) {
  const nome = storeName || 'ADONAY LANCHE';
  const sep = '================================';
  const lines = [
    sep,
    nome.padStart(Math.floor((32 + nome.length) / 2)),
    sep,
    `Comanda #${order.orderNumber}`,
    order.reference ? `Ref: ${order.reference}` : null,
    `Tipo: ${{ TABLE: 'Mesa', COUNTER: 'Balcão', DELIVERY: 'Delivery', TAKEOUT: 'Retirada' }[order.type] || order.type}`,
    `Data: ${new Date(order.openedAt).toLocaleString('pt-BR')}`,
    '--------------------------------',
    ...order.items
      .filter(i => i.status !== 'CANCELLED')
      .flatMap(i => [
        `${i.quantity}x ${i.productName}`,
        i.notes ? `   * ${i.notes}` : null,
        `    ${formatBRL(i.unitPrice)} = ${formatBRL(i.subtotal)}`,
      ].filter(Boolean) as string[]),
    '--------------------------------',
    Number(order.discount) > 0 ? `Desconto:  -${formatBRL(order.discount)}` : null,
    `TOTAL:     ${formatBRL(order.total)}`,
    ...(order.payments || []).map(p =>
      `${p.method}: ${formatBRL(p.amount)}${Number(p.change) > 0 ? ` | Troco: ${formatBRL(p.change)}` : ''}`
    ),
    sep,
    '     Obrigado pela preferência!     ',
    `  ${nome}  `,
  ].filter(Boolean) as string[];

  const win = window.open('', '_blank', 'width=420,height=650,menubar=no,toolbar=no');
  if (!win) { toast.error('Permita pop-ups para imprimir'); return; }
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Comanda #${order.orderNumber}</title>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Courier New', monospace; font-size: 13px; white-space: pre;
             padding: 8px; margin: 0; background: #fff; color: #000; }
      @media print { @page { margin: 4mm; size: 80mm auto; } }
    </style></head>
    <body>${lines.join('\n')}</body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ─── Modal base ───
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
