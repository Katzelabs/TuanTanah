import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
import { backdrop, modalPanel } from '@/lib/motion.js'

// Body scroll stays locked while any modal is open, so an inner confirm dialog
// closing doesn't hand scrolling back while its parent modal is still up.
let openCount = 0
let overflowBeforeLock = ''

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Optional header title rendered in the framed bar. */
  title?: ReactNode
  /** Tailwind max-width class for the panel. */
  size?: 'sm' | 'md' | 'lg'
  /** Disable backdrop-click / Escape close (e.g. forced decisions). */
  dismissable?: boolean
  className?: string
}

const MAX_W = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' } as const

/**
 * Brutalist modal: dimmed backdrop + framed panel with consistent enter/exit
 * motion, Escape-to-close, backdrop dismiss, and body scroll-lock.
 */
export function Modal({
  open,
  onClose,
  children,
  title,
  size = 'md',
  dismissable = true,
  className = '',
}: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Reference-counted scroll lock, keyed on `open` alone so a re-render (which
  // changes an inline `onClose` identity) can't unbalance the count.
  useEffect(() => {
    if (!open) return
    if (openCount === 0) {
      overflowBeforeLock = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openCount += 1
    return () => {
      openCount -= 1
      if (openCount === 0) document.body.style.overflow = overflowBeforeLock
    }
  }, [open])

  useEffect(() => {
    if (!open || !dismissable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Only the visually top-most modal reacts. Same z-index throughout, so
      // paint order follows DOM order and the last backdrop in the document is
      // the one on top — that's what lets a confirm dialog nested inside another
      // modal dismiss on its own instead of closing both. Mount order can't be
      // used here: React runs child effects before parent ones, so a nested
      // dialog registers *before* the modal it sits on.
      const backdrops = document.querySelectorAll('[data-modal-backdrop]')
      if (backdrops[backdrops.length - 1] !== backdropRef.current) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, dismissable, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...backdrop}
          ref={backdropRef}
          data-modal-backdrop=""
          className="fixed inset-0 z-modal flex items-center justify-center bg-ink/40 p-4"
          onClick={dismissable ? onClose : undefined}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            {...modalPanel}
            onClick={(e) => e.stopPropagation()}
            className={`flex max-h-full w-full ${MAX_W[size]} flex-col overflow-hidden rounded-xl border-2 border-ink bg-surface shadow-brutal-xl ${className}`}
          >
            {title != null && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-accent px-4 py-2.5">
                <h2 className="font-display text-lg uppercase tracking-tight text-ink">{title}</h2>
                {dismissable && (
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="flex h-7 w-7 items-center justify-center rounded-md border-2 border-ink bg-surface text-sm font-black leading-none brutal-press"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
