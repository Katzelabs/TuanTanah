import type { CSSProperties, HTMLAttributes } from 'react'

type Tone = 'neutral' | 'accent' | 'info' | 'danger' | 'success'
type Size = 'sm' | 'md'

/** Tone = meaning, per the accent-family rules in `tailwind.config.ts`. */
const TONE: Record<Tone, string> = {
  neutral: 'bg-surface text-ink',
  accent: 'bg-accent text-ink',
  info: 'bg-info text-ink',
  danger: 'bg-danger text-ink',
  success: 'bg-success text-ink',
}

const SIZE: Record<Size, string> = {
  sm: 'px-1.5 py-0.5 text-2xs', // 11px — dense game chrome (owner chips, tier pips)
  md: 'px-2 py-1 text-xs', // 12px — standalone status tags in page/panel copy
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /** `sm` (default) for in-board/in-panel chips, `md` for page-level tags. */
  size?: Size
  /** Override fill with an arbitrary color (e.g. a player's color). */
  color?: string
}

/**
 * Small framed pill — owner chips, tier markers, role/status tags.
 *
 * Border only, no shadow: badges appear in runs, and elevating each one turns a
 * row of them into visual noise. See the elevation table in `tailwind.config.ts`.
 */
export function Badge({
  tone = 'neutral',
  size = 'sm',
  color,
  className = '',
  style,
  ...props
}: BadgeProps) {
  const colorStyle: CSSProperties | undefined = color
    ? { background: color, color: '#fff', ...style }
    : style
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border-2 border-ink font-bold leading-none ${SIZE[size]} ${color ? '' : TONE[tone]} ${className}`}
      style={colorStyle}
      {...props}
    />
  )
}
