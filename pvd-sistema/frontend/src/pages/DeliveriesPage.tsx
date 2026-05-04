import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Bike, Clock, CheckCheck, Timer, PackageCheck,
  User, Phone, MapPin, Navigation, Store, ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { deliveriesApi, storesApi } from '@/services/endpoints';
import { getSocket } from '@/services/socket';
import { playDeliveryReady } from '@/lib/sounds';
import { formatBRL, formatTime } from '@/lib/utils';
import type { DeliveryStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_INFO: Record<DeliveryStatus, { label: string; color: string; icon: any; next?: DeliveryStatus }> = {
  WAITING:    { label: 'Aguardando',      color: '#94a3b8', icon: Clock,        next: 'READY' },
  READY:      { label: 'Pronto p/ sair',  color: '#22c55e', icon: PackageCheck, next: 'DISPATCHED' },
  DISPATCHED: { label: 'Saiu p/ entrega', color: '#3b82f6', icon: Bike,         next: 'DELIVERED' },
  DELIVERED:  { label: 'Entregue',        color: '#8b5cf6', icon: CheckCheck },
  RETURNED:   { label: 'Retornou',        color: '#f87171', icon: Timer },
};

function buildMapsUrl(address: {
  street?: string; number?: string; neighborhood?: string; city?: string; state?: string; zipCode?: string;
}) {
  const parts = [
    address.street,
    address.number,
    address.neighborhood,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

function buildWazeUrl(address: {
  street?: string; number?: string; neighborhood?: string; city?: string; state?: string;
}) {
  const parts = [address.street, address.number, address.neighborhood, address.city, address.state]
    .filter(Boolean).join(', ');
  return `https://waze.com/ul?q=${encodeURIComponent(parts)}&navigate=yes`;
}

export default function DeliveriesPage() {
  const user = useAuthStore(s => s.user);
  const isManager = ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user?.role || '');
  const isDeliverer = user?.role === 'DELIVERER';
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | DeliveryStatus>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(user?.storeId || null);

  // Carrega lojas para managers E para deliverers sem loja fixa
  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: storesApi.list,
    enabled: isManager || (isDeliverer && !user?.storeId),
  });

  // Auto-seleciona primeira loja se não tem loja fixa
  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const storeId = selectedStoreId;

  // Deliverer sem storeId pode buscar sem filtro de loja (backend filtra por tenant)
  const canQuery = !!storeId || isDeliverer;

  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries', storeId, filter],
    queryFn: () => deliveriesApi.list(
      storeId || '',
      filter === 'all' ? undefined : filter,
    ),
    enabled: canQuery,
    staleTime: 30_000,
  });

  // Escuta eventos em tempo real para entregas
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => qc.invalidateQueries({ queryKey: ['deliveries'] });

    socket.on('delivery:status-changed', refresh);
    socket.on('delivery:assigned', refresh);
    // Pedido de delivery fechado no caixa → novo registro WAITING
    socket.on('order:closed', () => qc.invalidateQueries({ queryKey: ['deliveries', storeId] }));
    socket.on('delivery:ready', (data: any) => {
      playDeliveryReady();
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      toast(`🛵 Pedido #${data.orderNumber} pronto para sair!`, {
        icon: '🔔',
        duration: 8000,
        style: { background: '#1e3a2f', color: '#4ade80', border: '1px solid #22c55e66' },
      });
    });
    socket.on('order:cancelled', refresh);

    return () => {
      socket.off('delivery:status-changed', refresh);
      socket.off('delivery:assigned', refresh);
      socket.off('order:closed', refresh);
      socket.off('delivery:ready', refresh);
      socket.off('order:cancelled', refresh);
    };
  }, [storeId, qc]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      deliveriesApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      if (vars.status === 'DISPATCHED') toast.success('🛵 Motoboy saiu para entrega!');
      if (vars.status === 'DELIVERED') toast.success('✅ Entrega confirmada!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  const counts: Record<string, number> = { all: deliveries.length };
  deliveries.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div>
          <h2 className="display-font text-2xl text-white">ENTREGAS</h2>
          <p className="text-stone-400 text-xs">Atualiza em tempo real</p>
        </div>

        {/* Seletor de loja para managers e deliverers sem loja fixa */}
        {(isManager || (isDeliverer && !user?.storeId)) && stores.length > 1 && (
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
      </div>

      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-white/5 flex-shrink-0">
        <button onClick={() => setFilter('all')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
            filter === 'all' ? 'bg-brand-500 text-white' : 'bg-white/5 text-stone-400 hover:bg-white/10')}>
          Todos ({counts.all})
        </button>
        {Object.entries(STATUS_INFO).map(([key, info]) => (
          <button key={key} onClick={() => setFilter(key as DeliveryStatus)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border',
              filter === key ? '' : 'bg-white/5 text-stone-400 border-transparent hover:bg-white/10')}
            style={filter === key ? { background: `${info.color}25`, color: info.color, borderColor: `${info.color}60` } : {}}>
            <info.icon size={12} /> {info.label} ({counts[key] || 0})
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        {!canQuery ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-stone-500">
            <Store size={48} className="opacity-30" />
            <p>Selecione uma loja para ver as entregas</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-20 text-stone-500">
            <Bike size={72} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">Nenhuma entrega no momento</p>
            <p className="text-sm mt-1">Os pedidos de delivery aparecem aqui automaticamente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map(d => {
              const info = STATUS_INFO[d.status];
              const Icon = info.icon;
              const addr = d.order.address;

              const clientName = d.order.customer?.name || d.order.reference || '—';
              const clientPhone = d.order.customer?.phone;

              return (
                <div key={d.id} className="rounded-xl overflow-hidden slide-in"
                  style={{ border: `1px solid ${info.color}50` }}>

                  {/* ── Cabeçalho colorido ── */}
                  <div className="flex items-center justify-between px-4 py-2.5"
                    style={{ background: `${info.color}18`, borderBottom: `1px solid ${info.color}30` }}>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                        style={{ background: `${info.color}25`, border: `1px solid ${info.color}60` }}>
                        <Icon size={12} style={{ color: info.color }} />
                        <span className="text-xs font-bold" style={{ color: info.color }}>{info.label}</span>
                      </div>
                      <span className="font-black text-white text-lg">#{d.order.orderNumber}</span>
                      <span className="text-xs text-stone-400">{formatTime(d.order.openedAt)}</span>
                    </div>
                    {d.deliverer && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                        🛵 {d.deliverer.name}
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.35)' }}>

                    {/* ── Cliente + contato ── */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{ background: 'rgba(232,93,47,0.25)', color: '#E85D2F' }}>
                          {clientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white text-base leading-tight">{clientName}</div>
                          {clientPhone && (
                            <div className="text-xs text-stone-400">{clientPhone}</div>
                          )}
                        </div>
                      </div>
                      {clientPhone && (
                        <a href={`tel:${clientPhone}`}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 transition-all active:scale-95">
                          <Phone size={16} /> Ligar
                        </a>
                      )}
                    </div>

                    {/* ── Endereço ── */}
                    {addr ? (
                      <div className="rounded-xl p-3 space-y-2"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-start gap-2">
                          <MapPin size={15} className="text-brand-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm leading-snug">
                              {addr.street}{addr.number ? `, ${addr.number}` : ''}
                              {addr.complement ? <span className="text-stone-400"> — {addr.complement}</span> : null}
                            </div>
                            {(addr.neighborhood || addr.city) && (
                              <div className="text-xs text-stone-400 mt-0.5">
                                {[addr.neighborhood, addr.city, addr.state].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            {addr.reference && (
                              <div className="mt-1 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/25 text-xs text-yellow-300 font-semibold">
                                📍 {addr.reference}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Botões de navegação */}
                        <div className="flex gap-2">
                          <a href={buildMapsUrl(addr)} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all">
                            <Navigation size={13} /> Google Maps
                          </a>
                          <a href={buildWazeUrl(addr)} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-all">
                            <ExternalLink size={12} /> Waze
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400 flex items-center gap-2">
                        <MapPin size={13} /> Endereço não informado — verifique com o caixa
                      </div>
                    )}

                    {/* ── Itens do pedido ── */}
                    <div className="rounded-xl overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {d.order.items.filter(i => i.status !== 'CANCELLED').map((item, idx, arr) => (
                        <div key={item.id}
                          className={cn('flex items-start gap-3 px-3 py-2.5', idx < arr.length - 1 && 'border-b border-white/5')}>
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                            style={{ background: 'rgba(232,93,47,0.3)', color: '#E85D2F' }}>
                            {item.quantity}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white">{item.productName}</div>
                            {item.notes && (
                              <div className="text-xs text-amber-300 mt-0.5">📝 {item.notes}</div>
                            )}
                          </div>
                          <span className="text-xs text-stone-400 shrink-0">{formatBRL(item.subtotal)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/10">
                        <span className="text-xs text-stone-500">TOTAL A COBRAR</span>
                        <span className="font-black text-lg" style={{ color: '#E85D2F' }}>{formatBRL(d.order.total)}</span>
                      </div>
                    </div>

                    {/* ── Botão de ação ── */}
                    {info.next && (
                      <button
                        onClick={() => updateStatus.mutate({ id: d.id, status: info.next! })}
                        disabled={updateStatus.isPending}
                        className="btn-primary w-full py-3.5 text-base font-black">
                        {(() => { const N = STATUS_INFO[info.next!].icon; return <N size={18} />; })()}
                        {info.next === 'DISPATCHED' ? '🛵 Saí para entrega' : info.next === 'DELIVERED' ? '✅ Entrega confirmada' : STATUS_INFO[info.next!].label}
                      </button>
                    )}

                    {d.actualMinutes && (
                      <div className="text-center text-xs text-purple-400">⏱ Tempo de entrega: {d.actualMinutes} min</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
