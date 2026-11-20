import { SUPPORT_URL } from '@tuan-tanah/shared'
import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Link to the developer's Tako page. Opens in a new tab so it never pulls a
 * player out of a room. Deliberately low-key: shown on the home footer and the
 * game-over screen only — never mid-game.
 */
export function SupportLink({ variant = 'footer' }: { variant?: 'footer' | 'gameOver' }) {
  const { t } = useTranslation()
  if (variant === 'gameOver') {
    return (
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted underline underline-offset-4 hover:text-ink"
      >
        <Heart aria-hidden className="h-3.5 w-3.5" />
        {t('support.gameOver')}
      </a>
    )
  }
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-2xs font-bold uppercase tracking-wide text-ink-muted underline underline-offset-4 hover:text-ink"
    >
      {t('support.footer')}
    </a>
  )
}
