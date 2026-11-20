import { SUPPORT_URL } from '@tuan-tanah/shared'
import { motion, useReducedMotion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * A heart that gives a soft double-beat every few seconds — enough movement to
 * catch the eye, rare enough not to nag. Static under reduced motion.
 */
function BeatingHeart({ className }: { className: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      aria-hidden
      className="inline-flex"
      animate={reduce ? undefined : { scale: [1, 1.25, 1, 1.18, 1] }}
      transition={
        reduce ? undefined : { duration: 0.9, repeat: Infinity, repeatDelay: 3.5, ease: 'easeOut' }
      }
    >
      <Heart className={`fill-danger-strong text-danger-strong ${className}`} />
    </motion.span>
  )
}

const external = { href: SUPPORT_URL, target: '_blank', rel: 'noopener noreferrer' } as const

/**
 * Link to the developer's Tako page. Opens in a new tab so it never pulls a
 * player out of a room. Shown on the home footer and the game-over screen only
 * — never mid-game. Pink (`danger-soft`) reads as "love" here and keeps the
 * yellow accent free for each view's real primary action.
 */
export function SupportLink({ variant = 'footer' }: { variant?: 'footer' | 'gameOver' }) {
  const { t } = useTranslation()

  if (variant === 'gameOver') {
    return (
      <div className="brutal-sm flex items-center gap-3 rounded-lg bg-danger-soft p-3 text-left">
        <BeatingHeart className="h-7 w-7" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-ink">{t('support.gameOver.title')}</div>
          <div className="text-xs text-ink-muted">{t('support.gameOver.body')}</div>
        </div>
        <a
          {...external}
          className="brutal-sm brutal-press shrink-0 rounded-lg bg-danger px-3 py-1.5 text-sm font-bold text-ink hover:bg-danger-strong hover:text-white"
        >
          {t('support.cta')}
        </a>
      </div>
    )
  }

  return (
    <a
      {...external}
      className="brutal-sm brutal-press inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-xs font-bold text-ink hover:bg-danger"
    >
      <BeatingHeart className="h-3.5 w-3.5" />
      {t('support.footer')}
    </a>
  )
}
