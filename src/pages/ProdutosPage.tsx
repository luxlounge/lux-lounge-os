import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, Categoria, RecipeItem, StockPurchase, ProductOptionGroup, ProductOption, ProductType } from '../types'
import { Modal } from '../components/ui/Modal'
import { PageHelp } from '../components/ui/PageHelp'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import {
  Plus, Edit2, Search, Wind, ShoppingBag, Upload, X, BookOpen,
  Trash2, DollarSign, ShoppingCart, Calendar, SlidersHorizontal, Layers,
} from 'lucide-react'

// Local types for composite builder modal
interface CmpItem {
  id: number
  component_product_id: number
  quantity: number
  component: { id: number; nome: string } | null
}
interface CmpPersonOption {
  id: number
  personalization_id: number
  component_product_id: number
  price_delta: number
  is_default: boolean
  component: { id: number; nome: string } | null
}
interface CmpPerson {
  id: number
  nome: string
  quantidade: number
  options?: CmpPersonOption[]
}
interface CmpAddon {
  id: number
  component_product_id: number
  price_delta: number
  component: { id: number; nome: string } | null
}

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
    product_type: 'simples' as ProductType,
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

  // Composite builder modal
  const [compositeOpen, setCompositeOpen] = useState(false)
  const [compositeProduct, setCompositeProduct] = useState<Product | null>(null)
  const [cmpItems, setCmpItems] = useState<CmpItem[]>([])
  const [cmpPersons, setCmpPersons] = useState<CmpPerson[]>([])
  const [cmpAddons, setCmpAddons] = useState<CmpAddon[]>([])
  const [compositeLoading, setCompositeLoading] = useState(false)
  const [cmpTab, setCmpTab] = useState<'inclusos' | 'personalizacoes' | 'adicionais'>('inclusos')
  const [newCmpItem, setNewCmpItem] = useState({ product_id: '', quantity: '1' })
  const [savingCmpItem, setSavingCmpItem] = useState(false)
  const [newPersonNome, setNewPersonNome] = useState('')
  const [newPersonQty, setNewPersonQty] = useState('1')
  const [savingPerson, setSavingPerson] = useState(false)
  const [newPersonOpts, setNewPersonOpts] = useState<Record<number, { product_id: string; price_delta: string; is_default: boolean }>>({})
  const [savingPersonOpt, setSavingPersonOpt] = useState<number | null>(null)
  const [newAddon, setNewAddon] = useState({ product_id: '', price_delta: '0' })
  const [savingAddon, setSavingAddon] = useState(false)

  // Options modal
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [optionsProduct, setOptionsProduct] = useState<Product | null>(null)
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [newGroupForm, setNewGroupForm] = useState({ nome: '', tipo: 'single' as 'single' | 'multiple', obrigatorio: false, min_select: '0', max_select: '1' })
  const [savingGroup, setSavingGroup] = useState(false)
  const [newOptionForms, setNewOptionForms] = useState<Record<number, { nome: string; price_delta: string }>>({})
  const [savingOption, setSavingOption] = useState<number | null>(null)

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
      product_type: 'simples',
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
      exibe_cardapio: p.exibe_cardapio, product_type: (p.product_type ?? 'simples') as ProductType,
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
      product_type: form.product_type,
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

  // — Options modal —
  async function openOptions(p: Product) {
    setOptionsProduct(p)
    setOptionsLoading(true)
    setOptionsOpen(true)
    setOptionGroups([])
    const { data } = await supabase
      .from('product_option_groups')
      .select('*, product_options(*)')
      .eq('product_id', p.id)
      .eq('ativo', true)
      .order('ordem')
    const groups = (data ?? []) as ProductOptionGroup[]
    setOptionGroups(groups)
    const forms: Record<number, { nome: string; price_delta: string }> = {}
    for (const g of groups) forms[g.id] = { nome: '', price_delta: '0' }
    setNewOptionForms(forms)
    setOptionsLoading(false)
  }

  async function addGroup() {
    if (!optionsProduct || !newGroupForm.nome.trim()) return
    setSavingGroup(true)
    const { data } = await supabase.from('product_option_groups').insert({
      product_id: optionsProduct.id,
      nome: newGroupForm.nome.trim(),
      tipo: newGroupForm.tipo,
      obrigatorio: newGroupForm.obrigatorio,
      min_select: parseInt(newGroupForm.min_select) || 0,
      max_select: parseInt(newGroupForm.max_select) || 1,
      ordem: optionGroups.length,
    }).select('*, product_options(*)').single()
    setSavingGroup(false)
    if (data) {
      setOptionGroups(gs => [...gs, data as ProductOptionGroup])
      setNewOptionForms(f => ({ ...f, [(data as ProductOptionGroup).id]: { nome: '', price_delta: '0' } }))
      setNewGroupForm({ nome: '', tipo: 'single', obrigatorio: false, min_select: '0', max_select: '1' })
      toast('Grupo criado')
    }
  }

  async function deleteGroup(groupId: number) {
    await supabase.from('product_option_groups').update({ ativo: false }).eq('id', groupId)
    setOptionGroups(gs => gs.filter(g => g.id !== groupId))
    toast('Grupo removido')
  }

  async function addOption(groupId: number) {
    const form = newOptionForms[groupId]
    if (!form?.nome.trim()) return
    setSavingOption(groupId)
    const { data } = await supabase.from('product_options').insert({
      group_id: groupId,
      nome: form.nome.trim(),
      price_delta: parseFloat(form.price_delta.replace(',', '.')) || 0,
      ordem: (optionGroups.find(g => g.id === groupId)?.product_options?.length ?? 0),
    }).select().single()
    setSavingOption(null)
    if (data) {
      setOptionGroups(gs => gs.map(g => g.id === groupId
        ? { ...g, product_options: [...(g.product_options ?? []), data as ProductOption] }
        : g))
      setNewOptionForms(f => ({ ...f, [groupId]: { nome: '', price_delta: '0' } }))
    }
  }

  async function deleteOption(groupId: number, optionId: number) {
    await supabase.from('product_options').update({ ativo: false }).eq('id', optionId)
    setOptionGroups(gs => gs.map(g => g.id === groupId
      ? { ...g, product_options: (g.product_options ?? []).filter(o => o.id !== optionId) }
      : g))
  }

  // — Composite builder modal —
  async function openComposite(p: Product) {
    setCompositeProduct(p)
    setCompositeLoading(true)
    setCompositeOpen(true)
    setCmpTab('inclusos')
    const [{ data: items }, { data: persons }, { data: addons }] = await Promise.all([
      supabase.from('composite_items')
        .select('*, component:component_product_id(id, nome)')
        .eq('product_id', p.id).order('ordem'),
      supabase.from('composite_personalizations')
        .select('*, options:composite_personalization_options(*, component:component_product_id(id, nome))')
        .eq('product_id', p.id).order('ordem'),
      supabase.from('composite_addons')
        .select('*, component:component_product_id(id, nome)')
        .eq('product_id', p.id).order('ordem'),
    ])
    setCmpItems((items ?? []) as CmpItem[])
    setCmpPersons((persons ?? []) as CmpPerson[])
    setCmpAddons((addons ?? []) as CmpAddon[])
    setCompositeLoading(false)
  }

  async function addCmpItem() {
    if (!compositeProduct || !newCmpItem.product_id) return
    setSavingCmpItem(true)
    const { data } = await supabase.from('composite_items').insert({
      product_id: compositeProduct.id,
      component_product_id: parseInt(newCmpItem.product_id),
      quantity: parseFloat(newCmpItem.quantity.replace(',', '.')) || 1,
      ordem: cmpItems.length,
    }).select('*, component:component_product_id(id, nome)').single()
    setSavingCmpItem(false)
    if (data) {
      setCmpItems(arr => [...arr, data as CmpItem])
      setNewCmpItem({ product_id: '', quantity: '1' })
    }
  }

  async function removeCmpItem(id: number) {
    await supabase.from('composite_items').delete().eq('id', id)
    setCmpItems(arr => arr.filter(i => i.id !== id))
  }

  async function addPerson() {
    if (!compositeProduct || !newPersonNome.trim()) return
    setSavingPerson(true)
    const { data } = await supabase.from('composite_personalizations').insert({
      product_id: compositeProduct.id,
      nome: newPersonNome.trim(),
      quantidade: parseInt(newPersonQty) || 1,
      ordem: cmpPersons.length,
    }).select().single()
    setSavingPerson(false)
    if (data) {
      setCmpPersons(arr => [...arr, { ...(data as CmpPerson), options: [] }])
      setNewPersonOpts(f => ({ ...f, [(data as CmpPerson).id]: { product_id: '', price_delta: '0', is_default: false } }))
      setNewPersonNome('')
      setNewPersonQty('1')
    }
  }

  async function removePerson(id: number) {
    await supabase.from('composite_personalizations').delete().eq('id', id)
    setCmpPersons(arr => arr.filter(p => p.id !== id))
    setNewPersonOpts(f => { const n = { ...f }; delete n[id]; return n })
  }

  async function addPersonOpt(personId: number) {
    const f = newPersonOpts[personId]
    if (!f?.product_id) return
    setSavingPersonOpt(personId)
    const { data } = await supabase.from('composite_personalization_options').insert({
      personalization_id: personId,
      component_product_id: parseInt(f.product_id),
      price_delta: parseFloat(f.price_delta.replace(',', '.')) || 0,
      is_default: f.is_default,
      ordem: (cmpPersons.find(p => p.id === personId)?.options?.length ?? 0),
    }).select('*, component:component_product_id(id, nome)').single()
    setSavingPersonOpt(null)
    if (data) {
      setCmpPersons(arr => arr.map(p => p.id === personId
        ? { ...p, options: [...(p.options ?? []), data as CmpPersonOption] }
        : p))
      setNewPersonOpts(f2 => ({ ...f2, [personId]: { product_id: '', price_delta: '0', is_default: false } }))
    }
  }

  async function removePersonOpt(personId: number, optId: number) {
    await supabase.from('composite_personalization_options').delete().eq('id', optId)
    setCmpPersons(arr => arr.map(p => p.id === personId
      ? { ...p, options: (p.options ?? []).filter(o => o.id !== optId) }
      : p))
  }

  async function addCmpAddon() {
    if (!compositeProduct || !newAddon.product_id) return
    setSavingAddon(true)
    const { data } = await supabase.from('composite_addons').insert({
      product_id: compositeProduct.id,
      component_product_id: parseInt(newAddon.product_id),
      price_delta: parseFloat(newAddon.price_delta.replace(',', '.')) || 0,
      ordem: cmpAddons.length,
    }).select('*, component:component_product_id(id, nome)').single()
    setSavingAddon(false)
    if (data) {
      setCmpAddons(arr => [...arr, data as CmpAddon])
      setNewAddon({ product_id: '', price_delta: '0' })
    }
  }

  async function removeCmpAddon(id: number) {
    await supabase.from('composite_addons').delete().eq('id', id)
    setCmpAddons(arr => arr.filter(a => a.id !== id))
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
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <button onClick={() => openEdit(p)}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <Edit2 size={10} /> Editar
                  </button>
                  <button onClick={() => openPurchases(p)}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <ShoppingCart size={10} /> Compras
                  </button>
                  <button onClick={() => openRecipe(p)}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <BookOpen size={10} /> Ficha
                  </button>
                  <button onClick={() => openOptions(p)}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <SlidersHorizontal size={10} /> Opções
                  </button>
                  {p.product_type === 'composto' && (
                    <button onClick={() => openComposite(p)}
                      className="col-span-2 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition"
                      style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)' }}>
                      <Layers size={10} /> Montagem
                    </button>
                  )}
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

          {/* Product type */}
          <div>
            <label className="label">Tipo de Produto</label>
            <div className="grid grid-cols-2 gap-2">
              {(['simples', 'composto'] as ProductType[]).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, product_type: t }))}
                  className="py-2 rounded-xl text-sm font-semibold transition capitalize"
                  style={{
                    background: form.product_type === t ? 'var(--gold-bg)' : 'var(--bg-raised)',
                    border: `1px solid ${form.product_type === t ? 'var(--gold-border)' : 'var(--border-default)'}`,
                    color: form.product_type === t ? 'var(--gold)' : 'var(--text-secondary)',
                  }}>
                  {t === 'simples' ? 'Simples' : 'Composto (Kit)'}
                </button>
              ))}
            </div>
            {form.product_type === 'composto' && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Produto composto agrupado em kit. Configure a montagem após salvar.
              </p>
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

      {/* Composite Builder Modal */}
      <Modal open={compositeOpen} onClose={() => setCompositeOpen(false)} title={`Montagem — ${compositeProduct?.nome ?? ''}`} size="lg">
        {compositeLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1">
              {([
                { key: 'inclusos', label: `Inclusos (${cmpItems.length})` },
                { key: 'personalizacoes', label: `Personalizações (${cmpPersons.length})` },
                { key: 'adicionais', label: `Adicionais (${cmpAddons.length})` },
              ] as { key: 'inclusos' | 'personalizacoes' | 'adicionais'; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => setCmpTab(key)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: cmpTab === key ? 'var(--gold)' : 'var(--bg-raised)',
                    color: cmpTab === key ? 'var(--bg-base)' : 'var(--text-muted)',
                    border: cmpTab === key ? 'none' : '1px solid var(--border-default)',
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab: Inclusos */}
            {cmpTab === 'inclusos' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  {cmpItems.length === 0 && (
                    <p className="text-sm text-center py-3" style={{ color: 'var(--text-muted)' }}>Nenhum item incluso ainda.</p>
                  )}
                  {cmpItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--gold)' }}>{item.quantity}×</span>
                      <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{item.component?.nome ?? '—'}</span>
                      <button onClick={() => removeCmpItem(item.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg"
                        style={{ color: 'var(--red)', border: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Adicionar Item Incluso</p>
                  <div className="flex gap-2">
                    <select className="input text-sm flex-1" value={newCmpItem.product_id}
                      onChange={e => setNewCmpItem(f => ({ ...f, product_id: e.target.value }))}>
                      <option value="">Selecione produto</option>
                      {products.filter(p => p.id !== compositeProduct?.id).map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                    <input className="input text-sm w-20" placeholder="Qtd" value={newCmpItem.quantity}
                      onChange={e => setNewCmpItem(f => ({ ...f, quantity: e.target.value }))} />
                  </div>
                  <button onClick={addCmpItem} disabled={!newCmpItem.product_id || savingCmpItem}
                    className="btn-secondary w-full py-2 text-sm">
                    {savingCmpItem ? <Spinner size={14} /> : <><Plus size={13} /> Adicionar</>}
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Personalizações */}
            {cmpTab === 'personalizacoes' && (
              <div className="space-y-3">
                {cmpPersons.map(person => (
                  <div key={person.id} className="rounded-xl p-3 space-y-2"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{person.nome}</span>
                        <span className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>· {person.quantidade}×</span>
                      </div>
                      <button onClick={() => removePerson(person.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg"
                        style={{ color: 'var(--red)', border: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {(person.options ?? []).map(opt => (
                        <div key={opt.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                          <span className="flex-1 text-xs" style={{ color: 'var(--text-primary)' }}>{opt.component?.nome ?? '—'}</span>
                          <span className="text-xs font-mono" style={{ color: opt.price_delta > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                            {opt.price_delta > 0 ? `+R$ ${Number(opt.price_delta).toFixed(2).replace('.', ',')}` : 'grátis'}
                          </span>
                          {opt.is_default && <span className="text-[9px] px-1 rounded" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}>padrão</span>}
                          <button onClick={() => removePersonOpt(person.id, opt.id)}
                            className="w-5 h-5 flex items-center justify-center rounded"
                            style={{ color: 'var(--red)' }}>
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Add option form */}
                    {newPersonOpts[person.id] !== undefined && (
                      <div className="flex gap-1 pt-1 flex-wrap">
                        <select className="input text-xs flex-1 min-w-0"
                          value={newPersonOpts[person.id]?.product_id ?? ''}
                          onChange={e => setNewPersonOpts(f => ({ ...f, [person.id]: { ...f[person.id], product_id: e.target.value } }))}>
                          <option value="">Produto...</option>
                          {products.filter(p => p.id !== compositeProduct?.id).map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                          ))}
                        </select>
                        <input className="input text-xs w-20" placeholder="+R$ 0"
                          value={newPersonOpts[person.id]?.price_delta ?? '0'}
                          onChange={e => setNewPersonOpts(f => ({ ...f, [person.id]: { ...f[person.id], price_delta: e.target.value } }))} />
                        <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                          <input type="checkbox" checked={newPersonOpts[person.id]?.is_default ?? false}
                            onChange={e => setNewPersonOpts(f => ({ ...f, [person.id]: { ...f[person.id], is_default: e.target.checked } }))}
                            className="w-3 h-3" style={{ accentColor: 'var(--gold)' }} />
                          padrão
                        </label>
                        <button onClick={() => addPersonOpt(person.id)}
                          disabled={!newPersonOpts[person.id]?.product_id || savingPersonOpt === person.id}
                          className="btn-secondary px-2.5 py-1.5 text-xs">
                          {savingPersonOpt === person.id ? <Spinner size={12} /> : <Plus size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {cmpPersons.length === 0 && (
                  <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>Nenhuma personalização ainda.</p>
                )}
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Novo Grupo de Escolha</p>
                  <div className="flex gap-2">
                    <input className="input text-sm flex-1" placeholder="Ex: Tipo de Energético"
                      value={newPersonNome} onChange={e => setNewPersonNome(e.target.value)} />
                    <input type="number" className="input text-sm w-20" placeholder="Qtd"
                      value={newPersonQty} onChange={e => setNewPersonQty(e.target.value)} />
                  </div>
                  <button onClick={addPerson} disabled={!newPersonNome.trim() || savingPerson}
                    className="btn-primary w-full py-3">
                    {savingPerson ? <Spinner size={16} /> : <><Plus size={14} /> Criar Grupo</>}
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Adicionais */}
            {cmpTab === 'adicionais' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  {cmpAddons.length === 0 && (
                    <p className="text-sm text-center py-3" style={{ color: 'var(--text-muted)' }}>Nenhum adicional configurado.</p>
                  )}
                  {cmpAddons.map(addon => (
                    <div key={addon.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                      <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{addon.component?.nome ?? '—'}</span>
                      <span className="text-xs font-mono" style={{ color: addon.price_delta > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {addon.price_delta > 0 ? `+R$ ${Number(addon.price_delta).toFixed(2).replace('.', ',')}` : 'grátis'}
                      </span>
                      <button onClick={() => removeCmpAddon(addon.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg"
                        style={{ color: 'var(--red)', border: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Novo Adicional</p>
                  <div className="flex gap-2">
                    <select className="input text-sm flex-1" value={newAddon.product_id}
                      onChange={e => setNewAddon(f => ({ ...f, product_id: e.target.value }))}>
                      <option value="">Selecione produto</option>
                      {products.filter(p => p.id !== compositeProduct?.id).map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                    <input className="input text-sm w-24" placeholder="+R$ 0,00" value={newAddon.price_delta}
                      onChange={e => setNewAddon(f => ({ ...f, price_delta: e.target.value }))} />
                  </div>
                  <button onClick={addCmpAddon} disabled={!newAddon.product_id || savingAddon}
                    className="btn-secondary w-full py-2 text-sm">
                    {savingAddon ? <Spinner size={14} /> : <><Plus size={13} /> Adicionar</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Options Modal */}
      <Modal open={optionsOpen} onClose={() => setOptionsOpen(false)} title={`Opções — ${optionsProduct?.nome ?? ''}`} size="lg">
        {optionsLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-5">
            {optionGroups.length === 0 && (
              <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>
                Nenhum grupo de opções. Crie o primeiro abaixo.
              </p>
            )}

            {optionGroups.map(group => (
              <div key={group.id} className="rounded-xl p-3 space-y-2"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{group.nome}</span>
                    <span className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {group.tipo === 'single' ? 'Seleção única' : `Múltipla · até ${group.max_select}`}
                      {group.obrigatorio ? ' · Obrigatório' : ''}
                    </span>
                  </div>
                  <button onClick={() => deleteGroup(group.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg transition"
                    style={{ color: 'var(--red)', border: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                    <Trash2 size={11} />
                  </button>
                </div>

                <div className="space-y-1">
                  {(group.product_options ?? []).filter(o => o.ativo).map(opt => (
                    <div key={opt.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <span className="flex-1 text-xs" style={{ color: 'var(--text-primary)' }}>{opt.nome}</span>
                      <span className="text-xs font-mono" style={{ color: opt.price_delta > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {opt.price_delta > 0 ? `+R$ ${Number(opt.price_delta).toFixed(2).replace('.', ',')}` : 'grátis'}
                      </span>
                      <button onClick={() => deleteOption(group.id, opt.id)}
                        className="w-5 h-5 flex items-center justify-center rounded transition"
                        style={{ color: 'var(--red)' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input className="input text-xs flex-1" placeholder="Nome da opção"
                    value={newOptionForms[group.id]?.nome ?? ''}
                    onChange={e => setNewOptionForms(f => ({ ...f, [group.id]: { ...f[group.id], nome: e.target.value } }))} />
                  <input className="input text-xs w-24" placeholder="+R$ 0,00"
                    value={newOptionForms[group.id]?.price_delta ?? '0'}
                    onChange={e => setNewOptionForms(f => ({ ...f, [group.id]: { ...f[group.id], price_delta: e.target.value } }))} />
                  <button onClick={() => addOption(group.id)}
                    disabled={!newOptionForms[group.id]?.nome.trim() || savingOption === group.id}
                    className="btn-secondary px-3 py-1.5 text-xs">
                    {savingOption === group.id ? <Spinner size={12} /> : <Plus size={12} />}
                  </button>
                </div>
              </div>
            ))}

            {/* New group form */}
            <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Novo Grupo</p>
              <div>
                <label className="label">Nome do grupo</label>
                <input className="input text-sm" placeholder="Ex: Ponto da carne, Adicionais, Tamanho"
                  value={newGroupForm.nome}
                  onChange={e => setNewGroupForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Tipo</label>
                  <select className="input text-sm" value={newGroupForm.tipo}
                    onChange={e => setNewGroupForm(f => ({ ...f, tipo: e.target.value as 'single' | 'multiple' }))}>
                    <option value="single">Seleção única</option>
                    <option value="multiple">Múltipla escolha</option>
                  </select>
                </div>
                {newGroupForm.tipo === 'multiple' && (
                  <div>
                    <label className="label">Máx. seleções</label>
                    <input type="number" className="input text-sm" value={newGroupForm.max_select}
                      onChange={e => setNewGroupForm(f => ({ ...f, max_select: e.target.value }))} />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={newGroupForm.obrigatorio}
                  onChange={e => setNewGroupForm(f => ({ ...f, obrigatorio: e.target.checked }))}
                  className="w-3.5 h-3.5" style={{ accentColor: 'var(--gold)' }} />
                Obrigatório
              </label>
              <button onClick={addGroup} disabled={!newGroupForm.nome.trim() || savingGroup}
                className="btn-primary w-full py-3">
                {savingGroup ? <Spinner size={16} /> : <><Plus size={14} /> Criar Grupo</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
