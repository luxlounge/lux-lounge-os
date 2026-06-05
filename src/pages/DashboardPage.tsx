import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, LayoutGrid, Wind, ClipboardList, AlertTriangle, Star } from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Stats {
  revenue: number
  occupiedTables: number
  roshSold: number
  ordersToday: number
  lowStock: Array<{ nome: string; stock_quantity: number }>
  topProducts: Array<{ product_name: string; total: number }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [
      { data: payments },
      { data: mesas },
      { data: pedidoItens },
      { data: lowStock },
    ] = await Promise.all([
      supabase.from('pagamentos').select('valor, created_at').gte('created_at', today.toISOString()),
      supabase.from('mesas').select('status'),
      supabase.from('pedido_itens').select('nome_produto, quantidade, is_rosh, pedidos(created_at)').gte('pedidos.created_at', today.toISOString()),
      supabase.from('products').select('nome, stock_quantity').lt('stock_quantity', 5).eq('active', true).order('stock_quantity'),
    ])
    const revenue = (payments ?? []).reduce((s, p) => s + Number(p.valor), 0)
    const occupiedTables = (mesas ?? []).filter(m => m.status === 'ocupada').length
    const allItems = (pedidoItens ?? []) as any[]
    const todayItems = allItems.filter(i => i.pedidos?.created_at)
    const roshSold = todayItems.filter(i => i.is_rosh).reduce((s: number, i: any) => s + i.quantidade, 0)
    const ordersToday = new Set(todayItems.map((i: any) => i.pedidos?.created_at)).size
    const productTotals: Record<string, number> = {}
    for (const i of todayItems as any[]) {
      productTotals[i.nome_produto] = (productTotals[i.nome_produto] ?? 0) + i.quantidade
    }
    const topProducts = Object.entries(productTotals)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([product_name, total]) => ({ product_name, total }))
    setStats({ revenue, occupiedTables, roshSold, ordersToday, lowStock: lowStock ?? [], topProducts })
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-ink"><Spinner size={32} /></div>
  )

  const cards = [
    { label: 'Faturamento', value: `R$ ${stats!.revenue.toFixed(2).replace('.', ',')}`, icon: TrendingUp, gold: true },
    { label: 'Mesas Ocupadas', value: String(stats!.occupiedTables), icon: LayoutGrid, gold: false },
    { label: 'Rosh Vendidos', value: String(stats!.roshSold), icon: Wind, gold: false },
    { label: 'Pedidos Hoje', value: String(stats!.ordersToday), icon: ClipboardList, gold: false },
  ]

  return (
    <div className="min-h-screen bg-ink pb-24 md:pb-6">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-ink-border">
        <h1 className="page-header">Dashboard</h1>
        <p className="text-[#444] text-xs mt-0.5 capitalize">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {cards.map(c => (
            <div key={c.label} className={[
              'bg-ink-card border rounded-2xl p-4',
              c.gold ? 'border-gold/30' : 'border-ink-border',
            ].join(' ')}>
              <div className={[
                'w-8 h-8 rounded-xl flex items-center justify-center mb-3',
                c.gold ? 'bg-gold/10' : 'bg-ink-raised',
              ].join(' ')}>
                <c.icon size={16} className={c.gold ? 'text-gold' : 'text-[#444]'} />
              </div>
              <p className={`font-display font-bold text-xl ${c.gold ? 'text-gold' : 'text-white'}`}>{c.value}</p>
              <p className="text-[11px] text-[#444] mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Low stock */}
        {stats!.lowStock.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Estoque Baixo</span>
            </div>
            <div className="space-y-2">
              {stats!.lowStock.map(p => (
                <div key={p.nome} className="flex items-center justify-between">
                  <span className="text-sm text-[#aaa]">{p.nome}</span>
                  <span className="badge-yellow badge">{p.stock_quantity} un</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top products */}
        {stats!.topProducts.length > 0 && (
          <div className="bg-ink-card border border-ink-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star size={14} className="text-gold" />
              <span className="text-xs font-semibold text-[#555] uppercase tracking-wider">Mais Vendidos Hoje</span>
            </div>
            <div className="space-y-2.5">
              {stats!.topProducts.map((p, i) => (
                <div key={p.product_name} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white flex-1 truncate">{p.product_name}</span>
                  <span className="text-sm font-semibold text-gold">{p.total}×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
