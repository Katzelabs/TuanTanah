import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface TooltipProps {
  /** Bubble content. When empty/nullish the trigger renders with no tooltip. */
  content: ReactNode
  children: ReactNode
  /** Anchor the bubble above (default) or below the trigger. */
  side?: 'top' | 'bottom'
  /** Extra wrapper classes — pass `w-full` when wrapping a block button. */
  className?: string
}

const tip = {
  initial: { opacity: 0, y: 4, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.96 },
  transition: { duration: 0.12 },
}

/** Hold this long before a touch counts as "explain this" rather than "do this". */
const LONG_PRESS_MS = 400

/**
 * Brutalist hover/focus tooltip: a framed ink bubble anchored to the trigger.
 * Shown on pointer hover, keyboard focus, and — on touch — a long press.
 * Wrap a `block` button and pass `className="w-full"` so the trigger keeps its
 * full width inside the wrapper.
 *
 * The long-press path exists because this wraps *buttons that do things*, and
 * most of the game is played on a phone. Without it every tooltip in the app is
 * dead weight on the majority device: a tap fires the action, and there is no
 * hover to ask "what is this?" with. So a press held past `LONG_PRESS_MS` opens
 * the bubble and swallows the click it would otherwise have produced — you can
 * read what a button does without spending your one meta action per lap finding
 * out.
 */
export function Tooltip({ content, children, side = 'top', className = '' }: TooltipProps) {
  const [open, setOpen] = useState(false)
  // Set when a long press fires, read (and cleared) by the click it precedes.
  const swallowClick = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelPress = () => {
    if (timer.current == null) return
    clearTimeout(timer.current)
    timer.current = null
  }

  // A touch-opened bubble has no pointer to leave, so it dismisses on the next
  // press anywhere. Registered only once open, which is after the press that
  // opened it — so it can't immediately close itself.
  useEffect(() => {
    if (!open) return
    const dismiss = () => setOpen(false)
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  useEffect(() => cancelPress, [])

  if (content == null || content === '') return <>{children}</>

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onTouchStart={() => {
        cancelPress()
        timer.current = setTimeout(() => {
          timer.current = null
          swallowClick.current = true
          setOpen(true)
        }, LONG_PRESS_MS)
      }}
      onTouchMove={cancelPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      // Capture phase: the click has to die before it reaches the button.
      onClickCapture={(e) => {
        if (!swallowClick.current) return
        swallowClick.current = false
        e.preventDefault()
        e.stopPropagation()
      }}
      // A long press on a control otherwise raises the platform's own callout.
      onContextMenu={(e) => {
        if (timer.current != null || swallowClick.current) e.preventDefault()
      }}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            {...tip}
            role="tooltip"
            className={`pointer-events-none absolute left-1/2 z-tooltip w-max max-w-[200px] -translate-x-1/2 rounded-md border-2 border-ink bg-ink px-2 py-1 text-center text-2xs font-semibold leading-snug text-surface shadow-brutal-sm ${
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
