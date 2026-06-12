import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Mesa, Comanda, Pedido, Pagamento } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { SkeletonMesa } from '../components/ui/Skeleton'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import { X, ChevronRight, Users, CheckCircle, Wrench, Unlock, CreditCard, DollarSign, Smartphone, Gift } from 'lucide-react'
import { format } from 'date-fns'

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

function fmt(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',')}`
}

const PAY_METHODS = [
  { key: 'dinheiro', label: 'Dinheiro', icon: DollarSign },
  { key: 'pix',      label: 'Pix',      icon: Smartphone },
  { key: 'credito',  label: 'Crédito',  icon: CreditCard },
  { key: 'debito',   label: 'Débito',   icon: CreditCard },
  { key: 'cortesia', label: 'Cortesia', icon: Gift },
] as const

const METHOD_LABEL: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', cortesia: 'Cortesia' }

interface MesaComComanda extends Mesa {
  comanda?: Comanda
}

export default function MesasPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { success: toast, error: toastError } = useToast()
  const [mesas, setMesas] = useState<MesaComComanda[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todas' | 'ocupadas' | 'livres'>('todas')
  const [selected, setSelected] = useState<MesaComComanda | null>(null)
  const [opening, setOpening] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  // Live detail for occupied mesa
  const [detailPedidos, setDetailPedidos] = useState<Pedido[]>([])
  const [detailPagamentos, setDetailPagamentos] = useState<Pagamento[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Quick pay in bottom sheet
  const [quickPayAmt, setQuickPayAmt] = useState('')
  const [quickPayMethod, setQuickPayMethod] = useState<string>('pix')
  const [savingPay, setSavingPay] = useState(false)

  // Check-in modal (visual only — DB only stores aberta_por)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [checkinMesa, setCheckinMesa] = useState<MesaComComanda | null>(null)
  const [checkinForm, setCheckinForm] = useState({ pessoas: '2', nome: '', obs: '' })

  const load = useCallback(async () => {
    const [{ data: ms }, { data: cs }] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('comandas').select('*').eq('status', 'aberta'),
    ])
    const comandaMap: Record<number, Comanda> = {}
    for (const c of cs ?? []) comandaMap[c.mesa_id] = c
    setMesas((ms ?? []).map(m => ({ ...m, comanda: comandaMap[m.id] })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const sub = supabase.channel('mesas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, load)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load])

  // Load live detail when occupied mesa is selected
  useEffect(() => {
    if (!selected?.comanda) {
      setDetailPedidos([])
      setDetailPagamentos([])
      return
    }
    const comandaId = selected.comanda.id
    setLoadingDetail(true)
    Promise.all([
      supabase.from('pedidos').select('*, pedido_itens(*)').eq('comanda_id', comandaId).order('created_at', { ascending: false }).limit(5),
      supabase.from('pagamentos').select('*').eq('comanda_id', comandaId).order('created_at', { ascending: false }),
    ]).then(([{ data: peds }, { data: pags }]) => {
      setDetailPedidos(peds ?? [])
      setDetailPagamentos(pags ?? [])
      setLoadingDetail(false)
    })
  }, [selected?.comanda?.id])

  const canManage = ['admin', 'caixa'].includes(profile?.role ?? '')

  function initiateOpen(mesa: MesaComComanda) {
    setCheckinMesa(mesa)
    setCheckinForm({ pessoas: '2', nome: '', obs: '' })
    setCheckinOpen(true)
  }

  async function confirmOpen() {
    if (!checkinMesa) return
    setOpening(true)
    const { data: comanda } = await supabase
      .from('comandas')
      .insert({ mesa_id: checkinMesa.id, status: 'aberta', aberta_por: profile?.id })
      .select()
      .single()
    await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', checkinMesa.id)
    setOpening(false)
    setCheckinOpen(false)
    setSelected(null)
    toast(`Mesa ${checkinMesa.numero} aberta`)
    navigate(`/comanda/${comanda?.id}`)
  }

  async function changeStatus(status: Mesa['status']) {
    if (!selected) return
    setChangingStatus(true)
    await supabase.from('mesas').update({ status }).eq('id', selected.id)
    setChangingStatus(false)
    setSelected(null)
    load()
    toast('Status da mesa atualizado')
  }

  async function saveQuickPay() {
    if (!selected?.comanda) return
    const valor = parseFloat(quickPayAmt.replace(',', '.'))
    if (!valor || valor <= 0) return
    setSavingPay(true)
    await supabase.from('pagamentos').insert({
      comanda_id: selected.comanda.id,
      metodo: quickPayMethod,
      valor,
      registrado_por: profile?.id,
    })
    // Refresh comanda total_pago
    const { data: pags } = await supabase.from('pagamentos').select('valor').eq('comanda_id', selected.comanda.id)
    const totalPago = (pags ?? []).reduce((s: number, p: any) => s + p.valor, 0)
    await supabase.from('comandas').update({ total_pago: totalPago }).eq('id', selected.comanda.id)
    setQuickPayAmt('')
    setSavingPay(false)
    toast(`${fmt(valor)} registrado via ${METHOD_LABEL[quickPayMethod]}`)
    load()
    // Refresh detail
    const [{ data: peds }, { data: pgsNew }] = await Promise.all([
      supabase.from('pedidos').select('*, pedido_itens(*)').eq('comanda_id', selected.comanda.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('pagamentos').select('*').eq('comanda_id', selected.comanda.id).order('created_at', { ascending: false }),
    ])
    setDetailPedidos(peds ?? [])
    setDetailPagamentos(pgsNew ?? [])
  }

  const filtered = mesas.filter(m => {
    if (filter === 'ocupadas') return m.status === 'ocupada'
    if (filter === 'livres') return m.status === 'disponivel'
    return true
  })

  const ocupadas = mesas.filter(m => m.status === 'ocupada').length
  const livres   = mesas.filter(m => m.status === 'disponivel').length

  function mesaClass(m: MesaComComanda) {
    switch (m.status) {
      case 'ocupada':    return 'mesa-card mesa-ocupada'
      case 'reservada':  return 'mesa-card mesa-reservada'
      case 'manutencao': return 'mesa-card mesa-manutencao'
      default:           return 'mesa-card mesa-disponivel'
    }
  }

  function statusInfo(m: MesaComComanda): { label: string; color: string } {
    if (m.status === 'disponivel') return { label: 'Disponível', color: 'var(--text-muted)' }
    if (m.status === 'reservada')  return { label: 'Reservada',  color: 'var(--blue)' }
    if (m.status === 'manutencao') return { label: 'Manutenção', color: 'var(--red)' }
    return { label: m.comanda ? timeAgo(m.comanda.aberta_em) : 'Ocupada', color: 'var(--gold)' }
  }

  if (loading) return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 md:px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="page-header">Mesas</h1>
      </div>
      <div className="p-4 md:p-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => <SkeletonMesa key={i} />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-5 pb-4"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="page-header">Mesas</h1>
            <p className="text-[12px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              {ocupadas} ocupadas · {livres} disponíveis
              <span className="inline-block w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--green)' }} />
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['todas', 'ocupadas', 'livres'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: filter === f ? 'var(--gold)' : 'var(--bg-raised)',
                color: filter === f ? 'var(--gold-fg)' : 'var(--text-secondary)',
                border: `1px solid ${filter === f ? 'transparent' : 'var(--border-default)'}`,
              }}>
              {f === 'todas' ? `Todas ${mesas.length}` : f === 'ocupadas' ? `Ocupadas ${ocupadas}` : `Livres ${livres}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 md:p-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {filtered.map(m => {
          const { label, color } = statusInfo(m)
          const isOcupada = m.status === 'ocupada'
          const isDisponivel = m.status === 'disponivel'
          return (
            <div key={m.id} className={`${mesaClass(m)} animate-fade-in`} onClick={() => setSelected(m)}>
              <div className="w-full">
                <span className="font-mono font-bold text-xl leading-none"
                  style={{ color: isOcupada ? 'var(--gold)' : 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  {String(m.numero).padStart(2, '0')}
                </span>
                {isOcupada && m.comanda && (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-[10px] font-semibold font-mono" style={{ color: 'var(--gold)' }}>
                      {timeAgo(m.comanda.aberta_em)}
                    </div>
                    {m.comanda.total > 0 && (
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {fmt(m.comanda.total)}
                      </div>
                    )}
                  </div>
                )}
                {isDisponivel && canManage && (
                  <div className="mt-1.5 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    toque p/ abrir
                  </div>
                )}
              </div>
              <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
            </div>
          )
        })}
      </div>

      {/* Bottom sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }} />
          <div className="bottom-sheet relative w-full animate-slide-up p-5 pb-8 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border-strong)' }} />

            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-3xl"
                    style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                    Mesa {String(selected.numero).padStart(2, '0')}
                  </span>
                  {selected.comanda && (
                    <span className="badge badge-gold text-[10px]">#{selected.comanda.id}</span>
                  )}
                </div>
                {selected.comanda && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Aberta há {timeAgo(selected.comanda.aberta_em)}
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <X size={14} />
              </button>
            </div>

            {selected.comanda && (
              <>
                {/* Financeiro */}
                <div className="rounded-xl p-4 mb-4"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: 'Total', value: fmt(selected.comanda.total) },
                      { label: 'Pago',  value: fmt(selected.comanda.total_pago) },
                      { label: 'Saldo', value: fmt(selected.comanda.total - selected.comanda.total_pago) },
                    ].map(({ label, value }, i) => (
                      <div key={label}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                        <p className="font-mono font-bold text-sm"
                          style={{ color: i === 2 ? 'var(--gold)' : 'var(--text-primary)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {selected.comanda.total > 0 && (
                    <div className="progress-bar">
                      <div className="progress-bar-fill"
                        style={{ width: `${Math.min(100, (selected.comanda.total_pago / selected.comanda.total) * 100)}%` }} />
                    </div>
                  )}
                </div>

                {/* Últimos pedidos */}
                {loadingDetail ? (
                  <div className="flex justify-center py-4"><Spinner size={18} /></div>
                ) : (
                  <>
                    {detailPedidos.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                          Últimos Pedidos
                        </p>
                        <div className="space-y-1.5">
                          {detailPedidos.map(p => (
                            <div key={p.id} className="rounded-lg px-3 py-2 flex items-center gap-2"
                              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                              <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>#{p.id}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                                  {(p as any).pedido_itens?.map((i: any) => `${i.quantidade}× ${i.nome_produto}`).join(', ') || '—'}
                                </p>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                                style={{
                                  background: p.status === 'entregue' ? 'var(--green-bg)' : p.status === 'pendente' ? 'var(--blue-bg)' : 'var(--amber-bg)',
                                  color: p.status === 'entregue' ? 'var(--green)' : p.status === 'pendente' ? 'var(--blue)' : 'var(--amber)',
                                }}>
                                {p.status}
                              </span>
                              <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                                {format(new Date(p.created_at), 'HH:mm')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pagamentos */}
                    {detailPagamentos.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                          Pagamentos
                        </p>
                        <div className="space-y-1.5">
                          {detailPagamentos.map(pg => (
                            <div key={pg.id} className="rounded-lg px-3 py-2 flex items-center justify-between"
                              style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}>
                              <span className="text-xs" style={{ color: 'var(--green)' }}>
                                {METHOD_LABEL[pg.metodo] ?? pg.metodo}
                              </span>
                              <span className="font-mono font-bold text-xs" style={{ color: 'var(--green)' }}>
                                {fmt(pg.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick pay */}
                    {canManage && (
                      <div className="mb-4 rounded-xl p-3"
                        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                          Registrar Pagamento
                        </p>
                        <div className="flex gap-2 mb-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>R$</span>
                            <input className="input pl-8 text-sm" placeholder="0,00"
                              value={quickPayAmt} onChange={e => setQuickPayAmt(e.target.value)} />
                          </div>
                          <button
                            onClick={() => setQuickPayAmt(String((selected.comanda!.total - selected.comanda!.total_pago).toFixed(2)).replace('.', ','))}
                            className="text-xs px-2 rounded-lg shrink-0"
                            style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)' }}>
                            Total
                          </button>
                        </div>
                        <div className="flex gap-1.5 flex-wrap mb-2">
                          {PAY_METHODS.map(m => (
                            <button key={m.key} onClick={() => setQuickPayMethod(m.key)}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold transition"
                              style={{
                                background: quickPayMethod === m.key ? 'var(--gold)' : 'var(--bg-base)',
                                color: quickPayMethod === m.key ? 'var(--gold-fg)' : 'var(--text-secondary)',
                                border: `1px solid ${quickPayMethod === m.key ? 'transparent' : 'var(--border-default)'}`,
                              }}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={saveQuickPay} disabled={!quickPayAmt || savingPay}
                          className="btn-primary w-full py-2.5 text-sm">
                          {savingPay ? <Spinner size={15} /> : 'Confirmar Pagamento'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="space-y-2">
              {/* Primary actions */}
              {selected.status === 'ocupada' && selected.comanda && (
                <button onClick={() => navigate(`/comanda/${selected.comanda!.id}`)}
                  className="btn-primary w-full py-3.5 text-sm">
                  Ver Comanda <ChevronRight size={16} />
                </button>
              )}
              {selected.status === 'disponivel' && canManage && (
                <button onClick={() => { setSelected(null); initiateOpen(selected) }} disabled={opening}
                  className="btn-primary w-full py-3.5 text-sm">
                  {opening ? <Spinner size={18} /> : <><Users size={16} /> Abrir Mesa</>}
                </button>
              )}
              {selected.status === 'reservada' && (
                <div className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue-border)' }}>
                  <CheckCircle size={14} style={{ color: 'var(--blue)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--blue)' }}>Mesa reservada</span>
                </div>
              )}
              {selected.status === 'manutencao' && (
                <div className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
                  <Wrench size={14} style={{ color: 'var(--red)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--red)' }}>Em manutenção</span>
                </div>
              )}

              {/* Status controls — admin/caixa only */}
              {canManage && selected.status !== 'ocupada' && (
                <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Alterar status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selected.status !== 'reservada' && (
                      <button onClick={() => changeStatus('reservada')} disabled={changingStatus}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                        {changingStatus ? <Spinner size={12} /> : <CheckCircle size={12} />} Reservar
                      </button>
                    )}
                    {selected.status !== 'manutencao' && (
                      <button onClick={() => changeStatus('manutencao')} disabled={changingStatus}
                        className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5">
                        {changingStatus ? <Spinner size={12} /> : <Wrench size={12} />} Manutenção
                      </button>
                    )}
                    {(selected.status === 'reservada' || selected.status === 'manutencao') && (
                      <button onClick={() => changeStatus('disponivel')} disabled={changingStatus}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                        {changingStatus ? <Spinner size={12} /> : <Unlock size={12} />} Liberar Mesa
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Check-in modal */}
      {checkinOpen && checkinMesa && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center"
          onClick={() => setCheckinOpen(false)}>
          <div className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
          <div className="bottom-sheet md:rounded-2xl relative w-full md:max-w-sm animate-slide-up p-5 pb-8"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5 md:hidden" style={{ background: 'var(--border-strong)' }} />
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                  Abrir Mesa {String(checkinMesa.numero).padStart(2, '0')}
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Check-in de clientes</p>
              </div>
              <button onClick={() => setCheckinOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Número de pessoas</label>
                <div className="flex gap-2">
                  {['1','2','3','4','5','6+'].map(n => (
                    <button key={n} onClick={() => setCheckinForm(f => ({ ...f, pessoas: n }))}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold transition"
                      style={{
                        background: checkinForm.pessoas === n ? 'var(--gold)' : 'var(--bg-raised)',
                        color: checkinForm.pessoas === n ? 'var(--gold-fg)' : 'var(--text-secondary)',
                        border: `1px solid ${checkinForm.pessoas === n ? 'transparent' : 'var(--border-default)'}`,
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Nome do responsável <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
                <input className="input" placeholder="Ex: João Silva"
                  value={checkinForm.nome}
                  onChange={e => setCheckinForm(f => ({ ...f, nome: e.target.value }))} />
              </div>

              <div>
                <label className="label">Observação <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
                <input className="input" placeholder="Ex: aniversário, alergia..."
                  value={checkinForm.obs}
                  onChange={e => setCheckinForm(f => ({ ...f, obs: e.target.value }))} />
              </div>

              <button onClick={confirmOpen} disabled={opening} className="btn-primary w-full py-3.5 text-sm">
                {opening ? <Spinner size={18} /> : <><Users size={16} /> Confirmar Abertura</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
