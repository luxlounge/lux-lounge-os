import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Pedido, PedidoItem } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { Clock } from 'lucide-react'
import { format } from 'date-fns'

const COLUMNS = [
  { key: 'pendente', label: 'Pendentes', dotColor: 'var(--blue)',  borderColor: 'var(--blue)' },
  { key: 'preparo',  label: 'Preparo',   dotColor: 'var(--gold)',  borderColor: 'var(--gold)' },
  { key: 'entregue', label: 'Entregues', dotColor: 'var(--green)', borderColor: 'var(--green)' },
]

const NEXT: Record<string, string> = { pendente: 'preparo', preparo: 'entregue' }
const NEXT_LABEL: Record<string, string> = { pendente: 'Iniciar Preparo', preparo: 'Marcar Entregue' }

function elapsed(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return { text: 'agora', urgent: false, color: 'var(--green)' }
  if (m < 5)  return { text: `${m}min`, urgent: false, color: 'var(--green)' }
  if (m < 10) return { text: `${m}min`, urgent: false, color: 'var(--amber)' }
  if (m < 60) return { text: `${m}min`, urgent: true,  color: 'var(--red)' }
  return { text: `${Math.floor(m/60)}h${m%60?m%60:''}`, urgent: true, color: 'var(--red)' }
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<(Pedido & { mesa_numero?: number })[]>([])
  const [loading, setLoading] = useState(true)
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

  if (loading) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Pedidos</h1>
      </div>
      <div className="flex items-center justify-center h-48">
        <Spinner size={28} />
      </div>
    </div>
  )

  const counts: Record<string, number> = {}
  for (const col of COLUMNS) counts[col.key] = pedidos.filter(p => p.status === col.key).length

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-5 pb-4 shrink-0"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Pedidos</h1>

        {/* Column headers — visible on mobile as legend */}
        <div className="flex gap-4 mt-3">
          {COLUMNS.map(col => (
            <div key={col.key} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.dotColor }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{col.label}</span>
              {counts[col.key] > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-raised)', color: col.dotColor }}>
                  {counts[col.key]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      {/* Mobile: horizontal scroll across columns; Desktop: 3 equal columns each with independent scroll */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex gap-0 w-full overflow-x-auto snap-x snap-mandatory md:overflow-x-visible md:grid md:grid-cols-3">
          {COLUMNS.map(col => {
            const colPedidos = pedidos.filter(p => p.status === col.key)
            return (
              <div key={col.key}
                className="flex flex-col shrink-0 w-[85vw] md:w-auto snap-start"
                style={{ borderRight: '1px solid var(--border-subtle)' }}>

                {/* Column title — desktop only (mobile uses header legend) */}
                <div className="hidden md:flex items-center gap-2 px-4 py-3 shrink-0"
                  style={{ borderBottom: `2px solid ${col.borderColor}`, background: 'var(--bg-base)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: col.dotColor }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{col.label}</span>
                  {counts[col.key] > 0 && (
                    <span className="ml-auto font-mono text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: col.dotColor + '18', color: col.dotColor }}>
                      {counts[col.key]}
                    </span>
                  )}
                </div>

                {/* Mobile column header */}
                <div className="flex md:hidden items-center gap-2 px-4 py-3 shrink-0"
                  style={{ borderBottom: `2px solid ${col.borderColor}` }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: col.dotColor }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{col.label}</span>
                  {counts[col.key] > 0 && (
                    <span className="ml-auto font-mono text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: col.dotColor + '18', color: col.dotColor }}>
                      {counts[col.key]}
                    </span>
                  )}
                </div>

                {/* Cards — independent scroll */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-24 md:pb-6">
                  {colPedidos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                        <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum pedido</p>
                    </div>
                  )}

                  {colPedidos.map(p => {
                    const isAdvancing = advancing === p.id
                    const time = elapsed(p.created_at)
                    return (
                      <div key={p.id} className="order-card animate-fade-in"
                        style={{ borderTop: `3px solid ${col.borderColor}` }}>

                        {/* Card header */}
                        <div className="flex items-center justify-between px-4 py-3"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[15px]" style={{ color: 'var(--text-primary)' }}>
                              Mesa {p.mesa_numero ?? '?'}
                            </span>
                            <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              #{p.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                              style={{ background: time.urgent ? 'var(--red-bg)' : 'var(--bg-raised)',
                                       color: time.color,
                                       border: `1px solid ${time.urgent ? 'var(--red-border)' : 'var(--border-default)'}` }}>
                              {time.text}
                            </span>
                            {!time.urgent && (
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {format(new Date(p.created_at), 'HH:mm')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Items */}
                        <div className="px-4 py-3 space-y-2">
                          {p.observacao && (
                            <p className="text-xs italic mb-2" style={{ color: 'var(--text-muted)' }}>
                              — {p.observacao}
                            </p>
                          )}
                          {(p.pedido_itens ?? []).map((item: PedidoItem) => (
                            <div key={item.id} className="flex items-start gap-2.5">
                              <span className="font-mono font-bold text-sm w-6 shrink-0" style={{ color: 'var(--gold)' }}>
                                {item.quantidade}×
                              </span>
                              <span className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
                                {item.nome_produto}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        {(NEXT[p.status] || ['pendente', 'preparo'].includes(p.status)) && (
                          <div className="px-3 pb-3 flex gap-2">
                            {NEXT[p.status] && (
                              <button onClick={() => advance(p)} disabled={isAdvancing}
                                className="btn-primary flex-1 py-2.5 text-sm">
                                {isAdvancing ? <Spinner size={15} /> : NEXT_LABEL[p.status]}
                              </button>
                            )}
                            {['pendente', 'preparo'].includes(p.status) && (
                              <button onClick={() => cancel(p)} className="btn-danger px-3 py-2.5 text-sm">
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
