import { useQuery } from '@tanstack/react-query';
import { DollarSign, Receipt, Package, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { reportsApi } from '@/services/endpoints';
import { formatBRL } from '@/lib/utils';

export default function ReportsPage() {
  const user = useAuthStore(s => s.user);
  const storeId = user?.storeId;

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', storeId],
    queryFn: () => reportsApi.dashboard(storeId!),
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="p-6 text-stone-400">Carregando...</div>;
  if (!data) return <div className="p-6 text-stone-400">Sem dados</div>;

  const { summary, paymentBreakdown, topProducts } = data;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="display-font text-4xl text-white">RELATÓRIO DO DIA</h2>
      <p className="text-stone-400 text-sm mb-6">
        {new Date(data.businessDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Faturamento', value: formatBRL(summary.revenue), icon: DollarSign, color: '#E85D2F' },
          { label: 'Pedidos', value: summary.closedOrders, icon: Receipt, color: '#2E86AB' },
          { label: 'Ticket Médio', value: formatBRL(summary.avgTicket || 0), icon: TrendingUp, color: '#C77DFF' },
          { label: 'Cancelados', value: summary.cancelled.count, icon: Package, color: '#f87171' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-xl" style={{ background: `linear-gradient(135deg, ${k.color}15, ${k.color}05)`, border: `1px solid ${k.color}30` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold text-stone-400">{k.label}</span>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div className="display-font text-2xl font-bold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold text-white mb-4">Por Forma de Pagamento</h3>
          {paymentBreakdown.length === 0 ? <p className="text-stone-500 text-sm">Sem vendas hoje</p> : (
            <div className="space-y-3">
              {paymentBreakdown.map((p: any) => (
                <div key={p.method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-stone-300 uppercase font-semibold">{p.method}</span>
                    <span className="text-white font-bold">{formatBRL(p.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${p.percentage}%`, background: 'linear-gradient(90deg, #E85D2F, #F4A261)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-white mb-4">Top 10 Mais Vendidos</h3>
          {topProducts.length === 0 ? <p className="text-stone-500 text-sm">Sem vendas hoje</p> : (
            <div className="space-y-2">
              {topProducts.map((p: any, idx: number) => (
                <div key={p.productId} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: idx === 0 ? '#E85D2F' : 'rgba(255,255,255,0.1)' }}>{idx + 1}</div>
                  <div className="flex-1 text-white font-semibold text-sm">{p.name}</div>
                  <div className="text-stone-400 text-sm"><span className="text-white font-bold">{p.quantity}</span> un.</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
