import { MAX_PLAYERS, type Player } from '@tuan-tanah/shared'
import { Check, Crown, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/index.js'
import { roleName } from '@/i18n/gameData.js'
import { LobbyPanel } from './LobbyPanel.js'

/**
 * Who's in the room and who's actually ready. "Ready" in this lobby means one
 * thing — you've claimed a role — so each row ends in either the role you took
 * or a visible "still choosing", instead of the old bare em-dash.
 */
export function PlayerList({
  players,
  meId,
  className = '',
}: {
  players: Player[]
  meId: string | undefined
  className?: string
}) {
  const { t } = useTranslation()
  const ready = players.filter((p) => p.role !== null).length
  const seatsLeft = MAX_PLAYERS - players.length

  return (
    <LobbyPanel
      title={t('lobby.playersTitle')}
      aside={
        <Badge tone={ready === players.length ? 'success' : 'neutral'}>
          {t('lobby.readyCount', { ready, total: players.length })}
        </Badge>
      }
      className={className}
    >
      <ul className="space-y-1.5">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-lg border-2 border-ink bg-surface px-2.5 py-1.5 shadow-brutal-sm"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border-2 border-ink"
              style={{ background: p.color }}
            />
            <span className="min-w-0 truncate text-sm font-bold text-ink">{p.name}</span>
            {p.id === meId && (
              <span className="shrink-0 text-2xs font-bold uppercase text-ink-faint">
                {t('lobby.you')}
              </span>
            )}
            {p.isRoomMaster && (
              <Badge tone="accent" className="shrink-0" title={t('common.host')}>
                <Crown className="h-3 w-3" aria-hidden />
                <span className="sr-only">{t('common.host')}</span>
              </Badge>
            )}
            {!p.isConnected && (
              <Badge tone="danger" className="shrink-0">
                <WifiOff className="h-3 w-3" aria-hidden />
                {t('common.offline')}
              </Badge>
            )}

            <span className="ml-auto flex shrink-0 items-center gap-1 pl-1">
              {p.role ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success-strong" aria-hidden />
                  <span className="text-2xs font-bold text-ink">{roleName(t, p.role)}</span>
                </>
              ) : (
                <span className="text-2xs font-medium italic text-ink-faint">
                  {t('lobby.choosing')}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {seatsLeft > 0 && (
        <p className="text-2xs font-medium text-ink-faint">
          {t('lobby.seatsLeft', { count: seatsLeft })}
        </p>
      )}
    </LobbyPanel>
  )
}
