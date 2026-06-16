import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui/Spinner'
import { OptionsModal, type GroupWithOptions } from '../../components/ui/OptionsModal'
import type { SelectedOption } from '../../types'
import { ShoppingCart, Plus, Minus, Send, CheckCircle, Wind } from 'lucide-react'

interface Categoria { id: number; nome: string; ordem: number }
interface Produto { id: number; nome: string; categoria_id: number; preco: number; stock_quantity: number; is_rosh: boolean }
interface CartItem {
  cartKey: string
  id: number
  nome: string
  preco: number
  priceAdditions: number
  qty: number
  is_rosh: boolean
  selectedOptions: SelectedOption[]
}

export default function QRMenuPage() {
  const { mesaNumber } = useParams<{ mesaNumber: string }>()
  const [mesa, setMesa] = useState<{ id: number; numero: number; status: string } | null>(null)
  const [comanda, setComanda] = useState<{ id: number } | null>(null)
  const [categories, setCategories] = useState<Categoria[]>([])
  const [products, setProducts] = useState<Produto[]>([])
  const [optionGroupsMap, setOptionGroupsMap] = useState<Record<number, GroupWithOptions[]>>({})
  const [cart, setCart] = useState<CartItem[]>([])
  const [pendingProduct, setPendingProduct] = useState<Produto | null>(null)
  const [selCat, setSelCat] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: m } = await supabase.from('mesas').select('*').eq('numero', parseInt(mesaNumber!)).single()
      setMesa(m)
      if (m?.status === 'ocupada') {
        const { data: c } = await supabase.from('comandas').select('id').eq('mesa_id', m.id).eq('status', 'aberta').single()
        setComanda(c)
      }
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from('categorias').select('*').eq('exibe_cardapio', true).order('ordem'),
        supabase.from('products').select('id, nome, categoria_id, preco, stock_quantity, is_rosh')
          .eq('active', true).eq('exibe_cardapio', true).gt('stock_quantity', 0).order('nome'),
      ])
      setCategories(cats ?? [])
      setProducts(prods ?? [])
      if (cats?.[0]) setSelCat(cats[0].id)

      const productIds = (prods ?? []).map(p => p.id)
      if (productIds.length > 0) {
        const { data: groups } = await supabase
          .from('product_option_groups')
          .select('*, product_options(*)')
          .in('product_id', productIds)
          .eq('ativo', true)
          .order('ordem')
        const map: Record<number, GroupWithOptions[]> = {}
        for (const g of (groups ?? []) as (GroupWithOptions & { product_id: number; product_options: { id: number; nome: string; price_delta: number; ativo: boolean }[] })[]) {
          if (!map[g.product_id]) map[g.product_id] = []
          map[g.product_id].push({
            id: g.id,
            nome: g.nome,
            tipo: g.tipo,
            obrigatorio: g.obrigatorio,
            min_select: g.min_select,
            max_select: g.max_select,
            options: (g.product_options ?? []).filter(o => o.ativo).map(o => ({
              id: o.id,
              nome: o.nome,
              price_delta: Number(o.price_delta),
            })),
          })
        }
        setOptionGroupsMap(map)
      }

      setLoading(false)
    }
    init()
  }, [mesaNumber])

  function handleProductClick(p: Produto) {
    const groups = optionGroupsMap[p.id]
    if (groups && groups.length > 0) {
      setPendingProduct(p)
    } else {
      addDirect(p, [], 0)
    }
  }

  function addDirect(p: Produto, selectedOptions: SelectedOption[], priceAdditions: number) {
    const cartKey = selectedOptions.length > 0
      ? `${p.id}-${selectedOptions.map(o => o.option_id).sort().join(',')}`
      : `${p.id}`
    setCart(c => {
      const ex = c.find(i => i.cartKey === cartKey)
      if (ex) return c.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { cartKey, id: p.id, nome: p.nome, preco: p.preco, priceAdditions, qty: 1, is_rosh: p.is_rosh, selectedOptions }]
    })
  }

  function removeFromCart(cartKey: string) {
    setCart(c => c.flatMap(i => i.cartKey === cartKey ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]))
  }

  async function sendOrder() {
    if (!comanda || !mesa || cart.length === 0) return
    setSending(true)
    const { data: pedido } = await supabase.from('pedidos').insert({
      comanda_id: comanda.id,
      mesa_id: mesa.id,
      observacao: customerName || null,
    }).select().single()

    const items = cart.map(i => ({
      pedido_id: pedido!.id,
      product_id: i.id,
      nome_produto: i.nome,
      preco_unitario: i.preco,
      quantidade: i.qty,
      is_rosh: i.is_rosh,
      selected_options: i.selectedOptions.length > 0 ? i.selectedOptions : null,
      price_additions: i.priceAdditions,
      total_item: (i.preco + i.priceAdditions) * i.qty,
    }))
    await supabase.from('pedido_itens').insert(items)

    const pedidoTotal = items.reduce((s, i) => s + i.total_item, 0)
    const { data: currentComanda } = await supabase
      .from('comandas').select('total').eq('id', comanda.id).single()
    if (currentComanda) {
      await supabase.from('comandas')
        .update({ total: (currentComanda.total ?? 0) + pedidoTotal })
        .eq('id', comanda.id)
    }

    setCart([])
    setSending(false)
    setSent(true)
    setCartOpen(false)
    setTimeout(() => setSent(false), 5000)
  }

  if (loading) return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <Spinner size={32} />
    </div>
  )

  if (!mesa) return (
    <div className="min-h-screen bg-ink flex items-center justify-center text-white text-center p-6">
      <div>
        <p className="text-2xl font-display font-bold mb-2 text-white">Mesa não encontrada</p>
        <p className="text-[#444]">Verifique o número e tente novamente.</p>
      </div>
    </div>
  )

  if (mesa.status !== 'ocupada' || !comanda) return (
    <div className="min-h-screen bg-ink flex items-center justify-center text-white text-center p-6">
      <div>
        <div className="w-16 h-16 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center mx-auto mb-4">
          <Wind size={28} className="text-gold" />
        </div>
        <p className="text-2xl font-display font-bold mb-2">Mesa {mesa.numero}</p>
        <p className="text-[#444] text-sm">Esta mesa ainda não foi aberta. Por favor, procure o caixa.</p>
      </div>
    </div>
  )

  const filteredProds = selCat ? products.filter(p => p.categoria_id === selCat) : products
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cart.reduce((s, i) => s + (i.preco + i.priceAdditions) * i.qty, 0)

  return (
    <div className="min-h-screen bg-ink text-white flex flex-col">
      {pendingProduct && (
        <OptionsModal
          productNome={pendingProduct.nome}
          productPreco={pendingProduct.preco}
          groups={optionGroupsMap[pendingProduct.id] ?? []}
          onConfirm={(selectedOptions, priceAdditions) => {
            addDirect(pendingProduct, selectedOptions, priceAdditions)
            setPendingProduct(null)
          }}
          onClose={() => setPendingProduct(null)}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-ink/95 backdrop-blur-sm border-b border-ink-border px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
            <span className="font-display font-bold text-white">Lux Lounge</span>
          </div>
          <p className="text-[#444] text-xs pl-3.5">Mesa {mesa.numero}</p>
        </div>
        <button onClick={() => setCartOpen(true)} className="relative p-2.5 rounded-xl bg-gold text-ink">
          <ShoppingCart size={19} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-ink text-gold text-[10px] font-bold rounded-full flex items-center justify-center border border-gold/30">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Success banner */}
      {sent && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
          <CheckCircle size={15} /> Pedido enviado com sucesso!
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-ink-border">
        {categories.map(c => (
          <button key={c.id} onClick={() => setSelCat(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition
              ${selCat === c.id ? 'bg-gold text-ink' : 'bg-ink-raised border border-ink-border text-[#555] hover:text-white'}`}>
            {c.nome}
          </button>
        ))}
      </div>

      {/* Products grid */}
      <div className="flex-1 p-4 grid grid-cols-2 gap-3 pb-28">
        {filteredProds.map(p => {
          const inCart = cart.some(i => i.id === p.id)
          const cartQty = cart.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0)
          const hasOptions = (optionGroupsMap[p.id]?.length ?? 0) > 0
          return (
            <button key={p.id} onClick={() => handleProductClick(p)}
              className={`flex flex-col p-4 rounded-2xl border text-left transition active:scale-95
                ${inCart ? 'border-gold/40 bg-gold/5' : 'border-ink-border bg-ink-card hover:border-ink-border-2'}`}>
              <div className="flex items-start justify-between gap-1 mb-2">
                <span className="font-semibold text-sm text-white leading-tight">{p.nome}</span>
                {p.is_rosh && <Wind size={10} className="text-gold shrink-0 mt-0.5" />}
              </div>
              <span className="text-gold font-bold text-sm">R$ {Number(p.preco).toFixed(2).replace('.', ',')}</span>
              {hasOptions && <span className="text-[10px] text-[#555] mt-0.5">Personalizável</span>}
              {inCart && (
                <span className="mt-2 text-[10px] font-bold bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded-full self-start">
                  {cartQty}× no carrinho
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative w-full bg-ink-card border-t border-ink-border rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
            <h2 className="font-display font-bold text-xl text-white mb-4">Meu Pedido</h2>

            <div>
              <label className="block text-xs text-[#444] uppercase tracking-wider mb-1.5">Seu nome (opcional)</label>
              <input className="input text-sm" placeholder="Ex: Eduardo" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>

            <div className="space-y-3 mt-4">
              {cart.length === 0 && <p className="text-[#444] text-sm text-center py-4">Carrinho vazio</p>}
              {cart.map(i => (
                <div key={i.cartKey} className="flex items-start gap-3">
                  <div className="flex items-center bg-ink-raised border border-ink-border rounded-xl overflow-hidden shrink-0">
                    <button onClick={() => removeFromCart(i.cartKey)} className="p-2.5 text-[#555] hover:text-white transition"><Minus size={13} /></button>
                    <span className="text-sm font-bold w-6 text-center text-white">{i.qty}</span>
                    <button onClick={() => addDirect({ id: i.id, nome: i.nome, preco: i.preco, stock_quantity: 99, categoria_id: 0, is_rosh: i.is_rosh }, i.selectedOptions, i.priceAdditions)} className="p-2.5 text-[#555] hover:text-white transition"><Plus size={13} /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{i.nome}</span>
                    {i.selectedOptions.length > 0 && (
                      <p className="text-[10px] text-[#555] mt-0.5 truncate">
                        {i.selectedOptions.map(o => o.option_nome).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gold shrink-0">R$ {((i.preco + i.priceAdditions) * i.qty).toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <>
                <div className="flex justify-between items-center my-4 py-3 border-t border-ink-border">
                  <span className="font-semibold text-white">Total</span>
                  <span className="font-display font-bold text-xl text-gold">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <button onClick={sendOrder} disabled={sending} className="btn-primary w-full py-4 text-base">
                  {sending ? <Spinner size={20} /> : <><Send size={17} /> Enviar · R$ {cartTotal.toFixed(2).replace('.', ',')}</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating cart button */}
      {!cartOpen && cartCount > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-40">
          <button onClick={() => setCartOpen(true)} className="btn-primary w-full py-4 text-sm shadow-gold">
            <ShoppingCart size={17} />
            Ver carrinho · {cartCount} item(s) · R$ {cartTotal.toFixed(2).replace('.', ',')}
          </button>
        </div>
      )}
    </div>
  )
}
