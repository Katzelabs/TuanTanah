import { Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { APP_VERSION, CHANGELOG } from '@tuan-tanah/shared'
import { Button, Card } from '@/components/ui/index.js'
import { hasUnseenRelease, markSeen } from './lastSeen.js'
import { changeText } from './lib/format.js'

/** Enough to be worth reading in place; past this, the page is the better answer. */
const PREVIEW_LINES = 3

/**
 * The one-shot "the game moved on while you were away" card, shown once per
 * release on the home page.
 *
 * The ticket flags this as high impact and easy to make annoying, so the rules
 * are deliberately strict: never for a first-time player (they have missed
 * nothing), never twice for the same version, and dismissible in one tap. It is
 * a card in the page flow rather than a modal — nobody should have to close
 * something before they can start a game.
 */
export function WhatsNew() {
  const { t, i18n } = useTranslation()
  // Read once, in a lazy initializer: reading it in an effect would render the
  // page without the card and then push it in under the cursor.
  const [show, setShow] = useState(hasUnseenRelease)

  useEffect(() => {
    // A first-ever visitor silently adopts the current version, so the NEXT
    // release is the first thing they are told about rather than this one.
    if (!show) markSeen()
  }, [show])

  const release = CHANGELOG[0]
  if (!show || !release || release.version !== APP_VERSION) return null

  const dismiss = () => {
    markSeen()
    setShow(false)
  }

  const preview = release.changes.slice(0, PREVIEW_LINES)
  const more = release.changes.length - preview.length

  return (
    <Card tone="accent" pad="lg" className="mt-6 w-full" role="status">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-surface text-ink">
          <Sparkles size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg uppercase tracking-tight text-ink">
            {t('changelog.whatsNew.title', { version: release.version })}
          </h2>
          <ul className="mt-2 space-y-1.5">
            {preview.map((change) => (
              <li key={change.en} className="flex items-start gap-2 text-sm font-semibold text-ink">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                {changeText(change, i18n.language)}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link to="/changelog">
              <Button variant="secondary" size="sm">
                {more > 0 ? t('changelog.whatsNew.readMore', { count: more }) : t('changelog.read')}
              </Button>
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('changelog.whatsNew.dismiss')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface text-ink brutal-press"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </Card>
  )
}
