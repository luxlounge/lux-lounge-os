import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Cliente, CrmConfig } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { Star, UserCheck, Users, Clock, TrendingUp, Gift, BarChart2 } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DEFAULT_CONFIG: CrmConfig = {
  id: 1, vip_min_spent: 1500, vip_min_visits: 10,
  frequent_min_visits: 5, inactive_days: 60,
  updated_at: new Date().toISOString(),
}

function fmt(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',')}`
}

function getTags(c: Cliente, cfg: CrmConfig): string[] {
  const now = Date.now()
  const daysSince = (iso: string | null) =>
    iso ? (now - new Date(iso).getTime()) / 86400000 : Infinity
  const isVip = c.is_vip_manual ||
    Number(c.total_spent) >= cfg.vip_min_spent ||
    c.total_visits >= cfg.vip_min_visits
  const isNew = daysSince(c.created_at) < 30
  const isInactive = daysSince(c.last_visit) >= cfg.inactive_days
  const isFrequent = c.total_visits >= cfg.frequent_min_visits
  const tags: string[] = []
  if (isVip) tags.push('vip')
  else if (isFrequent) tags.push('frequente')
  if (isNew) tags.push('novo')
  if (isInactive && !isNew) tags.push('inativo')
  return tags
}

interface MonthStat {
  label: string
  novos: number
  receita: number
}

export default function CrmPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [config, setConfig] = useState<CrmConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [monthStats, setMonthStats] = useState<MonthStat[]>([])

  const load = useCallback(async () => {
    try {
      const [{ data: cs }, { data: cfg }] = await Promise.all([
        supabase.from('clientes').select('*').order('total_spent', { ascending: false }),
        supabase.from('crm_config').select('*').eq('id', 1).single(),
      ])
      const allClientes = (cs ?? []) as Cliente[]
      setClientes(allClientes)
      if (cfg) setConfig(cfg as CrmConfig)

      // Build last-6-months stats from clientes data
      const stats: MonthStat[] = []
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        const start = startOfMonth(d).toISOString()
        const end = endOfMonth(d).toISOString()
        const novos = allClientes.filter(c => c.created_at >= start && c.created_at <= end).length
        stats.push({
          label: format(d, 'MMM', { locale: ptBR }),
          novos,
          receita: 0,
        })
      }

      // Fetch revenue by month from pagamentos
      const sixMonthsAgo = subMonths(new Date(), 5)
      const { data: pagamentos } = await supabase
        .from('pagamentos')
        .select('valor, created_at')
        .gte('created_at', startOfMonth(sixMonthsAgo).toISOString())

      for (const p of pagamentos ?? []) {
        const m = format(new Date(p.created_at), 'MMM', { locale: ptBR })
        const stat = stats.find(s => s.label === m)
        if (stat) stat.receita += Number(p.valor)
      }

      setMonthStats(stats)
    } catch (err) {
      console.error('CrmPage load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const counts = clientes.reduce(
    (acc, c) => {
      const tags = getTags(c, config)
      if (tags.includes('vip'))       acc.vip++
      if (tags.includes('frequente')) acc.frequente++
      if (tags.includes('novo'))      acc.novo++
      if (tags.includes('inativo'))   acc.inativo++
      return acc
    },
    { vip: 0, frequente: 0, novo: 0, inativo: 0 },
  )

  const totalSpent = clientes.reduce((s, c) => s + Number(c.total_spent), 0)
  const avgTicket = clientes.length > 0
    ? clientes.reduce((s, c) => s + (c.total_visits > 0 ? Number(c.total_spent) / c.total_visits : 0), 0) / clientes.length
    : 0

  const aniversariantes = clientes.filter(c => {
    if (!c.birthday) return false
    const today = new Date()
    const bd = new Date(c.birthday + 'T00:00:00')
    return bd.getUTCMonth() === today.getMonth()
  })

  const maxReceita = Math.max(...monthStats.map(s => s.receita), 1)
  const maxNovos = Math.max(...monthStats.map(s => s.novos), 1)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <Spinner size={28} />
    </div>
  )

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <BarChart2 size={18} style={{ color: 'var(--gold)' }} />
          <h1 className="page-header">CRM</h1>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Visão geral de retenção e crescimento
        </p>
      </div>

      <div className="p-4 md:p-8 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total clientes', value: String(clientes.length), icon: Users,      color: 'var(--text-primary)' },
            { label: 'VIPs',           value: String(counts.vip),       icon: Star,       color: 'var(--gold)' },
            { label: 'Frequentes',     value: String(counts.frequente),  icon: UserCheck,  color: 'var(--amber)' },
            { label: 'Inativos',       value: String(counts.inativo),    icon: Clock,      color: 'var(--red)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl px-4 py-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={12} style={{ color }} />
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
              <p className="font-mono font-bold text-3xl" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Revenue KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl px-4 py-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={12} style={{ color: 'var(--green)' }} />
              <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Receita total CRM</p>
            </div>
            <p className="font-mono font-bold text-2xl" style={{ color: 'var(--gold)' }}>{fmt(totalSpent)}</p>
          </div>
          <div className="rounded-2xl px-4 py-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={12} style={{ color: 'var(--amber)' }} />
              <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ticket médio geral</p>
            </div>
            <p className="font-mono font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>{fmt(avgTicket)}</p>
          </div>
        </div>

        {/* Chart: novos clientes por mês */}
        <div className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Novos clientes — últimos 6 meses
          </p>
          <div className="flex items-end gap-2 h-28">
            {monthStats.map(s => (
              <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold" style={{ color: 'var(--gold)' }}>
                  {s.novos > 0 ? s.novos : ''}
                </span>
                <div className="w-full rounded-t-md transition-all"
                  style={{
                    background: 'var(--gold)',
                    height: `${Math.max((s.novos / maxNovos) * 88, s.novos > 0 ? 4 : 0)}px`,
                    opacity: 0.85,
                  }} />
                <span className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart: receita por mês */}
        <div className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Receita por mês — últimos 6 meses
          </p>
          <div className="flex items-end gap-2 h-28">
            {monthStats.map(s => (
              <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold" style={{ color: 'var(--amber)' }}>
                  {s.receita > 0 ? `R$${Math.round(s.receita / 1000)}k` : ''}
                </span>
                <div className="w-full rounded-t-md transition-all"
                  style={{
                    background: 'var(--amber)',
                    height: `${Math.max((s.receita / maxReceita) * 88, s.receita > 0 ? 4 : 0)}px`,
                    opacity: 0.85,
                  }} />
                <span className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Aniversariantes */}
        {aniversariantes.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)' }}>
            <div className="px-4 py-3 flex items-center gap-2"
              style={{ background: 'var(--gold-bg)', borderBottom: '1px solid var(--gold-border)' }}>
              <Gift size={13} style={{ color: 'var(--gold)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>
                Aniversariantes este mês ({aniversariantes.length})
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {aniversariantes.map(c => {
                const bd = new Date(c.birthday! + 'T00:00:00')
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <Gift size={13} style={{ color: 'var(--gold)' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.nome}</span>
                      <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        dia {bd.getUTCDate()}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.whatsapp}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top VIPs */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Top 10 — Maior gasto
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {clientes.slice(0, 10).map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 text-right text-[11px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.nome}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.total_visits} visitas</p>
                </div>
                <span className="font-mono font-bold text-sm shrink-0" style={{ color: 'var(--gold)' }}>
                  {fmt(Number(c.total_spent))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
