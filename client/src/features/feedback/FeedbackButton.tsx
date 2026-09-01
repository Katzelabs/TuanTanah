import { MessageSquareWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFeedback } from './feedbackStore.js'

export interface FeedbackButtonProps {
  className?: string
}

/**
 * Opens the report form from wherever it is placed — the home and lobby control
 * clusters, and the in-game header.
 *
 * Renders nothing when the server has no sink configured, the same contract
 * `AuthMenu` uses for accounts: a deployment with the feature switched off shows
 * no entry point at all rather than a button that can only fail.
 *
 * Styled to match `SoundToggle` because it sits next to it in the same cluster
 * and is the same kind of thing — a persistent, secondary affordance that must
 * survive a 360px row.
 */
export function FeedbackButton({ className = '' }: FeedbackButtonProps) {
  const { t } = useTranslation()
  const enabled = useFeedback((s) => s.enabled)
  const openForm = useFeedback((s) => s.openForm)

  if (!enabled) return null

  return (
    <button
      type="button"
      onClick={openForm}
      aria-label={t('feedback.open')}
      title={t('feedback.open')}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-surface text-ink shadow-brutal-sm transition hover:bg-surface-sunken ${className}`}
    >
      <MessageSquareWarning size={16} aria-hidden />
    </button>
  )
}
