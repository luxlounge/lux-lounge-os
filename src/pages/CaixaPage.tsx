import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Comanda, Mesa } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import {
  DollarSign, ChevronRight, Lock, CreditCard,
  Banknote, Smartphone, Gift, CheckCircle, RefreshCw,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '../components/ui/Toast'

type PayMethod = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'cortesia'

const METHOD_ICON: Record<PayMethod, React.ReactNode> = {
  dinheiro: <Banknote size={14} />,
  pix:      <Smartphone size={14} />,
  credito:  <CreditCard size={14} />,
  debito:   <CreditCard size={14} />,
  cortesia: <Gift size={14} />,
}
const METHOD_LABEL: Record<PayMethod, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito', cortesia: 'Cortesia',
}

interface ComandaAberta extends Comanda {
  mesas?: Mesa
  balance: number
}

function fmt(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',')}`
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

export default function CaixaPage() {
  const { profile } = useAuth()
  const { success: toast, error: toastError } = useToast()
  const navigate = useNavigate()
  const [comandas, setComandas] = useState<ComandaAberta[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<number | null>(null)
  const [closingId, setClosingId] = useState<number | null>(null)
  const [payForms, setPayForms] = useState<Record<number, { amount: string; method: PayMethod }>>({})
  const [todayRevenue, setTodayRevenue] = useState(0)

  const load = useCallback(async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [{ data: cs }, { data: pays }] = await Promise.all([
      supabase.from('comandas').select('*, mesas(*)').eq('status', 'aberta').order('aberta_em'),
      supabase.from('pagamentos').select('valor').gte('created_at', today.toISOString()),
    ])
    const list = (cs ?? []).map(c => ({ ...c, balance: c.total - c.total_pago }))
    list.sort((a, b) => b.balance - a.balance)
    setComandas(list)
    setTodayRevenue((pays ?? []).reduce((s, p) => s + Number(p.valor), 0))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const sub = supabase.channel('caixa-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, load)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load])

  if (!['admin', 'caixa'].includes(profile?.role ?? '')) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
      style={{ background: 'var(--bg-base)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <Lock size={22} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Acesso Restrito</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Apenas caixa e administradores.</p>
    </div>
  )

  function getPayForm(id: number) {
    return payForms[id] ?? { amount: '', method: 'pix' as PayMethod }
  }
  function setPayForm(id: number, patch: Partial<{ amount: string; method: PayMethod }>) {
    setPayForms(prev => ({ ...prev, [id]: { ...getPayForm(id), ...patch } }))
  }

  async function registerPayment(comanda: ComandaAberta) {
    const form = getPayForm(comanda.id)
    const valor = parseFloat(form.amount.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) return
    setPayingId(comanda.id)
    await supabase.from('pagamentos').insert({
      comanda_id: comanda.id, valor, metodo: form.method, registrado_por: profile?.id,
    })
    setPayForms(prev => ({ ...prev, [comanda.id]: { amount: '', method: 'pix' } }))
    setPayingId(null)
    toast(`${fmt(valor)} registrado via ${METHOD_LABEL[form.method]}`)
    load()
  }

  async function closeComanda(comanda: ComandaAberta) {
    if (comanda.balance > 0.01 && !confirm(`Fechar Mesa ${(comanda.mesas as any)?.numero} com saldo pendente de ${fmt(comanda.balance)}?`)) return
    setClosingId(comanda.id)
    const { error } = await supabase.rpc('fn_fechar_comanda', { p_comanda_id: comanda.id })
    setClosingId(null)
    if (error) { toastError(error.message); return }
    toast(`Mesa ${(comanda.mesas as any)?.numero} fechada`)
    load()
  }

  const totalAberto = comandas.reduce((s, c) => s + c.balance, 0)

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 md:px-8 pt-5 pb-4"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="page-header">Caixa</h1>
            <p className="text-[12px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              {comandas.length} {comandas.length === 1 ? 'comanda aberta' : 'comandas abertas'}
              <span className="inline-block w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--green)' }} />
            </p>
          </div>
          <button onClick={load}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Faturado Hoje', value: fmt(todayRevenue), color: 'var(--green)' },
            { label: 'A Receber',     value: fmt(totalAberto),  color: totalAberto > 0 ? 'var(--gold)' : 'var(--green)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl px-4 py-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="font-mono font-bold text-lg" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comanda cards */}
      <div className="p-4 md:p-8 space-y-3">
        {loading && (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        )}

        {!loading && comandas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
              <CheckCircle size={20} style={{ color: 'var(--green)' }} />
            </div>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Tudo em dia</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Nenhuma comanda aberta no momento</p>
          </div>
        )}

        {comandas.map(c => {
          const mesa = (c.mesas as any)
          const form = getPayForm(c.id)
          const isPaying = payingId === c.id
          const isClosing = closingId === c.id
          const isQuitada = c.balance <= 0.01

          return (
            <div key={c.id} className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                        Mesa {mesa?.numero ?? '?'}
                      </span>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>#{c.id}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Aberta {timeAgo(c.aberta_em)} · {format(new Date(c.aberta_em), 'HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-xl" style={{ color: isQuitada ? 'var(--green)' : 'var(--gold)' }}>
                    {fmt(c.balance)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {isQuitada ? 'quitado' : 'a receber'}
                  </p>
                </div>
              </div>

              {/* Financial details */}
              <div className="grid grid-cols-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {[
                  { label: 'Total',  value: fmt(c.total),       color: 'var(--text-primary)' },
                  { label: 'Pago',   value: fmt(c.total_pago),  color: 'var(--green)' },
                  { label: 'Saldo',  value: fmt(c.balance),     color: isQuitada ? 'var(--green)' : 'var(--gold)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className="font-mono font-bold text-sm mt-0.5" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Quick payment */}
              {!isQuitada && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Registrar Pagamento
                  </p>
                  <div className="flex gap-2 mb-2">
                    <input type="text" inputMode="decimal" placeholder="0,00"
                      className="input text-sm flex-1" style={{ minWidth: 0 }}
                      value={form.amount}
                      onChange={e => setPayForm(c.id, { amount: e.target.value })} />
                    <select className="input text-sm" style={{ width: 'auto' }}
                      value={form.method}
                      onChange={e => setPayForm(c.id, { method: e.target.value as PayMethod })}>
                      {(Object.keys(METHOD_LABEL) as PayMethod[]).map(m => (
                        <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPayForm(c.id, { amount: c.balance.toFixed(2).replace('.', ',') })}
                      className="text-xs font-semibold px-2 py-1.5 rounded-lg transition"
                      style={{ background: 'var(--gold-bg)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}>
                      Total: {fmt(c.balance)}
                    </button>
                    <button onClick={() => registerPayment(c)} disabled={!form.amount || isPaying}
                      className="btn-primary text-sm px-4 py-1.5 flex-1">
                      {isPaying ? <Spinner size={14} /> : <><DollarSign size={14} /> Confirmar</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 px-4 py-3">
                <button onClick={() => navigate(`/comanda/${c.id}`)}
                  className="btn-secondary text-sm flex-1 py-2">
                  Ver Comanda <ChevronRight size={14} />
                </button>
                <button onClick={() => closeComanda(c)} disabled={isClosing}
                  className={isQuitada ? 'btn-primary text-sm px-4 py-2' : 'btn-secondary text-sm px-4 py-2'}
                  style={!isQuitada ? { color: 'var(--text-muted)' } : {}}>
                  {isClosing ? <Spinner size={14} /> : <><CheckCircle size={14} /> Fechar</>}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
