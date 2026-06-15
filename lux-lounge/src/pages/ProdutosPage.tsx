import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, Categoria, RecipeItem, StockPurchase } from '../types'
import { Modal } from '../components/ui/Modal'
import { PageHelp } from '../components/ui/PageHelp'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import {
  Plus, Edit2, Search, Wind, ShoppingBag, Upload, X, BookOpen,
  Trash2, DollarSign, ShoppingCart, Calendar,
} from 'lucide-react'

const UNIT_LABELS: Record<string, string> = {
  unit: 'Unidade', ml: 'mL', g: 'Gramas', kg: 'Kg', litro: 'Litro',
}

function fmt(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',')}`
}

function calcMargin(preco: number, cost: number) {
  if (preco <= 0) return 0
  return ((preco - cost) / preco) * 100
}

export default function ProdutosPage() {
  const { success: toast, error: toastError } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selCat, setSelCat] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({
    nome: '', categoria_id: '', preco: '', stock_quantity: '', cost_price: '0',
    unit_type: 'unit', package_quantity: '1',
    active: true, is_rosh: false, carvao_por_rosh: '2', exibe_cardapio: true,
  })
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Recipe modal
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null)
  const [recipe, setRecipe] = useState<RecipeItem[]>([])
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [addIngredient, setAddIngredient] = useState({ product_id: '', qty: '1' })
  const [savingRecipe, setSavingRecipe] = useState(false)

  // Purchases modal
  const [purchasesOpen, setPurchasesOpen] = useState(false)
  const [purchaseProduct, setPurchaseProduct] = useState<Product | null>(null)
  const [purchases, setPurchases] = useState<StockPurchase[]>([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)
  const [purchaseForm, setPurchaseForm] = useState({ quantity: '', unit_cost: '', supplier: '', purchased_at: new Date().toISOString().slice(0, 10) })
  const [savingPurchase, setSavingPurchase] = useState(false)

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
    setForm({
      nome: '', categoria_id: categories[0]?.id?.toString() ?? '', preco: '', stock_quantity: '0',
      cost_price: '0', unit_type: 'unit', package_quantity: '1',
      active: true, is_rosh: false, carvao_por_rosh: '2', exibe_cardapio: true,
    })
    setImageFile(null)
    setImagePreview(null)
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      nome: p.nome, categoria_id: String(p.categoria_id ?? ''), preco: String(p.preco),
      stock_quantity: String(p.stock_quantity), cost_price: String(p.cost_price ?? 0),
      unit_type: p.unit_type ?? 'unit', package_quantity: String(p.package_quantity ?? 1),
      active: p.active, is_rosh: p.is_rosh, carvao_por_rosh: String(p.carvao_por_rosh),
      exibe_cardapio: p.exibe_cardapio,
    })
    setImageFile(null)
    setImagePreview(p.imagem_url ?? null)
    setModalOpen(true)
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function uploadImage(productId: number): Promise<string | null> {
    if (!imageFile) return editing?.imagem_url ?? null
    setUploadingImg(true)
    const ext = imageFile.name.split('.').pop()
    const path = `${productId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true })
    setUploadingImg(false)
    if (error) { toastError('Falha no upload da imagem'); return null }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function save() {
    setSaving(true)
    const base = {
      nome: form.nome,
      categoria_id: parseInt(form.categoria_id) || null,
      preco: parseFloat(form.preco.replace(',', '.')),
      stock_quantity: parseInt(form.stock_quantity),
      cost_price: parseFloat(form.cost_price.replace(',', '.')) || 0,
      unit_type: form.unit_type,
      package_quantity: parseFloat(form.package_quantity.replace(',', '.')) || 1,
      active: form.active,
      is_rosh: form.is_rosh,
      carvao_por_rosh: parseInt(form.carvao_por_rosh),
      exibe_cardapio: form.exibe_cardapio,
    }

    let productId: number
    if (editing) {
      await supabase.from('products').update(base).eq('id', editing.id)
      productId = editing.id
    } else {
      const { data } = await supabase.from('products').insert(base).select('id').single()
      productId = data!.id
    }

    if (imageFile) {
      const url = await uploadImage(productId)
      if (url) {
        await supabase.from('products').update({ imagem_url: url }).eq('id', productId)
      }
    } else if (imagePreview === null && editing?.imagem_url) {
      await supabase.from('products').update({ imagem_url: null }).eq('id', productId)
    }

    setSaving(false)
    setModalOpen(false)
    toast(editing ? 'Produto atualizado' : 'Produto criado')
    load()
  }

  // — Recipe modal —
  async function openRecipe(p: Product) {
    setRecipeProduct(p)
    setRecipeLoading(true)
    setRecipeOpen(true)
    const { data } = await supabase
      .from('product_recipe_items')
      .select('*, ingredient:ingredient_product_id(id, nome, unit_type, package_quantity, cost_price)')
      .eq('product_id', p.id)
      .order('id')
    setRecipe((data ?? []) as RecipeItem[])
    setRecipeLoading(false)
  }

  function calcRecipeCost(items: RecipeItem[]) {
    return items.reduce((s, r) => {
      const ing = r.ingredient as Product | undefined
      if (!ing) return s
      const costPerUnit = (ing.cost_price ?? 0) / Math.max(ing.package_quantity ?? 1, 0.0001)
      return s + costPerUnit * r.quantity_used
    }, 0)
  }

  async function addRecipeItem() {
    if (!recipeProduct || !addIngredient.product_id) return
    setSavingRecipe(true)
    const { data } = await supabase.from('product_recipe_items').insert({
      product_id: recipeProduct.id,
      ingredient_product_id: parseInt(addIngredient.product_id),
      quantity_used: parseFloat(addIngredient.qty.replace(',', '.')) || 1,
    }).select('*, ingredient:ingredient_product_id(id, nome, unit_type, package_quantity, cost_price)').single()
    setSavingRecipe(false)
    if (data) {
      setRecipe(r => [...r, data as RecipeItem])
      setAddIngredient({ product_id: '', qty: '1' })
    }
  }

  async function removeRecipeItem(id: number) {
    await supabase.from('product_recipe_items').delete().eq('id', id)
    setRecipe(r => r.filter(i => i.id !== id))
  }

  async function saveCostFromRecipe() {
    if (!recipeProduct) return
    const cost = calcRecipeCost(recipe)
    await supabase.from('products').update({ cost_price: cost }).eq('id', recipeProduct.id)
    toast(`Custo atualizado para ${fmt(cost)}`)
    setRecipeOpen(false)
    load()
  }

  // — Purchases modal —
  async function openPurchases(p: Product) {
    setPurchaseProduct(p)
    setPurchasesLoading(true)
    setPurchasesOpen(true)
    const { data } = await supabase
      .from('stock_purchases')
      .select('*')
      .eq('product_id', p.id)
      .order('purchased_at', { ascending: false })
    setPurchases((data ?? []) as StockPurchase[])
    setPurchasesLoading(false)
  }

  async function registerPurchase() {
    if (!purchaseProduct) return
    const qty = parseFloat(purchaseForm.quantity.replace(',', '.'))
    const unitCost = parseFloat(purchaseForm.unit_cost.replace(',', '.'))
    if (isNaN(qty) || qty <= 0 || isNaN(unitCost) || unitCost <= 0) return
    setSavingPurchase(true)

    const totalCost = qty * unitCost
    await supabase.from('stock_purchases').insert({
      product_id: purchaseProduct.id,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: totalCost,
      supplier: purchaseForm.supplier || null,
      purchased_at: new Date(purchaseForm.purchased_at + 'T12:00:00').toISOString(),
    })

    // Reload purchases and compute weighted avg_cost
    const { data: allPurchases } = await supabase
      .from('stock_purchases')
      .select('quantity, unit_cost')
      .eq('product_id', purchaseProduct.id)

    const totalQty = (allPurchases ?? []).reduce((s, r) => s + Number(r.quantity), 0)
    const totalValue = (allPurchases ?? []).reduce((s, r) => s + Number(r.quantity) * Number(r.unit_cost), 0)
    const avgCost = totalQty > 0 ? totalValue / totalQty : 0

    // Update product: avg_cost, last_purchase_at, stock_quantity
    const { data: prod } = await supabase
      .from('products').select('stock_quantity').eq('id', purchaseProduct.id).single()
    await supabase.from('products').update({
      avg_cost: avgCost,
      last_purchase_at: new Date(purchaseForm.purchased_at + 'T12:00:00').toISOString(),
      stock_quantity: (prod?.stock_quantity ?? 0) + Math.floor(qty),
    }).eq('id', purchaseProduct.id)

    // Also register stock movement
    await supabase.from('estoque_movimentos').insert({
      product_id: purchaseProduct.id,
      tipo: 'entrada',
      quantidade: qty,
      motivo: `Compra${purchaseForm.supplier ? ' — ' + purchaseForm.supplier : ''} · R$ ${unitCost.toFixed(2)}/un`,
    })

    setPurchaseForm({ quantity: '', unit_cost: '', supplier: '', purchased_at: new Date().toISOString().slice(0, 10) })
    setSavingPurchase(false)
    toast(`Compra registrada · custo médio atualizado para ${fmt(avgCost)}`)

    // Reload list for fresh data
    const { data: fresh } = await supabase
      .from('stock_purchases').select('*').eq('product_id', purchaseProduct.id).order('purchased_at', { ascending: false })
    setPurchases((fresh ?? []) as StockPurchase[])
    load()
  }

  const filtered = products.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase())
    const matchCat = selCat === null || p.categoria_id === selCat
    return matchSearch && matchCat
  })

  const ingredientOptions = products.filter(p => p.id !== recipeProduct?.id)

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
          <div className="flex items-center gap-2">
            <h1 className="page-header">Produtos</h1>
            <PageHelp title="Produtos" lines={[
              'Cadastre aqui tudo que é vendido no salão: bebidas, narguile, petiscos e insumos.',
              'Produtos com "Ativo" ligado aparecem nos pedidos. Desative produtos fora de uso sem excluir.',
              'Produtos marcados como Insumo são usados em fichas técnicas de outros produtos.',
              'A ficha técnica define o que cada produto consome do estoque ao ser vendido.',
              'O custo médio é calculado automaticamente conforme você registra compras no Estoque.',
            ]} />
          </div>
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
          {filtered.map(p => {
            const cost = (p.avg_cost ?? 0) > 0 ? (p.avg_cost ?? 0) : (p.cost_price ?? 0)
            const profit = p.preco - cost
            const margin = calcMargin(p.preco, cost)
            return (
              <div key={p.id} className="card" style={{ opacity: p.active ? 1 : 0.45 }}>
                <div className="flex items-start gap-3">
                  {p.imagem_url && (
                    <img src={p.imagem_url} alt={p.nome}
                      className="w-14 h-14 rounded-xl object-cover shrink-0"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {p.nome}
                      </p>
                      {p.is_rosh && <Wind size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                      {(p as any).categorias?.nome ?? '—'} · {UNIT_LABELS[p.unit_type] ?? p.unit_type}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--gold)' }}>
                        {fmt(p.preco)}
                      </span>
                      <span className={`badge ${p.stock_quantity < 5 ? 'badge-yellow' : 'badge-gray'} text-[10px]`}>
                        {p.stock_quantity} un
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial row */}
                <div className="mt-3 pt-3 grid grid-cols-3 gap-1 text-center"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {(p.avg_cost ?? 0) > 0 ? 'C. Médio' : 'Custo'}
                    </p>
                    <p className="font-mono text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{fmt(cost)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Lucro</p>
                    <p className="font-mono text-xs font-semibold" style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(profit)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Margem</p>
                    <p className="font-mono text-xs font-semibold" style={{ color: margin >= 30 ? 'var(--green)' : margin >= 10 ? 'var(--amber)' : 'var(--red)' }}>
                      {margin.toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Last purchase info */}
                {p.last_purchase_at && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={9} />
                    Última compra: {new Date(p.last_purchase_at).toLocaleDateString('pt-BR')}
                    {(p.avg_cost ?? 0) > 0 && <span>· {fmt(p.avg_cost)} médio</span>}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex gap-1.5">
                  <button onClick={() => openEdit(p)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <Edit2 size={10} /> Editar
                  </button>
                  <button onClick={() => openPurchases(p)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <ShoppingCart size={10} /> Compras
                  </button>
                  <button onClick={() => openRecipe(p)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <BookOpen size={10} /> Ficha
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit / Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
          {/* Image upload */}
          <div>
            <label className="label">Imagem</label>
            {imagePreview ? (
              <div className="relative w-24 h-24">
                <img src={imagePreview} alt="" className="w-24 h-24 rounded-xl object-cover" />
                <button onClick={removeImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--red)', color: '#fff' }}>
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition w-full justify-center"
                style={{ border: '1px dashed var(--border-strong)', color: 'var(--text-muted)', background: 'var(--bg-raised)' }}>
                <Upload size={14} /> Selecionar imagem
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
          </div>

          <div><label className="label">Nome *</label><input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><label className="label">Preço Venda (R$)</label><input className="input" placeholder="0,00" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Custo (R$)</label><input className="input" placeholder="0,00" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} /></div>
            <div><label className="label">Estoque</label><input type="number" className="input" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unidade</label>
              <select className="input" value={form.unit_type} onChange={e => setForm(f => ({ ...f, unit_type: e.target.value }))}>
                {Object.entries(UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="label">Qtd/Embalagem</label><input className="input" placeholder="1" value={form.package_quantity} onChange={e => setForm(f => ({ ...f, package_quantity: e.target.value }))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 justify-end pb-1">
              {[{ key: 'active', label: 'Ativo' }, { key: 'is_rosh', label: 'É Rosh' }, { key: 'exibe_cardapio', label: 'Cardápio' }].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    className="w-3.5 h-3.5" style={{ accentColor: 'var(--gold)' }} />
                  {label}
                </label>
              ))}
            </div>
            {form.is_rosh && (
              <div><label className="label">Carvão por Rosh</label><input type="number" className="input" value={form.carvao_por_rosh} onChange={e => setForm(f => ({ ...f, carvao_por_rosh: e.target.value }))} /></div>
            )}
          </div>

          {/* Live cost/profit preview */}
          {form.preco && (
            <div className="grid grid-cols-3 gap-2 rounded-xl p-3"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
              {(() => {
                const preco = parseFloat(form.preco.replace(',', '.')) || 0
                const cost = parseFloat(form.cost_price.replace(',', '.')) || 0
                const profit = preco - cost
                const margin = calcMargin(preco, cost)
                return [
                  { label: 'Venda', value: fmt(preco), color: 'var(--gold)' },
                  { label: 'Lucro', value: fmt(profit), color: profit >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Margem', value: `${margin.toFixed(0)}%`, color: margin >= 30 ? 'var(--green)' : margin >= 10 ? 'var(--amber)' : 'var(--red)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className="font-mono text-xs font-bold" style={{ color }}>{value}</p>
                  </div>
                ))
              })()}
            </div>
          )}

          <button onClick={save} disabled={!form.nome || !form.preco || saving || uploadingImg} className="btn-primary w-full py-3.5">
            {saving || uploadingImg ? <Spinner size={18} /> : editing ? 'Salvar Alterações' : 'Criar Produto'}
          </button>
        </div>
      </Modal>

      {/* Purchases Modal */}
      <Modal open={purchasesOpen} onClose={() => setPurchasesOpen(false)} title={`Compras — ${purchaseProduct?.nome ?? ''}`} size="lg">
        {purchasesLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {/* Summary: último custo, custo médio, data */}
            {purchases.length > 0 && (() => {
              const last = purchases[0]
              const totalQty = purchases.reduce((s, r) => s + Number(r.quantity), 0)
              const totalVal = purchases.reduce((s, r) => s + Number(r.quantity) * Number(r.unit_cost), 0)
              const avg = totalQty > 0 ? totalVal / totalQty : 0
              return (
                <div className="grid grid-cols-3 gap-2 rounded-xl p-3"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Último Custo</p>
                    <p className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(Number(last.unit_cost))}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Custo Médio</p>
                    <p className="font-mono text-sm font-bold" style={{ color: 'var(--gold)' }}>{fmt(avg)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Última Compra</p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(last.purchased_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Purchase history */}
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {purchases.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  Nenhuma compra registrada ainda.
                </p>
              )}
              {purchases.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {Number(r.quantity).toLocaleString('pt-BR')} un
                      </p>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>×</span>
                      <p className="font-mono text-sm font-bold" style={{ color: 'var(--gold)' }}>{fmt(Number(r.unit_cost))}</p>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        = {fmt(Number(r.total_cost))}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.purchased_at).toLocaleDateString('pt-BR')}
                      {r.supplier && <span> · {r.supplier}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Register new purchase */}
            <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Registrar Nova Compra</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Quantidade</label>
                  <input className="input text-sm" placeholder="Ex: 5" value={purchaseForm.quantity}
                    onChange={e => setPurchaseForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Custo Unitário (R$)</label>
                  <input className="input text-sm" placeholder="Ex: 120,00" value={purchaseForm.unit_cost}
                    onChange={e => setPurchaseForm(f => ({ ...f, unit_cost: e.target.value }))} />
                </div>
              </div>
              {/* Live total preview */}
              {purchaseForm.quantity && purchaseForm.unit_cost && (() => {
                const qty = parseFloat(purchaseForm.quantity.replace(',', '.'))
                const uc = parseFloat(purchaseForm.unit_cost.replace(',', '.'))
                if (isNaN(qty) || isNaN(uc)) return null
                return (
                  <p className="text-xs font-mono text-center" style={{ color: 'var(--gold)' }}>
                    Total da compra: {fmt(qty * uc)}
                  </p>
                )
              })()}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Fornecedor (opcional)</label>
                  <input className="input text-sm" placeholder="Ex: Distribuidora X" value={purchaseForm.supplier}
                    onChange={e => setPurchaseForm(f => ({ ...f, supplier: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Data da Compra</label>
                  <input type="date" className="input text-sm" value={purchaseForm.purchased_at}
                    onChange={e => setPurchaseForm(f => ({ ...f, purchased_at: e.target.value }))} />
                </div>
              </div>
              <button onClick={registerPurchase}
                disabled={!purchaseForm.quantity || !purchaseForm.unit_cost || savingPurchase}
                className="btn-primary w-full py-3">
                {savingPurchase ? <Spinner size={16} /> : <><ShoppingCart size={14} /> Registrar Compra + Atualizar Custo Médio</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Recipe / Ficha Técnica Modal */}
      <Modal open={recipeOpen} onClose={() => setRecipeOpen(false)} title={`Ficha Técnica — ${recipeProduct?.nome ?? ''}`} size="lg">
        {recipeLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {/* Calculated cost */}
            {recipe.length > 0 && (
              <div className="rounded-xl p-3 grid grid-cols-3 gap-2"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                {(() => {
                  const cost = calcRecipeCost(recipe)
                  const preco = recipeProduct?.preco ?? 0
                  const profit = preco - cost
                  const margin = calcMargin(preco, cost)
                  return [
                    { label: 'Custo calculado', value: fmt(cost), color: 'var(--text-primary)' },
                    { label: 'Lucro estimado', value: fmt(profit), color: profit >= 0 ? 'var(--green)' : 'var(--red)' },
                    { label: 'Margem', value: `${margin.toFixed(0)}%`, color: margin >= 30 ? 'var(--green)' : margin >= 10 ? 'var(--amber)' : 'var(--red)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="font-mono text-sm font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))
                })()}
              </div>
            )}

            {/* Ingredient list */}
            <div className="space-y-2">
              {recipe.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  Sem insumos cadastrados. Adicione abaixo.
                </p>
              )}
              {recipe.map(r => {
                const ing = r.ingredient as Product | undefined
                return (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ing?.nome ?? '—'}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {r.quantity_used} {UNIT_LABELS[ing?.unit_type ?? ''] ?? ing?.unit_type ?? 'un'} · custo parcial: {fmt(((ing?.cost_price ?? 0) / Math.max(ing?.package_quantity ?? 1, 0.0001)) * r.quantity_used)}
                      </p>
                    </div>
                    <button onClick={() => removeRecipeItem(r.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg transition"
                      style={{ color: 'var(--red)', border: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add ingredient */}
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Adicionar Insumo</p>
              <div className="grid grid-cols-2 gap-2">
                <select className="input text-sm" value={addIngredient.product_id}
                  onChange={e => setAddIngredient(a => ({ ...a, product_id: e.target.value }))}>
                  <option value="">Selecione produto</option>
                  {ingredientOptions.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input className="input text-sm" placeholder="Quantidade" value={addIngredient.qty}
                  onChange={e => setAddIngredient(a => ({ ...a, qty: e.target.value }))} />
              </div>
              <button onClick={addRecipeItem} disabled={!addIngredient.product_id || savingRecipe}
                className="btn-secondary w-full py-2 text-sm">
                {savingRecipe ? <Spinner size={14} /> : <><Plus size={13} /> Adicionar Insumo</>}
              </button>
            </div>

            {recipe.length > 0 && (
              <button onClick={saveCostFromRecipe} className="btn-primary w-full py-3.5">
                <DollarSign size={15} /> Salvar custo calculado no produto
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
