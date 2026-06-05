import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Pedido, PedidoItem } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { RefreshCw, Clock } from 'lucide-react'
import { format } from 'date-fns'

const TABS = [
  { key: 'pendente', label: 'Pendentes', border: 'border-l-blue-500', dot: 'bg-blue-500' },
  { key: 'preparo',  label: 'Preparo',   border: 'border-l-gold',     dot: 'bg-gold' },
  { key: 'entregue', label: 'Entregues', border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
]

const NEXT: Record<string, string> = { pendente: 'preparo', preparo: 'entregue' }
const NEXT_LABEL: Record<string, string> = { pendente: 'Iniciar Preparo', preparo: 'Marcar Entregue' }

function elapsed(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h${m % 60 ? m % 60 : ''}`
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<(Pedido & { mesa_numero?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pendente')
  const [advancing, setAdvancing] = useState<number | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(*), comandas(mesa_id, mesas(numero))')
      .in('status', ['pendente', 'preparo', 'entregue'])
      .order('created_at')
    setPedidos((data ?? []).map((p: any) => ({ ...p, mesa_numero: p.comandas?.mesas?.numero })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const sub = supabase.channel('pedidos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_itens' }, load)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load])

  async function advance(pedido: Pedido) {
    const next = NEXT[pedido.status]
    if (!next) return
    setAdvancing(pedido.id)
    await supabase.from('pedidos').update({ status: next }).eq('id', pedido.id)
    setAdvancing(null)
    load()
  }

  async function cancel(pedido: Pedido) {
    if (!confirm('Cancelar este pedido?')) return
    await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', pedido.id)
    load()
  }

  const counts: Record<string, number> = {}
  for (const tab of TABS) counts[tab.key] = pedidos.filter(p => p.status === tab.key).length
  const filtered = pedidos.filter(p => p.status === filter)

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-ink"><Spinner size={32} /></div>
  )

  return (
    <div className="min-h-screen bg-ink pb-24 md:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-ink/95 backdrop-blur-sm border-b border-ink-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="page-header">Pedidos</h1>
          <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-xl bg-ink-raised border border-ink-border text-[#555] hover:text-white transition active:scale-95">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={[
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                filter === tab.key
                  ? 'bg-ink-raised border border-ink-border text-white'
                  : 'text-[#444] hover:text-[#666]',
              ].join(' ')}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={[
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  filter === tab.key
                    ? tab.key === 'pendente' ? 'bg-blue-500/20 text-blue-400'
                      : tab.key === 'preparo' ? 'bg-gold/15 text-gold'
                      : 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-ink-raised text-[#444]',
                ].join(' ')}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="p-4">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center mb-3">
              <Clock size={20} className="text-[#2A2A2A]" />
            </div>
            <p className="text-[#444] text-sm">Nenhum pedido {TABS.find(t => t.key === filter)?.label.toLowerCase()}</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => {
            const tabMeta = TABS.find(t => t.key === p.status)!
            const isAdvancing = advancing === p.id
            const age = elapsed(p.created_at)
            const isOld = filter === 'pendente' && (Date.now() - new Date(p.created_at).getTime()) > 10 * 60000

            return (
              <div
                key={p.id}
                className={`bg-ink-card border border-ink-border border-l-4 ${tabMeta.border} rounded-2xl overflow-hidden animate-fade-in`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-ink-border">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-white">Mesa {p.mesa_numero ?? '?'}</span>
                    <span className="text-[#333] text-xs font-mono">#{p.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOld && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                        <Clock size={9} /> {age}
                      </span>
                    )}
                    {!isOld && (
                      <span className="text-[11px] text-[#444]">{format(new Date(p.created_at), 'HH:mm')}</span>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="px-4 py-3 space-y-2">
                  {p.observacao && (
                    <p className="text-xs text-[#555] italic mb-2">— {p.observacao}</p>
                  )}
                  {(p.pedido_itens ?? []).map((item: PedidoItem) => (
                    <div key={item.id} className="flex items-start gap-2">
                      <span className="text-gold font-bold text-sm tabular-nums w-5 shrink-0">{item.quantidade}×</span>
                      <span className="text-sm text-white leading-snug">{item.nome_produto}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                {(NEXT[p.status] || ['pendente', 'preparo'].includes(p.status)) && (
                  <div className="px-3 pb-3 flex gap-2">
                    {NEXT[p.status] && (
                      <button
                        onClick={() => advance(p)}
                        disabled={isAdvancing}
                        className="flex-1 btn-primary py-2.5 text-sm font-semibold"
                      >
                        {isAdvancing ? <Spinner size={15} /> : NEXT_LABEL[p.status]}
                      </button>
                    )}
                    {['pendente', 'preparo'].includes(p.status) && (
                      <button
                        onClick={() => cancel(p)}
                        className="px-3 py-2.5 rounded-xl border border-red-500/20 text-red-400 text-sm hover:bg-red-500/10 transition active:scale-95"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
