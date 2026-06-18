import { useState } from 'react'
import { X, Check } from 'lucide-react'
import type { SelectedOption } from '../../types'

export interface OptionItem {
  id: number
  nome: string
  price_delta: number
}

export interface GroupWithOptions {
  id: number
  nome: string
  tipo: 'single' | 'multiple'
  obrigatorio: boolean
  min_select: number
  max_select: number
  options: OptionItem[]
}

interface Props {
  productNome: string
  productPreco: number
  groups: GroupWithOptions[]
  onConfirm: (selectedOptions: SelectedOption[], priceAdditions: number) => void
  onClose: () => void
}

function fmt(n: number) {
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

export function OptionsModal({ productNome, productPreco, groups, onConfirm, onClose }: Props) {
  // selections: groupId → array of selected optionIds
  const [selections, setSelections] = useState<Record<number, number[]>>(() => {
    const init: Record<number, number[]> = {}
    for (const g of groups) init[g.id] = []
    return init
  })

  function toggleOption(group: GroupWithOptions, optionId: number) {
    setSelections(prev => {
      const current = prev[group.id] ?? []
      if (group.tipo === 'single') {
        // radio: toggle off if same, otherwise replace
        return { ...prev, [group.id]: current.includes(optionId) ? [] : [optionId] }
      }
      // multiple
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter(id => id !== optionId) }
      }
      if (current.length >= group.max_select) return prev
      return { ...prev, [group.id]: [...current, optionId] }
    })
  }

  // Validation
  const errors: string[] = []
  for (const g of groups) {
    const sel = selections[g.id] ?? []
    if (g.obrigatorio && sel.length < Math.max(g.min_select, 1)) {
      errors.push(`"${g.nome}" é obrigatório`)
    }
  }

  // Build result
  function buildResult(): { selected: SelectedOption[]; additions: number } {
    const selected: SelectedOption[] = []
    let additions = 0
    for (const g of groups) {
      for (const optId of (selections[g.id] ?? [])) {
        const opt = g.options.find(o => o.id === optId)
        if (!opt) continue
        selected.push({ group_id: g.id, group_nome: g.nome, option_id: opt.id, option_nome: opt.nome, price_delta: opt.price_delta })
        additions += opt.price_delta
      }
    }
    return { selected, additions }
  }

  const { additions } = buildResult()
  const finalPrice = productPreco + additions

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
      onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{productNome}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Base: {fmt(productPreco)}
              {additions > 0 && <span style={{ color: 'var(--gold)' }}> + {fmt(additions)}</span>}
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Groups */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {groups.map(group => {
            const sel = selections[group.id] ?? []
            return (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    {group.nome}
                  </span>
                  {group.obrigatorio && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
                      Obrigatório
                    </span>
                  )}
                  {group.tipo === 'multiple' && (
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      até {group.max_select}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {group.options.map(opt => {
                    const checked = sel.includes(opt.id)
                    const disabled = !checked && group.tipo === 'multiple' && sel.length >= group.max_select
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !disabled && toggleOption(group, opt.id)}
                        disabled={disabled}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition active:scale-[0.98] disabled:opacity-40"
                        style={{
                          background: checked ? 'var(--gold-bg)' : 'var(--bg-raised)',
                          border: `1px solid ${checked ? 'var(--gold-border)' : 'var(--border-default)'}`,
                        }}
                      >
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: checked ? 'var(--gold)' : 'transparent',
                            border: `2px solid ${checked ? 'var(--gold)' : 'var(--border-strong)'}`,
                          }}>
                          {checked && <Check size={9} color="#000" strokeWidth={3} />}
                        </div>
                        <span className="flex-1 text-sm" style={{ color: checked ? 'var(--gold)' : 'var(--text-primary)' }}>
                          {opt.nome}
                        </span>
                        {opt.price_delta > 0 && (
                          <span className="text-xs font-mono font-bold" style={{ color: checked ? 'var(--gold)' : 'var(--text-muted)' }}>
                            +{fmt(opt.price_delta)}
                          </span>
                        )}
                        {opt.price_delta === 0 && (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>grátis</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
          {errors.length > 0 && (
            <p className="text-xs mb-3 text-center" style={{ color: 'var(--red)' }}>
              {errors[0]}
            </p>
          )}
          <button
            onClick={() => {
              if (errors.length > 0) return
              const { selected, additions } = buildResult()
              onConfirm(selected, additions)
            }}
            disabled={errors.length > 0}
            className="btn-primary w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Adicionar ao Pedido
            {additions > 0
              ? ` · ${fmt(finalPrice)}`
              : ` · ${fmt(productPreco)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
