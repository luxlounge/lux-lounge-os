import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Comanda, Pedido, PedidoItem, Pagamento, Mesa, Categoria, Product, SelectedOption, ProductOptionGroup, CompositeConfig, RoshConfig } from '../types'
import { Modal } from '../components/ui/Modal'
import { OptionsModal, type GroupWithOptions } from '../components/ui/OptionsModal'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import {
  ArrowLeft, Plus, CreditCard, Banknote, Smartphone, DollarSign,
  ArrowRightLeft, CheckCircle, Package, X, ChevronRight, Gift, UserCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHelp } from '../components/ui/PageHelp'

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
    if (!force && balance > 0.01) {
      if (!confirm(`Fechar comanda com ${fmt(balance)} em aberto?`)) return
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
          <div className="flex items-center gap-2">
            {isClosed
              ? <span className="badge badge-gray text-[10px]">Fechada</span>
              : <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--gold)' }}>
                  <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--gold)' }} />
                  Aberta
                </span>
            }
            <PageHelp title="Comanda" lines={[
              'Esta é a comanda ativa da mesa. Adicione pedidos pelo botão abaixo e registre os pagamentos.',
              'Você pode registrar vários pagamentos parciais com métodos diferentes.',
              'Para fechar, o total pago precisa ser igual ou maior ao consumo. Depois disso a mesa fica disponível.',
              'Para transferir a mesa, use o botão de transferência — a comanda acompanha para a nova mesa.',
            ]} />
          </div>
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
              { icon: CheckCircle,   label: 'Fechar Comanda',      sub: balance > 0.01 ? 'saldo pendente' : 'pronto', action: () => closeComanda(), disabled: false, highlight: false },
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
                    <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span style={{ color: 'var(--text-primary)' }}>
                          <span className="font-semibold mr-1.5" style={{ color: 'var(--gold)' }}>{item.quantidade}×</span>
                          {item.nome_produto}
                        </span>
                        {item.selected_options && item.selected_options.length > 0 && (
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                            {item.selected_options.map(o => o.option_nome).join(' · ')}
                          </p>
                        )}
                        {item.rosh_config && (
                          <p className="text-[10px] mt-0.5 font-semibold" style={{ color: 'var(--gold)' }}>
                            {item.rosh_config.essencias.length === 1
                              ? `Essência: ${item.rosh_config.essencias[0]?.nome ?? ''}`
                              : `Meio a meio: ${item.rosh_config.essencias.map(e => e.nome).join(' + ')}`}
                          </p>
                        )}
                        {item.composite_config && (
                          <div className="text-[10px] mt-0.5 space-y-0.5">
                            {(item.composite_config.personalizations ?? []).map((pp, idx) => (
                              <p key={idx} style={{ color: 'var(--gold)' }}>{pp.personalization_nome}: {pp.option_nome}</p>
                            ))}
                            {(item.composite_config.addons ?? []).map((a, idx) => (
                              <p key={idx} style={{ color: 'var(--text-muted)' }}>+ {a.addon_nome}</p>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{fmt(Number(item.total_item))}</span>
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

type CartItem = {
  cartKey: string
  id: number
  nome: string
  preco: number
  priceAdditions: number
  qty: number
  is_rosh: boolean
  selectedOptions: SelectedOption[]
  compositeConfig?: CompositeConfig
  roshConfig?: RoshConfig
}

interface CompositeData {
  items: { id: number; component_product_id: number; quantity: number; component: { id: number; nome: string } | null }[]
  personalizations: {
    id: number; nome: string; quantidade: number
    options?: { id: number; personalization_id: number; component_product_id: number; price_delta: number; is_default: boolean; component: { id: number; nome: string; production_sector: string | null } | null }[]
  }[]
  addons: { id: number; component_product_id: number; price_delta: number; component: { id: number; nome: string; production_sector: string | null } | null }[]
}

function AddOrderForm({ comandaId, mesaId, onDone }: { comandaId: number; mesaId: number; onDone: () => void }) {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<Categoria[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [essencias, setEssencias] = useState<{ id: number; nome: string; preco_adicional_rosh: number }[]>([])
  const [optionGroupsMap, setOptionGroupsMap] = useState<Record<number, GroupWithOptions[]>>({})
  const [selCat, setSelCat] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  const [pendingComposite, setPendingComposite] = useState<Product | null>(null)
  const [compositeData, setCompositeData] = useState<CompositeData | null>(null)
  const [loadingComposite, setLoadingComposite] = useState(false)
  const [pendingRosh, setPendingRosh] = useState<Product | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('categorias').select('*').eq('exibe_cardapio', true).order('ordem'),
      supabase.from('products').select('*').eq('active', true).eq('exibe_cardapio', true).gt('stock_quantity', 0).order('nome'),
      supabase.from('products').select('id, nome, preco_adicional_rosh').eq('is_essencia', true).eq('active', true).order('nome'),
    ]).then(async ([{ data: cats }, { data: prods }, { data: ess }]) => {
      setCategories(cats ?? [])
      setProducts(prods ?? [])
      setEssencias((ess ?? []) as { id: number; nome: string; preco_adicional_rosh: number }[])
      if (cats?.[0]) setSelCat(cats[0].id)

      // Load option groups for all active products
      const productIds = (prods ?? []).map(p => p.id)
      if (productIds.length > 0) {
        const { data: groups } = await supabase
          .from('product_option_groups')
          .select('*, product_options(*)')
          .in('product_id', productIds)
          .eq('ativo', true)
          .order('ordem')
        const map: Record<number, GroupWithOptions[]> = {}
        for (const g of (groups ?? []) as (ProductOptionGroup & { product_options: { id: number; nome: string; price_delta: number; ativo: boolean }[] })[]) {
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
    })
  }, [])

  async function handleProductClick(p: Product) {
    if (p.product_type === 'composto') {
      setLoadingComposite(true)
      try {
        const [{ data: items }, { data: persons }, { data: addons }] = await Promise.all([
          supabase.from('composite_items')
            .select('*, component:component_product_id(id, nome)')
            .eq('product_id', p.id).order('ordem'),
          supabase.from('composite_personalizations')
            .select('*, options:composite_personalization_options(*, component:component_product_id(id, nome, production_sector))')
            .eq('product_id', p.id).order('ordem'),
          supabase.from('composite_addons')
            .select('*, component:component_product_id(id, nome, production_sector)')
            .eq('product_id', p.id).order('ordem'),
        ])
        setCompositeData({
          items: (items ?? []) as CompositeData['items'],
          personalizations: (persons ?? []) as CompositeData['personalizations'],
          addons: (addons ?? []) as CompositeData['addons'],
        })
        setPendingComposite(p)
      } catch (err: any) {
        setFormError(err?.message ?? 'Erro ao carregar produto composto. Tente novamente.')
      } finally {
        setLoadingComposite(false)
      }
      return
    }
    if (p.is_rosh) {
      setPendingRosh(p)
      return
    }
    const groups = optionGroupsMap[p.id]
    if (groups && groups.length > 0) {
      setPendingProduct(p)
    } else {
      addDirect(p, [], 0)
    }
  }

  function addRosh(p: Product, roshConfig: RoshConfig) {
    const essKey = roshConfig.essencias.map(e => e.id).sort().join(',')
    const cartKey = `${p.id}-rosh-${essKey}`
    const priceAdditions = roshConfig.essencias.reduce((sum, e) => sum + (e.preco_adicional ?? 0), 0)
    setCart(c => {
      const ex = c.find(i => i.cartKey === cartKey)
      if (ex) return c.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { cartKey, id: p.id, nome: p.nome, preco: p.preco, priceAdditions, qty: 1, is_rosh: true, selectedOptions: [], roshConfig }]
    })
    setPendingRosh(null)
  }

  function addComposite(p: Product, config: CompositeConfig, priceAdditions: number) {
    const configKey = [
      ...(config.personalizations ?? []).map(pp => `p${pp.option_id}`),
      ...(config.addons ?? []).map(a => `a${a.addon_id}`),
    ].sort().join(',')
    const cartKey = configKey ? `${p.id}-comp-${configKey}` : `${p.id}-comp`
    setCart(c => {
      const ex = c.find(i => i.cartKey === cartKey)
      if (ex) return c.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { cartKey, id: p.id, nome: p.nome, preco: p.preco, priceAdditions, qty: 1, is_rosh: p.is_rosh, selectedOptions: [], compositeConfig: config }]
    })
  }

  function addDirect(p: Product, selectedOptions: SelectedOption[], priceAdditions: number) {
    const cartKey = selectedOptions.length > 0
      ? `${p.id}-${selectedOptions.map(o => o.option_id).sort().join(',')}`
      : `${p.id}`
    setCart(c => {
      const ex = c.find(i => i.cartKey === cartKey)
      if (ex) return c.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { cartKey, id: p.id, nome: p.nome, preco: p.preco, priceAdditions, qty: 1, is_rosh: p.is_rosh, selectedOptions }]
    })
  }

  function remove(cartKey: string) {
    setCart(c => c.flatMap(i => i.cartKey === cartKey ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]))
  }

  async function submit() {
    if (cart.length === 0) return
    setSaving(true)
    setFormError(null)
    try {
      const items = cart.map(i => ({
        product_id: i.id,
        quantidade: i.qty,
        price_additions: i.priceAdditions,
        selected_options: i.selectedOptions.length > 0 ? i.selectedOptions : null,
        composite_config: i.compositeConfig ?? null,
        rosh_config: i.roshConfig ?? null,
      }))

      const { data: result, error: rpcErr } = await supabase.rpc('fn_place_order', {
        p_comanda_id: comandaId,
        p_mesa_id: mesaId,
        p_observacao: observacao || null,
        p_items: items,
        p_criado_por: profile?.id ?? null,
      })
      if (rpcErr || !result) {
        setFormError(rpcErr?.message ?? 'Erro ao enviar pedido. Tente novamente.')
        return
      }

      const pedidoId = (result as any).pedido_id

      const { error: estoqueErr } = await supabase.rpc('registrar_venda_estoque', { p_pedido_id: pedidoId, p_user_id: profile?.id ?? null })
      if (estoqueErr) console.error('registrar_venda_estoque:', estoqueErr)

      // Deduct component stock for composite items (fire-and-forget)
      for (const item of cart) {
        if (!item.compositeConfig) continue
        const cfg = item.compositeConfig
        const userId = profile?.id ?? null
        const deductions: { product_id: number; qty: number }[] = [
          ...(cfg.inclusions ?? []).map(inc => ({ product_id: inc.component_product_id, qty: inc.quantity * item.qty })),
          ...cfg.personalizations.map(pp => ({ product_id: pp.component_product_id, qty: pp.quantidade * item.qty })),
          ...cfg.addons.map(a => ({ product_id: a.component_product_id, qty: item.qty })),
        ]
        for (const d of deductions) {
          supabase.rpc('deduct_component_stock', {
            p_product_id: d.product_id,
            p_quantidade: d.qty,
            p_pedido_id: pedidoId,
            p_user_id: userId,
          }).then(({ error }) => { if (error) console.error('deduct_component_stock:', error) })
        }
      }

      onDone()
    } catch (err: any) {
      setFormError(err?.message ?? 'Erro inesperado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>

  if (loadingComposite) return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <Spinner size={24} />
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Carregando produto composto…</p>
    </div>
  )

  const filtered = selCat ? products.filter(p => p.categoria_id === selCat) : products
  const cartTotal = cart.reduce((s, i) => s + (i.preco + i.priceAdditions) * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="space-y-4">
      {pendingRosh && (
        <RoshModal
          product={pendingRosh}
          essencias={essencias}
          onConfirm={(config) => addRosh(pendingRosh, config)}
          onClose={() => setPendingRosh(null)}
        />
      )}
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
      {pendingComposite && compositeData && (
        <CompositeProductModal
          product={pendingComposite}
          data={compositeData}
          onConfirm={(config, priceAdditions) => {
            addComposite(pendingComposite, config, priceAdditions)
            setPendingComposite(null)
            setCompositeData(null)
          }}
          onClose={() => { setPendingComposite(null); setCompositeData(null) }}
        />
      )}

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
          const hasOptions = (optionGroupsMap[p.id]?.length ?? 0) > 0
          const inCart = cart.some(i => i.id === p.id)
          const cartQty = cart.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0)
          return (
            <button key={p.id} onClick={() => handleProductClick(p)}
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
                <div className="flex items-center gap-1">
                  {hasOptions && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>+ops</span>}
                  {inCart && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ color: 'var(--gold)', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}>
                      {cartQty}×
                    </span>
                  )}
                </div>
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
            <div key={i.cartKey} className="flex items-start gap-2 text-sm">
              <button onClick={() => remove(i.cartKey)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>−</button>
              <div className="flex-1 min-w-0">
                <span style={{ color: 'var(--text-primary)' }}>{i.qty}× {i.nome}</span>
                {i.roshConfig && (
                  <p className="text-[10px] mt-0.5 font-semibold" style={{ color: 'var(--gold)' }}>
                    {i.roshConfig.essencias.length === 1
                      ? `Essência: ${i.roshConfig.essencias[0]?.nome ?? ''}`
                      : `Meio a meio: ${i.roshConfig.essencias.map(e => e.nome).join(' + ')}`}
                  </p>
                )}
                {i.selectedOptions.length > 0 && (
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {i.selectedOptions.map(o => o.option_nome).join(', ')}
                  </p>
                )}
                {i.compositeConfig && (
                  <div className="text-[10px] mt-0.5 space-y-0.5">
                    {i.compositeConfig.personalizations.map((pp, idx) => (
                      <p key={idx} style={{ color: 'var(--gold)' }}>{pp.personalization_nome}: {pp.option_nome}</p>
                    ))}
                    {i.compositeConfig.addons.map((a, idx) => (
                      <p key={idx} style={{ color: 'var(--text-muted)' }}>+ {a.addon_nome}</p>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                R$ {((i.preco + i.priceAdditions) * i.qty).toFixed(2).replace('.', ',')}
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

      {formError && (
        <div className="rounded-xl px-3 py-2.5 text-sm text-center" style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)' }}>
          {formError}
        </div>
      )}
      <button onClick={submit} disabled={cart.length === 0 || saving} className="btn-primary w-full py-3.5">
        {saving ? <Spinner size={18} /> : `Enviar Pedido${cartTotal > 0 ? ` · R$ ${cartTotal.toFixed(2).replace('.', ',')}` : ''}`}
      </button>
    </div>
  )
}

function CompositeProductModal({
  product, data, onConfirm, onClose,
}: {
  product: Product
  data: CompositeData
  onConfirm: (config: CompositeConfig, priceAdditions: number) => void
  onClose: () => void
}) {
  const [selectedPersons, setSelectedPersons] = useState<Record<number, number>>(() => {
    const defaults: Record<number, number> = {}
    for (const p of data.personalizations) {
      const opts = p.options ?? []
      const def = opts.find(o => o.is_default) ?? opts[0]
      if (def) defaults[p.id] = def.id
    }
    return defaults
  })
  const [selectedAddons, setSelectedAddons] = useState<Set<number>>(new Set())

  let priceAdditions = 0
  for (const p of data.personalizations) {
    const selId = selectedPersons[p.id]
    const opt = (p.options ?? []).find(o => o.id === selId)
    if (opt) priceAdditions += Number(opt.price_delta)
  }
  for (const addonId of selectedAddons) {
    const addon = data.addons.find(a => a.id === addonId)
    if (addon) priceAdditions += Number(addon.price_delta)
  }

  const canConfirm = data.personalizations.every(p => selectedPersons[p.id] !== undefined)

  function handleConfirm() {
    const config: CompositeConfig = {
      inclusions: data.items.map(item => ({
        component_product_id: item.component_product_id,
        component_nome: item.component?.nome ?? '',
        quantity: item.quantity,
      })),
      personalizations: data.personalizations
        .filter(p => selectedPersons[p.id])
        .map(p => {
          const selId = selectedPersons[p.id]
          const opt = (p.options ?? []).find(o => o.id === selId)!
          return {
            personalization_id: p.id,
            personalization_nome: p.nome,
            option_id: opt.id,
            option_nome: opt.component?.nome ?? '',
            quantidade: p.quantidade,
            price_delta: Number(opt.price_delta),
            component_product_id: opt.component_product_id,
            component_production_sector: opt.component?.production_sector ?? null,
          }
        }),
      addons: data.addons
        .filter(a => selectedAddons.has(a.id))
        .map(a => ({
          addon_id: a.id,
          addon_nome: a.component?.nome ?? '',
          price_delta: Number(a.price_delta),
          component_product_id: a.component_product_id,
          component_production_sector: a.component?.production_sector ?? null,
        })),
    }
    onConfirm(config, priceAdditions)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative w-full md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{product.nome}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure seu pedido</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Included items */}
          {data.items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Incluso no produto</p>
              <div className="flex flex-wrap gap-1.5">
                {data.items.map(item => (
                  <span key={item.id} className="text-xs px-2 py-1 rounded-full"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    {item.quantity}× {item.component?.nome ?? '—'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Personalizations */}
          {data.personalizations.map(person => (
            <div key={person.id}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                {person.nome}{person.quantidade > 1 ? ` (${person.quantidade}×)` : ''}
              </p>
              <div className="space-y-1.5">
                {(person.options ?? []).map(opt => {
                  const selected = selectedPersons[person.id] === opt.id
                  return (
                    <button key={opt.id} onClick={() => setSelectedPersons(s => ({ ...s, [person.id]: opt.id }))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
                      style={{
                        background: selected ? 'var(--gold-bg)' : 'var(--bg-raised)',
                        border: `1px solid ${selected ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
                      }}>
                      <span className="w-3.5 h-3.5 rounded-full shrink-0 border-2 flex items-center justify-center"
                        style={{ borderColor: selected ? 'var(--gold)' : 'var(--border-strong)', background: selected ? 'var(--gold)' : 'transparent' }}>
                        {selected && <span className="w-1.5 h-1.5 rounded-full block" style={{ background: 'var(--bg-base)' }} />}
                      </span>
                      <span className="flex-1 text-sm" style={{ color: selected ? 'var(--gold)' : 'var(--text-primary)' }}>
                        {opt.component?.nome ?? '—'}
                      </span>
                      <span className="text-xs font-mono" style={{ color: opt.price_delta > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {opt.price_delta > 0 ? `+R$ ${Number(opt.price_delta).toFixed(2).replace('.', ',')}` : 'incluso'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Addons */}
          {data.addons.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Adicionais (opcional)</p>
              <div className="space-y-1.5">
                {data.addons.map(addon => {
                  const selected = selectedAddons.has(addon.id)
                  return (
                    <button key={addon.id} onClick={() => setSelectedAddons(s => {
                      const ns = new Set(s)
                      if (ns.has(addon.id)) ns.delete(addon.id)
                      else ns.add(addon.id)
                      return ns
                    })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
                      style={{
                        background: selected ? 'var(--gold-bg)' : 'var(--bg-raised)',
                        border: `1px solid ${selected ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
                      }}>
                      <span className="w-3.5 h-3.5 rounded shrink-0 border-2 flex items-center justify-center"
                        style={{ borderColor: selected ? 'var(--gold)' : 'var(--border-strong)', background: selected ? 'var(--gold)' : 'transparent' }}>
                        {selected && <span className="text-[8px] font-bold leading-none" style={{ color: 'var(--bg-base)' }}>✓</span>}
                      </span>
                      <span className="flex-1 text-sm" style={{ color: selected ? 'var(--gold)' : 'var(--text-primary)' }}>
                        {addon.component?.nome ?? '—'}
                      </span>
                      <span className="text-xs font-mono" style={{ color: addon.price_delta > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {addon.price_delta > 0 ? `+R$ ${Number(addon.price_delta).toFixed(2).replace('.', ',')}` : 'grátis'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Total + confirm */}
          <div className="pt-2 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Total</span>
              <span className="font-mono font-bold text-lg" style={{ color: 'var(--gold)' }}>
                R$ {(product.preco + priceAdditions).toFixed(2).replace('.', ',')}
              </span>
            </div>
            <button onClick={handleConfirm} disabled={!canConfirm} className="btn-primary w-full py-3.5">
              Adicionar ao Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoshModal({
  product, essencias, onConfirm, onClose,
}: {
  product: Product
  essencias: { id: number; nome: string; preco_adicional_rosh: number }[]
  onConfirm: (config: RoshConfig) => void
  onClose: () => void
}) {
  const [modo, setModo] = useState<'unica' | 'meio_a_meio' | null>(null)
  const [selected, setSelected] = useState<number[]>([])

  const sessaoGramas = (product as any).quantidade_total_essencia ?? 10

  function toggle(id: number) {
    if (modo === 'unica') {
      setSelected([id])
    } else {
      if (selected.includes(id)) {
        setSelected(s => s.filter(x => x !== id))
      } else if (selected.length < 2) {
        setSelected(s => [...s, id])
      }
    }
  }

  const canConfirm = modo === 'unica' ? selected.length === 1 : selected.length === 2

  function confirm() {
    if (!canConfirm || !modo) return
    const percentual = modo === 'unica' ? 100 : 50
    onConfirm({
      sessao_gramas_total: sessaoGramas,
      essencias: selected.map(id => {
        const ess = essencias.find(e => e.id === id)!
        return {
          id,
          nome: ess.nome,
          percentual,
          gramas: sessaoGramas * (percentual / 100),
          preco_adicional: ess.preco_adicional_rosh,
        }
      }),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative w-full md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{product.nome}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Escolha da essência</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Step 1: mode */}
          {!modo && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Tipo de mistura
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setModo('unica'); setSelected([]) }}
                  className="p-4 rounded-xl text-sm font-semibold transition active:scale-95 text-center"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                  💨<br />Uma Essência
                </button>
                <button onClick={() => { setModo('meio_a_meio'); setSelected([]) }}
                  className="p-4 rounded-xl text-sm font-semibold transition active:scale-95 text-center"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                  🔥<br />Meio a Meio
                </button>
              </div>
            </div>
          )}

          {/* Step 2: essence list */}
          {modo && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {modo === 'unica' ? 'Escolha 1 essência' : `Escolha 2 essências (${selected.length}/2)`}
                </p>
                <button onClick={() => { setModo(null); setSelected([]) }}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                  ← Voltar
                </button>
              </div>
              {essencias.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  Nenhuma essência cadastrada. Adicione produtos com "É insumo Rosh" ativo.
                </p>
              )}
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {essencias.map(e => {
                  const isSel = selected.includes(e.id)
                  const isDisabled = !isSel && modo === 'meio_a_meio' && selected.length >= 2
                  return (
                    <button key={e.id} onClick={() => !isDisabled && toggle(e.id)}
                      disabled={isDisabled}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
                      style={{
                        background: isSel ? 'var(--gold-bg)' : 'var(--bg-raised)',
                        border: `1px solid ${isSel ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
                        opacity: isDisabled ? 0.4 : 1,
                      }}>
                      <span className={`w-3.5 h-3.5 ${modo === 'unica' ? 'rounded-full' : 'rounded'} shrink-0 border-2 flex items-center justify-center`}
                        style={{ borderColor: isSel ? 'var(--gold)' : 'var(--border-strong)', background: isSel ? 'var(--gold)' : 'transparent' }}>
                        {isSel && (
                          modo === 'unica'
                            ? <span className="w-1.5 h-1.5 rounded-full block" style={{ background: 'var(--bg-base)' }} />
                            : <span className="text-[8px] font-bold leading-none" style={{ color: 'var(--bg-base)' }}>✓</span>
                        )}
                      </span>
                      <span className="flex-1 text-sm" style={{ color: isSel ? 'var(--gold)' : 'var(--text-primary)' }}>
                        {e.nome}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button onClick={confirm} disabled={!canConfirm} className="btn-primary w-full py-3.5">
                {canConfirm
                  ? modo === 'unica'
                    ? `Confirmar: ${essencias.find(e => e.id === selected[0])?.nome ?? ''}`
                    : `Confirmar: ${selected.map(id => essencias.find(e => e.id === id)?.nome ?? '').join(' + ')}`
                  : modo === 'unica' ? 'Selecione uma essência' : `Selecione mais ${2 - selected.length} essência(s)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
