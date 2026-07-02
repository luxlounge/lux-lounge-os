import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Wind, Coffee } from 'lucide-react'
import { format } from 'date-fns'
import { playSound } from '../lib/sound'

interface ProdItem {
  id: number
  nome_produto: string
  quantidade: number
  selected_options: { group_nome: string; option_nome: string }[] | null
  composite_config: {
    personalizations: { personalization_nome: string; option_nome: string }[]
    addons: { addon_nome: string }[]
  } | null
  rosh_config: {
    tipo_mistura: 'unica' | 'meio_a_meio'
    essencias: { id: number; nome: string }[]
  } | null
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

function getMinutes(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function timeColor(m: number) {
  if (m < 5) return '#22c55e'
  if (m < 10) return '#f59e0b'
  return '#ef4444'
}

function formatElapsed(m: number) {
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`
}

function getRoshEssencias(item: ProdItem): string | null {
  if (item.rosh_config) {
    const { essencias, tipo_mistura } = item.rosh_config
    return tipo_mistura === 'meio_a_meio'
      ? essencias.map(e => e.nome).join(' + ')
      : essencias[0]?.nome ?? null
  }
  if (item.selected_options) {
    const opt = item.selected_options.find(o =>
      o.group_nome?.toLowerCase().includes('essênc') ||
      o.group_nome?.toLowerCase().includes('essenc')
    )
    if (opt) return opt.option_nome
  }
  return null
}

const STATUS_COLOR: Record<string, string> = {
  pendente: '#3b82f6',
  preparo:  '#D4AF37',
}
const STATUS_LABEL: Record<string, string> = {
  pendente: 'PENDENTE',
  preparo:  'EM PREPARO',
}

export default function ProducaoTVPage() {
  const [pedidos, setPedidos] = useState<ProdPedido[]>([])
  const [tick, setTick] = useState(0)
  const prevPendentesRef = useRef<Set<number>>(new Set())
  const soundReadyRef = useRef(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('id, status, observacao, created_at, pedido_itens(id, nome_produto, quantidade, selected_options, composite_config, rosh_config, products(production_sector)), comandas(mesas(numero))')
      .in('status', ['pendente', 'preparo'])
      .order('created_at')

    const mapped: ProdPedido[] = (data ?? []).map((p: any) => ({
      id: p.id, status: p.status, observacao: p.observacao, created_at: p.created_at,
      mesa_numero: p.comandas?.mesas?.numero ?? null,
      pedido_itens: p.pedido_itens ?? [],
    }))

    const newPendentes = new Set(mapped.filter(p => p.status === 'pendente').map(p => p.id))
    const prev = prevPendentesRef.current
    const hasNew = [...newPendentes].some(id => !prev.has(id))
    if (hasNew && prev.size > 0 && soundReadyRef.current) playSound('order')
    prevPendentesRef.current = newPendentes
    setPedidos(mapped)
    soundReadyRef.current = true
  }, [])

  useEffect(() => {
    load()
    const sub = supabase.channel('producao-tv-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_itens' }, load)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load])

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const pendentes = pedidos.filter(p => p.status === 'pendente')
  const preparo   = pedidos.filter(p => p.status === 'preparo')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#060606', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: '#1a1a1a' }}>
        <div className="flex items-center gap-3">
          <Wind size={28} style={{ color: '#D4AF37' }} />
          <div>
            <span className="font-black text-2xl tracking-tight" style={{ color: '#D4AF37' }}>LUX LOUNGE</span>
            <span className="ml-3 text-sm font-semibold" style={{ color: '#444' }}>PAINEL DE PRODUÇÃO</span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-bold" style={{ color: '#fff' }}>
            {format(new Date(), 'HH:mm')}
          </p>
          <p className="text-xs" style={{ color: '#444' }}>
            {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''} · {preparo.length} em preparo
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Pendentes column */}
        <div className="flex-1 flex flex-col border-r" style={{ borderColor: '#1a1a1a' }}>
          <div className="px-6 py-3 flex items-center gap-2 border-b" style={{ borderColor: '#1a1a1a', background: 'rgba(59,130,246,0.06)' }}>
            <Coffee size={16} style={{ color: '#3b82f6' }} />
            <span className="font-bold text-sm tracking-widest uppercase" style={{ color: '#3b82f6' }}>Pendentes</span>
            <span className="ml-auto font-mono font-black text-2xl" style={{ color: '#3b82f6' }}>{pendentes.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {pendentes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p style={{ color: '#333' }}>Nenhum pedido pendente</p>
              </div>
            )}
            {pendentes.map(p => <TVCard key={p.id} p={p} tick={tick} />)}
          </div>
        </div>

        {/* Em preparo column */}
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-3 flex items-center gap-2 border-b" style={{ borderColor: '#1a1a1a', background: 'rgba(212,175,55,0.06)' }}>
            <Wind size={16} style={{ color: '#D4AF37' }} />
            <span className="font-bold text-sm tracking-widest uppercase" style={{ color: '#D4AF37' }}>Em Preparo</span>
            <span className="ml-auto font-mono font-black text-2xl" style={{ color: '#D4AF37' }}>{preparo.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {preparo.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p style={{ color: '#333' }}>Nenhum pedido em preparo</p>
              </div>
            )}
            {preparo.map(p => <TVCard key={p.id} p={p} tick={tick} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

function TVCard({ p, tick: _tick }: { p: ProdPedido; tick: number }) {
  const mins = getMinutes(p.created_at)
  const urgent = mins >= 12
  const color = STATUS_COLOR[p.status] ?? '#fff'
  const elapsed = formatElapsed(mins)

  return (
    <div style={{
      background: urgent ? 'rgba(239,68,68,0.06)' : '#0e0e0e',
      border: `2px solid ${urgent ? 'rgba(239,68,68,0.4)' : color + '30'}`,
      borderTop: `4px solid ${color}`,
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 28, color: '#fff', fontFamily: 'monospace' }}>
            Mesa {p.mesa_numero ?? '?'}
          </span>
          <span style={{ fontSize: 13, color: '#444', fontFamily: 'monospace' }}>#{p.id}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{
            fontSize: 18, fontWeight: 800, fontFamily: 'monospace',
            color: timeColor(mins),
          }}>
            {elapsed}
          </span>
          <span style={{ fontSize: 11, color: '#444' }}>{format(new Date(p.created_at), 'HH:mm')}</span>
        </div>
      </div>

      {/* Status badge */}
      <div style={{ padding: '6px 16px' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          padding: '3px 10px', borderRadius: 9999,
          background: color + '15', color, border: `1px solid ${color}40`,
        }}>
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
        {urgent && (
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
            padding: '3px 10px', borderRadius: 9999,
            background: 'rgba(239,68,68,0.15)', color: '#ef4444',
          }}>
            ⚡ URGENTE
          </span>
        )}
      </div>

      {/* Items */}
      <div style={{ padding: '8px 16px 14px' }}>
        {p.observacao && (
          <p style={{ fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 8 }}>— {p.observacao}</p>
        )}
        {p.pedido_itens.map(item => {
          const rosh = getRoshEssencias(item)
          const persons = item.composite_config?.personalizations ?? []
          const addons = item.composite_config?.addons ?? []
          const sector = item.products?.production_sector
          return (
            <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 22, color: '#D4AF37', minWidth: 32 }}>
                {item.quantidade}×
              </span>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{item.nome_produto}</p>
                {sector === 'NARGUILE' && rosh && (
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#D4AF37', marginTop: 3, padding: '2px 8px', background: 'rgba(212,175,55,0.10)', borderRadius: 6, display: 'inline-block' }}>
                    💨 {rosh}
                  </p>
                )}
                {persons.map((pp, i) => (
                  <p key={i} style={{ fontSize: 13, color: '#D4AF37', marginTop: 2 }}>
                    {pp.personalization_nome}: {pp.option_nome}
                  </p>
                ))}
                {addons.map((a, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#666', marginTop: 2 }}>+ {a.addon_nome}</p>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
