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

  if (loading) return <div className="flex justify-center items-center h-screen bg-ink"><Spinner size={32} /></div>

  const lowStock = products.filter(p => p.stock_quantity < 5)

  return (
    <div className="min-h-screen bg-ink pb-24 md:pb-6">
      <div className="sticky top-0 z-20 bg-ink/95 backdrop-blur-sm border-b border-ink-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="page-header">Estoque</h1>
          <div className="flex gap-2">
            <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-xl bg-ink-raised border border-ink-border text-[#555] hover:text-white transition">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => setModalOpen(true)} className="btn-primary btn-sm"><Plus size={14} /> Movimento</button>
          </div>
        </div>
        <div className="flex gap-2">
          {(['stock', 'movements'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${tab === t ? 'bg-gold text-ink' : 'bg-ink-raised border border-ink-border text-[#555] hover:text-white'}`}>
              {t === 'stock' ? 'Produtos' : 'Movimentações'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {lowStock.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Estoque Baixo</span>
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
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center mb-3">
                  <Package size={20} className="text-[#2A2A2A]" />
                </div>
                <p className="text-[#444] text-sm">Nenhum produto ativo</p>
              </div>
            )}
            {products.map(p => (
              <div key={p.id} className="bg-ink-card border border-ink-border rounded-2xl flex items-center justify-between gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white truncate">{p.nome}</p>
                  <p className="text-xs text-[#444] mt-0.5">{(p as any).categorias?.nome ?? '—'}</p>
                </div>
                <span className={`badge text-sm px-3 py-1 ${
                  p.stock_quantity === 0 ? 'badge-red' :
                  p.stock_quantity < 5 ? 'badge-yellow' : 'badge-gray'
                }`}>
                  {p.stock_quantity} un
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'movements' && (
          <div className="space-y-2">
            {movements.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-[#444] text-sm">Nenhuma movimentação registrada</p>
              </div>
            )}
            {movements.map(m => (
              <div key={m.id} className="bg-ink-card border border-ink-border rounded-2xl flex items-center gap-3 p-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  m.tipo === 'entrada' ? 'bg-emerald-500/10' :
                  m.tipo === 'saida' ? 'bg-red-500/10' : 'bg-blue-500/10'
                }`}>
                  {m.tipo === 'entrada' ? <ArrowUp size={14} className="text-emerald-400" /> :
                   m.tipo === 'saida' ? <ArrowDown size={14} className="text-red-400" /> :
                   <RefreshCw size={14} className="text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{(m as any).products?.nome ?? '—'}</p>
                  {m.motivo && <p className="text-xs text-[#444] mt-0.5">{m.motivo}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-sm ${
                    m.tipo === 'entrada' ? 'text-emerald-400' :
                    m.tipo === 'saida' ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : ''}{m.quantidade}
                  </p>
                  <p className="text-[11px] text-[#444]">{format(new Date(m.created_at), 'dd/MM HH:mm')}</p>
                </div>
              </div>
            ))}
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
              {(['entrada', 'saida', 'ajuste'] as const).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className={`p-2.5 rounded-xl border text-xs font-semibold capitalize transition ${
                    form.tipo === t
                      ? t === 'entrada' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : t === 'saida' ? 'border-red-500/40 bg-red-500/10 text-red-400'
                        : 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                      : 'border-ink-border bg-ink-raised text-[#555] hover:text-white'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{form.tipo === 'ajuste' ? 'Quantidade Final' : 'Quantidade'}</label>
            <input type="number" min="1" className="input" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
          </div>
          <div>
            <label className="label">Observações</label>
            <input className="input" placeholder="Opcional..." value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
          </div>
          <button onClick={saveMovement} disabled={!form.product_id || !form.quantidade || saving} className="btn-primary w-full py-3.5">
            {saving ? <Spinner size={18} /> : 'Confirmar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
