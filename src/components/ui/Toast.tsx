import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId
    setToasts(ts => [...ts, { id, type, message }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const success = useCallback((m: string) => toast(m, 'success'), [toast])
  const error   = useCallback((m: string) => toast(m, 'error'),   [toast])
  const warning = useCallback((m: string) => toast(m, 'warning'), [toast])

  const configs: Record<ToastType, { icon: typeof CheckCircle; bg: string; border: string; color: string }> = {
    success: { icon: CheckCircle,   bg: 'var(--green-bg)',  border: 'var(--green-border)',  color: 'var(--green)' },
    error:   { icon: XCircle,       bg: 'var(--red-bg)',    border: 'var(--red-border)',    color: 'var(--red)' },
    warning: { icon: AlertTriangle, bg: 'var(--amber-bg)',  border: 'var(--amber-border)',  color: 'var(--amber)' },
  }

  return (
    <ToastContext.Provider value={{ toast, success, error, warning }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: 'min(360px, calc(100vw - 2rem))' }}>
        {toasts.map(t => {
          const cfg = configs[t.type]
          const Icon = cfg.icon
          return (
            <div key={t.id}
              className="flex items-start gap-3 px-4 py-3 rounded-xl pointer-events-auto animate-fade-in"
              style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                backdropFilter: 'blur(8px)',
              }}>
              <Icon size={15} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
              <span className="text-sm flex-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
                {t.message}
              </span>
              <button onClick={() => dismiss(t.id)}
                className="shrink-0 transition-opacity hover:opacity-60"
                style={{ color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
