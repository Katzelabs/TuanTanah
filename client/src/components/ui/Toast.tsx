import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { toastSlide } from '@/lib/motion.js'

type Tone = 'error' | 'warning' | 'info' | 'success'

/**
 * Tone = meaning, per the accent-family rules in `tailwind.config.ts`.
 * `error` → danger (the action failed), `warning` → accent (it went through but
 * needs attention), `info` → info (a neutral fact), `success` → success.
 */
const TONE: Record<Tone, string> = {
  error: 'bg-danger text-ink',
  warning: 'bg-accent text-ink',
  info: 'bg-info text-ink',
  success: 'bg-success text-ink',
}

export interface ToastProps {
  show: boolean
  children: ReactNode
  tone?: Tone
  onDismiss?: () => void
}

/**
 * Bottom-centered framed toast with consistent slide-up motion. Sits at
 * `z-toast` — above the board and panels (and the phone-portrait HUD drawer),
 * below modals.
 */
export function Toast({ show, children, tone = 'error', onDismiss }: ToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          {...toastSlide}
          className={`fixed bottom-6 left-1/2 z-toast max-w-[90vw] -translate-x-1/2 cursor-pointer rounded-lg border-2 border-ink px-4 py-2.5 text-sm font-bold shadow-brutal ${TONE[tone]}`}
          onClick={onDismiss}
          role="alert"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
