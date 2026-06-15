import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, ChevronRight, CheckCircle, AlertTriangle, Clock, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface LiveAlert {
  key: string
  tipo: 'pedido_urgente' | 'mesa_longa' | 'estoque_zero' | 'estoque_baixo'
  titulo: string
  descricao: string
  action_url: string
  severity: 'red' | 'amber'
}

const TIPO_ICON: Record<LiveAlert['tipo'], typeof Bell> = {
  pedido_urgente: AlertTriangle,
  mesa_longa:     Clock,
  estoque_zero:   Package,
  estoque_baixo:  Package,
}

export function NotificationBell() {
  const [alerts, setAlerts]   = useState<LiveAlert[]>([])
  const [open, setOpen]       = useState(false)
  const navigate               = useNavigate()
  const ref                    = useRef<HTMLDivElement>(null)
  const rtDebounceRef          = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const loadAlerts = useCallback(async () => {
    const now        = Date.now()
    const fourHrsAgo = new Date(now - 4 * 3600000).toISOString()
    const tenMinsAgo = new Date(now - 10 * 60000).toISOString()

    const [
      { data: longMesas },
      { data: zeroStock },
      { data: lowStock },
      { data: urgentPedidos },
    ] = await Promise.all([
      supabase.from('comandas')
        .select('id, aberta_em, mesas(numero)')
        .eq('status', 'aberta')
        .lte('aberta_em', fourHrsAgo),
      supabase.from('products')
        .select('nome, stock_quantity')
        .eq('active', true)
        .lte('stock_quantity', 0),
      supabase.from('products')
        .select('nome, stock_quantity')
        .eq('active', true)
        .gt('stock_quantity', 0)
        .lt('stock_quantity', 3),
      supabase.from('pedidos')
        .select('id, created_at, status, comandas(mesas(numero))')
        .eq('status', 'pendente')
        .lte('created_at', tenMinsAgo),
    ])

    const next: LiveAlert[] = []

    for (const c of longMesas ?? []) {
      const hrs = ((now - new Date(c.aberta_em).getTime()) / 3600000).toFixed(1)
      next.push({
        key:        `mesa_longa_${c.id}`,
        tipo:       'mesa_longa',
        titulo:     `Mesa ${(c as any).mesas?.numero} há ${hrs}h aberta`,
        descricao:  'Comanda aberta há mais de 4 horas',
        action_url: '/mesas',
        severity:   'amber',
      })
    }

    for (const p of zeroStock ?? []) {
      next.push({
        key:        `estoque_zero_${p.nome}`,
        tipo:       'estoque_zero',
        titulo:     `${p.nome} — estoque zerado`,
        descricao:  'Produto sem unidades disponíveis',
        action_url: '/estoque',
        severity:   'red',
      })
    }

    for (const p of lowStock ?? []) {
      next.push({
        key:        `estoque_baixo_${p.nome}`,
        tipo:       'estoque_baixo',
        titulo:     `${p.nome} — apenas ${p.stock_quantity} un`,
        descricao:  'Estoque abaixo do mínimo',
        action_url: '/estoque',
        severity:   'amber',
      })
    }

    for (const p of urgentPedidos ?? []) {
      const mins = Math.floor((now - new Date(p.created_at).getTime()) / 60000)
      next.push({
        key:        `pedido_${p.id}`,
        tipo:       'pedido_urgente',
        titulo:     `Pedido #${p.id} — ${mins}min sem resposta`,
        descricao:  `Mesa ${(p as any).comandas?.mesas?.numero ?? '?'} aguardando aprovação`,
        action_url: '/pedidos',
        severity:   'red',
      })
    }

    setAlerts(next)
  }, [])

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 60000)
    return () => clearInterval(interval)
  }, [loadAlerts])

  // Realtime com debounce: evita 4 queries × N eventos em burst
  useEffect(() => {
    function debouncedLoad() {
      clearTimeout(rtDebounceRef.current)
      rtDebounceRef.current = setTimeout(loadAlerts, 350)
    }
    const sub = supabase.channel('notif-bell-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' },  debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, debouncedLoad)
      .subscribe()
    return () => {
      clearTimeout(rtDebounceRef.current)
      sub.unsubscribe()
    }
  }, [loadAlerts])

  // Close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const count = alerts.length
  const redCount = alerts.filter(a => a.severity === 'red').length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-xl transition"
        style={{
          background: open ? 'var(--gold-bg)' : 'var(--bg-raised)',
          border: `1px solid ${open ? 'var(--gold-border)' : 'var(--border-default)'}`,
        }}
        title="Alertas operacionais"
      >
        <Bell size={14} style={{ color: count > 0 ? 'var(--gold)' : 'var(--text-muted)' }} />
        {count > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[9px] font-bold leading-none"
            style={{ background: redCount > 0 ? 'var(--red)' : 'var(--amber)', color: 'white' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-80 rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Alertas Operacionais
            </span>
            {count > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
                {count} ativo{count > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>

          {/* Alert list */}
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircle size={22} className="mx-auto mb-2" style={{ color: 'var(--green)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tudo em ordem</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Nenhum alerta operacional</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {alerts.map((alert) => {
                const Icon = TIPO_ICON[alert.tipo]
                return (
                  <button
                    key={alert.key}
                    onClick={() => { navigate(alert.action_url); setOpen(false) }}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 transition hover:opacity-80"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: alert.severity === 'red' ? 'var(--red-bg)' : 'var(--amber-bg)',
                        border: `1px solid ${alert.severity === 'red' ? 'var(--red-border)' : 'var(--amber-border)'}`,
                      }}>
                      <Icon size={12} style={{ color: alert.severity === 'red' ? 'var(--red)' : 'var(--amber)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {alert.titulo}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {alert.descricao}
                      </p>
                    </div>
                    <ChevronRight size={11} className="shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
                  </button>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 text-center"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
            <button
              onClick={() => { navigate('/'); setOpen(false) }}
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Ver dashboard completo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
