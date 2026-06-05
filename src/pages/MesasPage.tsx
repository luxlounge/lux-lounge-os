import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Mesa, Comanda } from '../types'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Plus, RefreshCw, Wrench } from 'lucide-react'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 60) return `${diff}min`
  return `${Math.floor(diff / 60)}h${diff % 60 > 0 ? `${diff % 60}` : ''}`
}

export default function MesasPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [comandas, setComandas] = useState<Record<number, Comanda>>({})
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState<Mesa | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: ms }, { data: cs }] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('comandas').select('*').eq('status', 'aberta'),
    ])
    setMesas(ms ?? [])
    const map: Record<number, Comanda> = {}
    for (const c of cs ?? []) map[c.mesa_id] = c
    setComandas(map)
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

  async function openMesa() {
    if (!openModal) return
    setSaving(true)
    const { data: comanda } = await supabase
      .from('comandas')
      .insert({ mesa_id: openModal.id, aberta_por: profile?.id })
      .select()
      .single()
    await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', openModal.id)
    setSaving(false)
    setOpenModal(null)
    navigate(`/comanda/${comanda?.id}`)
  }

  const canOpen = ['admin', 'caixa'].includes(profile?.role ?? '')
  const ocupadas = mesas.filter(m => m.status === 'ocupada').length
  const disponiveis = mesas.filter(m => m.status === 'disponivel').length

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-ink">
      <Spinner size={32} />
    </div>
  )

  return (
    <div className="min-h-screen bg-ink pb-24 md:pb-6">
      {/* Header */}
      <div className="sticky top-0 md:top-0 z-20 bg-ink/95 backdrop-blur-sm border-b border-ink-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-white">Mesas</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1.5 text-xs text-[#666]">
                <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" />
                {ocupadas} ocupada{ocupadas !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#666]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                {disponiveis} disponíve{disponiveis !== 1 ? 'is' : 'l'}
              </span>
            </div>
          </div>
          <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-xl bg-ink-raised border border-ink-border text-[#555] hover:text-white transition active:scale-95">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-9 gap-3">
        {mesas.map(mesa => {
          const comanda = comandas[mesa.id]
          const isOcupada = mesa.status === 'ocupada'
          const isDisponivel = mesa.status === 'disponivel'

          return (
            <button
              key={mesa.id}
              onClick={() => {
                if (isOcupada && comanda) navigate(`/comanda/${comanda.id}`)
                else if (isDisponivel && canOpen) setOpenModal(mesa)
              }}
              className={[
                'relative flex flex-col items-center justify-center rounded-2xl aspect-square transition-all duration-200 active:scale-95',
                isOcupada
                  ? 'bg-ink-card border-2 border-gold/60'
                  : isDisponivel
                  ? 'bg-ink-card border border-ink-border hover:border-ink-border-2'
                  : mesa.status === 'reservada'
                  ? 'bg-ink-card border border-amber-500/30'
                  : 'bg-ink-card border border-red-900/40',
              ].join(' ')}
              style={isOcupada ? { boxShadow: '0 0 18px rgba(212,175,55,0.14)' } : undefined}
            >
              {/* Number */}
              <span className={[
                'font-display font-bold leading-none',
                isOcupada ? 'text-gold text-2xl' : 'text-white text-2xl',
              ].join(' ')}>
                {mesa.numero}
              </span>

              {/* Status */}
              {isOcupada && comanda && (
                <div className="flex flex-col items-center mt-1 gap-0.5">
                  <span className="text-[9px] text-gold/60 font-medium">#{comanda.id}</span>
                  <span className="text-[9px] text-[#555]">{timeAgo(comanda.aberta_em)}</span>
                </div>
              )}
              {isDisponivel && (
                <span className="mt-1 text-[9px] text-[#3A3A3A] uppercase tracking-wider font-medium">livre</span>
              )}
              {mesa.status === 'reservada' && (
                <span className="mt-1 text-[9px] text-amber-500/60 uppercase tracking-wider">rsv</span>
              )}
              {mesa.status === 'manutencao' && (
                <Wrench size={10} className="mt-1 text-red-500/50" />
              )}

              {/* Gold dot for occupied */}
              {isOcupada && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-4">
        <div className="flex flex-wrap gap-4 text-[11px] text-[#555]">
          {[
            { color: 'bg-gold', label: 'Ocupada' },
            { color: 'bg-emerald-500', label: 'Disponível' },
            { color: 'bg-amber-500', label: 'Reservada' },
            { color: 'bg-red-700', label: 'Manutenção' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Open Mesa Modal */}
      <Modal open={!!openModal} onClose={() => setOpenModal(null)} title="">
        <div className="text-center pt-2 pb-4">
          <div className="w-16 h-16 rounded-2xl bg-ink-raised border border-ink-border flex items-center justify-center mx-auto mb-4">
            <span className="font-display font-bold text-3xl text-gold">{openModal?.numero}</span>
          </div>
          <h2 className="font-display font-bold text-xl text-white mb-1">Abrir Mesa {openModal?.numero}</h2>
          <p className="text-sm text-[#555] mb-6">Confirmar abertura desta mesa?</p>
          <button onClick={openMesa} disabled={saving} className="btn-primary w-full py-3.5 text-base">
            {saving ? <Spinner size={18} /> : <><Plus size={18} /> Abrir Mesa</>}
          </button>
        </div>
      </Modal>
    </div>
  )
}
