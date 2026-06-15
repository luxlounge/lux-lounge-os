import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface PageHelpProps {
  title: string
  lines: string[]
}

export function PageHelp({ title, lines }: PageHelpProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Como funciona esta tela?"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80"
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-muted)',
        }}
      >
        <HelpCircle size={13} />
        <span className="hidden sm:inline">Ajuda</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-5 shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}
                >
                  <HelpCircle size={13} style={{ color: 'var(--gold)' }} />
                </div>
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-lg transition hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>

            <ul className="space-y-2.5">
              {lines.map((line, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {line}
                  </p>
                </li>
              ))}
            </ul>

            <button
              onClick={() => setOpen(false)}
              className="mt-5 w-full py-2 rounded-xl text-sm font-semibold transition hover:opacity-80"
              style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)' }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  )
}
