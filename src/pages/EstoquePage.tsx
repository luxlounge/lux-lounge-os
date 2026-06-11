import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, EstoqueMovimento } from '../types'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { Plus, ArrowUp, ArrowDown, RefreshCw, AlertTriangle, Package } from 'lucide-react'
import { format } from 'date-fns'

export default function EstoquePage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<EstoqueMovimento[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ product_id: '', tipo: 'entrada' as 'entrada' | 'saida' | 'ajuste', quantidade: '', motivo: '' })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'stock' | 'movements'>('stock')

  const load = useCallback(async () => {
    const [{ data: ps }, { data: mvs }] = await Promise.all([
      supabase.from('products').select('*, categorias(*)').eq('active', true).order('nome'),
      supabase.from('estoque_movimentos').select('*, products(nome)').order('created_at', { ascending: false }).limit(50),
    ])
    setProducts(ps ?? [])
    setMovements(mvs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveMovement() {
    setSaving(true)
    const qty = parseInt(form.quantidade)
    const productId = parseInt(form.product_id)
    await supabase.from('estoque_movimentos').insert({
      product_id: productId, tipo: form.tipo,
      quantidade: qty, motivo: form.motivo || null, criado_por: profile?.id,
    })
    const prod = products.find(p => p.id === productId)
    if (prod) {
      const newQty = form.tipo === 'ajuste' ? qty :
        form.tipo === 'entrada' ? prod.stock_quantity + qty : prod.stock_quantity - qty
      await supabase.from('products').update({ stock_quantity: newQty }).eq('id', productId)
    }
    setSaving(false)
    setModalOpen(false)
    setForm({ product_id: '', tipo: 'entrada', quantidade: '', motivo: '' })
    load()
  }

  const lowStock = products.filter(p => p.stock_quantity < 5)

  if (loading) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Estoque</h1>
      </div>
      <div className="flex items-center justify-center h-48"><Spinner size={28} /></div>
    </div>
  )

  const tipoConfig = {
    entrada: { icon: ArrowUp,   color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green-border)', label: 'Entrada' },
    saida:   { icon: ArrowDown, color: 'var(--red)',   bg: 'var(--red-bg)',   border: 'var(--red-border)',   label: 'Saída' },
    ajuste:  { icon: RefreshCw, color: 'var(--blue)',  bg: 'var(--blue-bg)', border: 'var(--blue-border)',  label: 'Ajuste' },
  }

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-5 pb-3"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="page-header">Estoque</h1>
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
        {/* Low stock alert */}
        {lowStock.length > 0 && tab === 'stock' && (
          <div className="rounded-xl p-4"
            style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={13} style={{ color: 'var(--amber)' }} />
              <span className="section-header" style={{ color: 'var(--amber)' }}>Estoque Crítico</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(p => (
                <span key={p.id} className="badge badge-yellow">{p.nome}: {p.stock_quantity} un</span>
              ))}
            </div>
          </div>
        )}

        {tab === 'stock' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.length === 0 && (
              <div className="col-span-full flex flex-col items-center py-16">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                  <Package size={20} style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum produto</p>
              </div>
            )}
            {products.map(p => {
              const stockColor = p.stock_quantity === 0 ? 'var(--red)' : p.stock_quantity < 5 ? 'var(--amber)' : 'var(--green)'
              const stockBadge = p.stock_quantity === 0 ? 'badge-red' : p.stock_quantity < 5 ? 'badge-yellow' : 'badge-green'
              return (
                <div key={p.id} className="card flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stockColor }} />
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.nome}</p>
                    </div>
                    <p className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>{(p as any).categorias?.nome ?? '—'}</p>
                  </div>
                  <span className={`badge ${stockBadge} font-mono`}>{p.stock_quantity} un</span>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'movements' && (
          <div className="space-y-2">
            {movements.length === 0 && (
              <div className="flex flex-col items-center py-16">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma movimentação</p>
              </div>
            )}
            {movements.map(m => {
              const cfg = tipoConfig[m.tipo as keyof typeof tipoConfig]
              const Icon = cfg.icon
              const sign = m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : ''
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
                    {m.motivo && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.motivo}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-sm" style={{ color: cfg.color }}>
                      {sign}{m.quantidade}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {format(new Date(m.created_at), 'dd/MM HH:mm')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
            <input type="number" min="1" className="input" value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
          </div>
          <div>
            <label className="label">Observações</label>
            <input className="input" placeholder="Opcional..." value={form.motivo}
              onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
          </div>
          <button onClick={saveMovement} disabled={!form.product_id || !form.quantidade || saving}
            className="btn-primary w-full py-3.5">
            {saving ? <Spinner size={18} /> : 'Confirmar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
