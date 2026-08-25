import { motion, useDragControls, type PanInfo } from 'framer-motion'
import { ChevronUp } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SPRING_SOFT } from '@/lib/motion.js'

/**
 * How much of the drawer stays on screen when it's closed. Enough for the grab
 * handle plus one line of status, so a collapsed drawer still answers "whose
 * turn is it?" without being opened.
 */
const PEEK_PX = 68

/**
 * Panel height as a fraction of the viewport. Kept in sync by hand with the
 * `h-[82dvh]` class below — it exists so the closed offset can be derived on the
 * very first render, before the panel has been laid out.
 */
const HEIGHT_DVH = 0.82

/** Past this drag distance (or flick speed) the drawer commits to the other state. */
const COMMIT_PX = 72
const COMMIT_VELOCITY = 450

/** A pointer move smaller than this is a tap, not a drag — so the click still toggles. */
const TAP_SLOP_PX = 4

export interface HudDrawerProps {
  /** One-line status shown on the closed handle (whose turn, debt, game over). */
  title: ReactNode
  children: ReactNode
  /**
   * Flips true at a "you must act now" moment (your turn starts, you owe a
   * debt). On the false→true edge the drawer opens itself once — it never
   * closes itself from this, so the player stays in control after the nudge.
   */
  demandsAttention?: boolean
  /**
   * While true the drawer stays closed because the board underneath has to be
   * tappable — meta-action tile targeting is the case that matters.
   */
  yieldToBoard?: boolean
}

/**
 * The phone-portrait HUD: below the `hud` breakpoint the board takes the full
 * width at the top of the screen and everything else — player panel, action
 * bar, event log — moves into this swipe-up drawer.
 *
 * It sits on the reserved `z-drawer` layer: above the board and panels, below
 * toasts and modals, so a property modal or an error toast still covers it.
 *
 * Interaction is drag-first but never drag-only: the handle is a real
 * `aria-expanded` disclosure button, so tapping it (or reaching it by keyboard)
 * works identically to flicking it. Drag is started explicitly from the handle
 * via `dragControls` rather than from the whole panel, so the body keeps its
 * own scrolling instead of fighting the gesture.
 *
 * The board's container-query geometry is untouched by all of this — the board
 * is simply given the full width above the drawer and sizes itself as it always
 * has.
 */
export function HudDrawer({ title, children, demandsAttention, yieldToBoard }: HudDrawerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  // Set while a pointer gesture actually moved, so the click that follows a
  // drag doesn't also toggle the drawer back.
  const dragged = useRef(false)

  // The closed offset is "panel height minus the peek". It has to be right on
  // the FIRST render, not just after a layout effect: framer-motion treats the
  // mount value of `animate` as the initial state, so seeding it at 0 and
  // correcting afterwards would play a full slide-down every time the game
  // screen loaded. The panel's height is `HEIGHT_DVH` of the viewport, so it is
  // derivable before the DOM exists — the effect below only refines it (and
  // keeps it right through URL-bar changes and rotation).
  const [closedY, setClosedY] = useState(() =>
    typeof window === 'undefined' ? 0 : Math.max(0, window.innerHeight * HEIGHT_DVH - PEEK_PX),
  )
  useLayoutEffect(() => {
    const measure = () => {
      const el = panelRef.current
      if (el) setClosedY(Math.max(0, el.offsetHeight - PEEK_PX))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  // Open once on the rising edge of "you must act", not on every render where
  // it happens to be true — otherwise the drawer would spring back open every
  // time the player closed it mid-turn.
  const wasDemanding = useRef(Boolean(demandsAttention))
  useEffect(() => {
    if (demandsAttention && !wasDemanding.current) setOpen(true)
    wasDemanding.current = Boolean(demandsAttention)
  }, [demandsAttention])

  // Yielding is derived, not stored: while the board needs to be tappable the
  // drawer is held shut, and when that passes it springs back to whatever the
  // player had it set to rather than making them re-open it.
  const shown = open && !yieldToBoard

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const flick = info.velocity.y
    const moved = info.offset.y
    if (shown) setOpen(!(moved > COMMIT_PX || flick > COMMIT_VELOCITY))
    else setOpen(moved < -COMMIT_PX || flick < -COMMIT_VELOCITY)
  }

  return (
    <motion.div
      ref={panelRef}
      // No offset shadow here: the brutal ladder only casts down-right, which a
      // bottom-anchored sheet can't show. The thick top border is the frame.
      className="fixed inset-x-0 bottom-0 z-drawer flex h-[82dvh] flex-col rounded-t-xl border-t-2 border-ink bg-surface"
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: closedY }}
      dragElastic={0.04}
      dragMomentum={false}
      animate={{ y: shown ? 0 : closedY }}
      transition={SPRING_SOFT}
      onDragStart={() => {
        dragged.current = false
      }}
      onDrag={(_, info) => {
        if (Math.abs(info.offset.y) > TAP_SLOP_PX) dragged.current = true
      }}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        aria-expanded={shown}
        aria-label={shown ? t('hud.hidePanel') : t('hud.showPanel')}
        onPointerDown={(e) => dragControls.start(e)}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false
            return
          }
          setOpen((o) => !o)
        }}
        className="shrink-0 cursor-grab touch-none select-none px-3 pb-2 pt-2 active:cursor-grabbing"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-ink/25" />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold text-ink">{title}</span>
          <ChevronUp
            size={18}
            strokeWidth={3}
            className={`shrink-0 text-ink-muted transition-transform duration-200 ease-snap ${
              shown ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-4">
        {children}
      </div>
    </motion.div>
  )
}

/** The height the board area must leave clear so the closed drawer never covers it. */
export const HUD_PEEK_PX = PEEK_PX
