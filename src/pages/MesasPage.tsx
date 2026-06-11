import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Mesa, Comanda } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { SkeletonMesa } from '../components/ui/Skeleton'
import { useAuth } from '../hooks/useAuth'
import { X, ChevronRight, Users, CheckCircle, Wrench } from 'lucide-react'

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

function fmt(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',')}`
}

interface MesaComComanda extends Mesa {
  comanda?: Comanda
}

export default function MesasPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [mesas, setMesas] = useState<MesaComComanda[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todas' | 'ocupadas' | 'livres'>('todas')
  const [selected, setSelected] = useState<MesaComComanda | null>(null)
  const [opening, setOpening] = useState(false)

  const load = useCallback(async () => {
    const [{ data: ms }, { data: cs }] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('comandas').select('*').eq('status', 'aberta'),
    ])
    const comandaMap: Record<number, Comanda> = {}
    for (const c of cs ?? []) comandaMap[c.mesa_id] = c
    setMesas((ms ?? []).map(m => ({ ...m, comanda: comandaMap[m.id] })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const sub = supabase.channel('mesas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, load)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load])

  const canOpen = ['admin', 'caixa'].includes(profile?.role ?? '')

  async function openMesa(mesa: Mesa) {
    setOpening(true)
    const { data: comanda } = await supabase
      .from('comandas')
      .insert({ mesa_id: mesa.id, status: 'aberta', aberta_por: profile?.id })
      .select()
      .single()
    await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesa.id)
    setOpening(false)
    setSelected(null)
    navigate(`/comanda/${comanda?.id}`)
  }

  const filtered = mesas.filter(m => {
    if (filter === 'ocupadas') return m.status === 'ocupada'
    if (filter === 'livres') return m.status === 'disponivel'
    return true
  })

  const ocupadas = mesas.filter(m => m.status === 'ocupada').length
  const livres   = mesas.filter(m => m.status === 'disponivel').length

  function mesaClass(m: MesaComComanda) {
    switch (m.status) {
      case 'ocupada':    return 'mesa-card mesa-ocupada'
      case 'reservada':  return 'mesa-card mesa-reservada'
      case 'manutencao': return 'mesa-card mesa-manutencao'
      default:           return 'mesa-card mesa-disponivel'
    }
  }

  function statusInfo(m: MesaComComanda): { label: string; color: string } {
    if (m.status === 'disponivel') return { label: 'Disponível', color: 'var(--text-muted)' }
    if (m.status === 'reservada')  return { label: 'Reservada',  color: 'var(--blue)' }
    if (m.status === 'manutencao') return { label: 'Manutenção', color: 'var(--red)' }
    return { label: m.comanda ? timeAgo(m.comanda.aberta_em) : 'Ocupada', color: 'var(--gold)' }
  }

  if (loading) return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Mesas</h1>
      </div>
      <div className="p-4 md:p-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => <SkeletonMesa key={i} />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-5 pb-4"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="page-header">Mesas</h1>
            <p className="text-[12px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              {ocupadas} ocupadas · {livres} disponíveis
              <span className="inline-block w-1.5 h-1.5 rounded-full pulse-dot"
                style={{ background: 'var(--green)' }} />
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['todas', 'ocupadas', 'livres'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: filter === f ? 'var(--gold)' : 'var(--bg-raised)',
                color: filter === f ? 'var(--gold-fg)' : 'var(--text-secondary)',
                border: `1px solid ${filter === f ? 'transparent' : 'var(--border-default)'}`,
              }}>
              {f === 'todas' ? `Todas ${mesas.length}` : f === 'ocupadas' ? `Ocupadas ${ocupadas}` : `Livres ${livres}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 md:p-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {filtered.map(m => {
          const { label, color } = statusInfo(m)
          const isOcupada = m.status === 'ocupada'
          return (
            <div key={m.id} className={`${mesaClass(m)} animate-fade-in`} onClick={() => setSelected(m)}>
              <div className="w-full">
                <span className="font-mono font-bold text-xl leading-none"
                  style={{ color: isOcupada ? 'var(--gold)' : 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  {String(m.numero).padStart(2, '0')}
                </span>
                {isOcupada && m.comanda && (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-[10px] font-semibold font-mono" style={{ color: 'var(--gold)' }}>
                      {timeAgo(m.comanda.aberta_em)}
                    </div>
                    {m.comanda.total > 0 && (
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {fmt(m.comanda.total)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
            </div>
          )
        })}
      </div>

      {/* Bottom sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }} />
          <div className="bottom-sheet relative w-full animate-slide-up p-5 pb-8"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5"
              style={{ background: 'var(--border-strong)' }} />

            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-3xl"
                    style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                    Mesa {String(selected.numero).padStart(2, '0')}
                  </span>
                  {selected.comanda && (
                    <span className="badge badge-gold text-[10px]">#{selected.comanda.id}</span>
                  )}
                </div>
                {selected.comanda && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Aberta há {timeAgo(selected.comanda.aberta_em)}
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <X size={14} />
              </button>
            </div>

            {selected.comanda && (
              <div className="rounded-xl p-4 mb-4"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: 'Total', value: fmt(selected.comanda.total) },
                    { label: 'Pago',  value: fmt(selected.comanda.total_pago) },
                    { label: 'Saldo', value: fmt(selected.comanda.total - selected.comanda.total_pago) },
                  ].map(({ label, value }, i) => (
                    <div key={label}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="font-mono font-bold text-sm"
                        style={{ color: i === 2 ? 'var(--gold)' : 'var(--text-primary)' }}>{value}</p>
                    </div>
                  ))}
                </div>
                {selected.comanda.total > 0 && (
                  <div className="progress-bar">
                    <div className="progress-bar-fill"
                      style={{ width: `${Math.min(100, (selected.comanda.total_pago / selected.comanda.total) * 100)}%` }} />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {selected.status === 'ocupada' && selected.comanda && (
                <button onClick={() => navigate(`/comanda/${selected.comanda!.id}`)}
                  className="btn-primary w-full py-3.5 text-sm">
                  Ver Comanda <ChevronRight size={16} />
                </button>
              )}
              {selected.status === 'disponivel' && canOpen && (
                <button onClick={() => openMesa(selected)} disabled={opening}
                  className="btn-primary w-full py-3.5 text-sm">
                  {opening ? <Spinner size={18} /> : <><Users size={16} /> Abrir Mesa</>}
                </button>
              )}
              {selected.status === 'reservada' && (
                <div className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue-border)' }}>
                  <CheckCircle size={14} style={{ color: 'var(--blue)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--blue)' }}>Mesa reservada</span>
                </div>
              )}
              {selected.status === 'manutencao' && (
                <div className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
                  <Wrench size={14} style={{ color: 'var(--red)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--red)' }}>Em manutenção</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
