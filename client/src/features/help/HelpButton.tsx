import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHelp } from './helpStore.js'

export interface HelpButtonProps {
  className?: string
}

/**
 * The `?` that opens the rules. Sits in the home and lobby control clusters and
 * in the in-game header, styled to match `SoundToggle`/`FeedbackButton` because
 * it is the same kind of thing — a persistent secondary affordance that has to
 * survive a 360px row.
 *
 * Unlike `FeedbackButton` this has no enabled flag: the rules are static client
 * content, so there is no deployment in which they aren't available.
 *
 * A book, not a `?`: the board already spends a purple `?` on event tiles, and
 * the legend on the page this opens shows that exact glyph. Two question marks
 * meaning different things is the confusion this feature exists to remove.
 */
export function HelpButton({ className = '' }: HelpButtonProps) {
  const { t } = useTranslation()
  const openHelp = useHelp((s) => s.openHelp)

  return (
    <button
      type="button"
      onClick={openHelp}
      aria-label={t('help.open')}
      title={t('help.open')}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-surface text-ink shadow-brutal-sm transition hover:bg-surface-sunken ${className}`}
    >
      <BookOpen size={16} aria-hidden />
    </button>
  )
}
