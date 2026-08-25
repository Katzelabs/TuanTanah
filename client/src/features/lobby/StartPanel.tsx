import type { Player, RoomSettings } from '@tuan-tanah/shared'
import { AlertTriangle, Hourglass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button, Card } from '@/components/ui/index.js'
import { canStartGame, startBlockers, type StartBlocker } from './lobbyStatus.js'

/**
 * The start affordance — and, when it can't fire, the reason. A disabled button
 * with no explanation is the lobby's worst moment: the host can't tell whether
 * they're waiting on a player, on a role, or on their own role settings.
 *
 * The button's enabled state still mirrors the engine (`canStartGame`); the
 * blocker copy is display text, not a second rulebook.
 */
export function StartPanel({
  players,
  settings,
  me,
  onStart,
  className = '',
}: {
  players: Player[]
  settings: Pick<RoomSettings, 'enabledRoles'>
  me: Player | null
  onStart: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const isMaster = !!me?.isRoomMaster
  const ready = canStartGame(players)
  const blockers = startBlockers(players, settings)
  const host = players.find((p) => p.isRoomMaster)

  return (
    <div className={`space-y-2 ${className}`}>
      {/* The one thing a role-less player can do about the wait — so it gets
          the accent, and the host's Start button is the accent for the host. */}
      {me && me.role === null && (
        <Card tone="accent" pad="sm" className="text-sm font-bold text-ink">
          {t('lobby.pickYourRole')}
        </Card>
      )}

      {isMaster ? (
        <Button block size="lg" disabled={!ready} onClick={onStart}>
          {t('lobby.startGame')}
        </Button>
      ) : (
        <Card
          tone="info"
          flat
          pad="sm"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Hourglass className="h-4 w-4 shrink-0" aria-hidden />
          {host ? t('lobby.waitingForHostName', { name: host.name }) : t('lobby.waitingForHost')}
        </Card>
      )}

      {blockers.length > 0 && (
        <Card tone="info" flat pad="sm" className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-muted">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('lobby.cantStart')}
          </div>
          <ul className="space-y-1">
            {blockers.map((b) => (
              <li key={b.kind} className="text-2xs font-medium leading-snug text-ink">
                {blockerText(t, b)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function blockerText(t: TFunction, blocker: StartBlocker): string {
  switch (blocker.kind) {
    case 'needPlayers':
      return t('lobby.blockers.needPlayers', { count: blocker.missing })
    case 'needRoles':
      return t('lobby.blockers.needRoles', {
        count: blocker.names.length,
        names: blocker.names.join(', '),
      })
    case 'notEnoughRoles':
      return t('lobby.blockers.notEnoughRoles', {
        enabled: blocker.enabled,
        players: blocker.players,
      })
  }
}
