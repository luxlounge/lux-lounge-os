import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui/Spinner'
import { OptionsModal, type GroupWithOptions } from '../../components/ui/OptionsModal'
import type { SelectedOption, CompositeConfig, RoshConfig } from '../../types'
import {
  ShoppingCart, Plus, Minus, Send, CheckCircle, AlertCircle, Wind,
  Bell, Flame, Receipt, X, BookOpen, Clock, ChevronLeft,
} from 'lucide-react'

// ─── Local types ────────────────────────────────────────────────────────────
interface Categoria { id: number; nome: string; ordem: number }
interface Produto {
  id: number; nome: string; categoria_id: number
  preco: number; stock_quantity: number; is_rosh: boolean
  imagem_url: string | null; product_type: 'simples' | 'composto'
}
interface CartItem {
  cartKey: string; id: number; nome: string
  preco: number; priceAdditions: number; qty: number
  is_rosh: boolean; selectedOptions: SelectedOption[]
  compositeConfig?: CompositeConfig
  roshConfig?: RoshConfig
}
interface PedidoTracking {
  id: number
  status: 'pendente' | 'preparo' | 'entregue' | 'cancelado'
  created_at: string
  itens: { nome_produto: string; quantidade: number; composite_config?: CompositeConfig | null }[]
}
interface CompositeData {
  items: { component_product_id: number; quantity: number; component: { id: number; nome: string } | null }[]
  personalizations: {
    id: number; nome: string; quantidade: number
    options?: { id: number; component_product_id: number; price_delta: number; is_default: boolean; component: { id: number; nome: string; production_sector: string | null } | null }[]
  }[]
  addons: { id: number; component_product_id: number; price_delta: number; component: { id: number; nome: string; production_sector: string | null } | null }[]
}
type Fase = 'loading' | 'welcome' | 'menu' | 'fechada' | 'unavailable'
type Tab = 'cardapio' | 'pedidos' | 'solicitar'

// ─── Constants ───────────────────────────────────────────────────────────────
const PEDIDO_STATUS = {
  pendente:  { label: 'Recebido',   step: 1, color: '#f59e0b', desc: 'Agora é com a gente.' },
  preparo:   { label: 'Em preparo', step: 2, color: '#60a5fa', desc: 'Sua experiência está sendo preparada.' },
  entregue:  { label: 'Entregue',   step: 3, color: '#22c55e', desc: 'Aproveite!' },
  cancelado: { label: 'Cancelado',  step: 0, color: '#ef4444', desc: '' },
} as const

const CAT_EMOJIS: [string, string][] = [
  ['drink', '🍹'], ['bebida', '🥃'], ['drinque', '🍹'], ['cerveja', '🍺'],
  ['vinho', '🍷'], ['whisky', '🥃'], ['vodka', '🍸'], ['espumante', '🥂'],
  ['energético', '⚡'], ['energetico', '⚡'], ['suco', '🍊'], ['água', '💧'],
  ['agua', '💧'], ['refrigerante', '🥤'], ['narguilé', '💨'], ['narguile', '💨'],
  ['rosh', '🔥'], ['carvão', '🔥'], ['carvao', '🔥'], ['kit', '📦'],
  ['petisco', '🍢'], ['porcao', '🍽️'], ['porção', '🍽️'], ['tábua', '🧀'],
  ['tabua', '🧀'], ['fruta', '🍓'], ['sobremesa', '🍮'], ['doce', '🍬'],
  ['snack', '🥨'], ['combo', '🎁'], ['pacote', '📦'], ['especial', '⭐'],
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtBRL(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}` }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function catEmoji(nome: string): string {
  const lower = nome.toLowerCase()
  for (const [key, emoji] of CAT_EMOJIS) {
    if (lower.includes(key)) return emoji
  }
  return '✦'
}

function timeSince(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? String(m % 60).padStart(2, '0') : ''}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Welcome screen
function WelcomeScreen({ mesaNum, onDone }: { mesaNum: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center text-center px-8 animate-fade-in"
      onClick={onDone}>
      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl bg-ink-card border border-gold/20 flex items-center justify-center mx-auto mb-6 shadow-gold">
          <Wind size={28} className="text-gold" />
        </div>
        <p className="text-[#666] text-sm tracking-widest uppercase mb-2">{greeting()}</p>
        <h1 className="text-3xl font-bold text-white mb-1">Mesa {mesaNum}</h1>
        <p className="text-[#555] text-base">Bem-vindo à <span className="text-gold font-semibold">Lux</span>.</p>
      </div>
      <div className="flex gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-gold/40" />
        <span className="w-1.5 h-1.5 rounded-full bg-gold/20" />
      </div>
    </div>
  )
}

// Closed screen
function ClosedScreen({ mesaNum }: { mesaNum: number }) {
  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center text-center px-8 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={28} className="text-emerald-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Sessão encerrada</h2>
      <p className="text-sm text-[#555]">
        Mesa {mesaNum} — comanda fechada.<br />Obrigado pela visita. Até logo!
      </p>
      <div className="mt-8 px-6 py-4 rounded-2xl bg-ink-card border border-ink-border">
        <p className="text-[11px] text-gold font-semibold tracking-widest uppercase">Lux Lounge</p>
      </div>
    </div>
  )
}

// Category grid card
function CategoryCard({ cat, onClick }: { cat: Categoria; onClick: () => void }) {
  const emoji = catEmoji(cat.nome)
  return (
    <button onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-ink-border bg-ink-card active:scale-95 transition text-center min-h-[110px]">
      <span className="text-3xl leading-none">{emoji}</span>
      <span className="text-sm font-semibold text-white leading-tight">{cat.nome}</span>
    </button>
  )
}

// Product card
function ProductCard({
  p, inCart, cartQty, hasOptions, isComposto, onClick
}: {
  p: Produto; inCart: boolean; cartQty: number
  hasOptions: boolean; isComposto: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col rounded-2xl border text-left transition active:scale-95 overflow-hidden
        ${inCart ? 'border-gold/40 bg-gold/5' : 'border-ink-border bg-ink-card'}`}>
      {/* Image area */}
      {p.imagem_url ? (
        <div className="w-full aspect-video bg-ink-raised overflow-hidden">
          <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-video bg-ink-raised flex items-center justify-center border-b border-ink-border/40">
          <Wind size={20} className="text-[#333]" />
        </div>
      )}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <span className="font-semibold text-sm text-white leading-tight line-clamp-2">{p.nome}</span>
        <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
          <span className="text-gold font-bold text-sm">{fmtBRL(p.preco)}</span>
          {isComposto && (
            <span className="text-[9px] font-bold bg-gold/10 text-gold border border-gold/20 px-1.5 py-0.5 rounded-full">KIT</span>
          )}
          {p.is_rosh && (
            <Wind size={9} className="text-gold" />
          )}
        </div>
        {hasOptions && <span className="text-[10px] text-[#555]">Personalizável</span>}
        {inCart && (
          <span className="text-[10px] font-bold bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded-full self-start mt-1">
            {cartQty}× no carrinho
          </span>
        )}
      </div>
    </button>
  )
}

// Composite configurator modal
function CompositeConfigurator({
  product, data, basePrice, onConfirm, onClose
}: {
  product: Produto; data: CompositeData; basePrice: number
  onConfirm: (config: CompositeConfig, extra: number) => void
  onClose: () => void
}) {
  // Selections: personalization_id → option_id
  const [personSelections, setPersonSelections] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {}
    for (const p of data.personalizations) {
      const def = p.options?.find(o => o.is_default)
      if (def) init[p.id] = def.id
    }
    return init
  })
  const [addonSelections, setAddonSelections] = useState<Set<number>>(new Set())

  const personExtra = data.personalizations.reduce((sum, p) => {
    const selId = personSelections[p.id]
    if (!selId) return sum
    const opt = p.options?.find(o => o.id === selId)
    return sum + (opt?.price_delta ?? 0) * p.quantidade
  }, 0)

  const addonExtra = data.addons.reduce((sum, a) => {
    if (addonSelections.has(a.id)) return sum + a.price_delta
    return sum
  }, 0)

  const totalPrice = basePrice + personExtra + addonExtra

  function confirm() {
    const config: CompositeConfig = {
      inclusions: data.items.map(i => ({
        component_product_id: i.component_product_id,
        component_nome: i.component?.nome ?? '',
        quantity: i.quantity,
      })),
      personalizations: data.personalizations
        .filter(p => personSelections[p.id] !== undefined)
        .map(p => {
          const selId = personSelections[p.id]
          const opt = p.options?.find(o => o.id === selId)!
          return {
            personalization_id: p.id,
            personalization_nome: p.nome,
            option_id: selId,
            option_nome: opt.component?.nome ?? '',
            quantidade: p.quantidade,
            price_delta: opt.price_delta,
            component_product_id: opt.component_product_id,
            component_production_sector: opt.component?.production_sector ?? null,
          }
        }),
      addons: data.addons
        .filter(a => addonSelections.has(a.id))
        .map(a => ({
          addon_id: a.id,
          addon_nome: a.component?.nome ?? '',
          price_delta: a.price_delta,
          component_product_id: a.component_product_id,
          component_production_sector: a.component?.production_sector ?? null,
        })),
    }
    onConfirm(config, personExtra + addonExtra)
  }

  const allPersonSelected = data.personalizations.every(p => personSelections[p.id] !== undefined)

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-ink-card border-t border-gold/20 rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-ink-card border-b border-ink-border px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-0.5">Kit</p>
            <h2 className="font-bold text-lg text-white leading-tight">{product.nome}</h2>
            <p className="text-gold font-bold text-base mt-0.5">{fmtBRL(totalPrice)}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-ink-raised border border-ink-border flex items-center justify-center text-[#555] shrink-0">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-6 pt-4">
          {/* Inclusions */}
          {data.items.length > 0 && (
            <div>
              <p className="text-[10px] text-[#555] uppercase tracking-widest mb-3">Incluso no kit</p>
              <div className="flex flex-wrap gap-2">
                {data.items.map(item => (
                  <span key={item.component_product_id}
                    className="text-xs px-3 py-1.5 rounded-full bg-ink-raised border border-ink-border text-white">
                    {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.component?.nome ?? `Item #${item.component_product_id}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Personalizations */}
          {data.personalizations.map(pers => (
            <div key={pers.id}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-sm font-semibold text-white">{pers.nome}</p>
                {pers.quantidade > 1 && (
                  <span className="text-[10px] bg-ink-raised border border-ink-border text-[#666] px-2 py-0.5 rounded-full">
                    escolha {pers.quantidade}
                  </span>
                )}
                <span className="text-[10px] text-red-400 ml-auto">obrigatório</span>
              </div>
              <div className="space-y-2">
                {(pers.options ?? []).map(opt => {
                  const selected = personSelections[pers.id] === opt.id
                  return (
                    <button key={opt.id}
                      onClick={() => setPersonSelections(prev => ({ ...prev, [pers.id]: opt.id }))}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition active:scale-[0.98]
                        ${selected ? 'border-gold/50 bg-gold/8' : 'border-ink-border bg-ink-raised'}`}>
                      <span className="text-sm text-white">{opt.component?.nome ?? `Opção #${opt.id}`}</span>
                      <div className="flex items-center gap-2">
                        {opt.price_delta > 0 && (
                          <span className="text-[11px] text-[#666]">+{fmtBRL(opt.price_delta)}</span>
                        )}
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition
                          ${selected ? 'border-gold bg-gold' : 'border-[#444]'}`}>
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-ink" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Addons */}
          {data.addons.length > 0 && (
            <div>
              <p className="text-[10px] text-[#555] uppercase tracking-widest mb-3">Adicionais opcionais</p>
              <div className="space-y-2">
                {data.addons.map(addon => {
                  const selected = addonSelections.has(addon.id)
                  return (
                    <button key={addon.id}
                      onClick={() => setAddonSelections(prev => {
                        const next = new Set(prev)
                        if (next.has(addon.id)) next.delete(addon.id)
                        else next.add(addon.id)
                        return next
                      })}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition active:scale-[0.98]
                        ${selected ? 'border-gold/50 bg-gold/8' : 'border-ink-border bg-ink-raised'}`}>
                      <span className="text-sm text-white">{addon.component?.nome ?? `Adicional #${addon.id}`}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#666]">+{fmtBRL(addon.price_delta)}</span>
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition
                          ${selected ? 'border-gold bg-gold' : 'border-[#444]'}`}>
                          {selected && <CheckCircle size={10} className="text-ink" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div className="sticky bottom-0 bg-ink-card border-t border-ink-border px-5 py-4">
          <button onClick={confirm} disabled={!allPersonSelected}
            className="w-full py-4 rounded-2xl bg-gold text-ink font-bold text-base flex items-center justify-center gap-2 shadow-gold transition active:scale-[0.98] disabled:opacity-40">
            Adicionar ao carrinho · {fmtBRL(totalPrice)}
          </button>
        </div>
      </div>
    </div>
  )
}

// Status notification toast
function StatusToast({ msg, sub, variant, onDone }: { msg: string; sub: string; variant?: 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000)
    return () => clearTimeout(t)
  }, [onDone])
  const isError = variant === 'error'
  return (
    <div className="fixed top-4 left-4 right-4 z-[100] animate-slide-up">
      <div className={`flex items-start gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg
        ${isError ? 'border-red-500/30 bg-red-950/80' : 'border-emerald-500/30 bg-emerald-950/80'}`}>
        {isError
          ? <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          : <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />}
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isError ? 'text-red-300' : 'text-emerald-300'}`}>{msg}</p>
          <p className={`text-xs mt-0.5 ${isError ? 'text-red-600' : 'text-emerald-600'}`}>{sub}</p>
        </div>
        <button onClick={onDone} className="text-[#444]"><X size={12} /></button>
      </div>
    </div>
  )
}

// Pedido card with timeline
function PedidoCard({ p }: { p: PedidoTracking }) {
  const s = PEDIDO_STATUS[p.status] ?? PEDIDO_STATUS.pendente
  const steps = [
    { label: 'Recebido',   done: s.step >= 1 },
    { label: 'Em preparo', done: s.step >= 2 },
    { label: 'Entregue',   done: s.step >= 3 },
  ]
  if (p.status === 'cancelado') return (
    <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 flex items-center gap-3">
      <X size={14} className="text-red-400 shrink-0" />
      <div>
        <p className="text-xs font-semibold text-red-400">Pedido #{p.id} cancelado</p>
        <p className="text-[10px] text-[#555]">{timeSince(p.created_at)}</p>
      </div>
    </div>
  )
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-card px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold text-[#888]">Pedido #{p.id}</span>
        <span className="text-[10px] text-[#555]">{timeSince(p.created_at)}</span>
      </div>
      {/* Step timeline */}
      <div className="flex items-start mb-3">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: step.done ? s.color : '#1a1a1a',
                  border: `2px solid ${step.done ? s.color : '#2a2a2a'}`,
                  boxShadow: step.done && i === s.step - 1 ? `0 0 10px ${s.color}60` : 'none',
                }}>
                {step.done && <CheckCircle size={12} style={{ color: step.done ? '#000' : '#444' }} />}
              </div>
              <span className="text-[9px] font-medium text-center leading-tight"
                style={{ color: step.done ? s.color : '#3a3a3a' }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="h-0.5 flex-1 mx-1 mb-5 rounded-full transition-all"
                style={{ background: steps[i + 1].done ? s.color : '#2a2a2a' }} />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: s.color }}>{s.desc}</p>
      {p.itens.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {p.itens.map((item, idx) => (
            <p key={idx} className="text-[10px] text-[#444]">
              {item.quantidade}× {item.nome_produto}
              {item.composite_config?.personalizations?.map(c =>
                ` · ${c.option_nome}`
              ).join('')}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// Solicitar tab
function SolicitarTab({
  isFechamento, actionSending, onSolicitar
}: {
  isFechamento: boolean
  actionSending: string | null
  onSolicitar: (tipo: 'atendimento' | 'rosh' | 'fechamento') => void
}) {
  return (
    <div className="flex-1 p-4 space-y-3 pb-28">
      <p className="text-[11px] text-[#444] uppercase tracking-widest mb-4">Como podemos ajudar?</p>

      <button onClick={() => onSolicitar('atendimento')}
        disabled={!!actionSending}
        className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-blue-900/40 bg-blue-950/20 active:scale-[0.98] transition disabled:opacity-50">
        <div className="w-12 h-12 rounded-xl bg-blue-900/30 border border-blue-900/40 flex items-center justify-center shrink-0">
          {actionSending === 'atendimento' ? <Spinner size={20} /> : <Bell size={22} className="text-blue-400" />}
        </div>
        <div className="text-left">
          <p className="font-bold text-white text-base">Chamar Atendimento</p>
          <p className="text-[12px] text-blue-400/70 mt-0.5">Um de nossos atendentes virá até você</p>
        </div>
      </button>

      <button onClick={() => onSolicitar('rosh')}
        disabled={!!actionSending}
        className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-purple-900/40 bg-purple-950/20 active:scale-[0.98] transition disabled:opacity-50">
        <div className="w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-900/40 flex items-center justify-center shrink-0">
          {actionSending === 'rosh' ? <Spinner size={20} /> : <Flame size={22} className="text-purple-400" />}
        </div>
        <div className="text-left">
          <p className="font-bold text-white text-base">Trocar Rosh</p>
          <p className="text-[12px] text-purple-400/70 mt-0.5">Solicitar troca de carvão / mangueira</p>
        </div>
      </button>

      <button
        onClick={() => !isFechamento && onSolicitar('fechamento')}
        disabled={isFechamento || actionSending === 'fechamento'}
        className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border transition active:scale-[0.98] disabled:opacity-70"
        style={{
          borderColor: isFechamento ? 'rgba(212,175,55,0.35)' : 'rgba(212,175,55,0.20)',
          background: isFechamento ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.03)',
        }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)' }}>
          {actionSending === 'fechamento'
            ? <Spinner size={20} />
            : isFechamento
              ? <CheckCircle size={22} className="text-gold" />
              : <Receipt size={22} className="text-gold" />}
        </div>
        <div className="text-left">
          <p className="font-bold text-white text-base">
            {isFechamento ? 'Conta solicitada' : 'Pedir Conta'}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'rgba(212,175,55,0.6)' }}>
            {isFechamento
              ? 'Dirija-se ao caixa para concluir o pagamento'
              : 'Solicitar fechamento da comanda'}
          </p>
        </div>
      </button>
    </div>
  )
}

// Rosh essence selector modal
function RoshModal({
  product, essencias, onConfirm, onClose,
}: {
  product: Produto
  essencias: { id: number; nome: string }[]
  onConfirm: (config: RoshConfig) => void
  onClose: () => void
}) {
  const [modo, setModo] = useState<'unica' | 'meio_a_meio' | null>(null)
  const [selected, setSelected] = useState<number[]>([])

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
    onConfirm({
      tipo_mistura: modo,
      essencias: selected.map(id => ({
        id,
        nome: essencias.find(e => e.id === id)?.nome ?? '',
        percentual: modo === 'unica' ? 100 : 50,
      })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-ink-card border-t border-gold/20 rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-ink-card border-b border-ink-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-0.5">Narguilé</p>
            <h2 className="font-bold text-lg text-white">{product.nome}</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-ink-raised border border-ink-border flex items-center justify-center text-[#555]">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 pb-6 pt-4 space-y-4">
          {!modo ? (
            <div className="space-y-3">
              <p className="text-[10px] text-[#555] uppercase tracking-widest">Tipo de mistura</p>
              <button onClick={() => { setModo('unica'); setSelected([]) }}
                className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-ink-border bg-ink-raised active:scale-[0.98] transition">
                <span className="text-3xl">💨</span>
                <div className="text-left">
                  <p className="font-bold text-white text-base">Uma Essência</p>
                  <p className="text-[12px] text-[#555] mt-0.5">Sabor único, intenso e puro</p>
                </div>
              </button>
              <button onClick={() => { setModo('meio_a_meio'); setSelected([]) }}
                className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-ink-border bg-ink-raised active:scale-[0.98] transition">
                <span className="text-3xl">🔥</span>
                <div className="text-left">
                  <p className="font-bold text-white text-base">Meio a Meio</p>
                  <p className="text-[12px] text-[#555] mt-0.5">Combine duas essências distintas</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#555] uppercase tracking-widest">
                  {modo === 'unica' ? 'Escolha 1 essência' : `Escolha 2 essências (${selected.length}/2)`}
                </p>
                <button onClick={() => { setModo(null); setSelected([]) }}
                  className="text-xs px-3 py-1 rounded-lg bg-ink-raised border border-ink-border text-[#555]">
                  ← Voltar
                </button>
              </div>
              {essencias.length === 0 && (
                <p className="text-xs text-center py-4 text-[#444]">Nenhuma essência disponível no momento.</p>
              )}
              <div className="space-y-2">
                {essencias.map(e => {
                  const isSel = selected.includes(e.id)
                  const isDisabled = !isSel && modo === 'meio_a_meio' && selected.length >= 2
                  return (
                    <button key={e.id} onClick={() => !isDisabled && toggle(e.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition active:scale-[0.98]
                        ${isSel ? 'border-gold/50 bg-gold/8' : 'border-ink-border bg-ink-raised'}
                        ${isDisabled ? 'opacity-40' : ''}`}>
                      <span className="text-sm text-white">{e.nome}</span>
                      <div className={`w-4 h-4 ${modo === 'unica' ? 'rounded-full' : 'rounded-md'} border-2 flex items-center justify-center transition
                        ${isSel ? 'border-gold bg-gold' : 'border-[#444]'}`}>
                        {isSel && (
                          modo === 'unica'
                            ? <div className="w-1.5 h-1.5 rounded-full bg-ink" />
                            : <CheckCircle size={10} className="text-ink" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Confirm */}
        {modo && (
          <div className="sticky bottom-0 bg-ink-card border-t border-ink-border px-5 py-4">
            <button onClick={confirm} disabled={!canConfirm}
              className="w-full py-4 rounded-2xl bg-gold text-ink font-bold text-base shadow-gold transition active:scale-[0.98] disabled:opacity-40">
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
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QRMenuPage() {
  const params = useParams<{ mesaNumber?: string; sessionToken?: string }>()
  const mesaNumber = params.mesaNumber
  const sessionToken = params.sessionToken

  const [fase, setFase]           = useState<Fase>('loading')
  const [activeTab, setActiveTab] = useState<Tab>('cardapio')
  const [mesa, setMesa]           = useState<{ id: number; numero: number; status: string } | null>(null)
  const [comanda, setComanda]     = useState<{ id: number; status: string } | null>(null)
  const [categories, setCategories]     = useState<Categoria[]>([])
  const [products, setProducts]         = useState<Produto[]>([])
  const [essencias, setEssencias]       = useState<{ id: number; nome: string }[]>([])
  const [optionGroupsMap, setOptionGroupsMap] = useState<Record<number, GroupWithOptions[]>>({})
  const [cart, setCart]           = useState<CartItem[]>([])
  const [cartOpen, setCartOpen]   = useState(false)
  const [customerNote, setCustomerNote] = useState('')
  const [meusPedidos, setMeusPedidos]   = useState<PedidoTracking[]>([])
  const [selCat, setSelCat]       = useState<number | null>(null)
  const [showCatGrid, setShowCatGrid]   = useState(true)
  const [sending, setSending]     = useState(false)
  const [pendingProduct, setPendingProduct] = useState<Produto | null>(null)
  const [roshProduct, setRoshProduct] = useState<Produto | null>(null)
  const [compositeProduct, setCompositeProduct] = useState<Produto | null>(null)
  const [compositeData, setCompositeData]     = useState<CompositeData | null>(null)
  const [compositeLoading, setCompositeLoading] = useState(false)
  const [actionSending, setActionSending]     = useState<string | null>(null)
  const [toast, setToast]         = useState<{ msg: string; sub: string; variant?: 'error' } | null>(null)

  const prevStatusesRef  = useRef<Record<number, string>>({})
  const channelRefMesa   = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const channelRefPedidos = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Fetch pedidos ───────────────────────────────────────────────────────────
  const fetchMeusPedidos = useCallback(async (comandaId: number) => {
    const { data } = await supabase
      .from('pedidos')
      .select('id, status, created_at, pedido_itens(nome_produto, quantidade, composite_config)')
      .eq('comanda_id', comandaId)
      .order('created_at', { ascending: false })
    if (!data) return
    const pedidos: PedidoTracking[] = data.map((p: any) => ({
      id: p.id,
      status: p.status,
      created_at: p.created_at,
      itens: p.pedido_itens ?? [],
    }))

    // Detect status changes → show toast
    for (const p of pedidos) {
      const prev = prevStatusesRef.current[p.id]
      if (prev && prev !== p.status && p.status !== 'cancelado') {
        const s = PEDIDO_STATUS[p.status as keyof typeof PEDIDO_STATUS]
        if (s) setToast({ msg: `Pedido #${p.id} — ${s.label}`, sub: s.desc })
      }
      prevStatusesRef.current[p.id] = p.status
    }
    setMeusPedidos(pedidos)
  }, [])

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      let mesaData: { id: number; numero: number; status: string } | null = null
      let comandaData: { id: number; status: string } | null = null

      if (sessionToken) {
        // Token-based: validate session → get comanda + mesa
        const { data: c } = await supabase
          .from('comandas')
          .select('id, status, mesas(id, numero, status, qr_slug)')
          .eq('session_token', sessionToken)
          .single()

        if (!c) { setFase('unavailable'); return }

        const raw = (c as any).mesas
        const m = Array.isArray(raw) ? raw[0] : raw
        if (!m) { setFase('unavailable'); return }

        mesaData = { id: m.id, numero: m.numero, status: m.status }
        setMesa(mesaData)

        if (c.status === 'fechada') { setFase('fechada'); return }
        if (c.status !== 'aberta') { setFase('unavailable'); return }

        comandaData = { id: c.id, status: c.status }
        setComanda(comandaData)
      } else if (mesaNumber) {
        // Legacy: number-based lookup
        const { data: m } = await supabase
          .from('mesas').select('*').eq('numero', parseInt(mesaNumber)).single()
        setMesa(m)
        if (!m) { setFase('unavailable'); return }

        const isActive = m.status === 'ocupada' || m.status === 'solicitou_fechamento'
        if (!isActive) { setFase('unavailable'); return }

        const { data: c } = await supabase
          .from('comandas').select('id, status').eq('mesa_id', m.id).eq('status', 'aberta').single()
        setComanda(c)
        if (!c) { setFase('unavailable'); return }

        mesaData = m
        comandaData = c
      } else {
        setFase('unavailable')
        return
      }

      const [{ data: cats }, { data: prods }, { data: ess }] = await Promise.all([
        supabase.from('categorias').select('*').eq('exibe_cardapio', true).order('ordem'),
        supabase.from('products')
          .select('id, nome, categoria_id, preco, stock_quantity, is_rosh, imagem_url, product_type')
          .eq('active', true).eq('exibe_cardapio', true).gt('stock_quantity', 0).order('nome'),
        supabase.from('products').select('id, nome').eq('is_insumo_rosh', true).eq('active', true).order('nome'),
      ])
      setCategories(cats ?? [])
      setProducts(prods ?? [])
      setEssencias((ess ?? []) as { id: number; nome: string }[])

      const productIds = (prods ?? []).map((p: Produto) => p.id)
      if (productIds.length > 0) {
        const { data: groups } = await supabase
          .from('product_option_groups')
          .select('*, product_options(*)')
          .in('product_id', productIds)
          .eq('ativo', true)
          .order('ordem')
        const map: Record<number, GroupWithOptions[]> = {}
        for (const g of (groups ?? []) as any[]) {
          if (!map[g.product_id]) map[g.product_id] = []
          map[g.product_id].push({
            id: g.id, nome: g.nome, tipo: g.tipo,
            obrigatorio: g.obrigatorio, min_select: g.min_select, max_select: g.max_select,
            options: (g.product_options ?? []).filter((o: any) => o.ativo).map((o: any) => ({
              id: o.id, nome: o.nome, price_delta: Number(o.price_delta),
            })),
          })
        }
        setOptionGroupsMap(map)
      }

      await fetchMeusPedidos(comandaData!.id)
      setFase('welcome')
    }
    init()
  }, [mesaNumber, sessionToken, fetchMeusPedidos])

  // ── Realtime: mesa ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mesa) return
    channelRefMesa.current = supabase
      .channel(`qr-mesa-${mesa.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mesas', filter: `id=eq.${mesa.id}` },
        (payload) => {
          const newStatus = (payload.new as any).status
          setMesa(prev => prev ? { ...prev, status: newStatus } : prev)
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comandas', filter: `mesa_id=eq.${mesa.id}` },
        (payload) => {
          const newStatus = (payload.new as any).status
          if (newStatus === 'fechada') {
            setFase('fechada')
          }
        })
      .subscribe()
    return () => { channelRefMesa.current?.unsubscribe() }
  }, [mesa?.id])

  // ── Realtime: pedidos ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!comanda) return
    channelRefPedidos.current = supabase
      .channel(`qr-pedidos-${comanda.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `comanda_id=eq.${comanda.id}` },
        () => fetchMeusPedidos(comanda.id))
      .subscribe()
    return () => { channelRefPedidos.current?.unsubscribe() }
  }, [comanda?.id, fetchMeusPedidos])

  // ── Product click ────────────────────────────────────────────────────────────
  async function handleProductClick(p: Produto) {
    if (p.is_rosh) {
      setRoshProduct(p)
      return
    }
    if (p.product_type === 'composto') {
      setCompositeProduct(p)
      setCompositeLoading(true)
      try {
        const [{ data: items }, { data: persons }, { data: addons }] = await Promise.all([
          supabase.from('composite_items')
            .select('component_product_id, quantity, component:products!composite_items_component_product_id_fkey(id, nome)')
            .eq('product_id', p.id).order('ordem'),
          supabase.from('composite_personalizations')
            .select('id, nome, quantidade, options:composite_personalization_options(id, component_product_id, price_delta, is_default, component:products!composite_personalization_options_component_product_id_fkey(id, nome, production_sector))')
            .eq('product_id', p.id).order('ordem'),
          supabase.from('composite_addons')
            .select('id, component_product_id, price_delta, component:products!composite_addons_component_product_id_fkey(id, nome, production_sector)')
            .eq('product_id', p.id).order('ordem'),
        ])
        setCompositeData({
          items: (items ?? []).map((i: any) => ({ ...i, component: Array.isArray(i.component) ? i.component[0] : i.component })),
          personalizations: (persons ?? []).map((p: any) => ({
            ...p,
            options: (p.options ?? []).map((o: any) => ({ ...o, component: Array.isArray(o.component) ? o.component[0] : o.component }))
          })),
          addons: (addons ?? []).map((a: any) => ({ ...a, component: Array.isArray(a.component) ? a.component[0] : a.component })),
        })
      } catch (err: any) {
        setCompositeProduct(null)
        setToast({ msg: 'Erro ao carregar produto', sub: err?.message ?? 'Tente novamente.', variant: 'error' })
      } finally {
        setCompositeLoading(false)
      }
      return
    }
    const groups = optionGroupsMap[p.id]
    if (groups && groups.length > 0) setPendingProduct(p)
    else addToCart(p, [], 0)
  }

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  function addRosh(p: Produto, roshConfig: RoshConfig) {
    const essKey = roshConfig.essencias.map(e => e.id).sort().join(',')
    const cartKey = `${p.id}-rosh-${roshConfig.tipo_mistura}-${essKey}`
    setCart(c => {
      const ex = c.find(i => i.cartKey === cartKey)
      if (ex) return c.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { cartKey, id: p.id, nome: p.nome, preco: p.preco, priceAdditions: 0, qty: 1, is_rosh: true, selectedOptions: [], roshConfig }]
    })
    setRoshProduct(null)
  }

  function addToCart(p: Produto, selectedOptions: SelectedOption[], priceAdditions: number, compositeConfig?: CompositeConfig) {
    const optKey = selectedOptions.length > 0 ? selectedOptions.map(o => o.option_id).sort().join(',') : ''
    const cartKey = compositeConfig
      ? `${p.id}-cmp-${[...compositeConfig.personalizations.map(x => x.option_id), ...compositeConfig.addons.map(x => x.addon_id)].sort().join(',')}`
      : optKey ? `${p.id}-${optKey}` : `${p.id}`
    setCart(c => {
      const ex = c.find(i => i.cartKey === cartKey)
      if (ex) return c.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { cartKey, id: p.id, nome: p.nome, preco: p.preco, priceAdditions, qty: 1, is_rosh: p.is_rosh, selectedOptions, compositeConfig }]
    })
    setCompositeProduct(null)
    setCompositeData(null)
  }

  function removeFromCart(cartKey: string) {
    setCart(c => c.flatMap(i => i.cartKey === cartKey
      ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]))
  }

  function addQty(item: CartItem) {
    if (item.compositeConfig || item.roshConfig) {
      setCart(c => c.map(i => i.cartKey === item.cartKey ? { ...i, qty: i.qty + 1 } : i))
    } else {
      addToCart(
        { id: item.id, nome: item.nome, preco: item.preco, stock_quantity: 99, categoria_id: 0, is_rosh: item.is_rosh, imagem_url: null, product_type: 'simples' },
        item.selectedOptions, item.priceAdditions
      )
    }
  }

  // ── Send order ───────────────────────────────────────────────────────────────
  async function sendOrder() {
    if (!comanda || !mesa || cart.length === 0) return
    setSending(true)
    try {
      const items = cart.map(i => ({
        product_id: i.id,
        quantidade: i.qty,
        price_additions: i.priceAdditions,
        selected_options: i.selectedOptions.length > 0 ? i.selectedOptions : null,
        composite_config: i.compositeConfig ?? null,
        rosh_config: i.roshConfig ?? null,
      }))

      const { data: result, error } = await supabase.rpc('fn_place_order', {
        p_comanda_id: comanda.id,
        p_mesa_id: mesa.id,
        p_observacao: customerNote || null,
        p_items: items,
        p_criado_por: null,
      })
      if (error || !result) {
        setToast({ msg: 'Erro ao enviar pedido', sub: error?.message ?? 'Tente novamente.', variant: 'error' })
        return
      }

      const pedidoId = (result as any).pedido_id

      // Deduct simple/rosh product stock (fire-and-forget — same as operator flow)
      Promise.resolve(supabase.rpc('registrar_venda_estoque', {
        p_pedido_id: pedidoId,
        p_user_id: null,
      })).catch(() => {})

      // Deduct component stock for composite items (fire-and-forget)
      for (const item of cart) {
        if (!item.compositeConfig) continue
        const allComponents = [
          ...(item.compositeConfig.inclusions ?? []).map(inc => ({
            id: inc.component_product_id, qty: inc.quantity * item.qty
          })),
          ...item.compositeConfig.personalizations.map(p => ({
            id: p.component_product_id, qty: p.quantidade * item.qty
          })),
          ...item.compositeConfig.addons.map(a => ({
            id: a.component_product_id, qty: item.qty
          })),
        ]
        for (const comp of allComponents) {
          Promise.resolve(supabase.rpc('deduct_component_stock', {
            p_product_id: comp.id, p_quantidade: comp.qty,
            p_pedido_id: pedidoId, p_user_id: null as any,
          })).catch(() => {})
        }
      }

      setCart([])
      setCartOpen(false)
      setCustomerNote('')
      setToast({ msg: '✓ Pedido recebido!', sub: 'Agora é com a gente.' })
      setActiveTab('pedidos')
      await fetchMeusPedidos(comanda.id)
    } catch (err: any) {
      setToast({ msg: 'Erro ao enviar pedido', sub: err?.message ?? 'Tente novamente.', variant: 'error' })
    } finally {
      setSending(false)
    }
  }

  // ── Solicitações ─────────────────────────────────────────────────────────────
  async function enviarSolicitacao(tipo: 'atendimento' | 'rosh' | 'fechamento') {
    if (!mesa) return
    setActionSending(tipo)
    try {
      await supabase.from('mesa_solicitacoes').insert({
        mesa_id: mesa.id, comanda_id: comanda?.id ?? null,
        mesa_numero: mesa.numero, tipo,
      })
      if (tipo === 'fechamento') {
        await supabase.rpc('solicitar_fechamento_mesa', { p_mesa_id: mesa.id })
        setMesa(prev => prev ? { ...prev, status: 'solicitou_fechamento' } : prev)
        setToast({ msg: '💳 Fechamento solicitado', sub: 'Dirija-se ao caixa para concluir o pagamento.' })
      } else if (tipo === 'atendimento') {
        setToast({ msg: '🔔 Solicitação enviada', sub: 'Nossa equipe foi notificada.' })
      } else {
        setToast({ msg: '🔥 Troca de Rosh solicitada', sub: 'Nossa equipe já recebeu seu pedido.' })
      }
    } finally {
      setActionSending(null)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const cartCount    = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal    = cart.reduce((s, i) => s + (i.preco + i.priceAdditions) * i.qty, 0)
  const activePedidos = meusPedidos.filter(p => p.status !== 'cancelado')
  const isFechamento  = mesa?.status === 'solicitou_fechamento'
  const catProducts   = selCat ? products.filter(p => p.categoria_id === selCat) : products

  // ── Render ────────────────────────────────────────────────────────────────────
  if (fase === 'loading') return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <Spinner size={32} />
    </div>
  )

  if (fase === 'unavailable' || !mesa) return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center text-center px-6 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center">
        <Wind size={24} className="text-[#444]" />
      </div>
      <p className="font-bold text-lg text-white">Mesa não disponível</p>
      <p className="text-sm text-[#444]">Procure um de nossos atendentes.</p>
    </div>
  )

  if (fase === 'fechada') return <ClosedScreen mesaNum={mesa.numero} />

  if (fase === 'welcome') return (
    <WelcomeScreen mesaNum={mesa.numero} onDone={() => setFase('menu')} />
  )

  // ── Menu ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-ink text-white flex flex-col">

      {/* Toast */}
      {toast && <StatusToast msg={toast.msg} sub={toast.sub} variant={toast.variant} onDone={() => setToast(null)} />}

      {/* Rosh modal */}
      {roshProduct && (
        <RoshModal
          product={roshProduct}
          essencias={essencias}
          onConfirm={(config) => addRosh(roshProduct, config)}
          onClose={() => setRoshProduct(null)}
        />
      )}

      {/* Modals */}
      {pendingProduct && (
        <OptionsModal
          productNome={pendingProduct.nome}
          productPreco={pendingProduct.preco}
          groups={optionGroupsMap[pendingProduct.id] ?? []}
          onConfirm={(sel, additions) => { addToCart(pendingProduct, sel, additions); setPendingProduct(null) }}
          onClose={() => setPendingProduct(null)}
        />
      )}
      {compositeProduct && !compositeLoading && compositeData && (
        <CompositeConfigurator
          product={compositeProduct}
          data={compositeData}
          basePrice={compositeProduct.preco}
          onConfirm={(config, extra) => addToCart(compositeProduct, [], extra, config)}
          onClose={() => { setCompositeProduct(null); setCompositeData(null) }}
        />
      )}
      {compositeProduct && compositeLoading && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <Spinner size={32} />
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative w-full bg-ink-card border-t border-ink-border rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-white">Meu Pedido</h2>
              <button onClick={() => setCartOpen(false)}
                className="w-8 h-8 rounded-xl bg-ink-raised border border-ink-border flex items-center justify-center text-[#555]">
                <X size={14} />
              </button>
            </div>
            <div>
              <label className="block text-[11px] text-[#444] uppercase tracking-widest mb-1.5">Observação (opcional)</label>
              <input className="w-full bg-ink-raised border border-ink-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#444] outline-none focus:border-gold/40 transition"
                placeholder='Ex: "sem gelo", "bem gelado"…'
                value={customerNote} onChange={e => setCustomerNote(e.target.value)} />
            </div>
            <div className="space-y-4 mt-4">
              {cart.length === 0 && <p className="text-[#444] text-sm text-center py-6">Carrinho vazio</p>}
              {cart.map(item => (
                <div key={item.cartKey} className="flex items-start gap-3">
                  <div className="flex items-center bg-ink-raised border border-ink-border rounded-xl overflow-hidden shrink-0">
                    <button onClick={() => removeFromCart(item.cartKey)}
                      className="p-2.5 text-[#444] active:text-white transition"><Minus size={13} /></button>
                    <span className="text-sm font-bold w-6 text-center text-white">{item.qty}</span>
                    <button onClick={() => addQty(item)}
                      className="p-2.5 text-[#444] active:text-white transition"><Plus size={13} /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{item.nome}</p>
                    {item.roshConfig && (
                      <p className="text-[10px] text-gold mt-0.5 font-semibold">
                        {item.roshConfig.tipo_mistura === 'unica'
                          ? `Essência: ${item.roshConfig.essencias[0]?.nome ?? ''}`
                          : `Meio a meio: ${item.roshConfig.essencias.map(e => e.nome).join(' + ')}`}
                      </p>
                    )}
                    {item.compositeConfig && (
                      <div className="mt-0.5 space-y-0.5">
                        {item.compositeConfig.personalizations.map((p, i) => (
                          <p key={i} className="text-[10px] text-gold">{p.personalization_nome}: {p.option_nome}</p>
                        ))}
                        {item.compositeConfig.addons.map((a, i) => (
                          <p key={i} className="text-[10px] text-[#666]">+ {a.addon_nome}</p>
                        ))}
                      </div>
                    )}
                    {item.selectedOptions.length > 0 && (
                      <p className="text-[10px] text-[#555] mt-0.5 truncate">
                        {item.selectedOptions.map(o => o.option_nome).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gold shrink-0">
                    {fmtBRL((item.preco + item.priceAdditions) * item.qty)}
                  </span>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <>
                <div className="flex justify-between items-center my-4 pt-4 border-t border-ink-border">
                  <span className="font-semibold text-white">Total</span>
                  <span className="font-bold text-2xl text-gold">{fmtBRL(cartTotal)}</span>
                </div>
                <button onClick={sendOrder} disabled={sending}
                  className="w-full py-4 rounded-2xl bg-gold text-ink font-bold text-base flex items-center justify-center gap-2 shadow-gold transition active:scale-[0.98] disabled:opacity-60">
                  {sending ? <Spinner size={20} /> : <><Send size={17} /> Enviar Pedido · {fmtBRL(cartTotal)}</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-ink/96 backdrop-blur-md border-b border-ink-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
              <span className="font-bold text-sm text-white">Lux Lounge</span>
            </div>
            <div className="flex items-center gap-2 pl-3">
              <span className="text-[11px] text-[#555]">Mesa {mesa.numero}</span>
              {isFechamento && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  💳 Conta solicitada
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setCartOpen(true)}
            className="relative p-2.5 rounded-xl bg-ink-raised border border-ink-border transition active:scale-95">
            <ShoppingCart size={18} className={cartCount > 0 ? 'text-gold' : 'text-[#555]'} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gold text-ink text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto pb-32">

        {/* CARDÁPIO TAB */}
        {activeTab === 'cardapio' && (
          <div className="animate-fade-in">
            {showCatGrid ? (
              /* Category grid */
              <div className="p-4">
                <p className="text-[11px] text-[#444] uppercase tracking-widest mb-4">Categorias</p>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map(cat => (
                    <CategoryCard key={cat.id} cat={cat} onClick={() => {
                      setSelCat(cat.id)
                      setShowCatGrid(false)
                    }} />
                  ))}
                </div>
              </div>
            ) : (
              /* Product list */
              <div>
                {/* Back + category selector */}
                <div className="px-4 py-3 border-b border-ink-border flex items-center gap-2">
                  <button onClick={() => setShowCatGrid(true)}
                    className="p-1.5 rounded-lg bg-ink-raised border border-ink-border text-[#555] active:text-white transition">
                    <ChevronLeft size={15} />
                  </button>
                  <div className="flex gap-2 overflow-x-auto flex-1">
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setSelCat(c.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition
                          ${selCat === c.id ? 'bg-gold text-ink' : 'bg-ink-raised border border-ink-border text-[#555]'}`}>
                        {c.nome}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {catProducts.length === 0 && (
                    <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
                      <p className="text-sm text-[#444]">Nenhum produto disponível</p>
                    </div>
                  )}
                  {catProducts.map(p => {
                    const inCart = cart.some(i => i.id === p.id)
                    const cartQty = cart.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0)
                    const hasOptions = (optionGroupsMap[p.id]?.length ?? 0) > 0
                    return (
                      <ProductCard key={p.id} p={p} inCart={inCart} cartQty={cartQty}
                        hasOptions={hasOptions} isComposto={p.product_type === 'composto'}
                        onClick={() => handleProductClick(p)} />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PEDIDOS TAB */}
        {activeTab === 'pedidos' && (
          <div className="p-4 space-y-3 animate-fade-in">
            <p className="text-[11px] text-[#444] uppercase tracking-widest mb-4">Meus pedidos</p>
            {activePedidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <Clock size={28} className="text-[#333]" />
                <p className="text-sm text-[#444]">Nenhum pedido ainda.<br />Explore o cardápio!</p>
                <button onClick={() => setActiveTab('cardapio')}
                  className="mt-2 px-4 py-2 rounded-xl bg-ink-raised border border-ink-border text-xs font-semibold text-[#666]">
                  Ver cardápio
                </button>
              </div>
            ) : (
              activePedidos.map(p => <PedidoCard key={p.id} p={p} />)
            )}
          </div>
        )}

        {/* SOLICITAR TAB */}
        {activeTab === 'solicitar' && (
          <SolicitarTab
            isFechamento={isFechamento}
            actionSending={actionSending}
            onSolicitar={enviarSolicitacao}
          />
        )}
      </div>

      {/* ── Bottom navigation ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
        {/* Cart FAB */}
        {cartCount > 0 && !cartOpen && activeTab === 'cardapio' && (
          <div className="px-4 pb-2">
            <button onClick={() => setCartOpen(true)}
              className="w-full py-3.5 rounded-2xl bg-gold text-ink font-bold text-sm flex items-center justify-center gap-2 shadow-gold transition active:scale-[0.98]">
              <ShoppingCart size={16} />
              Ver carrinho · {cartCount} item{cartCount > 1 ? 'ns' : ''} · {fmtBRL(cartTotal)}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 border-t border-ink-border"
          style={{ background: 'rgba(8,8,8,0.97)', backdropFilter: 'blur(12px)' }}>
          {([
            { key: 'cardapio', label: 'Cardápio', Icon: BookOpen, badge: undefined as number | undefined },
            { key: 'pedidos',  label: 'Pedidos',  Icon: Clock, badge: activePedidos.length as number | undefined },
            { key: 'solicitar',label: 'Solicitar', Icon: Bell, badge: undefined as number | undefined },
          ]).map(({ key, label, Icon, badge }) => (
            <button key={key} onClick={() => setActiveTab(key as Tab)}
              className={`flex flex-col items-center gap-1 py-3 transition relative
                ${activeTab === key ? 'text-gold' : 'text-[#444]'}`}>
              <div className="relative">
                <Icon size={20} />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-gold text-ink text-[9px] font-bold rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">{label}</span>
              {activeTab === key && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
