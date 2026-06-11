import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, LayoutGrid, Wind, ClipboardList, AlertTriangle, Star } from 'lucide-react'
import { SkeletonCard } from '../components/ui/Skeleton'
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
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Dashboard</h1>
      </div>
      <div className="p-4 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )

  const fmtMoney = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

  const secondaryKpis = [
    { label: 'Mesas Ocupadas', value: String(stats!.occupiedTables), icon: LayoutGrid, subColor: 'var(--green)', sub: 'ao vivo' },
    { label: 'Rosh Vendidos',  value: String(stats!.roshSold),       icon: Wind,        subColor: 'var(--text-muted)', sub: 'hoje' },
    { label: 'Pedidos',        value: String(stats!.ordersToday),     icon: ClipboardList, subColor: 'var(--text-muted)', sub: 'hoje' },
  ]

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="px-4 md:px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Dashboard</h1>
        <p className="text-[12px] mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="p-4 md:p-8 space-y-4">

        {/* Revenue Hero */}
        <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-raised) 100%)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)',
          }}>
          {/* Subtle gold accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
            style={{ background: 'linear-gradient(90deg, var(--gold) 0%, transparent 100%)' }} />

          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}>
                <TrendingUp size={15} style={{ color: 'var(--gold)' }} />
              </div>
              <span className="text-sm font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                Faturamento
              </span>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{ background: 'var(--gold-bg)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}>
              hoje
            </span>
          </div>

          <p className="font-mono font-bold leading-none mt-4 mb-1"
            style={{
              fontSize: 'clamp(40px, 8vw, 64px)',
              color: 'var(--gold)',
              letterSpacing: '-0.03em',
            }}>
            {fmtMoney(stats!.revenue)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {secondaryKpis.map(kpi => (
            <div key={kpi.label} className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                <kpi.icon size={13} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <p className="stat-number text-2xl leading-none mb-1"
                style={{ color: 'var(--text-primary)' }}>
                {kpi.value}
              </p>
              <p className="text-[10px] uppercase tracking-wider mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {kpi.label}
              </p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Low stock */}
          {stats!.lowStock.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--amber-border)', background: 'var(--amber-bg)' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} style={{ color: 'var(--amber)' }} />
                <span className="section-header" style={{ color: 'var(--amber)' }}>Estoque Baixo</span>
              </div>
              <div className="space-y-2.5">
                {stats!.lowStock.map(p => (
                  <div key={p.nome} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{p.nome}</span>
                    <span className="badge badge-yellow">{p.stock_quantity} un</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top products */}
          {stats!.topProducts.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Star size={13} style={{ color: 'var(--gold)' }} />
                <span className="section-header">Mais Vendidos Hoje</span>
              </div>
              <div className="space-y-3">
                {stats!.topProducts.map((p, i) => (
                  <div key={p.product_name} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)' }}>
                      {i + 1}
                    </span>
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                      {p.product_name}
                    </span>
                    <span className="font-mono text-sm font-bold" style={{ color: 'var(--gold)' }}>
                      {p.total}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
