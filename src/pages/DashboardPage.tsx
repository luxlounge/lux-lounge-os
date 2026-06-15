import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrendingUp, TrendingDown, LayoutGrid, AlertTriangle, Star,
  Clock, DollarSign, CheckCircle, ChevronRight, Flame, Users,
  Tag, ShoppingBag,
} from 'lucide-react'
import { SkeletonCard } from '../components/ui/Skeleton'
import { PageHelp } from '../components/ui/PageHelp'
import {
  format, subDays, startOfMonth, endOfMonth, subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'hoje' | '7d' | '15d' | 'mes_atual' | 'mes_anterior'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'hoje',         label: 'Hoje' },
  { key: '7d',           label: '7 dias' },
  { key: '15d',          label: '15 dias' },
  { key: 'mes_atual',    label: 'Mês Atual' },
  { key: 'mes_anterior', label: 'Mês Anterior' },
]

interface Stats {
  revenue:             number
  prevRevenue:         number
  lucro:               number
  ticketMedio:         number
  comandasCount:       number
  clientesAtendidos:   number
  novosClientes:       number
  clientesRecorrentes: number
  roshSold:            number
  topProducts:         Array<{ nome: string; revenue: number }>
  topCategories:       Array<{ nome: string; revenue: number }>
  chartData:           Array<{ label: string; value: number }>
  totalToReceive:      number
  occupiedTables:      number
  totalMesas:          number
  pendingOrders:       number
  preparingOrders:     number
  urgentPedidos:       Array<{ id: number; mesa?: number; minutesOld: number; status: string }>
  longOpenMesas:       Array<{ numero: number; hoursOpen: number; balance: number }>
  lowStock:            Array<{ nome: string; stock_quantity: number }>
  crmTotal:            number
  crmVip:              number
  crmFrequente:        number
  crmNovo:             number
  crmInativo:          number
  catCount:            number
  prodCount:           number
  mesaCount:           number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',')}`
}
function fmtShort(n: number) {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace('.', ',')}k`
  return `R$ ${Number(n).toFixed(0)}`
}
function pct(current: number, prev: number) {
  if (prev <= 0) return null
  return ((current - prev) / prev) * 100
}

function getPeriodRange(period: Period) {
  const now = new Date()
  let start: Date, end: Date, prevStart: Date, prevEnd: Date

  switch (period) {
    case '7d':
      start     = subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 6)
      end       = now
      prevStart = subDays(start, 7)
      prevEnd   = new Date(start)
      break
    case '15d':
      start     = subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 14)
      end       = now
      prevStart = subDays(start, 15)
      prevEnd   = new Date(start)
      break
    case 'mes_atual':
      start     = startOfMonth(now)
      end       = now
      prevStart = startOfMonth(subMonths(now, 1))
      prevEnd   = new Date(start)
      break
    case 'mes_anterior':
      start     = startOfMonth(subMonths(now, 1))
      end       = endOfMonth(subMonths(now, 1))
      prevStart = startOfMonth(subMonths(now, 2))
      prevEnd   = new Date(start)
      break
    default: // hoje
      start     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end       = now
      prevStart = subDays(start, 1)
      prevEnd   = new Date(start)
  }

  return { start, end, prevStart, prevEnd }
}

function buildChartData(
  payments: { valor: number; created_at: string }[],
  period: Period,
  start: Date,
  end: Date
): { label: string; value: number }[] {
  if (period === 'hoje') {
    const byHour: number[] = Array(24).fill(0)
    for (const p of payments) byHour[new Date(p.created_at).getHours()] += Number(p.valor)
    const maxHour = new Date().getHours()
    return Array.from({ length: maxHour + 1 }, (_, h) => ({
      label: `${String(h).padStart(2, '0')}h`,
      value: byHour[h],
    }))
  }
  const byDate: Record<string, number> = {}
  const cur = new Date(start)
  while (cur <= end) {
    byDate[cur.toISOString().slice(0, 10)] = 0
    cur.setDate(cur.getDate() + 1)
  }
  for (const p of payments) {
    const key = p.created_at.slice(0, 10)
    if (key in byDate) byDate[key] += Number(p.valor)
  }
  const dayFmt = period === '7d' || period === '15d' ? 'dd/MM' : 'dd'
  return Object.entries(byDate).map(([date, value]) => ({
    label: format(new Date(`${date}T12:00:00`), dayFmt, { locale: ptBR }),
    value,
  }))
}

// ─── Bar chart (CSS/div) ──────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const step = Math.ceil(data.length / 8)
  const showLabel = (i: number) =>
    data.length <= 10 || i === 0 || i === data.length - 1 || i % step === 0

  return (
    <div className="flex items-end gap-px" style={{ height: '88px' }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ minWidth: 0 }}>
          <div style={{
            width: '100%',
            height: `${Math.max((d.value / max) * 64, d.value > 0 ? 2 : 0)}px`,
            background: d.value > 0 ? 'var(--gold)' : 'var(--border-subtle)',
            borderRadius: '2px 2px 0 0',
            transition: 'height 0.4s ease',
            opacity: d.value > 0 ? 1 : 0.4,
          }} />
          {showLabel(i) && (
            <span style={{
              fontSize: '8px', color: 'var(--text-muted)', marginTop: '3px',
              overflow: 'hidden', maxWidth: '100%', textAlign: 'center',
            }}>
              {d.label}
            </span>
          )}
          {!showLabel(i) && <span style={{ height: '11px', display: 'block' }} />}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate              = useNavigate()
  const [period, setPeriod]   = useState<Period>('hoje')
  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const rtDebounceRef         = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const loadStats = useCallback(async () => {
    setLoading(true)
    const { start, end, prevStart, prevEnd } = getPeriodRange(period)
    const now = Date.now()

    const [
      { data: payments },
      { data: prevPayments },
      { data: closedComandas },
      { count: novosClientesCount },  // count-only: sem trazer rows
      { count: recurrentesCount },    // count-only: sem trazer rows
      { data: pedidoItens },
      { data: allMesas },
      { data: activePedidos },
      { data: openComandas },
      { data: lowStock },
     { count: catCount },
{ count: prodCount },
{ data: crmCountsRaw },
    ] = await Promise.all([
      supabase.from('pagamentos').select('valor, created_at')
        .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
      supabase.from('pagamentos').select('valor')
        .gte('created_at', prevStart.toISOString()).lte('created_at', prevEnd.toISOString()),
      supabase.from('comandas').select('id, total, cliente_id')
        .eq('status', 'fechada')
        .gte('fechada_em', start.toISOString()).lte('fechada_em', end.toISOString()),
      // count-only: evita trazer rows desnecessários
      supabase.from('clientes').select('id', { count: 'exact', head: true })
        .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
      supabase.from('clientes').select('id', { count: 'exact', head: true }).gte('total_visits', 2),
      supabase.from('pedido_itens')
        .select('nome_produto, quantidade, preco_unitario, total_item, is_rosh, products(cost_price, avg_cost, categoria_id, categorias(nome)), pedidos!inner(created_at)')
        .gte('pedidos.created_at', start.toISOString()).lte('pedidos.created_at', end.toISOString()),
      supabase.from('mesas').select('status'),
      supabase.from('pedidos')
        .select('id, status, created_at, comandas(mesa_id, mesas(numero))')
        .in('status', ['pendente', 'preparo']),
      supabase.from('comandas').select('id, total, total_pago, aberta_em, mesas(numero)')
        .eq('status', 'aberta'),
      supabase.from('products').select('nome, stock_quantity')
        .eq('active', true).lt('stock_quantity', 5).order('stock_quantity'),
      supabase.from('categorias').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id',  { count: 'exact', head: true }).eq('active', true),
      // RPC: agrega CRM no banco — substitui query unbounded de todos os clientes
      // e lê crm_config internamente. Elimina 2 queries, reduz payload de N rows → 5 números.
     Promise.resolve({
  data: {
    total: 0,
    vip: 0,
    frequente: 0,
    novo: 0,
    inativo: 0,
  },
}),
    ])

    // Revenue
    const revenue     = (payments     ?? []).reduce((s, p) => s + Number(p.valor), 0)
    const prevRevenue = (prevPayments ?? []).reduce((s, p) => s + Number(p.valor), 0)

    // Comandas metrics
    const comandasCount     = (closedComandas ?? []).length
    const ticketMedio       = comandasCount > 0
      ? (closedComandas ?? []).reduce((s, c) => s + Number(c.total), 0) / comandasCount : 0
    const uniqueClients     = new Set(
      (closedComandas ?? []).filter(c => c.cliente_id !== null).map(c => c.cliente_id)
    ).size
    const clientesAtendidos = uniqueClients > 0 ? uniqueClients : comandasCount

    // Client metrics (from count-only queries)
    const novosClientes        = novosClientesCount  ?? 0
    const clientesRecorrentes  = recurrentesCount    ?? 0

    // Items analysis
    const items = (pedidoItens ?? []) as any[]
    const productRev:  Record<string, number> = {}
    const categoryRev: Record<string, number> = {}
    let lucro    = 0
    let roshSold = 0

    for (const i of items) {
      const rev  = Number(i.total_item ?? 0)
      const cost = Number(i.products?.avg_cost) > 0
        ? Number(i.products.avg_cost) : Number(i.products?.cost_price ?? 0)
      lucro    += (Number(i.preco_unitario) - cost) * Number(i.quantidade)
      if (i.is_rosh) roshSold += Number(i.quantidade)
      productRev[i.nome_produto] = (productRev[i.nome_produto] ?? 0) + rev
      const cat = i.products?.categorias?.nome ?? 'Sem categoria'
      categoryRev[cat] = (categoryRev[cat] ?? 0) + rev
    }

    const topProducts   = Object.entries(productRev)
      .sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([nome, revenue]) => ({ nome, revenue }))
    const topCategories = Object.entries(categoryRev)
      .sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([nome, revenue]) => ({ nome, revenue }))

    // Real-time metrics
    const occupiedTables  = (allMesas ?? []).filter(m => m.status === 'ocupada').length
    const pendingOrders   = (activePedidos ?? []).filter(p => p.status === 'pendente').length
    const preparingOrders = (activePedidos ?? []).filter(p => p.status === 'preparo').length
    const totalToReceive  = (openComandas ?? []).reduce((s, c) => s + Math.max(0, c.total - c.total_pago), 0)

    const urgentPedidos = (activePedidos ?? []).filter(p => {
      const mins = (now - new Date(p.created_at).getTime()) / 60000
      return (p.status === 'pendente' && mins > 10) || (p.status === 'preparo' && mins > 20)
    }).map(p => ({
      id: p.id,
      mesa: (p as any).comandas?.mesas?.numero,
      minutesOld: Math.floor((now - new Date(p.created_at).getTime()) / 60000),
      status: p.status,
    }))

    const longOpenMesas = (openComandas ?? [])
      .filter(c => (now - new Date(c.aberta_em).getTime()) / 3600000 > 4)
      .map(c => ({
        numero:    (c as any).mesas?.numero ?? '?',
        hoursOpen: (now - new Date(c.aberta_em).getTime()) / 3600000,
        balance:   c.total - c.total_pago,
      }))

    // Chart
    const chartData = buildChartData(payments ?? [], period, start, end)

    // CRM — valores calculados no banco via fn_crm_counts(), não no browser
    const crm = (crmCountsRaw as any) ?? {}
    const crmTotal     = Number(crm.total     ?? 0)
    const crmVip       = Number(crm.vip       ?? 0)
    const crmFrequente = Number(crm.frequente ?? 0)
    const crmNovo      = Number(crm.novo      ?? 0)
    const crmInativo   = Number(crm.inativo   ?? 0)

    setStats({
      revenue, prevRevenue, lucro, ticketMedio,
      comandasCount, clientesAtendidos, novosClientes, clientesRecorrentes, roshSold,
      topProducts, topCategories, chartData,
      totalToReceive, occupiedTables, totalMesas: allMesas?.length ?? 0,
      pendingOrders, preparingOrders, urgentPedidos, longOpenMesas, lowStock: lowStock ?? [],
      crmTotal, crmVip, crmFrequente, crmNovo, crmInativo,
      catCount: catCount ?? 0, prodCount: prodCount ?? 0, mesaCount: allMesas?.length ?? 0,
    })
    setLoading(false)
  }, [period])

  useEffect(() => { loadStats() }, [loadStats])

  useEffect(() => {
    // Debounce: múltiplos eventos realtime rápidos (ex: batch de pagamentos)
    // disparam uma única recarga, não N × 12 queries simultâneas.
    function debouncedLoad() {
      clearTimeout(rtDebounceRef.current)
      rtDebounceRef.current = setTimeout(loadStats, 350)
    }
    const sub = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' },     debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' },   debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos'}, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' },  debouncedLoad)
      .subscribe()
    return () => {
      clearTimeout(rtDebounceRef.current)
      sub.unsubscribe()
    }
  }, [loadStats])

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading && !stats) return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Dashboard</h1>
      </div>
      <div className="p-4 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )

  const s          = stats!
  const needsSetup = s.catCount === 0 || s.prodCount === 0 || s.mesaCount === 0
  const hasAlerts  = s.urgentPedidos.length > 0 || s.longOpenMesas.length > 0
  const revPct     = pct(s.revenue, s.prevRevenue)

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* ── Header + period selector ──────────────────────────────────────── */}
      <div className="sticky top-0 z-10 px-4 md:px-8 pt-6 pb-4"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
            <h1 className="page-header">Dashboard</h1>
            <PageHelp title="Dashboard" lines={[
              'Selecione o período no topo para ver os dados de hoje, últimos 7 ou 15 dias, mês atual ou anterior.',
              'Faturamento mostra o total recebido. O % compara com o período anterior.',
              'Lucro estimado depende do custo médio dos produtos (atualizado via compras no Estoque).',
              'O sino no topo avisa sobre situações urgentes: mesas há mais de 4h abertas, pedidos sem resposta e estoque crítico.',
            ]} />
          </div>
            <p className="text-[12px] mt-0.5 capitalize flex items-center gap-1.5"
              style={{ color: 'var(--text-muted)' }}>
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              <span className="inline-block w-1.5 h-1.5 rounded-full pulse-dot"
                style={{ background: loading ? 'var(--amber)' : 'var(--green)' }} />
              {loading ? 'atualizando' : 'ao vivo'}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {PERIODS.map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
              style={period === key
                ? { background: 'var(--gold)', color: '#000' }
                : { background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }
              }>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-4">

        {/* ── Real-time strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {([
            { label: 'Mesas',      value: `${s.occupiedTables}/${s.totalMesas}`, icon: LayoutGrid, color: 'var(--text-primary)' },
            { label: 'Pendentes',  value: String(s.pendingOrders),               icon: Clock,      color: s.pendingOrders  > 0 ? 'var(--amber)' : 'var(--text-primary)' },
            { label: 'Preparo',    value: String(s.preparingOrders),             icon: Flame,      color: s.preparingOrders > 0 ? 'var(--blue)'  : 'var(--text-primary)' },
            { label: 'A Receber',  value: s.totalToReceive > 0 ? fmtShort(s.totalToReceive) : '—', icon: DollarSign, color: s.totalToReceive > 0 ? 'var(--gold)' : 'var(--text-primary)' },
          ] as const).map(kpi => (
            <div key={kpi.label} className="rounded-xl p-3 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <kpi.icon size={12} className="mx-auto mb-1.5" style={{ color: 'var(--text-muted)' }} />
              <p className="font-mono font-bold text-base leading-none" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
              <p className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {kpi.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Hero: Faturamento + Lucro ─────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-raised) 100%)', border: '1px solid var(--border-default)' }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
              style={{ background: 'linear-gradient(90deg, var(--gold) 0%, transparent 100%)' }} />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}>
                <TrendingUp size={13} style={{ color: 'var(--gold)' }} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Faturamento
              </span>
              {revPct !== null && (
                <span className="ml-auto flex items-center gap-0.5 text-xs font-bold"
                  style={{ color: revPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {revPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {Math.abs(revPct).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="font-mono font-bold leading-none mt-3"
              style={{ fontSize: 'clamp(26px, 5vw, 40px)', color: 'var(--gold)', letterSpacing: '-0.02em' }}>
              {fmt(s.revenue)}
            </p>
            {s.prevRevenue > 0 && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                anterior: {fmt(s.prevRevenue)}
              </p>
            )}
          </div>

          <div className="rounded-2xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: s.lucro >= 0 ? 'var(--green-bg)' : 'var(--red-bg)', border: `1px solid ${s.lucro >= 0 ? 'var(--green-border)' : 'var(--red-border)'}` }}>
                <DollarSign size={13} style={{ color: s.lucro >= 0 ? 'var(--green)' : 'var(--red)' }} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Lucro Estimado
              </span>
            </div>
            <p className="font-mono font-bold leading-none mt-3"
              style={{ fontSize: 'clamp(26px, 5vw, 40px)', color: s.lucro >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '-0.02em' }}>
              {fmt(s.lucro)}
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              receita − avg_cost × quantidade
            </p>
          </div>
        </div>

        {/* ── KPIs período ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'Ticket Médio',   value: s.ticketMedio > 0 ? fmtShort(s.ticketMedio) : '—', color: 'var(--text-primary)' },
            { label: 'Atendimentos',   value: String(s.comandasCount),                            color: 'var(--text-primary)' },
            { label: 'Cli. Atendidos', value: String(s.clientesAtendidos),                        color: 'var(--blue)' },
            { label: 'Novos Clientes', value: String(s.novosClientes),                            color: 'var(--green)' },
            { label: 'Recorrentes',    value: String(s.clientesRecorrentes),                      color: 'var(--gold)' },
            { label: 'Rosh Vendidos',  value: String(s.roshSold),                                 color: 'var(--text-primary)' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl p-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <p className="font-mono font-bold text-xl leading-none" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
              <p className="text-[9px] mt-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {kpi.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Gráfico ───────────────────────────────────────────────────────── */}
        {s.chartData.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={13} style={{ color: 'var(--gold)' }} />
              <span className="section-header">
                Faturamento por {period === 'hoje' ? 'hora' : 'dia'}
              </span>
              <span className="ml-auto font-mono text-xs font-bold" style={{ color: 'var(--gold)' }}>
                {fmt(s.revenue)}
              </span>
            </div>
            <BarChart data={s.chartData} />
          </div>
        )}

        {/* ── Alertas operacionais ──────────────────────────────────────────── */}
        {hasAlerts && (
          <div className="space-y-2">
            {s.urgentPedidos.length > 0 && (
              <button className="w-full text-left rounded-xl p-4 transition"
                onClick={() => navigate('/pedidos')}
                style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} style={{ color: 'var(--red)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--red)' }}>
                    {s.urgentPedidos.length} pedido(s) urgente(s)
                  </span>
                  <ChevronRight size={13} className="ml-auto" style={{ color: 'var(--red)' }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.urgentPedidos.slice(0, 6).map(p => (
                    <span key={p.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.1)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
                      #{p.id} Mesa {p.mesa ?? '?'} · {p.minutesOld}min
                    </span>
                  ))}
                </div>
              </button>
            )}

            {s.longOpenMesas.length > 0 && (
              <div className="rounded-xl p-4"
                style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={13} style={{ color: 'var(--amber)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--amber)' }}>
                    Mesas abertas há mais de 4h
                  </span>
                </div>
                <div className="space-y-1.5">
                  {s.longOpenMesas.map(m => (
                    <div key={m.numero} className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        Mesa {m.numero}
                      </span>
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
          </div>
        )}

        {/* ── Top Produtos + Categorias ─────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-3">
          {s.topProducts.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag size={13} style={{ color: 'var(--gold)' }} />
                <span className="section-header">Top Produtos</span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>por receita</span>
              </div>
              <div className="space-y-3">
                {s.topProducts.map((p, i) => {
                  const maxRev = s.topProducts[0]?.revenue ?? 1
                  return (
                    <div key={p.nome}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{ background: i === 0 ? 'var(--gold-bg)' : 'var(--bg-raised)', color: i === 0 ? 'var(--gold)' : 'var(--text-muted)', border: `1px solid ${i === 0 ? 'var(--gold-border)' : 'var(--border-subtle)'}` }}>
                          {i + 1}
                        </span>
                        <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                          {p.nome}
                        </span>
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--gold)' }}>
                          {fmtShort(p.revenue)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(p.revenue / maxRev) * 100}%`, background: 'var(--gold)', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {s.topCategories.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={13} style={{ color: 'var(--blue)' }} />
                <span className="section-header">Top Categorias</span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>por receita</span>
              </div>
              <div className="space-y-3">
                {s.topCategories.map((c, i) => {
                  const maxRev = s.topCategories[0]?.revenue ?? 1
                  return (
                    <div key={c.nome}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{ background: i === 0 ? 'var(--blue-bg)' : 'var(--bg-raised)', color: i === 0 ? 'var(--blue)' : 'var(--text-muted)', border: `1px solid ${i === 0 ? 'var(--blue-border)' : 'var(--border-subtle)'}` }}>
                          {i + 1}
                        </span>
                        <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                          {c.nome}
                        </span>
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--blue)' }}>
                          {fmtShort(c.revenue)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(c.revenue / maxRev) * 100}%`, background: 'var(--blue)', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Estoque Crítico ───────────────────────────────────────────────── */}
        {s.lowStock.length > 0 && (
          <button className="w-full text-left rounded-xl p-4 transition"
            onClick={() => navigate('/estoque')}
            style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} style={{ color: 'var(--amber)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--amber)' }}>Estoque Crítico</span>
              <ChevronRight size={13} className="ml-auto" style={{ color: 'var(--amber)' }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {s.lowStock.map(p => (
                <div key={p.nome} className="rounded-lg px-2 py-1.5"
                  style={{
                    background: p.stock_quantity <= 0 ? 'var(--red-bg)' : 'rgba(0,0,0,0.06)',
                    border: `1px solid ${p.stock_quantity <= 0 ? 'var(--red-border)' : 'var(--amber-border)'}`,
                  }}>
                  <p className="text-[11px] font-semibold truncate"
                    style={{ color: p.stock_quantity <= 0 ? 'var(--red)' : 'var(--amber)' }}>
                    {p.nome}
                  </p>
                  <p className="text-[10px] font-mono mt-0.5"
                    style={{ color: p.stock_quantity <= 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                    {p.stock_quantity <= 0 ? 'ZERADO' : `${p.stock_quantity} un`}
                  </p>
                </div>
              ))}
            </div>
          </button>
        )}

        {/* ── CRM Summary ───────────────────────────────────────────────────── */}
        {s.crmTotal > 0 && (
          <button className="w-full text-left card" onClick={() => navigate('/clientes')}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue-border)' }}>
                <Users size={13} style={{ color: 'var(--blue)' }} />
              </div>
              <span className="section-header">Clientes CRM</span>
              <span className="ml-auto text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                {s.crmTotal} cadastrados
              </span>
              <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'VIP',       value: s.crmVip,       color: 'var(--gold)' },
                { label: 'Frequente', value: s.crmFrequente, color: 'var(--green)' },
                { label: 'Novos',     value: s.crmNovo,      color: 'var(--blue)' },
                { label: 'Inativos',  value: s.crmInativo,   color: 'var(--text-muted)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-2.5 text-center"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                  <p className="font-mono font-bold text-lg leading-none" style={{ color }}>{value}</p>
                  <p className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </button>
        )}

        {/* ── Onboarding ────────────────────────────────────────────────────── */}
        {needsSetup && (
          <div className="rounded-2xl p-4"
            style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Flame size={14} style={{ color: 'var(--amber)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--amber)' }}>Primeiros Passos</span>
              <span className="ml-auto text-[10px] font-semibold" style={{ color: 'var(--amber)' }}>
                {[s.catCount > 0, s.prodCount > 0, s.mesaCount > 0].filter(Boolean).length}/3
              </span>
            </div>
            <div className="space-y-2.5">
              {[
                { done: s.catCount  > 0, label: 'Criar categorias',   path: '/config',   hint: 'Aba Categorias em Configurações' },
                { done: s.prodCount > 0, label: 'Cadastrar produtos',  path: '/produtos', hint: '' },
                { done: s.mesaCount > 0, label: 'Cadastrar mesas',     path: '/config',   hint: 'Aba Mesas em Configurações' },
              ].map(({ done, label, path, hint }) => (
                <button key={label} onClick={() => navigate(path)}
                  className="w-full flex items-center gap-3 text-left py-1"
                  style={{ opacity: done ? 0.5 : 1 }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: done ? 'var(--green-bg)' : 'transparent', border: `1.5px solid ${done ? 'var(--green)' : 'var(--border-strong)'}` }}>
                    {done && <CheckCircle size={11} style={{ color: 'var(--green)' }} />}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>
                      {label}
                    </span>
                    {!done && hint && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
                  </div>
                  {!done && <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!loading && s.revenue === 0 && s.comandasCount === 0 && !needsSetup && (
          <div className="flex flex-col items-center py-12 text-center">
            <Star size={22} className="mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Sem dados para este período</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Mude o período ou comece um atendimento</p>
          </div>
        )}

      </div>
    </div>
  )
}
