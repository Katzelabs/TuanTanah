import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'info' | 'ghost'
type Size = 'xs' | 'sm' | 'md' | 'lg'

/**
 * Variant = meaning, per the accent-family rules in `tailwind.config.ts`.
 * `primary` is the one action the player is meant to take next — at most one
 * per view. Hover flips to the `strong` step (white text where it needs it).
 */
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:bg-accent-strong',
  secondary: 'bg-surface text-ink hover:bg-surface-sunken',
  danger: 'bg-danger text-ink hover:bg-danger-strong hover:text-white',
  success: 'bg-success text-ink hover:bg-success-strong hover:text-white',
  info: 'bg-info text-ink hover:bg-info-strong hover:text-white',
  ghost: 'border-transparent bg-transparent text-ink shadow-none hover:bg-surface-sunken',
}

/**
 * Padding and type step move together — each size is a complete control, so a
 * call site never has to bolt a `text-*` onto a button to make it fit.
 *   xs  toast / inline row actions      sm  in-game panels and sidebars
 *   md  modals and page-level forms     lg  the single hero action on a page
 */
const SIZE: Record<Size, string> = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-5 py-3 text-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Stretch to fill the container width. */
  block?: boolean
}

/**
 * Brutalist button: thick ink border, hard offset shadow, tactile press.
 * `ghost` opts out of the frame for low-emphasis actions.
 *
 * Elevation is `brutal` at rest and `brutal-lg` on hover via `.brutal-press`;
 * disabled drops to `brutal-sm` and freezes the press.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className = '', ...props },
  ref,
) {
  const framed = variant !== 'ghost' ? 'brutal brutal-press' : 'brutal-press'
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-bold ${framed} ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:active:translate-x-0 disabled:active:translate-y-0 ${className}`}
      {...props}
    />
  )
})
