import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui/Spinner'
import { ShoppingCart, Plus, Minus, Send, CheckCircle, Wind } from 'lucide-react'

interface Categoria { id: number; nome: string; ordem: number }
interface Produto { id: number; nome: string; categoria_id: number; preco: number; stock_quantity: number; is_rosh: boolean }
interface CartItem { id: number; nome: string; preco: number; qty: number; is_rosh: boolean }

export default function QRMenuPage() {
  const { mesaNumber } = useParams<{ mesaNumber: string }>()
  const [mesa, setMesa] = useState<{ id: number; numero: number; status: string } | null>(null)
  const [comanda, setComanda] = useState<{ id: number } | null>(null)
  const [categories, setCategories] = useState<Categoria[]>([])
  const [products, setProducts] = useState<Produto[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
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
      setLoading(false)
    }
    init()
  }, [mesaNumber])

  function addToCart(p: Produto) {
    setCart(c => {
      const ex = c.find(i => i.id === p.id)
      if (ex) return c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { id: p.id, nome: p.nome, preco: p.preco, qty: 1, is_rosh: p.is_rosh }]
    })
  }

  function removeFromCart(id: number) {
    setCart(c => c.flatMap(i => i.id === id ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]))
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
      total_item: i.preco * i.qty,
    }))
    await supabase.from('pedido_itens').insert(items)

    // Update comanda total
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
  const cartTotal = cart.reduce((s, i) => s + i.preco * i.qty, 0)

  return (
    <div className="min-h-screen bg-ink text-white flex flex-col">
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
          const inCart = cart.find(i => i.id === p.id)
          return (
            <button key={p.id} onClick={() => addToCart(p)}
              className={`flex flex-col p-4 rounded-2xl border text-left transition active:scale-95
                ${inCart ? 'border-gold/40 bg-gold/5' : 'border-ink-border bg-ink-card hover:border-ink-border-2'}`}>
              <div className="flex items-start justify-between gap-1 mb-2">
                <span className="font-semibold text-sm text-white leading-tight">{p.nome}</span>
                {p.is_rosh && <Wind size={10} className="text-gold shrink-0 mt-0.5" />}
              </div>
              <span className="text-gold font-bold text-sm">R$ {Number(p.preco).toFixed(2).replace('.', ',')}</span>
              {inCart && (
                <span className="mt-2 text-[10px] font-bold bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded-full self-start">
                  {inCart.qty}× no carrinho
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
                <div key={i.id} className="flex items-center gap-3">
                  <div className="flex items-center bg-ink-raised border border-ink-border rounded-xl overflow-hidden">
                    <button onClick={() => removeFromCart(i.id)} className="p-2.5 text-[#555] hover:text-white transition"><Minus size={13} /></button>
                    <span className="text-sm font-bold w-6 text-center text-white">{i.qty}</span>
                    <button onClick={() => addToCart({ ...i, stock_quantity: 99, categoria_id: 0 })} className="p-2.5 text-[#555] hover:text-white transition"><Plus size={13} /></button>
                  </div>
                  <span className="flex-1 text-sm text-white">{i.nome}</span>
                  <span className="text-sm font-bold text-gold">R$ {(i.preco * i.qty).toFixed(2).replace('.', ',')}</span>
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
                  {sending ? <Spinner size={20} /> : <><Send size={17} /> Enviar Pedido</>}
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
