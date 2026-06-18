import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/ui/Spinner'
import { Wind, Coffee, Printer, Search, Clock, CheckCircle2 } from 'lucide-react'
import { format, startOfDay } from 'date-fns'
import { buildPrintTicket, printTicket } from '../lib/printTicket'

type Setor = 'BAR' | 'NARGUILE'
type View = 'fila' | 'concluidos'

interface ProdItem {
  id: number
  nome_produto: string
  quantidade: number
  selected_options: { group_nome: string; option_nome: string }[] | null
  products: { production_sector: string | null } | null
}

interface ProdPedido {
  id: number
  status: string
  observacao: string | null
  created_at: string
  mesa_numero: number | null
  pedido_itens: ProdItem[]
}

const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', preparo: 'Em Preparo', entregue: 'Pronto' }
const ACTION_LABEL: Record<string, string> = { pendente: 'Iniciar Preparo', preparo: 'Marcar Pronto' }
const NEXT: Record<string, string> = { pendente: 'preparo', preparo: 'entregue' }

function getMinutes(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function timeColor(m: number): string {
  if (m < 5) return 'var(--green, #22c55e)'
  if (m < 10) return 'var(--amber, #f59e0b)'
  return 'var(--red, #ef4444)'
}

function timeBg(m: number): string {
  if (m < 5) return 'rgba(34,197,94,0.1)'
  if (m < 10) return 'rgba(245,158,11,0.1)'
  return 'rgba(239,68,68,0.1)'
}

function formatElapsed(m: number): string {
  if (m < 1) return 'agora'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`
}

function getEssencia(item: ProdItem): string | null {
  if (!item.selected_options) return null
  const opt = item.selected_options.find(o =>
    o.group_nome?.toLowerCase().includes('essência') ||
    o.group_nome?.toLowerCase().includes('essencia')
  )
  return opt?.option_nome ?? null
}

function playNewOrderSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
    setTimeout(() => ctx.close(), 600)
  } catch { /* AudioContext not available */ }
}

export default function ProducaoPage() {
  const [pedidos, setPedidos] = useState<ProdPedido[]>([])
  const [concluidos, setConcluidos] = useState<ProdPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [setor, setSetor] = useState<Setor>('BAR')
  const [view, setView] = useState<View>('fila')
  const [advancing, setAdvancing] = useState<number | null>(null)
  const [printing, setPrinting] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const prevPendentesRef = useRef<Set<number>>(new Set())
  const [, setTick] = useState(0)

  // Re-render every 30s to update elapsed timers
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  // Reset sound ref when setor changes to avoid false-positive on switch
  useEffect(() => {
    prevPendentesRef.current = new Set()
  }, [setor])

  const loadConcluidos = useCallback(async () => {
    const since = startOfDay(new Date()).toISOString()
    const { data } = await supabase
      .from('pedidos')
      .select('id, status, observacao, created_at, pedido_itens(id, nome_produto, quantidade, selected_options, products(production_sector)), comandas(mesas(numero))')
      .eq('status', 'entregue')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50)
    setConcluidos((data ?? []).map((p: any) => ({
      id: p.id, status: p.status, observacao: p.observacao, created_at: p.created_at,
      mesa_numero: p.comandas?.mesas?.numero ?? null,
      pedido_itens: (p.pedido_itens ?? []) as ProdItem[],
    })))
  }, [])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('id, status, observacao, created_at, pedido_itens(id, nome_produto, quantidade, selected_options, products(production_sector)), comandas(mesas(numero))')
      .in('status', ['pendente', 'preparo'])
      .order('created_at')

    const mapped: ProdPedido[] = (data ?? []).map((p: any) => ({
      id: p.id, status: p.status, observacao: p.observacao, created_at: p.created_at,
      mesa_numero: p.comandas?.mesas?.numero ?? null,
      pedido_itens: (p.pedido_itens ?? []) as ProdItem[],
    }))

    // Sound: detect new pendente orders for current sector
    const newPendentes = new Set(
      mapped
        .filter(p => p.status === 'pendente' && p.pedido_itens.some(i => i.products?.production_sector === setor))
        .map(p => p.id)
    )
    const prev = prevPendentesRef.current
    const hasNew = [...newPendentes].some(id => !prev.has(id))
    if (hasNew && prev.size > 0) playNewOrderSound()
    prevPendentesRef.current = newPendentes

    setPedidos(mapped)
    setLoading(false)
  }, [setor])

  useEffect(() => {
    load()
    loadConcluidos()
    const sub = supabase.channel('producao-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => { load(); loadConcluidos() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_itens' }, () => { load(); loadConcluidos() })
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load, loadConcluidos])

  async function advance(pedido: ProdPedido) {
    const next = NEXT[pedido.status]
    if (!next) return
    setAdvancing(pedido.id)
    await supabase.from('pedidos').update({ status: next }).eq('id', pedido.id)
    setAdvancing(null)
    load()
    loadConcluidos()
  }

  function handlePrint(pedido: ProdPedido) {
    setPrinting(pedido.id)
    const ticket = buildPrintTicket(pedido, setor)
    printTicket(ticket)
    setTimeout(() => setPrinting(null), 1000)
  }

  // Filter by sector
  const sectorPedidos = pedidos.filter(p =>
    p.pedido_itens.some(i => i.products?.production_sector === setor)
  ).map(p => ({
    ...p,
    pedido_itens: p.pedido_itens.filter(i => i.products?.production_sector === setor),
  }))

  const sectorConcluidos = concluidos.filter(p =>
    p.pedido_itens.some(i => i.products?.production_sector === setor)
  ).map(p => ({
    ...p,
    pedido_itens: p.pedido_itens.filter(i => i.products?.production_sector === setor),
  }))

  // Apply mesa search filter
  const searchTrim = search.trim()
  const filtered = sectorPedidos.filter(p =>
    !searchTrim || String(p.mesa_numero ?? '').includes(searchTrim) || String(p.id).includes(searchTrim)
  )
  const filteredConcluidos = sectorConcluidos.filter(p =>
    !searchTrim || String(p.mesa_numero ?? '').includes(searchTrim) || String(p.id).includes(searchTrim)
  )

  // Counts
  const countPendente = sectorPedidos.filter(p => p.status === 'pendente').length
  const countPreparo  = sectorPedidos.filter(p => p.status === 'preparo').length
  const countPronto   = sectorConcluidos.length

  const displayList = view === 'fila' ? filtered : filteredConcluidos

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-5 pb-3 shrink-0"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>

        <div className="flex items-center justify-between mb-3">
          <h1 className="page-header">Produção</h1>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input className="input pl-8 text-sm py-1.5" placeholder="Mesa / #ID" style={{ width: 120 }}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Setor tabs */}
        <div className="flex gap-2 mb-3">
          {(['BAR', 'NARGUILE'] as Setor[]).map(s => (
            <button key={s} onClick={() => setSetor(s)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: setor === s ? 'var(--gold)' : 'var(--bg-raised)',
                color: setor === s ? 'var(--bg-base)' : 'var(--text-muted)',
                border: setor === s ? 'none' : '1px solid var(--border-default)',
              }}>
              {s === 'BAR' ? <Coffee size={14} /> : <Wind size={14} />}
              {s}
            </button>
          ))}
        </div>

        {/* Counter */}
        <div className="flex gap-3 flex-wrap mb-3">
          {[
            { label: 'Pendentes', count: countPendente, color: 'var(--blue, #3b82f6)', bg: 'rgba(59,130,246,0.1)' },
            { label: 'Em Preparo', count: countPreparo,  color: 'var(--gold)',           bg: 'rgba(234,179,8,0.1)' },
            { label: 'Prontos',    count: countPronto,   color: 'var(--green,#22c55e)',   bg: 'rgba(34,197,94,0.1)' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: bg, border: `1px solid ${color}30` }}>
              <span className="text-xs font-semibold" style={{ color }}>{label}</span>
              <span className="font-bold text-sm font-mono" style={{ color }}>{count}</span>
            </div>
          ))}
        </div>

        {/* View tabs */}
        <div className="flex gap-1">
          {[
            { key: 'fila',       label: 'Fila', icon: Clock },
            { key: 'concluidos', label: `Concluídos hoje (${countPronto})`, icon: CheckCircle2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key as View)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition"
              style={{
                background: view === key ? 'var(--bg-raised)' : 'transparent',
                color: view === key ? 'var(--text-primary)' : 'var(--text-muted)',
                border: view === key ? '1px solid var(--border-default)' : '1px solid transparent',
              }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size={28} /></div>
      ) : displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-20 text-center px-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
            {setor === 'BAR'
              ? <Coffee size={22} style={{ color: 'var(--text-muted)' }} />
              : <Wind   size={22} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {view === 'fila' ? 'Fila vazia' : 'Nenhum pedido concluído hoje'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {view === 'fila' ? `Nenhum pedido pendente para ${setor}` : `Produção de ${setor} zerada hoje`}
          </p>
        </div>
      ) : (
        <div className="p-4 md:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
          {displayList.map(p => {
            const mins = getMinutes(p.created_at)
            const urgent = mins >= 15
            const color = timeColor(mins)
            const bg = timeBg(mins)
            const isAdv = advancing === p.id
            const isPrinting = printing === p.id

            return (
              <div key={p.id} className="rounded-2xl overflow-hidden transition"
                style={{
                  background: urgent ? 'rgba(239,68,68,0.04)' : 'var(--bg-card)',
                  border: urgent ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border-default)',
                  borderTop: `3px solid ${p.status === 'pendente' ? 'var(--blue,#3b82f6)' : p.status === 'preparo' ? 'var(--gold)' : 'var(--green,#22c55e)'}`,
                  boxShadow: urgent ? '0 0 0 1px rgba(239,68,68,0.15)' : undefined,
                }}>

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
                    {/* Elapsed badge */}
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full"
                      style={{ background: bg, color, border: `1px solid ${color}40` }}>
                      {formatElapsed(mins)}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {format(new Date(p.created_at), 'HH:mm')}
                    </span>
                  </div>
                </div>

                {/* Status + urgency */}
                <div className="px-4 pt-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: p.status === 'pendente' ? 'rgba(59,130,246,0.1)' : p.status === 'preparo' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                      color: p.status === 'pendente' ? 'var(--blue,#3b82f6)' : p.status === 'preparo' ? 'var(--gold)' : 'var(--green,#22c55e)',
                    }}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  {urgent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                      style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red,#ef4444)' }}>
                      URGENTE
                    </span>
                  )}
                </div>

                {/* Items */}
                <div className="px-4 py-3 space-y-2">
                  {p.observacao && (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>— {p.observacao}</p>
                  )}
                  {p.pedido_itens.map(item => {
                    const essencia = setor === 'NARGUILE' ? getEssencia(item) : null
                    const otherOpts = (item.selected_options ?? []).filter(o =>
                      !o.group_nome?.toLowerCase().includes('essência') &&
                      !o.group_nome?.toLowerCase().includes('essencia')
                    )
                    return (
                      <div key={item.id} className="flex items-start gap-2.5">
                        <span className="font-mono font-bold text-sm w-6 shrink-0" style={{ color: 'var(--gold)' }}>
                          {item.quantidade}×
                        </span>
                        <div className="min-w-0">
                          <span className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
                            {item.nome_produto}
                          </span>
                          {essencia && (
                            <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--gold)' }}>
                              <Wind size={9} className="inline mr-1" />{essencia}
                            </p>
                          )}
                          {otherOpts.length > 0 && (
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {otherOpts.map(o => o.option_nome).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Actions */}
                <div className="px-3 pb-3 flex gap-2">
                  {NEXT[p.status] && (
                    <button onClick={() => advance(p)} disabled={isAdv}
                      className="btn-primary flex-1 py-2.5 text-sm">
                      {isAdv ? <Spinner size={15} /> : ACTION_LABEL[p.status]}
                    </button>
                  )}
                  <button onClick={() => handlePrint(p)} disabled={isPrinting}
                    className="px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
                    style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-muted)',
                    }}
                    title={p.status === 'entregue' ? 'Reimprimir' : 'Imprimir'}>
                    <Printer size={14} />
                    {p.status === 'entregue' && <span className="text-[11px]">Reimp.</span>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
