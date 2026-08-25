import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { MatchHistoryEntry } from '@tuan-tanah/shared'
import { LanguageSwitcher } from '@/components/LanguageSwitcher.js'
import { Badge, Button, Card } from '@/components/ui/index.js'
import { roleName } from '@/i18n/gameData.js'
import { fetchMatchHistory, type HistoryResult } from './api.js'

/**
 * The signed-in player's finished games, on its own route rather than folded into
 * the account page — history is readable on its own, and it keeps this branch off
 * a page another ticket in the epic is building.
 */
export function MatchHistory() {
  const { t } = useTranslation()
  const [result, setResult] = useState<HistoryResult | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchMatchHistory(controller.signal)
      .then(setResult)
      // An aborted fetch is this effect being torn down, not a failed request —
      // reporting it as an error would flash "couldn't load" on every unmount.
      .catch(() => {
        if (!controller.signal.aborted) setResult({ status: 'error' })
      })
    return () => controller.abort()
  }, [attempt])

  const retry = () => {
    setResult(null)
    setAttempt((n) => n + 1)
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="-rotate-1">
          <h1 className="rounded-xl border-2 border-ink bg-accent px-4 py-1.5 font-display text-2xl uppercase tracking-tight text-ink shadow-brutal xs:text-3xl">
            {t('history.title')}
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
      <p className="mt-4 font-semibold text-ink-muted">{t('history.subtitle')}</p>

      <div className="mt-6">
        <HistoryBody result={result} onRetry={retry} />
      </div>
    </div>
  )
}

function HistoryBody({ result, onRetry }: { result: HistoryResult | null; onRetry: () => void }) {
  const { t } = useTranslation()

  if (!result) return <Notice title={t('history.loading')} />

  if (result.status === 'signedOut') {
    return <Notice title={t('history.signedOut')} hint={t('history.signedOutHint')} />
  }

  if (result.status === 'error') {
    return (
      <Notice title={t('history.error')} tone="danger">
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('history.retry')}
        </Button>
      </Notice>
    )
  }

  if (result.games.length === 0) {
    return <Notice title={t('history.empty')} hint={t('history.emptyHint')} />
  }

  return (
    <ul className="space-y-3">
      {result.games.map((game) => (
        <li key={game.gameId}>
          <MatchRow game={game} />
        </li>
      ))}
    </ul>
  )
}

function Notice({
  title,
  hint,
  tone = 'sunken',
  children,
}: {
  title: string
  hint?: string
  tone?: 'sunken' | 'danger'
  children?: ReactNode
}) {
  return (
    <Card tone={tone} className="space-y-2 p-6 text-center">
      <p className="font-bold text-ink">{title}</p>
      {hint && <p className="text-sm font-semibold text-ink-muted">{hint}</p>}
      {children}
    </Card>
  )
}

function MatchRow({ game }: { game: MatchHistoryEntry }) {
  const { t, i18n } = useTranslation()

  return (
    <Card pad="md" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div>
        <div className="flex items-center gap-2">
          <Outcome game={game} />
          <span className="text-sm font-bold text-ink">
            {game.role ? roleName(t, game.role) : t('history.noRole')}
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-ink-muted">
          {formatDate(game.playedAt, i18n.language)} ·{' '}
          {t('history.players', { count: game.playerCount })}
        </p>
      </div>
      <div className="xs:text-right">
        <p className="text-xs font-bold uppercase text-ink-faint">{t('history.wealth')}</p>
        <p className="font-display text-lg text-ink">{`Rp ${game.finalWealth.toLocaleString('id-ID')}`}</p>
      </div>
    </Card>
  )
}

/**
 * Won / eliminated / lost — three outcomes, not two. Surviving to the end and
 * losing on wealth is a different game from being bankrupted out of it, and the
 * archive already records the difference.
 */
function Outcome({ game }: { game: MatchHistoryEntry }) {
  const { t } = useTranslation()
  if (game.won) return <Badge tone="success">{t('history.won')}</Badge>
  if (game.eliminated) return <Badge tone="danger">{t('history.eliminated')}</Badge>
  return <Badge tone="neutral">{t('history.lost')}</Badge>
}

function formatDate(iso: string, language: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' })
}
