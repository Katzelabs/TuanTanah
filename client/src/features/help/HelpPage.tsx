import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/LanguageSwitcher.js'
import { Button, Card } from '@/components/ui/index.js'
import { HelpContent } from './HelpContent.js'

/**
 * The rules on their own route, sharing `HelpContent` with the modal.
 *
 * The modal already satisfies "reachable from anywhere"; this exists so the
 * rules have a URL — the link you paste to the friend you just invited, before
 * they have a room to open a modal in. Page shell matches `MatchHistory`.
 */
export function HelpPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="-rotate-1">
          <h1 className="rounded-xl border-2 border-ink bg-accent px-4 py-1.5 font-display text-2xl uppercase tracking-tight text-ink shadow-brutal xs:text-3xl">
            {t('help.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to="/">
            <Button variant="secondary" size="sm">
              {t('common.backHome')}
            </Button>
          </Link>
        </div>
      </div>

      <Card pad="lg" className="mt-6">
        <HelpContent />
      </Card>
    </div>
  )
}
