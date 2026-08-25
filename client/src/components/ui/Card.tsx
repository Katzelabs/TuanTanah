import type { HTMLAttributes } from 'react'

type Tone = 'surface' | 'sunken' | 'accent' | 'info' | 'danger' | 'success'
type Pad = 'none' | 'sm' | 'md' | 'lg'

/**
 * Tone = meaning, per the accent-family rules in `tailwind.config.ts`. The
 * colored tones use the `soft` step: a card is a surface behind copy, so it
 * must stay readable under ink text.
 */
const TONE: Record<Tone, string> = {
  surface: 'bg-surface',
  sunken: 'bg-surface-sunken',
  accent: 'bg-accent-soft',
  info: 'bg-info-soft',
  danger: 'bg-danger-soft',
  success: 'bg-success-soft',
}

/**
 * `none` is the default so the 50+ existing call sites that pass their own
 * padding keep working. New code should pick a step instead:
 *   sm  dense in-game panels     md  the standard panel/modal body
 *   lg  page-level feature cards
 */
const PAD: Record<Pad, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone
  /** Smaller shadow for nested/secondary surfaces (`brutal-sm` instead of `brutal`). */
  flat?: boolean
  /** Inner padding step. Omit only when the caller supplies its own via `className`. */
  pad?: Pad
}

/**
 * A framed surface — the brutalist replacement for the old `rounded-xl
 * bg-slate-800/60` panels.
 *
 * Elevation follows the table in `tailwind.config.ts`: `brutal` (4px) standing
 * alone on the page, `flat` → `brutal-sm` (2px) when nested inside another
 * framed surface, so frames don't stack up into a pile of shadows.
 */
export function Card({
  tone = 'surface',
  flat,
  pad = 'none',
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl ${flat ? 'brutal-sm' : 'brutal'} ${TONE[tone]} ${PAD[pad]} ${className}`}
      {...props}
    />
  )
}
