import { useTranslation } from 'react-i18next'
import { VERSION_LABEL } from '@/lib/version.js'

export interface AppVersionProps {
  className?: string
}

/**
 * The build this browser is running, as a plain monospace label.
 *
 * Deliberately display-only and deliberately quiet. It exists so "which version
 * are you on?" is answered before a bug report is written rather than after —
 * which means it has to be *findable* (a fixed place on the settings surfaces,
 * not a hover) without competing with anything a player actually came to do.
 *
 * Monospace because the value gets read aloud, screenshotted, and typed back:
 * a proportional `1a2b3c4` is meaningfully harder to transcribe correctly.
 */
export function AppVersion({ className = '' }: AppVersionProps) {
  const { t } = useTranslation()

  return (
    <span
      // A `title` rather than a visible caption: the string is self-evidently a
      // version, and the label is only needed by someone hunting for it.
      title={t('version.label')}
      className={`font-mono text-2xs font-bold tabular-nums text-ink-faint ${className}`}
    >
      {VERSION_LABEL}
    </span>
  )
}
