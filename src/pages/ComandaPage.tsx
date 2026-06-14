import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Comanda, Pedido, PedidoItem, Pagamento, Mesa, Categoria, Product } from '../types'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import {
  ArrowLeft, Plus, CreditCard, Banknote, Smartphone, DollarSign,
  ArrowRightLeft, CheckCircle, Package, X, ChevronRight, Gift, UserCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PayMethod = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'cortesia'

const METHOD_ICON: Record<PayMethod, React.ReactNode> = {
  dinheiro: <Banknote size={16} />,
  pix:      <Smartphone size={16} />,
  credito:  <CreditCard size={16} />,
  debito:   <CreditCard size={16} />,
  cortesia: <Gift size={16} />,
}
const METHOD_LABEL: Record<PayMethod, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito', cortesia: 'Cortesia',
}

const STATUS_BADGE: Record<string, string> = {
  pendente: 'badge-blue', preparo: 'badge-yellow', entregue: 'badge-green', cancelado: 'badge-red',
}
const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', preparo: 'Preparo', entregue: 'Entregue', cancelado: 'Cancelado',
}

function fmt(n: number) {
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

export default function ComandaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [mesasDisp, setMesasDisp] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)

  const [payModal, setPayModal] = useState(false)
  const [transferModal, setTransferModal] = useState(false)
  const [addOrderModal, setAddOrderModal] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', method: 'pix' as PayMethod })
  const [transferMesa, setTransferMesa] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: c }, { data: ps }, { data: pays }, { data: ms }] = await Promise.all([
      supabase.from('comandas').select('*, mesas(*), clientes(id, nome, whatsapp, total_visits)').eq('id', id!).single(),
      supabase.from('pedidos').select('*, pedido_itens(*)').eq('comanda_id', id!).order('created_at', { ascending: false }),
      supabase.from('pagamentos').select('*').eq('comanda_id', id!).order('created_at'),
      supabase.from('mesas').select('*').eq('status', 'disponivel').order('numero'),
    ])
    setComanda(c)
    setPedidos(ps ?? [])
    setPagamentos(pays ?? [])
    setMesasDisp(ms ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const sub = supabase.channel(`comanda-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `comanda_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos', filter: `comanda_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load, id])

  async function addPayment() {
    if (!comanda) return
    setSaving(true)
    const valor = parseFloat(payForm.amount.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setSaving(false); return }
    await supabase.from('pagamentos').insert({
      comanda_id: comanda.id, valor, metodo: payForm.method, registrado_por: profile?.id,
    })
    // Update total_pago without depending on a trigger
    const { data: pags } = await supabase
      .from('pagamentos').select('valor').eq('comanda_id', comanda.id)
    const totalPago = (pags ?? []).reduce((s, p) => s + Number(p.valor), 0)
    await supabase.from('comandas').update({ total_pago: totalPago }).eq('id', comanda.id)
    setSaving(false)
    setPayModal(false)
    setPayForm({ amount: '', method: 'pix' })
    load()
  }

  async function closeComanda(force = false) {
    if (!comanda) return
    const openOrders = pedidos.filter(p => ['pendente', 'preparo'].includes(p.status))
    if (!force && openOrders.length > 0) {
      if (!confirm(`Há ${openOrders.length} pedido(s) ainda em preparo. Fechar mesmo assim?`)) return
    }
    setSaving(true)
    const { error } = await supabase.rpc('fn_fechar_comanda', { p_comanda_id: comanda.id })
    setSaving(false)
    if (error) { alert(error.message); return }
    navigate('/mesas')
  }

  async function transferMesaFn() {
    if (!comanda || !transferMesa) return
    setSaving(true)
    const { error } = await supabase.rpc('fn_transferir_mesa', {
      p_comanda_id: comanda.id,
      p_mesa_destino_id: parseInt(transferMesa),
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    setTransferModal(false)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
      <Spinner size={32} />
    </div>
  )
  if (!comanda) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
      Comanda não encontrada
    </div>
  )

  const mesaNumero = (comanda as any).mesas?.numero ?? '?'
  const balance = comanda.total - comanda.total_pago
  const canAct = ['admin', 'caixa'].includes(profile?.role ?? '') && comanda.status === 'aberta'
  const canForceClose = profile?.role === 'admin' && comanda.status === 'aberta' && balance > 0.01
  const isClosed = comanda.status === 'fechada'

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-sm"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/mesas')}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
            <ArrowLeft size={17} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                Mesa {mesaNumero}
              </h1>
              <span style={{ color: 'var(--border-strong)' }}>·</span>
              <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>#{comanda.id}</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {format(new Date(comanda.aberta_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
              {comanda.pessoas ? ` · ${comanda.pessoas} pessoa(s)` : ''}
            </p>
            {(comanda as any).clientes && (
              <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                <UserCheck size={10} style={{ color: 'var(--green)' }} />
                {(comanda as any).clientes.nome}
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                {(comanda as any).clientes.whatsapp}
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                {(comanda as any).clientes.total_visits}ª visita
              </p>
            )}
            {comanda.observacao && (
              <p className="text-xs italic mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {comanda.observacao}
              </p>
            )}
          </div>
          {isClosed
            ? <span className="badge badge-gray text-[10px]">Fechada</span>
            : <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--gold)' }}>
                <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--gold)' }} />
                Aberta
              </span>
          }
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-xl mx-auto">

        {/* Financial summary */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="grid grid-cols-3">
            {[
              { label: 'Total', value: fmt(comanda.total), color: 'var(--text-primary)' },
              { label: 'Pago',  value: fmt(comanda.total_pago), color: 'var(--green)' },
              { label: 'Saldo', value: fmt(balance), color: balance > 0.01 ? 'var(--gold)' : 'var(--green)' },
            ].map(({ label, value, color }, i) => (
              <div key={label} className="px-4 py-5"
                style={{ borderRight: i < 2 ? '1px solid var(--border-subtle)' : 'none' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="font-mono font-bold text-xl" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          {balance > 0.01 && (
            <div className="px-4 pb-3">
              <div className="progress-bar">
                <div className="progress-bar-fill"
                  style={{ width: `${Math.min(100, (comanda.total_pago / comanda.total) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {canAct && (
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Plus,          label: 'Adicionar Pedido',    sub: 'novo item',                              action: () => setAddOrderModal(true), highlight: true,  disabled: false },
              { icon: DollarSign,    label: 'Registrar Pagamento', sub: balance > 0 ? fmt(balance)+' pendente' : 'quitado', action: () => setPayModal(true), highlight: false, disabled: false },
              { icon: ArrowRightLeft,label: 'Transferir Mesa',     sub: `${mesasDisp.length} disponíveis`,        action: () => setTransferModal(true), highlight: false, disabled: false },
              { icon: CheckCircle,   label: 'Fechar Comanda',      sub: balance > 0.01 ? 'saldo pendente' : 'pronto', action: () => closeComanda(), disabled: balance > 0.01 && !canForceClose, highlight: false },
            ].map(({ icon: Icon, label, sub, action, highlight, disabled }) => (
              <button key={label} onClick={action} disabled={disabled}
                className="flex flex-col items-start p-4 rounded-2xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-left"
                style={{
                  background: highlight ? 'var(--gold-bg)' : 'var(--bg-card)',
                  border: `1px solid ${highlight ? 'var(--gold-border)' : 'var(--border-default)'}`,
                }}>
                <Icon size={18} className="mb-2" style={{ color: highlight ? 'var(--gold)' : 'var(--text-muted)' }} />
                <span className="text-sm font-semibold leading-tight" style={{ color: highlight ? 'var(--gold)' : 'var(--text-primary)' }}>{label}</span>
                <span className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</span>
              </button>
            ))}
          </div>
        )}

        {/* Force close for admin when balance pending */}
        {canForceClose && (
          <button onClick={() => closeComanda(true)} disabled={saving}
            className="btn-danger w-full py-2.5 text-sm">
            {saving ? <Spinner size={15} /> : 'Fechar com Saldo Pendente (Admin)'}
          </button>
        )}

        {/* Payments */}
        {pagamentos.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-widest mb-2 flex items-center gap-2"
              style={{ color: 'var(--text-muted)' }}>
              Pagamentos <span className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              {pagamentos.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div className="flex items-center gap-2.5" style={{ color: 'var(--text-secondary)' }}>
                    {METHOD_ICON[p.metodo as PayMethod]}
                    <div>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {METHOD_LABEL[p.metodo as PayMethod] ?? p.metodo}
                      </span>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {format(new Date(p.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold font-mono" style={{ color: 'var(--green)' }}>{fmt(Number(p.valor))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pedidos */}
        <div>
          <p className="text-[11px] uppercase tracking-widest mb-2 flex items-center gap-2"
            style={{ color: 'var(--text-muted)' }}>
            Pedidos ({pedidos.length})
            <span className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          </p>
          {pedidos.length === 0 && (
            <div className="rounded-2xl flex flex-col items-center justify-center py-10 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <Package size={28} className="mb-2" style={{ color: 'var(--border-strong)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum pedido ainda</p>
              {canAct && (
                <button onClick={() => setAddOrderModal(true)} className="btn-secondary btn-sm mt-3">
                  <Plus size={13} /> Adicionar
                </button>
              )}
            </div>
          )}
          <div className="space-y-2">
            {pedidos.map(p => (
              <div key={p.id} className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>#{p.id}</span>
                    {p.observacao && (
                      <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>— {p.observacao}</span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {format(new Date(p.created_at), 'HH:mm')}
                    </span>
                  </div>
                  <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-gray'}`}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {(p.pedido_itens ?? []).map((item: PedidoItem) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--text-primary)' }}>
                        <span className="font-semibold mr-1.5" style={{ color: 'var(--gold)' }}>{item.quantidade}×</span>
                        {item.nome_produto}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmt(Number(item.total_item))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Registrar Pagamento">
        <div className="space-y-4">
          <div>
            <label className="label">Valor</label>
            <input type="text" inputMode="decimal" className="input text-xl font-mono" placeholder="0,00"
              value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
            {balance > 0.01 && (
              <button onClick={() => setPayForm(f => ({ ...f, amount: balance.toFixed(2).replace('.', ',') }))}
                className="flex items-center gap-1 text-xs mt-2 hover:opacity-80"
                style={{ color: 'var(--gold)' }}>
                <ChevronRight size={12} /> Usar saldo total: {fmt(balance)}
              </button>
            )}
          </div>
          <div>
            <label className="label">Forma de Pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(METHOD_LABEL) as PayMethod[]).map(m => (
                <button key={m} onClick={() => setPayForm(f => ({ ...f, method: m }))}
                  className="flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium transition active:scale-95"
                  style={{
                    border: `1px solid ${payForm.method === m ? 'var(--gold-border)' : 'var(--border-default)'}`,
                    background: payForm.method === m ? 'var(--gold-bg)' : 'var(--bg-raised)',
                    color: payForm.method === m ? 'var(--gold)' : 'var(--text-secondary)',
                  }}>
                  {METHOD_ICON[m]} {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <button onClick={addPayment} disabled={!payForm.amount || saving} className="btn-primary w-full py-3.5">
            {saving ? <Spinner size={18} /> : 'Confirmar Pagamento'}
          </button>
        </div>
      </Modal>

      {/* Transfer modal */}
      <Modal open={transferModal} onClose={() => setTransferModal(false)} title="Transferir Mesa">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Selecione a mesa de destino</p>
          {mesasDisp.length === 0 ? (
            <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma mesa disponível</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {mesasDisp.map(m => (
                <button key={m.id} onClick={() => setTransferMesa(String(m.id))}
                  className="p-3 rounded-xl font-mono font-bold text-xl transition active:scale-95"
                  style={{
                    border: `1px solid ${transferMesa === String(m.id) ? 'var(--gold)' : 'var(--border-default)'}`,
                    background: transferMesa === String(m.id) ? 'var(--gold-bg)' : 'var(--bg-raised)',
                    color: transferMesa === String(m.id) ? 'var(--gold)' : 'var(--text-primary)',
                  }}>
                  {m.numero}
                </button>
              ))}
            </div>
          )}
          <button onClick={transferMesaFn} disabled={!transferMesa || saving} className="btn-primary w-full py-3.5">
            {saving ? <Spinner size={18} /> : 'Transferir Mesa'}
          </button>
        </div>
      </Modal>

      {/* Add Order modal */}
      <Modal open={addOrderModal} onClose={() => setAddOrderModal(false)} title="Novo Pedido" size="lg">
        <AddOrderForm
          comandaId={comanda.id}
          mesaId={comanda.mesa_id}
          onDone={() => { setAddOrderModal(false); load() }}
        />
      </Modal>
    </div>
  )
}

function AddOrderForm({ comandaId, mesaId, onDone }: { comandaId: number; mesaId: number; onDone: () => void }) {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<Categoria[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selCat, setSelCat] = useState<number | null>(null)
  const [cart, setCart] = useState<{ id: number; nome: string; preco: number; qty: number; is_rosh: boolean }[]>([])
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('categorias').select('*').eq('exibe_cardapio', true).order('ordem'),
      supabase.from('products').select('*').eq('active', true).eq('exibe_cardapio', true).order('nome'),
    ]).then(([{ data: cats }, { data: prods }]) => {
      setCategories(cats ?? [])
      setProducts(prods ?? [])
      if (cats?.[0]) setSelCat(cats[0].id)
      setLoading(false)
    })
  }, [])

  function add(p: Product) {
    setCart(c => {
      const ex = c.find(i => i.id === p.id)
      if (ex) return c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { id: p.id, nome: p.nome, preco: p.preco, qty: 1, is_rosh: p.is_rosh }]
    })
  }
  function remove(id: number) {
    setCart(c => c.flatMap(i => i.id === id ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]))
  }

  async function submit() {
    if (cart.length === 0) return
    setSaving(true)
    const { data: pedido, error: pedidoErr } = await supabase
      .from('pedidos')
      .insert({ comanda_id: comandaId, mesa_id: mesaId, observacao: observacao || null, criado_por: profile?.id })
      .select()
      .single()
    if (pedidoErr || !pedido) { setSaving(false); return }

    const itens = cart.map(i => ({
      pedido_id: pedido.id,
      product_id: i.id,
      nome_produto: i.nome,
      preco_unitario: i.preco,
      quantidade: i.qty,
      is_rosh: i.is_rosh,
      total_item: i.preco * i.qty,
    }))
    await supabase.from('pedido_itens').insert(itens)

    // Update comanda total without depending on a trigger
    const pedidoTotal = itens.reduce((s, i) => s + i.total_item, 0)
    const { data: currentComanda } = await supabase
      .from('comandas').select('total').eq('id', comandaId).single()
    if (currentComanda) {
      await supabase.from('comandas')
        .update({ total: (currentComanda.total ?? 0) + pedidoTotal })
        .eq('id', comandaId)
    }

    // Auto stock deduction based on recipe (or self-deduction)
    const productIds = cart.map(i => i.id)
    const { data: recipes } = await supabase
      .from('product_recipe_items')
      .select('product_id, ingredient_product_id, quantity_used')
      .in('product_id', productIds)

    for (const cartItem of cart) {
      const itemRecipes = (recipes ?? []).filter(r => r.product_id === cartItem.id)
      if (itemRecipes.length > 0) {
        // Deduct ingredients
        for (const r of itemRecipes) {
          const totalUsed = r.quantity_used * cartItem.qty
          const { data: ing } = await supabase
            .from('products').select('stock_quantity').eq('id', r.ingredient_product_id).single()
          if (ing) {
            await supabase.from('products')
              .update({ stock_quantity: Math.max(0, ing.stock_quantity - totalUsed) })
              .eq('id', r.ingredient_product_id)
            await supabase.from('estoque_movimentos').insert({
              product_id: r.ingredient_product_id,
              tipo: 'saida',
              quantidade: totalUsed,
              motivo: `Venda pedido #${pedido.id}`,
              pedido_id: pedido.id,
              criado_por: profile?.id ?? null,
            })
          }
        }
      } else {
        // No recipe: deduct product itself
        const { data: prod } = await supabase
          .from('products').select('stock_quantity').eq('id', cartItem.id).single()
        if (prod) {
          await supabase.from('products')
            .update({ stock_quantity: Math.max(0, prod.stock_quantity - cartItem.qty) })
            .eq('id', cartItem.id)
          await supabase.from('estoque_movimentos').insert({
            product_id: cartItem.id,
            tipo: 'saida',
            quantidade: cartItem.qty,
            motivo: `Venda pedido #${pedido.id}`,
            pedido_id: pedido.id,
            criado_por: profile?.id ?? null,
          })
        }
      }
    }

    setSaving(false)
    onDone()
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>

  const filtered = selCat ? products.filter(p => p.categoria_id === selCat) : products
  const cartTotal = cart.reduce((s, i) => s + i.preco * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
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
        {categories.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Nenhuma categoria cadastrada. Acesse Configurações → Categorias.
          </p>
        )}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        {filtered.map(p => {
          const inCart = cart.find(i => i.id === p.id)
          return (
            <button key={p.id} onClick={() => add(p)}
              className="flex flex-col p-3 rounded-xl text-left transition active:scale-95"
              style={{
                border: `1px solid ${inCart ? 'var(--gold-border)' : 'var(--border-default)'}`,
                background: inCart ? 'var(--gold-bg)' : 'var(--bg-raised)',
              }}>
              <span className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>{p.nome}</span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs font-bold font-mono" style={{ color: 'var(--gold)' }}>
                  R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                </span>
                {inCart && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ color: 'var(--gold)', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}>
                    {inCart.qty}×
                  </span>
                )}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && categories.length > 0 && (
          <p className="col-span-2 text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhum produto nesta categoria
          </p>
        )}
      </div>

      {/* Cart summary */}
      {cart.length > 0 && (
        <div className="rounded-xl p-3 space-y-2"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
          {cart.map(i => (
            <div key={i.id} className="flex items-center gap-2 text-sm">
              <button onClick={() => remove(i.id)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>−</button>
              <span className="flex-1" style={{ color: 'var(--text-primary)' }}>{i.qty}× {i.nome}</span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                R$ {(i.preco * i.qty).toFixed(2).replace('.', ',')}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2"
            style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{cartCount} item(s)</span>
            <span className="font-bold font-mono" style={{ color: 'var(--gold)' }}>
              R$ {cartTotal.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>
      )}

      {/* Observação */}
      <div>
        <label className="label">Observação (opcional)</label>
        <input className="input text-sm" placeholder="Ex: sem gelo, bem passado, alergia a…"
          value={observacao} onChange={e => setObservacao(e.target.value)} />
      </div>

      <button onClick={submit} disabled={cart.length === 0 || saving} className="btn-primary w-full py-3.5">
        {saving ? <Spinner size={18} /> : `Enviar Pedido${cartTotal > 0 ? ` · R$ ${cartTotal.toFixed(2).replace('.', ',')}` : ''}`}
      </button>
    </div>
  )
}
