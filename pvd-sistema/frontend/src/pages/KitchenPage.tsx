import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChefHat, Clock, Check, CheckCheck, Store } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { ordersApi, storesApi } from '@/services/endpoints';
import { getSocket } from '@/services/socket';
import { minutesSince } from '@/lib/utils';
import { playOrderKitchen } from '@/lib/sounds';
import { cn } from '@/lib/utils';

export default function KitchenPage() {
  const user = useAuthStore(s => s.user);
  const isManager = ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user?.role || '');
  const qc = useQueryClient();

  // OWNER/MANAGER podem trocar de loja; KITCHEN usa a loja fixa do JWT
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(user?.storeId || null);

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: storesApi.list,
    enabled: isManager,
  });

  // Auto-seleciona primeira loja se OWNER/MANAGER não tem loja fixa
  useEffect(() => {
    if (isManager && !selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId, isManager]);

  const storeId = selectedStoreId;

  const { data: orders = [], refetch } = useQuery({
    queryKey: ['kitchen-orders', storeId],
    queryFn: () => ordersApi.listOpen(storeId!),
    enabled: !!storeId,
    refetchInterval: 20_000,
  });

  // Escuta todos os eventos que podem afetar a cozinha
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => refetch();

    socket.on('order:kitchen', () => {
      playOrderKitchen();
      refresh();
    });
    // Pedido atualizado (item marcado pronto, itens adicionados etc.)
    socket.on('order:updated', refresh);
    // Novo pedido criado (aparece ao recarregar)
    socket.on('order:created', refresh);
    // Pedido cancelado → remove da tela
    socket.on('order:cancelled', refresh);
    // Pedido fechado → remove da tela
    socket.on('order:closed', refresh);

    return () => {
      socket.off('order:kitchen');
      socket.off('order:updated', refresh);
      socket.off('order:created', refresh);
      socket.off('order:cancelled', refresh);
      socket.off('order:closed', refresh);
    };
  }, [refetch]);

  const markReady = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      ordersApi.markItemReady(orderId, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      toast.success('Item marcado como pronto!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  const markAllReady = useMutation({
    mutationFn: (order: typeof orders[0]) => ordersApi.markAllReady(order.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      toast.success('Todos os itens prontos!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  const kitchenOrders = orders.filter(o =>
    o.items.some(i => i.status === 'SENT' || i.status === 'PREPARING')
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
        <div>
          <h2 className="display-font text-3xl text-white">COZINHA</h2>
          <p className="text-stone-400 text-sm">
            {kitchenOrders.length} pedido{kitchenOrders.length !== 1 ? 's' : ''} em preparo · atualiza em tempo real
          </p>
        </div>

        {/* Seletor de loja para OWNER/MANAGER */}
        {isManager && stores.length > 1 && (
          <div className="flex items-center gap-2">
            <Store size={14} className="text-stone-400" />
            {stores.map(s => (
              <button key={s.id} onClick={() => setSelectedStoreId(s.id)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  storeId === s.id ? 'bg-brand-500 text-white' : 'bg-white/5 text-stone-400 hover:bg-white/10')}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4">
        {!storeId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-stone-500">
            <Store size={48} className="opacity-30" />
            <p>Selecione uma loja para ver os pedidos</p>
          </div>
        ) : kitchenOrders.length === 0 ? (
          <div className="text-center py-20 text-stone-500">
            <ChefHat size={72} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">Nenhum pedido no momento</p>
            <p className="text-sm mt-1">Os pedidos aparecerão aqui automaticamente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {kitchenOrders.map(o => {
              const since = o.sentToKitchenAt ? minutesSince(o.sentToKitchenAt) : 0;
              const urgent = since > 15;
              const warning = since > 8;
              const pendingItems = o.items.filter(i => i.status === 'SENT' || i.status === 'PREPARING');

              return (
                <div key={o.id} className="rounded-xl p-4 slide-in flex flex-col"
                  style={{
                    background: urgent
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.04))'
                      : warning
                      ? 'linear-gradient(135deg, rgba(251,146,60,0.18), rgba(251,146,60,0.04))'
                      : 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.03))',
                    border: `1px solid ${urgent ? 'rgba(239,68,68,0.45)' : warning ? 'rgba(251,146,60,0.35)' : 'rgba(34,197,94,0.3)'}`,
                  }}>
                  {/* Cabeçalho do pedido */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
                    <div>
                      <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        {o.type === 'TABLE' ? '🪑 Mesa' : o.type === 'DELIVERY' ? '🛵 Delivery' : o.type === 'COUNTER' ? '🛒 Balcão' : '📦 Retirada'}
                      </div>
                      <div className="font-black text-white text-2xl leading-tight">
                        {o.reference || `#${o.orderNumber}`}
                      </div>
                      {o.customer?.name && (
                        <div className="text-xs text-stone-400">{o.customer.name}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 font-bold text-lg justify-end"
                        style={{ color: urgent ? '#f87171' : warning ? '#fb923c' : '#4ade80' }}>
                        <Clock size={16} /> {since}min
                      </div>
                      {urgent && (
                        <div className="text-[10px] font-black text-red-400 tracking-wider animate-pulse">
                          ⚠ ATRASADO
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Itens */}
                  <div className="space-y-2 flex-1">
                    {pendingItems.map(i => (
                      <div key={i.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/40">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-white text-lg shrink-0"
                          style={{ background: 'linear-gradient(135deg, #E85D2F, #C73E18)' }}>
                          {i.quantity}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-sm">{i.productName}</div>
                          {i.notes && (
                            <div className="text-xs text-yellow-300 mt-0.5 font-semibold">
                              ⚠ {i.notes}
                            </div>
                          )}
                          {i.kitchenStation && (
                            <div className="text-[10px] text-stone-500 mt-0.5 uppercase">{i.kitchenStation}</div>
                          )}
                        </div>
                        <button
                          onClick={() => markReady.mutate({ orderId: o.id, itemId: i.id })}
                          disabled={markReady.isPending}
                          title="Marcar item como pronto"
                          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all bg-green-500/20 hover:bg-green-500/40 border border-green-500/30">
                          <Check size={18} className="text-green-400" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Botão "Tudo Pronto" */}
                  {pendingItems.length > 1 && (
                    <button
                      onClick={() => markAllReady.mutate(o)}
                      disabled={markAllReady.isPending}
                      className="mt-3 w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30">
                      <CheckCheck size={15} /> Tudo Pronto
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
