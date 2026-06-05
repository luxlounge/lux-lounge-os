import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Comanda, Pedido, PedidoItem, Pagamento, Mesa, Categoria, Product } from '../types'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import {
  ArrowLeft, Plus, CreditCard, Banknote, Smartphone, DollarSign,
  ArrowRightLeft, CheckCircle, Package, X, ChevronRight
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PayMethod = 'dinheiro' | 'pix' | 'credito' | 'debito'

const METHOD_ICON: Record<PayMethod, React.ReactNode> = {
  dinheiro: <Banknote size={16} />,
  pix: <Smartphone size={16} />,
  credito: <CreditCard size={16} />,
  debito: <CreditCard size={16} />,
}
const METHOD_LABEL: Record<PayMethod, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito',
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
      supabase.from('comandas').select('*, mesas(*)').eq('id', id!).single(),
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
    setSaving(false)
    setPayModal(false)
    setPayForm({ amount: '', method: 'pix' })
    load()
  }

  async function closeComanda() {
    if (!comanda) return
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
    <div className="flex items-center justify-center h-screen bg-ink">
      <Spinner size={32} />
    </div>
  )
  if (!comanda) return (
    <div className="flex items-center justify-center h-screen bg-ink text-[#555]">Comanda não encontrada</div>
  )

  const mesaNumero = (comanda as any).mesas?.numero ?? '?'
  const balance = comanda.total - comanda.total_pago
  const canAct = ['admin', 'caixa'].includes(profile?.role ?? '') && comanda.status === 'aberta'
  const isClosed = comanda.status === 'fechada'

  return (
    <div className="min-h-screen bg-ink pb-24 md:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-ink/95 backdrop-blur-sm border-b border-ink-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/mesas')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-ink-raised border border-ink-border text-[#555] hover:text-white transition active:scale-95">
            <ArrowLeft size={17} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-white text-lg">Mesa {mesaNumero}</h1>
              <span className="text-[#3A3A3A]">·</span>
              <span className="text-[#555] text-sm">#{comanda.id}</span>
            </div>
            <p className="text-xs text-[#444]">
              {format(new Date(comanda.aberta_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          {isClosed && <span className="badge-gray text-[10px] badge">Fechada</span>}
          {!isClosed && (
            <span className="flex items-center gap-1.5 text-xs text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
              Aberta
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-xl mx-auto">
        {/* Financial Summary */}
        <div className="bg-ink-card border border-ink-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-ink-border">
            <div className="px-4 py-5">
              <p className="text-[10px] text-[#444] uppercase tracking-widest mb-1">Total</p>
              <p className="font-display font-bold text-xl text-white">{fmt(comanda.total)}</p>
            </div>
            <div className="px-4 py-5">
              <p className="text-[10px] text-[#444] uppercase tracking-widest mb-1">Pago</p>
              <p className="font-display font-bold text-xl text-emerald-400">{fmt(comanda.total_pago)}</p>
            </div>
            <div className="px-4 py-5">
              <p className="text-[10px] text-[#444] uppercase tracking-widest mb-1">Saldo</p>
              <p className={`font-display font-bold text-xl ${balance > 0.01 ? 'text-gold' : 'text-emerald-400'}`}>
                {fmt(balance)}
              </p>
            </div>
          </div>
          {balance > 0.01 && (
            <div className="px-4 pb-3">
              <div className="w-full bg-ink-raised rounded-full h-1">
                <div
                  className="bg-gold h-1 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (comanda.total_pago / comanda.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {canAct && (
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Plus, label: 'Adicionar Pedido', sub: 'novo item', action: () => setAddOrderModal(true), highlight: true },
              { icon: DollarSign, label: 'Registrar Pagamento', sub: balance > 0 ? fmt(balance) + ' pendente' : 'quitado', action: () => setPayModal(true), highlight: false },
              { icon: ArrowRightLeft, label: 'Transferir Mesa', sub: `${mesasDisp.length} disponíveis`, action: () => setTransferModal(true), highlight: false },
              { icon: CheckCircle, label: 'Fechar Comanda', sub: balance > 0.01 ? 'saldo pendente' : 'pronto', action: closeComanda, disabled: balance > 0.01 || saving, highlight: false },
            ].map(({ icon: Icon, label, sub, action, highlight, disabled }) => (
              <button
                key={label}
                onClick={action}
                disabled={disabled}
                className={[
                  'flex flex-col items-start p-4 rounded-2xl border transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-left',
                  highlight
                    ? 'bg-gold/10 border-gold/30 hover:bg-gold/15'
                    : 'bg-ink-card border-ink-border hover:border-ink-border-2',
                ].join(' ')}
              >
                <Icon size={18} className={highlight ? 'text-gold mb-2' : 'text-[#555] mb-2'} />
                <span className={`text-sm font-semibold leading-tight ${highlight ? 'text-gold' : 'text-white'}`}>{label}</span>
                <span className="text-[11px] text-[#444] mt-0.5">{sub}</span>
              </button>
            ))}
          </div>
        )}

        {/* Payments */}
        {pagamentos.length > 0 && (
          <div>
            <p className="text-[11px] text-[#444] uppercase tracking-widest mb-2 flex items-center gap-2">
              Pagamentos
              <span className="flex-1 h-px bg-ink-border" />
            </p>
            <div className="bg-ink-card border border-ink-border rounded-2xl divide-y divide-ink-border overflow-hidden">
              {pagamentos.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 text-[#888]">
                    {METHOD_ICON[p.metodo as PayMethod]}
                    <div>
                      <span className="text-sm text-white">{METHOD_LABEL[p.metodo as PayMethod] ?? p.metodo}</span>
                      <p className="text-[11px] text-[#444]">{format(new Date(p.created_at), 'HH:mm')}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-emerald-400">{fmt(Number(p.valor))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pedidos */}
        <div>
          <p className="text-[11px] text-[#444] uppercase tracking-widest mb-2 flex items-center gap-2">
            Pedidos ({pedidos.length})
            <span className="flex-1 h-px bg-ink-border" />
          </p>
          {pedidos.length === 0 && (
            <div className="bg-ink-card border border-ink-border rounded-2xl flex flex-col items-center justify-center py-10 text-center">
              <Package size={28} className="text-[#2A2A2A] mb-2" />
              <p className="text-sm text-[#444]">Nenhum pedido ainda</p>
              {canAct && (
                <button onClick={() => setAddOrderModal(true)} className="btn-secondary btn-sm mt-3">
                  <Plus size={13} /> Adicionar
                </button>
              )}
            </div>
          )}
          <div className="space-y-2">
            {pedidos.map(p => (
              <div key={p.id} className="bg-ink-card border border-ink-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-ink-border">
                  <div className="flex items-center gap-2">
                    <span className="text-[#444] text-xs font-mono">#{p.id}</span>
                    {p.observacao && (
                      <span className="text-xs text-[#666]">— {p.observacao}</span>
                    )}
                    <span className="text-[#333] text-xs">{format(new Date(p.created_at), 'HH:mm')}</span>
                  </div>
                  <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-gray'}`}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {(p.pedido_itens ?? []).map((item: PedidoItem) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-[#ccc]">
                        <span className="text-gold font-semibold mr-1.5">{item.quantidade}×</span>
                        {item.nome_produto}
                      </span>
                      <span className="text-[#555] text-xs">{fmt(Number(item.total_item))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Payment */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Registrar Pagamento">
        <div className="space-y-4">
          <div>
            <label className="label">Valor</label>
            <input
              type="text" inputMode="decimal" className="input text-xl font-display" placeholder="0,00"
              value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
            />
            {balance > 0.01 && (
              <button
                onClick={() => setPayForm(f => ({ ...f, amount: balance.toFixed(2).replace('.', ',') }))}
                className="flex items-center gap-1 text-xs text-gold mt-2 hover:text-gold-light"
              >
                <ChevronRight size={12} /> Usar saldo total: {fmt(balance)}
              </button>
            )}
          </div>
          <div>
            <label className="label">Forma de Pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(METHOD_LABEL) as PayMethod[]).map(m => (
                <button
                  key={m}
                  onClick={() => setPayForm(f => ({ ...f, method: m }))}
                  className={[
                    'flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition active:scale-95',
                    payForm.method === m
                      ? 'border-gold/40 bg-gold/10 text-gold'
                      : 'border-ink-border bg-ink-raised text-[#666] hover:text-white hover:border-ink-border-2',
                  ].join(' ')}
                >
                  {METHOD_ICON[m]} {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={addPayment}
            disabled={!payForm.amount || saving}
            className="btn-primary w-full py-3.5"
          >
            {saving ? <Spinner size={18} /> : 'Confirmar Pagamento'}
          </button>
        </div>
      </Modal>

      {/* Transfer */}
      <Modal open={transferModal} onClose={() => setTransferModal(false)} title="Transferir Mesa">
        <div className="space-y-4">
          <p className="text-sm text-[#555]">Selecione a mesa de destino</p>
          {mesasDisp.length === 0 ? (
            <p className="text-center py-6 text-[#444] text-sm">Nenhuma mesa disponível</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {mesasDisp.map(m => (
                <button
                  key={m.id}
                  onClick={() => setTransferMesa(String(m.id))}
                  className={[
                    'p-3 rounded-xl border font-display font-bold text-xl transition active:scale-95',
                    transferMesa === String(m.id)
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-ink-border bg-ink-raised text-white hover:border-ink-border-2',
                  ].join(' ')}
                >
                  {m.numero}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={transferMesaFn}
            disabled={!transferMesa || saving}
            className="btn-primary w-full py-3.5"
          >
            {saving ? <Spinner size={18} /> : 'Transferir Mesa'}
          </button>
        </div>
      </Modal>

      {/* Add Order */}
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
  const [categories, setCategories] = useState<Categoria[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selCat, setSelCat] = useState<number | null>(null)
  const [cart, setCart] = useState<{ id: number; nome: string; preco: number; qty: number; is_rosh: boolean }[]>([])
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
    const { data: pedido } = await supabase
      .from('pedidos')
      .insert({ comanda_id: comandaId, mesa_id: mesaId })
      .select()
      .single()
    await supabase.from('pedido_itens').insert(
      cart.map(i => ({
        pedido_id: pedido!.id,
        product_id: i.id,
        nome_produto: i.nome,
        preco_unitario: i.preco,
        quantidade: i.qty,
        is_rosh: i.is_rosh,
      }))
    )
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
          <button
            key={c.id}
            onClick={() => setSelCat(c.id)}
            className={[
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition',
              selCat === c.id
                ? 'bg-gold text-ink font-bold'
                : 'bg-ink-raised border border-ink-border text-[#666] hover:text-white',
            ].join(' ')}
          >
            {c.nome}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        {filtered.map(p => {
          const inCart = cart.find(i => i.id === p.id)
          return (
            <button
              key={p.id}
              onClick={() => add(p)}
              className={[
                'flex flex-col p-3 rounded-xl border text-left transition active:scale-95',
                inCart
                  ? 'border-gold/40 bg-gold/10'
                  : 'border-ink-border bg-ink-raised hover:border-ink-border-2',
              ].join(' ')}
            >
              <span className="text-sm font-medium text-white leading-snug">{p.nome}</span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs font-bold text-gold">R$ {Number(p.preco).toFixed(2).replace('.', ',')}</span>
                {inCart && <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-full">{inCart.qty}×</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Cart summary */}
      {cart.length > 0 && (
        <div className="bg-ink-raised border border-ink-border rounded-xl p-3 space-y-2">
          {cart.map(i => (
            <div key={i.id} className="flex items-center gap-2 text-sm">
              <button onClick={() => remove(i.id)} className="w-5 h-5 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-xs font-bold shrink-0">−</button>
              <span className="flex-1 text-white">{i.qty}× {i.nome}</span>
              <span className="text-[#555] text-xs">R$ {(i.preco * i.qty).toFixed(2).replace('.', ',')}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 border-t border-ink-border">
            <span className="text-sm text-[#888]">{cartCount} item(s)</span>
            <span className="font-bold text-gold">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
      )}

      <button onClick={submit} disabled={cart.length === 0 || saving} className="btn-primary w-full py-3.5">
        {saving ? <Spinner size={18} /> : `Enviar Pedido${cartTotal > 0 ? ` · R$ ${cartTotal.toFixed(2).replace('.', ',')}` : ''}`}
      </button>
    </div>
  )
}
