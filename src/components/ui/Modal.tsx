import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-ink-card border border-ink-border rounded-t-3xl sm:rounded-2xl w-full ${widths[size]} shadow-2xl animate-slide-up`}>
        {(title || true) && (
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            {title && <h2 className="font-display font-bold text-lg text-white">{title}</h2>}
            {!title && <div />}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-ink-raised border border-ink-border text-[#444] hover:text-white transition">
              <X size={15} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
