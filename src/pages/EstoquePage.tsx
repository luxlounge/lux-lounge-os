import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, EstoqueMovimento } from '../types'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { Plus, ArrowUp, ArrowDown, RefreshCw, AlertTriangle, Package, Settings2 } from 'lucide-react'
import { PageHelp } from '../components/ui/PageHelp'
import { format } from 'date-fns'

type StockStatus = 'normal' | 'baixo' | 'critico' | 'sem_estoque'

function getStockStatus(p: Product): StockStatus {
  if (p.stock_quantity <= 0) return 'sem_estoque'
  if (p.stock_minimo > 0) {
    if (p.stock_quantity <= Math.floor(p.stock_minimo * 0.5)) return 'critico'
    if (p.stock_quantity <= p.stock_minimo) return 'baixo'
  }
  return 'normal'
}

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; bg: string }> = {
  normal:      { label: 'Normal',      color: 'var(--green,#22c55e)',  bg: 'rgba(34,197,94,0.1)'  },
  baixo:       { label: 'Baixo',       color: 'var(--amber,#f59e0b)',  bg: 'rgba(245,158,11,0.1)' },
  critico:     { label: 'Crítico',     color: 'var(--red,#ef4444)',    bg: 'rgba(239,68,68,0.1)'  },
  sem_estoque: { label: 'Sem Estoque', color: 'var(--red,#ef4444)',    bg: 'rgba(239,68,68,0.15)' },
}

export default function EstoquePage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<EstoqueMovimento[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [minimoModal, setMinimoModal] = useState<Product | null>(null)
  const [form, setForm] = useState({ product_id: '', tipo: 'entrada' as 'entrada' | 'saida' | 'ajuste', quantidade: '', motivo: '' })
  const [minimoForm, setMinimoForm] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'stock' | 'movements'>('stock')
  const [filterStatus, setFilterStatus] = useState<StockStatus | 'todos'>('todos')

  const load = useCallback(async () => {
    const [{ data: ps }, { data: mvs }] = await Promise.all([
      supabase.from('products').select('*, categorias(*)').eq('active', true).order('nome'),
      supabase.from('estoque_movimentos').select('*, products(nome)').order('created_at', { ascending: false }).limit(100),
    ])
    setProducts(ps ?? [])
    setMovements(mvs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveMovement() {
    if (!form.product_id || !form.quantidade) return
    setSaving(true)
    await supabase.rpc('ajustar_estoque', {
      p_product_id: parseInt(form.product_id),
      p_quantidade: parseFloat(form.quantidade),
      p_tipo: form.tipo,
      p_motivo: form.motivo || null,
      p_user_id: profile?.id ?? null,
    })
    setSaving(false)
    setModalOpen(false)
    setForm({ product_id: '', tipo: 'entrada', quantidade: '', motivo: '' })
    load()
  }

  async function saveMinimo() {
    if (!minimoModal) return
    setSaving(true)
    await supabase.from('products').update({ stock_minimo: parseInt(minimoForm) || 0 }).eq('id', minimoModal.id)
    setSaving(false)
    setMinimoModal(null)
    load()
  }

  const alerts = products.filter(p => getStockStatus(p) !== 'normal')
  const filteredProducts = filterStatus === 'todos'
    ? products
    : products.filter(p => getStockStatus(p) === filterStatus)

  const tipoConfig = {
    entrada: { icon: ArrowUp,   color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green-border)', label: 'Entrada' },
    saida:   { icon: ArrowDown, color: 'var(--red)',   bg: 'var(--red-bg)',   border: 'var(--red-border)',   label: 'Saída' },
    ajuste:  { icon: RefreshCw, color: 'var(--blue)',  bg: 'var(--blue-bg)', border: 'var(--blue-border)',  label: 'Ajuste' },
  }

  if (loading) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Estoque</h1>
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
          <div className="flex items-center gap-2">
            <h1 className="page-header">Estoque</h1>
            <PageHelp title="Estoque" lines={[
              'A baixa de estoque é automática ao confirmar pedidos — feita pelo banco, sem race condition.',
              'Cancelar pedido devolve o estoque automaticamente.',
              'Use "Movimento" para ajustes manuais: entrada de mercadoria, perda ou correção de inventário.',
              'Configure o estoque mínimo (ícone ⚙) para ativar alertas: Baixo → Crítico → Sem Estoque.',
            ]} />
          </div>
          <div className="flex gap-2">
            <button onClick={load}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={() => setModalOpen(true)} className="btn-primary btn-sm">
              <Plus size={14} /> Movimento
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {(['stock', 'movements'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
              style={{
                background: tab === t ? 'var(--gold)' : 'var(--bg-raised)',
                color: tab === t ? 'var(--gold-fg)' : 'var(--text-secondary)',
                border: `1px solid ${tab === t ? 'transparent' : 'var(--border-default)'}`,
              }}>
              {t === 'stock' ? 'Produtos' : 'Movimentações'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-4">

        {/* Alert banner */}
        {alerts.length > 0 && tab === 'stock' && (
          <div className="rounded-xl p-4"
            style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} style={{ color: 'var(--amber)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--amber)' }}>
                {alerts.length} produto{alerts.length > 1 ? 's' : ''} requer{alerts.length === 1 ? '' : 'em'} atenção
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.map(p => {
                const st = getStockStatus(p)
                const cfg = STATUS_CONFIG[st]
                return (
                  <span key={p.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                    {p.nome}: {p.stock_quantity} — {cfg.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'stock' && (
          <>
            {/* Status filter */}
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'todos' as const,       label: 'Todos' },
                { key: 'sem_estoque' as const, label: 'Sem Estoque' },
                { key: 'critico' as const,     label: 'Crítico' },
                { key: 'baixo' as const,       label: 'Baixo' },
                { key: 'normal' as const,      label: 'Normal' },
              ]).map(({ key, label }) => (
                <button key={key} onClick={() => setFilterStatus(key)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition"
                  style={{
                    background: filterStatus === key ? 'var(--gold)' : 'var(--bg-raised)',
                    color: filterStatus === key ? 'var(--bg-base)' : 'var(--text-muted)',
                    border: filterStatus === key ? 'none' : '1px solid var(--border-default)',
                  }}>
                  {label}
                  {key !== 'todos' && (
                    <span className="ml-1 opacity-70">
                      ({products.filter(p => getStockStatus(p) === key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.length === 0 && (
                <div className="col-span-full flex flex-col items-center py-16">
                  <Package size={20} className="mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum produto</p>
                </div>
              )}
              {filteredProducts.map(p => {
                const st = getStockStatus(p)
                const cfg = STATUS_CONFIG[st]
                return (
                  <div key={p.id} className="card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.nome}</p>
                        </div>
                        <p className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>
                          {(p as any).categorias?.nome ?? '—'}
                        </p>
                      </div>
                      <button
                        onClick={() => { setMinimoModal(p); setMinimoForm(String(p.stock_minimo ?? 0)) }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg shrink-0 transition hover:opacity-70"
                        style={{ color: 'var(--text-muted)' }} title="Configurar estoque mínimo">
                        <Settings2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-end justify-between mt-3">
                      <div className="flex items-end gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Atual</p>
                          <p className="font-mono font-bold text-2xl leading-none" style={{ color: cfg.color }}>{p.stock_quantity}</p>
                        </div>
                        {(p.stock_minimo ?? 0) > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Mín.</p>
                            <p className="font-mono text-base leading-none" style={{ color: 'var(--text-secondary)' }}>{p.stock_minimo}</p>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === 'movements' && (
          <div className="space-y-4">
            {movements.length === 0 && (
              <div className="flex flex-col items-center py-16">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma movimentação</p>
              </div>
            )}
            {(() => {
              const groups: Record<string, EstoqueMovimento[]> = {}
              for (const m of movements) {
                const day = format(new Date(m.created_at), 'yyyy-MM-dd')
                if (!groups[day]) groups[day] = []
                groups[day].push(m)
              }
              return Object.entries(groups).map(([day, items]) => (
                <div key={day}>
                  <p className="text-[10px] uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
                    {format(new Date(day + 'T12:00:00'), 'dd/MM/yyyy')}
                  </p>
                  <div className="space-y-2">
                    {items.map(m => {
                      const cfg = tipoConfig[m.tipo as keyof typeof tipoConfig] ?? tipoConfig.ajuste
                      const Icon = cfg.icon
                      const sign = m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : '='
                      return (
                        <div key={m.id} className="card flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                            <Icon size={14} style={{ color: cfg.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {(m as any).products?.nome ?? '—'}
                            </p>
                            {m.motivo && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{m.motivo}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-bold text-sm" style={{ color: cfg.color }}>
                              {sign}{m.quantidade}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {format(new Date(m.created_at), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>

      {/* Movimento manual modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar Movimento">
        <div className="space-y-4">
          <div>
            <label className="label">Produto</label>
            <select className="input" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
              <option value="">Selecione...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.stock_quantity} un)</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['entrada', 'saida', 'ajuste'] as const).map(t => {
                const cfg = tipoConfig[t]
                const active = form.tipo === t
                return (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className="p-2.5 rounded-xl text-xs font-semibold capitalize transition"
                    style={{
                      background: active ? cfg.bg : 'var(--bg-raised)',
                      border: `1px solid ${active ? cfg.border : 'var(--border-default)'}`,
                      color: active ? cfg.color : 'var(--text-secondary)',
                    }}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="label">{form.tipo === 'ajuste' ? 'Quantidade Final' : 'Quantidade'}</label>
            <input type="number" min="0" className="input" value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
          </div>
          <div>
            <label className="label">Motivo</label>
            <input className="input" placeholder="Ex: entrada de mercadoria, perda, inventário..."
              value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
          </div>
          <button onClick={saveMovement} disabled={!form.product_id || !form.quantidade || saving}
            className="btn-primary w-full py-3.5">
            {saving ? <Spinner size={18} /> : 'Confirmar'}
          </button>
        </div>
      </Modal>

      {/* Estoque mínimo modal */}
      {minimoModal && (
        <Modal open onClose={() => setMinimoModal(null)} title={`Mínimo — ${minimoModal.nome}`}>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Define o nível mínimo. Abaixo → Baixo. Abaixo de 50% → Crítico. Zero desativa o alerta.
            </p>
            <div>
              <label className="label">Estoque mínimo (unidades)</label>
              <input type="number" min="0" className="input text-lg font-mono" value={minimoForm}
                onChange={e => setMinimoForm(e.target.value)} />
            </div>
            <button onClick={saveMinimo} disabled={saving} className="btn-primary w-full py-3.5">
              {saving ? <Spinner size={18} /> : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
