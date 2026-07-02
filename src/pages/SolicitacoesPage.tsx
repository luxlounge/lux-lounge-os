import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { MesaSolicitacao, SolicitacaoTipo } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { Bell, Flame, Receipt, CheckCircle, Clock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

// ─── Config por tipo ─────────────────────────────────────────
const TIPO_CONFIG: Record<SolicitacaoTipo, {
  label: string
  icon: typeof Bell
  color: string
  bg: string
  border: string
}> = {
  atendimento: { label: 'Atendimento',   icon: Bell,    color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)' },
  rosh:        { label: 'Troca de Rosh', icon: Flame,   color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
  fechamento:  { label: 'Pedir Conta',   icon: Receipt, color: '#D4AF37', bg: 'rgba(212,175,55,0.08)',  border: 'rgba(212,175,55,0.2)' },
}

const ORDER: SolicitacaoTipo[] = ['fechamento', 'atendimento', 'rosh']

function getMinutes(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function formatElapsed(m: number): string {
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? String(m % 60).padStart(2, '0') : ''}`
}

function urgencyColor(m: number): string {
  if (m < 3) return 'var(--green, #22c55e)'
  if (m < 7) return 'var(--amber, #f59e0b)'
  return 'var(--red, #ef4444)'
}

// ─── Card individual ─────────────────────────────────────────
function SolicitacaoCard({
  s, atendendo, onAtender,
}: {
  s: MesaSolicitacao
  atendendo: number | null
  onAtender: (id: number) => void
}) {
  const cfg = TIPO_CONFIG[s.tipo]
  const Icon = cfg.icon
  const mins = getMinutes(s.created_at)

  return (
    <div className="rounded-2xl p-4 flex items-start gap-3"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
        <Icon size={16} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            Mesa {s.mesa_numero > 0 ? s.mesa_numero : (s.mesas?.numero ?? s.mesa_id)}
          </span>
          <span className="text-[11px] font-mono font-semibold flex items-center gap-1"
            style={{ color: urgencyColor(mins) }}>
            <Clock size={10} />
            {formatElapsed(mins)}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cfg.label}</p>
      </div>
      <button
        onClick={() => onAtender(s.id)}
        disabled={atendendo === s.id}
        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
        {atendendo === s.id ? <Spinner size={12} /> : 'Atender'}
      </button>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────
export default function SolicitacoesPage() {
  const { profile } = useAuth()
  const [solicitacoes, setSolicitacoes] = useState<MesaSolicitacao[]>([])
  const [loading, setLoading]           = useState(true)
  const [atendendo, setAtendendo]       = useState<number | null>(null)
  const [, setTick]                     = useState(0)
  const channelName = useRef(`solicitacoes-${Math.random().toString(36).slice(2)}`).current

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mesa_solicitacoes')
      .select('*, mesas(id, numero)')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
    setSolicitacoes((data ?? []) as MesaSolicitacao[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  // Timer re-render para elapsed time
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  // Realtime
  useEffect(() => {
    const sub = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesa_solicitacoes' }, () => {
        load()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mesa_solicitacoes' }, load)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load, channelName])

  async function atender(id: number) {
    setAtendendo(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('mesa_solicitacoes')
      .update({
        status: 'atendido',
        ...(user?.id ? { atendida_por: user.id } : {}),
        atendida_em: new Date().toISOString(),
      })
      .eq('id', id)
    setAtendendo(null)
    await load()
  }

  // Agrupar por tipo na ordem de prioridade
  const grouped = ORDER.reduce((acc, tipo) => {
    acc[tipo] = solicitacoes.filter(s => s.tipo === tipo)
    return acc
  }, {} as Record<SolicitacaoTipo, MesaSolicitacao[]>)

  const total = solicitacoes.length

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-5 pb-4"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-header">Solicitações</h1>
              {total > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
                  {total}
                </span>
              )}
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Central de solicitações em tempo real
            </p>
          </div>
          {total > 0 && (
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-6">
        {loading && (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        )}

        {!loading && total === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <CheckCircle size={22} style={{ color: 'var(--green)' }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Nenhuma solicitação pendente
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Todas as mesas estão atendidas
            </p>
          </div>
        )}

        {!loading && ORDER.map(tipo => {
          const items = grouped[tipo]
          if (items.length === 0) return null
          const cfg = TIPO_CONFIG[tipo]
          const Icon = cfg.icon
          return (
            <div key={tipo}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  <Icon size={12} style={{ color: cfg.color }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}>
                  {cfg.label}
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map(s => (
                  <SolicitacaoCard
                    key={s.id}
                    s={s}
                    atendendo={atendendo}
                    onAtender={atender}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
