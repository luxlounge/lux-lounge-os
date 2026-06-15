import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Cliente, CrmConfig, Comanda, Mesa } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import {
  Search, X, Star, UserCheck, Clock, Users, ChevronRight,
  Phone, Calendar, TrendingUp, FileText, Shield,
} from 'lucide-react'
import { format } from 'date-fns'
import { PageHelp } from '../components/ui/PageHelp'
import { ptBR } from 'date-fns/locale'

// ─── Tag engine ────────────────────────────────────────────────
const TAG_META: Record<string, { label: string; bg: string; color: string; border: string }> = {
  vip:       { label: '⭐ VIP',      bg: 'var(--gold-bg)',   color: 'var(--gold)',   border: 'var(--gold-border)' },
  frequente: { label: 'Frequente',  bg: 'var(--amber-bg)',  color: 'var(--amber)',  border: 'var(--amber-border)' },
  novo:      { label: 'Novo',       bg: 'var(--blue-bg)',   color: 'var(--blue)',   border: 'var(--blue-border)' },
  inativo:   { label: 'Inativo',    bg: 'var(--red-bg)',    color: 'var(--red)',    border: 'var(--red-border)' },
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

function fmt(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',')}`
}

function TagBadge({ tag }: { tag: string }) {
  const m = TAG_META[tag]
  if (!m) return null
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {m.label}
    </span>
  )
}

// ─── Default config fallback ─────────────────────────────────
const DEFAULT_CONFIG: CrmConfig = {
  id: 1, vip_min_spent: 1500, vip_min_visits: 10,
  frequent_min_visits: 5, inactive_days: 60,
  updated_at: new Date().toISOString(),
}

// ─── Main component ──────────────────────────────────────────
export default function ClientesPage() {
  const { success: toast, error: toastError } = useToast()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [config, setConfig] = useState<CrmConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Drawer
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [drawerCmds, setDrawerCmds] = useState<(Comanda & { mesas?: Mesa })[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingVip, setSavingVip] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const [{ data: cs }, { data: cfg }] = await Promise.all([
      supabase.from('clientes').select('*').order('total_spent', { ascending: false }),
      supabase.from('crm_config').select('*').eq('id', 1).single(),
    ])
    setClientes((cs ?? []) as Cliente[])
    if (cfg) setConfig(cfg as CrmConfig)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function openDrawer(c: Cliente) {
    setSelected(c)
    setNotes(c.notes ?? '')
    setDrawerLoading(true)
    const { data } = await supabase
      .from('comandas')
      .select('id, created_at, total, status, mesas(numero)')
      .eq('cliente_id', c.id)
      .order('created_at', { ascending: false })
    setDrawerCmds((data ?? []) as any[])
    setDrawerLoading(false)
  }

  function closeDrawer() {
    setSelected(null)
    setDrawerCmds([])
    if (notesTimer.current) clearTimeout(notesTimer.current)
  }

  function handleNotesChange(val: string) {
    setNotes(val)
    if (!selected) return
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      await supabase.from('clientes').update({ notes: val || null }).eq('id', selected.id)
      setClientes(prev => prev.map(c => c.id === selected.id ? { ...c, notes: val || null } : c))
    }, 1200)
  }

  async function toggleVip(c: Cliente) {
    setSavingVip(true)
    const next = !c.is_vip_manual
    await supabase.from('clientes').update({ is_vip_manual: next }).eq('id', c.id)
    const updated = { ...c, is_vip_manual: next }
    setClientes(prev => prev.map(x => x.id === c.id ? updated : x))
    setSelected(updated)
    setSavingVip(false)
    toast(next ? '⭐ VIP manual ativado' : 'VIP manual removido')
  }

  // ── Filtros ──────────────────────────────────────────────────
  const searchLow = search.toLowerCase().replace(/\D/g, '') || search.toLowerCase()
  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp.replace(/\D/g, '').includes(search.replace(/\D/g, ''))
  )

  // ── Stat counts ──────────────────────────────────────────────
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

  if (loading) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Clientes</h1>
      </div>
      <div className="flex items-center justify-center h-48"><Spinner size={28} /></div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-5 pb-3"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-header">Clientes</h1>
              <PageHelp title="Clientes (CRM)" lines={[
                'Todos os clientes cadastrados pelo WhatsApp durante o check-in aparecem aqui.',
                'As tags (VIP, Frequente, Novo, Inativo) são calculadas automaticamente com base no histórico de visitas e gasto.',
                'Clique em um cliente para ver o histórico completo, adicionar observações e marcar como VIP manualmente.',
                'Os critérios das tags podem ser ajustados em Configurações > CRM.',
              ]} />
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {clientes.length} cadastrados
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-9 text-sm" placeholder="Buscar por nome ou WhatsApp..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-4">

        {/* CRM stat strip */}
        {!search && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'VIPs',       value: counts.vip,       icon: Star,      color: 'var(--gold)' },
              { label: 'Frequentes', value: counts.frequente,  icon: UserCheck, color: 'var(--amber)' },
              { label: 'Novos',      value: counts.novo,       icon: Users,     color: 'var(--blue)' },
              { label: 'Inativos',   value: counts.inativo,    icon: Clock,     color: 'var(--red)' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl px-4 py-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={11} style={{ color }} />
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <p className="font-mono font-bold text-2xl" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Client list */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users size={28} className="mb-3" style={{ color: 'var(--border-strong)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map(c => {
            const tags = getTags(c, config)
            const ticket = c.total_visits > 0 ? Number(c.total_spent) / c.total_visits : 0
            return (
              <button key={c.id} onClick={() => openDrawer(c)}
                className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {c.nome}
                      </span>
                      {tags.map(t => <TagBadge key={t} tag={t} />)}
                    </div>
                    <p className="text-xs flex items-center gap-1 mb-2" style={{ color: 'var(--text-muted)' }}>
                      <Phone size={9} /> {c.whatsapp}
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Gasto</p>
                        <p className="font-mono font-bold text-sm" style={{ color: 'var(--gold)' }}>{fmt(Number(c.total_spent))}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Visitas</p>
                        <p className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{c.total_visits}×</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ticket médio</p>
                        <p className="font-mono font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>{fmt(ticket)}</p>
                      </div>
                      {c.last_visit && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Última visita</p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {format(new Date(c.last_visit), "dd/MM/yy", { locale: ptBR })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Drawer: perfil do cliente ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={closeDrawer} />
          <div className="relative w-full md:max-w-md h-full overflow-y-auto flex flex-col"
            style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border-default)' }}>

            {/* Drawer header */}
            <div className="sticky top-0 z-10 flex items-start justify-between px-5 py-4"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {selected.nome}
                  </h2>
                  {getTags(selected, config).map(t => <TagBadge key={t} tag={t} />)}
                </div>
                <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  <Phone size={9} /> {selected.whatsapp}
                </p>
              </div>
              <button onClick={closeDrawer}
                className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0 ml-3"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-5">

              {/* Métricas */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Visitas',     value: String(selected.total_visits), icon: UserCheck, color: 'var(--text-primary)' },
                  { label: 'Total gasto', value: fmt(Number(selected.total_spent)), icon: TrendingUp, color: 'var(--gold)' },
                  {
                    label: 'Ticket médio',
                    value: selected.total_visits > 0
                      ? fmt(Number(selected.total_spent) / selected.total_visits)
                      : '—',
                    icon: TrendingUp,
                    color: 'var(--text-secondary)',
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl p-3"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                    <Icon size={10} className="mb-1" style={{ color: 'var(--text-muted)' }} />
                    <p className="font-mono font-bold text-sm truncate" style={{ color }}>{value}</p>
                    <p className="text-[9px] mt-0.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Dados */}
              <div className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                {[
                  { label: 'Cadastro',       value: format(new Date(selected.created_at), "dd/MM/yyyy", { locale: ptBR }), icon: Calendar },
                  { label: 'Última visita',  value: selected.last_visit ? format(new Date(selected.last_visit), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—', icon: Clock },
                ].map(({ label, value, icon: Icon }, i) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <Icon size={12} style={{ color: 'var(--text-muted)' }} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* VIP manual toggle */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: selected.is_vip_manual ? 'var(--gold-bg)' : 'var(--bg-raised)', border: `1px solid ${selected.is_vip_manual ? 'var(--gold-border)' : 'var(--border-subtle)'}` }}>
                <div className="flex items-center gap-2">
                  <Star size={14} style={{ color: selected.is_vip_manual ? 'var(--gold)' : 'var(--text-muted)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: selected.is_vip_manual ? 'var(--gold)' : 'var(--text-primary)' }}>
                      VIP Manual
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Garante badge VIP independente das regras
                    </p>
                  </div>
                </div>
                <button onClick={() => toggleVip(selected)} disabled={savingVip}
                  className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                  style={{ background: selected.is_vip_manual ? 'var(--gold)' : 'var(--border-strong)' }}>
                  {savingVip
                    ? <Spinner size={10} />
                    : <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: selected.is_vip_manual ? '22px' : '2px' }} />
                  }
                </button>
              </div>

              {/* Observações internas — auto-save */}
              <div>
                <label className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}>
                  <FileText size={10} /> Observações internas
                </label>
                <textarea
                  className="input text-sm resize-none"
                  rows={3}
                  placeholder={`Ex: "Prefere Jack Daniels", "Aniversário em setembro"...`}
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  style={{ fontFamily: 'inherit' }}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Salvo automaticamente
                </p>
              </div>

              {/* Histórico de comandas */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                  style={{ color: 'var(--text-muted)' }}>
                  <Shield size={10} /> Histórico de visitas
                </p>
                {drawerLoading ? (
                  <div className="flex justify-center py-6"><Spinner size={20} /></div>
                ) : drawerCmds.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    Nenhuma visita registrada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {drawerCmds.map(cmd => {
                      const mesa = (cmd as any).mesas
                      const isClosed = cmd.status === 'fechada'
                      return (
                        <div key={cmd.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                Mesa {mesa?.numero ?? '?'}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{
                                  background: isClosed ? 'var(--green-bg)' : 'var(--amber-bg)',
                                  color: isClosed ? 'var(--green)' : 'var(--amber)',
                                }}>
                                {isClosed ? 'Fechada' : 'Aberta'}
                              </span>
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {format(new Date(cmd.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-sm shrink-0" style={{ color: 'var(--gold)' }}>
                            {fmt(Number(cmd.total))}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
