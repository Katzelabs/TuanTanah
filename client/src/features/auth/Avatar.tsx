import type { User } from '@tuan-tanah/shared'
import { initialsOf } from './lib/initials.js'

type Size = 'sm' | 'md' | 'lg'

const SIZE: Record<Size, string> = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-lg',
}

// Bright flat fills, ink border — the same vocabulary as the rest of the design
// system, so an avatar reads as part of it rather than a pasted-in photo.
const TONE = ['bg-accent', 'bg-info', 'bg-success', 'bg-danger', 'bg-accent-soft'] as const

/** Stable per-account colour, so the same player is the same colour every visit. */
function toneFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return TONE[hash % TONE.length]
}

/**
 * An account's avatar, rendered as initials.
 *
 * We never hotlink Google's `lh3.googleusercontent.com` picture — our CSP blocks
 * it, the snippet that would have to allow it is shared with every other app on
 * the box, and loading it would leak players' page views to Google. `avatarUrl`
 * on the account stays reserved for a self-hosted upload.
 */
export function Avatar({
  user,
  size = 'md',
  className = '',
}: {
  user: Pick<User, 'id' | 'displayName'>
  size?: Size
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-lg border-2 border-ink font-display uppercase leading-none text-ink ${SIZE[size]} ${toneFor(user.id)} ${className}`}
    >
      {initialsOf(user.displayName)}
    </span>
  )
}
