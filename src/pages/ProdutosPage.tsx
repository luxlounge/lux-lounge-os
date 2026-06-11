import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, Categoria } from '../types'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { Plus, Edit2, Search, Wind, ShoppingBag } from 'lucide-react'

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selCat, setSelCat] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ nome: '', categoria_id: '', preco: '', stock_quantity: '', active: true, is_rosh: false, carvao_por_rosh: '2', exibe_cardapio: true })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: ps }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, categorias(*)').order('nome'),
      supabase.from('categorias').select('*').order('ordem'),
    ])
    setProducts(ps ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm({ nome: '', categoria_id: categories[0]?.id?.toString() ?? '', preco: '', stock_quantity: '0', active: true, is_rosh: false, carvao_por_rosh: '2', exibe_cardapio: true })
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ nome: p.nome, categoria_id: String(p.categoria_id ?? ''), preco: String(p.preco), stock_quantity: String(p.stock_quantity), active: p.active, is_rosh: p.is_rosh, carvao_por_rosh: String(p.carvao_por_rosh), exibe_cardapio: p.exibe_cardapio })
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    const payload = { nome: form.nome, categoria_id: parseInt(form.categoria_id) || null, preco: parseFloat(form.preco.replace(',', '.')), stock_quantity: parseInt(form.stock_quantity), active: form.active, is_rosh: form.is_rosh, carvao_por_rosh: parseInt(form.carvao_por_rosh), exibe_cardapio: form.exibe_cardapio }
    if (editing) await supabase.from('products').update(payload).eq('id', editing.id)
    else await supabase.from('products').insert(payload)
    setSaving(false)
    setModalOpen(false)
    load()
  }

  const filtered = products.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase())
    const matchCat = selCat === null || p.categoria_id === selCat
    return matchSearch && matchCat
  })

  if (loading) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Produtos</h1>
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
          <h1 className="page-header">Produtos</h1>
          <button onClick={openNew} className="btn-primary btn-sm">
            <Plus size={14} /> Novo
          </button>
        </div>
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-9 text-sm" placeholder="Buscar produto..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setSelCat(null)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition"
            style={{
              background: selCat === null ? 'var(--gold)' : 'var(--bg-raised)',
              color: selCat === null ? 'var(--gold-fg)' : 'var(--text-secondary)',
              border: `1px solid ${selCat === null ? 'transparent' : 'var(--border-default)'}`,
            }}>
            Todos
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setSelCat(c.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition"
              style={{
                background: selCat === c.id ? 'var(--gold)' : 'var(--bg-raised)',
                color: selCat === c.id ? 'var(--gold-fg)' : 'var(--text-secondary)',
                border: `1px solid ${selCat === c.id ? 'transparent' : 'var(--border-default)'}`,
              }}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="p-4 md:p-8">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
              <ShoppingBag size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum produto encontrado</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div key={p.id} className="card flex items-center justify-between gap-3"
              style={{ opacity: p.active ? 1 : 0.45 }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {p.nome}
                  </p>
                  {p.is_rosh && <Wind size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  {(p as any).categorias?.nome ?? '—'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm" style={{ color: 'var(--gold)' }}>
                    R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                  </span>
                  <span className={`badge ${p.stock_quantity < 5 ? 'badge-yellow' : 'badge-gray'} text-[10px]`}>
                    {p.stock_quantity} un
                  </span>
                </div>
              </div>
              <button onClick={() => openEdit(p)}
                className="w-8 h-8 flex items-center justify-center rounded-xl transition shrink-0"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Edit2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
          <div><label className="label">Nome *</label><input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><label className="label">Preço (R$)</label><input className="input" placeholder="0,00" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Estoque</label><input type="number" className="input" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} /></div>
            <div className="flex flex-col gap-2 justify-end pb-1">
              {[{ key: 'active', label: 'Ativo' }, { key: 'is_rosh', label: 'É Rosh' }, { key: 'exibe_cardapio', label: 'Cardápio' }].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    className="w-3.5 h-3.5" style={{ accentColor: 'var(--gold)' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {form.is_rosh && (
            <div><label className="label">Carvão por Rosh</label><input type="number" className="input" value={form.carvao_por_rosh} onChange={e => setForm(f => ({ ...f, carvao_por_rosh: e.target.value }))} /></div>
          )}
          <button onClick={save} disabled={!form.nome || !form.preco || saving} className="btn-primary w-full py-3.5">
            {saving ? <Spinner size={18} /> : editing ? 'Salvar Alterações' : 'Criar Produto'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
