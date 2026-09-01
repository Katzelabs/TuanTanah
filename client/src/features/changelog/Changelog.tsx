import { Sparkles, Wrench, Bug, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CHANGELOG, type ChangeKind, type ChangelogRelease } from '@tuan-tanah/shared'
import { Badge, Card } from '@/components/ui/index.js'
import { markSeen } from './lastSeen.js'
import { changeText, formatReleaseDate } from './lib/format.js'

/** Meaning, not decoration — each kind keeps one tone and one icon everywhere. */
const KIND_TONE: Record<ChangeKind, 'success' | 'info' | 'accent'> = {
  new: 'success',
  improved: 'info',
  fixed: 'accent',
}

const KIND_ICON: Record<ChangeKind, LucideIcon> = {
  new: Sparkles,
  improved: Wrench,
  fixed: Bug,
}

/** Fixed order, so the same section is always in the same place down the page. */
const KIND_ORDER: readonly ChangeKind[] = ['new', 'improved', 'fixed']

/**
 * `/changelog` — what changed, newest first.
 *
 * The outbound half of the pair with the feedback form: report a problem, then
 * see it get fixed. A player who reports a bug and never learns whether it was
 * fixed stops reporting, which is the failure this page exists to prevent.
 */
export function Changelog() {
  const { t } = useTranslation()

  // Reading the page counts as catching up, so the home card doesn't go on
  // announcing a release they just read in full.
  useEffect(() => {
    markSeen()
  }, [])

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="-rotate-1 rounded-xl border-2 border-ink bg-accent px-4 py-1.5 font-display text-2xl uppercase tracking-tight text-ink shadow-brutal">
          {t('changelog.title')}
        </h1>
        <Link
          to="/"
          className="text-xs font-bold text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          {t('common.backHome')}
        </Link>
      </header>

      <p className="mb-5 text-sm font-semibold text-ink-muted">{t('changelog.intro')}</p>

      <div className="space-y-4">
        {CHANGELOG.map((release, index) => (
          <ReleaseCard key={release.version} release={release} current={index === 0} />
        ))}
      </div>
    </div>
  )
}

function ReleaseCard({ release, current }: { release: ChangelogRelease; current: boolean }) {
  const { t, i18n } = useTranslation()

  return (
    <Card pad="lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-xl uppercase tracking-tight text-ink">
          v{release.version}
        </span>
        {/* Answers "am I on this one?" without making the reader compare two
            version strings by eye. */}
        {current && <Badge tone="success">{t('changelog.current')}</Badge>}
        <span className="ml-auto text-xs font-bold text-ink-faint">
          {formatReleaseDate(release.date, i18n.language)}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {KIND_ORDER.map((kind) => {
          const changes = release.changes.filter((c) => c.kind === kind)
          if (changes.length === 0) return null
          const Icon = KIND_ICON[kind]
          return (
            <div key={kind}>
              <h3 className="flex items-center gap-1.5">
                <Badge tone={KIND_TONE[kind]} size="md">
                  <Icon size={12} aria-hidden />
                  {t(`changelog.kind.${kind}`)}
                </Badge>
              </h3>
              <ul className="mt-2 space-y-1.5">
                {changes.map((change) => (
                  <li
                    key={change.en}
                    className="flex items-start gap-2 text-sm font-semibold text-ink"
                  >
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                    {changeText(change, i18n.language)}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
