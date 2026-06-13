import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrendingUp, LayoutGrid, Wind, ClipboardList, AlertTriangle, Star,
  Clock, DollarSign, CheckCircle, ChevronRight, Flame,
} from 'lucide-react'
import { SkeletonCard } from '../components/ui/Skeleton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function fmt(n: number) {
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

interface Stats {
  revenue: number
  totalToReceive: number
  occupiedTables: number
  totalMesas: number
  roshSold: number
  ordersToday: number
  pendingOrders: number
  preparingOrders: number
  avgTicket: number
  lowStock: Array<{ nome: string; stock_quantity: number }>
  topProducts: Array<{ product_name: string; total: number }>
  urgentPedidos: Array<{ id: number; mesa?: number; minutesOld: number; status: string }>
  longOpenMesas: Array<{ numero: number; hoursOpen: number; balance: number }>
  catCount: number
  prodCount: number
  mesaCount: number
  lucroHoje: number
  margemMedia: number
  topProfitProduct: string
  topProfitCategory: string
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const now = Date.now()

    const [
      { data: payments },
      { data: allMesas },
      { data: activePedidos },
      { data: pedidoItens },
      { data: lowStock },
      { data: openComandas },
      { data: closedComandas },
      { count: catCount },
      { count: prodCount },
    ] = await Promise.all([
      supabase.from('pagamentos').select('valor').gte('created_at', today.toISOString()),
      supabase.from('mesas').select('status'),
      supabase.from('pedidos').select('id, status, created_at, comandas(mesa_id, mesas(numero))').in('status', ['pendente', 'preparo']),
      supabase.from('pedido_itens').select('nome_produto, quantidade, is_rosh, preco_unitario, total_item, pedidos(created_at), products(cost_price, avg_cost, categoria_id, categorias(nome))'),
      supabase.from('products').select('nome, stock_quantity').lt('stock_quantity', 5).eq('active', true).order('stock_quantity'),
      supabase.from('comandas').select('id, total, total_pago, aberta_em, mesas(numero)').eq('status', 'aberta'),
      supabase.from('comandas').select('total').eq('status', 'fechada').gte('fechada_em', today.toISOString()),
      supabase.from('categorias').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
    ])

    const revenue = (payments ?? []).reduce((s, p) => s + Number(p.valor), 0)
    const occupiedTables = (allMesas ?? []).filter(m => m.status === 'ocupada').length

    const allItems = (pedidoItens ?? []) as any[]
    const todayItems = allItems.filter(i => i.pedidos?.created_at && new Date(i.pedidos.created_at) >= today)
    const roshSold = todayItems.filter(i => i.is_rosh).reduce((s: number, i: any) => s + i.quantidade, 0)
    const ordersToday = new Set(todayItems.map(i => i.pedidos?.created_at)).size

    const productTotals: Record<string, number> = {}
    for (const i of todayItems) productTotals[i.nome_produto] = (productTotals[i.nome_produto] ?? 0) + i.quantidade
    const topProducts = Object.entries(productTotals).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([product_name, total]) => ({ product_name, total }))

    const pendingOrders = (activePedidos ?? []).filter(p => p.status === 'pendente').length
    const preparingOrders = (activePedidos ?? []).filter(p => p.status === 'preparo').length

    const urgentPedidos = (activePedidos ?? []).filter(p => {
      const mins = (now - new Date(p.created_at).getTime()) / 60000
      return (p.status === 'pendente' && mins > 10) || (p.status === 'preparo' && mins > 20)
    }).map(p => ({
      id: p.id,
      mesa: (p as any).comandas?.mesas?.numero,
      minutesOld: Math.floor((now - new Date(p.created_at).getTime()) / 60000),
      status: p.status,
    }))

    const totalToReceive = (openComandas ?? []).reduce((s, c) => s + Math.max(0, c.total - c.total_pago), 0)

    const longOpenMesas = (openComandas ?? [])
      .filter(c => (now - new Date(c.aberta_em).getTime()) / 3600000 > 2)
      .map(c => ({
        numero: (c as any).mesas?.numero ?? '?',
        hoursOpen: (now - new Date(c.aberta_em).getTime()) / 3600000,
        balance: c.total - c.total_pago,
      }))

    const avgTicket = (closedComandas ?? []).length > 0
      ? (closedComandas ?? []).reduce((s, c) => s + Number(c.total), 0) / (closedComandas ?? []).length
      : 0

    // Financial intelligence
    let lucroHoje = 0
    const profitByProduct: Record<string, number> = {}
    const profitByCategory: Record<string, number> = {}
    const marginSamples: number[] = []

    for (const i of todayItems) {
      const item = i as any
      const costPrice = (item.products?.avg_cost ?? 0) > 0 ? (item.products?.avg_cost ?? 0) : (item.products?.cost_price ?? 0)
      const preco = item.preco_unitario ?? 0
      const qty = item.quantidade ?? 0
      const profit = (preco - costPrice) * qty
      lucroHoje += profit
      if (preco > 0) marginSamples.push(((preco - costPrice) / preco) * 100)
      profitByProduct[item.nome_produto] = (profitByProduct[item.nome_produto] ?? 0) + profit
      const catNome = item.products?.categorias?.nome ?? 'Sem categoria'
      profitByCategory[catNome] = (profitByCategory[catNome] ?? 0) + profit
    }

    const margemMedia = marginSamples.length > 0
      ? marginSamples.reduce((s, m) => s + m, 0) / marginSamples.length
      : 0
    const topProfitProduct = Object.entries(profitByProduct).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    const topProfitCategory = Object.entries(profitByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    setStats({
      revenue, totalToReceive, occupiedTables, totalMesas: allMesas?.length ?? 0,
      roshSold, ordersToday, pendingOrders, preparingOrders, avgTicket,
      lowStock: lowStock ?? [], topProducts, urgentPedidos, longOpenMesas,
      catCount: catCount ?? 0, prodCount: prodCount ?? 0, mesaCount: allMesas?.length ?? 0,
      lucroHoje, margemMedia, topProfitProduct, topProfitCategory,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    loadStats()
    const sub = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, loadStats)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [loadStats])

  if (loading) return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Dashboard</h1>
      </div>
      <div className="p-4 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )

  const needsSetup = stats!.catCount === 0 || stats!.prodCount === 0 || stats!.mesaCount === 0
  const hasAlerts = stats!.urgentPedidos.length > 0 || stats!.longOpenMesas.length > 0 || stats!.lowStock.length > 0

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="px-4 md:px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Dashboard</h1>
        <p className="text-[12px] mt-0.5 capitalize flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          <span className="inline-block w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--green)' }} />
          ao vivo
        </p>
      </div>

      <div className="p-4 md:p-8 space-y-4">

        {/* Onboarding — primeiros passos */}
        {needsSetup && (
          <div className="rounded-2xl p-4"
            style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Flame size={14} style={{ color: 'var(--amber)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--amber)' }}>Primeiros Passos</span>
              <span className="ml-auto text-[10px] font-semibold" style={{ color: 'var(--amber)' }}>
                {[stats!.catCount > 0, stats!.prodCount > 0, stats!.mesaCount > 0].filter(Boolean).length}/3 concluídos
              </span>
            </div>
            <div className="space-y-2.5">
              {[
                { done: stats!.catCount > 0,  label: 'Criar categorias',   path: '/config',   hint: 'Aba Categorias em Configurações' },
                { done: stats!.prodCount > 0,  label: 'Cadastrar produtos', path: '/produtos', hint: 'Aba Produtos' },
                { done: stats!.mesaCount > 0,  label: 'Cadastrar mesas',    path: '/config',   hint: 'Aba Mesas em Configurações' },
              ].map(({ done, label, path, hint }) => (
                <button key={label} onClick={() => navigate(path)}
                  className="w-full flex items-center gap-3 text-left py-1"
                  style={{ opacity: done ? 0.5 : 1 }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: done ? 'var(--green-bg)' : 'transparent',
                      border: `1.5px solid ${done ? 'var(--green)' : 'var(--border-strong)'}`,
                    }}>
                    {done && <CheckCircle size={11} style={{ color: 'var(--green)' }} />}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium" style={{
                      color: 'var(--text-primary)',
                      textDecoration: done ? 'line-through' : 'none',
                    }}>{label}</span>
                    {!done && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
                  </div>
                  {!done && <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hero: Faturamento + A Receber */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-raised) 100%)',
              border: '1px solid var(--border-default)',
            }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
              style={{ background: 'linear-gradient(90deg, var(--gold) 0%, transparent 100%)' }} />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}>
                <TrendingUp size={13} style={{ color: 'var(--gold)' }} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Faturamento Hoje
              </span>
            </div>
            <p className="font-mono font-bold leading-none mt-3"
              style={{ fontSize: 'clamp(28px, 6vw, 48px)', color: 'var(--gold)', letterSpacing: '-0.02em' }}>
              {fmt(stats!.revenue)}
            </p>
            {stats!.avgTicket > 0 && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                ticket médio: {fmt(stats!.avgTicket)}
              </p>
            )}
          </div>

          <div className="rounded-2xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: stats!.totalToReceive > 0 ? 'var(--amber-bg)' : 'var(--green-bg)', border: `1px solid ${stats!.totalToReceive > 0 ? 'var(--amber-border)' : 'var(--green-border)'}` }}>
                <DollarSign size={13} style={{ color: stats!.totalToReceive > 0 ? 'var(--amber)' : 'var(--green)' }} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                A Receber
              </span>
            </div>
            <p className="font-mono font-bold leading-none mt-3"
              style={{ fontSize: 'clamp(28px, 6vw, 48px)', color: stats!.totalToReceive > 0 ? 'var(--text-primary)' : 'var(--green)', letterSpacing: '-0.02em' }}>
              {fmt(stats!.totalToReceive)}
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>em comandas abertas</p>
          </div>
        </div>

        {/* KPI grid — 6 cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'Mesas',        value: `${stats!.occupiedTables}/${stats!.totalMesas}`, icon: LayoutGrid,    color: 'var(--text-primary)' },
            { label: 'Pendentes',    value: String(stats!.pendingOrders),  icon: Clock,          color: stats!.pendingOrders > 0 ? 'var(--amber)' : 'var(--text-primary)' },
            { label: 'Em Preparo',   value: String(stats!.preparingOrders), icon: Flame,         color: stats!.preparingOrders > 0 ? 'var(--blue)' : 'var(--text-primary)' },
            { label: 'Rosh Hoje',    value: String(stats!.roshSold),        icon: Wind,          color: 'var(--text-primary)' },
            { label: 'Pedidos',      value: String(stats!.ordersToday),     icon: ClipboardList, color: 'var(--text-primary)' },
            { label: 'Ticket Médio', value: stats!.avgTicket > 0 ? fmt(stats!.avgTicket) : '—', icon: TrendingUp, color: 'var(--text-primary)' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl p-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <kpi.icon size={12} className="mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="stat-number text-xl leading-none font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Alertas operacionais */}
        {hasAlerts && (
          <div className="space-y-2">

            {stats!.urgentPedidos.length > 0 && (
              <button className="w-full text-left rounded-xl p-4 transition" onClick={() => navigate('/pedidos')}
                style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} style={{ color: 'var(--red)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--red)' }}>
                    {stats!.urgentPedidos.length} pedido(s) urgente(s) — clique para ver
                  </span>
                  <ChevronRight size={13} className="ml-auto" style={{ color: 'var(--red)' }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats!.urgentPedidos.slice(0, 6).map(p => (
                    <span key={p.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.1)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
                      #{p.id} Mesa {p.mesa ?? '?'} · {p.minutesOld}min
                    </span>
                  ))}
                </div>
              </button>
            )}

            {stats!.longOpenMesas.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={13} style={{ color: 'var(--amber)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--amber)' }}>
                    Mesas abertas há mais de 2h
                  </span>
                </div>
                <div className="space-y-1.5">
                  {stats!.longOpenMesas.map(m => (
                    <div key={m.numero} className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Mesa {m.numero}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono" style={{ color: 'var(--amber)' }}>
                          {m.hoursOpen.toFixed(1)}h aberta
                        </span>
                        {m.balance > 0.01 && (
                          <span className="badge badge-yellow">{fmt(m.balance)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats!.lowStock.length > 0 && (
              <button className="w-full text-left rounded-xl p-4" onClick={() => navigate('/estoque')}
                style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} style={{ color: 'var(--amber)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--amber)' }}>Estoque Crítico</span>
                  <ChevronRight size={13} className="ml-auto" style={{ color: 'var(--amber)' }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats!.lowStock.map(p => (
                    <span key={p.nome} className="badge badge-yellow">{p.nome}: {p.stock_quantity} un</span>
                  ))}
                </div>
              </button>
            )}
          </div>
        )}

        {/* Financial intelligence */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Lucro Hoje',      value: fmt(stats!.lucroHoje),           color: stats!.lucroHoje >= 0 ? 'var(--green)' : 'var(--red)' },
            { label: 'Margem Média',    value: `${stats!.margemMedia.toFixed(0)}%`, color: stats!.margemMedia >= 30 ? 'var(--green)' : stats!.margemMedia >= 10 ? 'var(--amber)' : 'var(--red)' },
            { label: 'Mais Lucrativo',  value: stats!.topProfitProduct,         color: 'var(--gold)' },
            { label: 'Cat. Lucrativa',  value: stats!.topProfitCategory,        color: 'var(--text-primary)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <p className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="font-mono font-bold text-sm truncate" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

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
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{p.product_name}</span>
                  <span className="font-mono text-sm font-bold" style={{ color: 'var(--gold)' }}>{p.total}×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
