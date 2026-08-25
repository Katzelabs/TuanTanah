import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ControlCluster } from '@/components/ControlCluster.js'
import { LanguageSwitcher } from '@/components/LanguageSwitcher.js'
import { LeaveButton } from '@/components/RoomActions.js'
import { SoundToggle } from '@/components/SoundToggle.js'
import { Button, Card } from '@/components/ui/index.js'
import { AuthMenu } from '@/features/auth/index.js'
import { InviteFriendButton } from '@/features/invites/index.js'

/**
 * Title, room code, and the actions that act on the room.
 *
 * The old header stacked all six controls in one right-hand column, which on a
 * phone squeezed the title into a third of the width. It's now three rows that
 * hold at every size: identity + the shared `ControlCluster`, the subtitle, then
 * the room code paired with the things you do with it (invite, leave).
 *
 * Invite and leave deliberately stay out of the cluster's overflow menu: they're
 * room actions that belong beside the code, not app settings.
 */
export function LobbyHeader({ roomId, onInvite }: { roomId: string; onInvite: () => void }) {
  const { t } = useTranslation()

  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="-rotate-1">
          <h1 className="inline-block rounded-xl border-2 border-ink bg-accent px-3 py-1 font-display text-2xl uppercase tracking-tight text-ink shadow-brutal xs:px-4 xs:text-3xl">
            {t('lobby.title')}
          </h1>
        </div>
        {/* AuthMenu opens its own anchored dropdown, so it stays in `children`. */}
        <ControlCluster
          className="shrink-0"
          overflow={
            <>
              <SoundToggle />
              <LanguageSwitcher />
            </>
          }
        >
          <AuthMenu />
        </ControlCluster>
      </div>

      {/* The role panel carries its own instruction, so on a phone this line is
          repetition taking up a chunk of the first screen. */}
      <p className="hidden text-sm font-semibold text-ink-muted sm:block">{t('lobby.subtitle')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Card tone="sunken" flat className="flex items-center gap-2.5 px-3 py-1.5">
          <span className="text-3xs font-bold uppercase tracking-wide text-ink-faint">
            {t('lobby.roomCode')}
          </span>
          {/* `select-all` keeps the read-it-out-loud fallback one tap away. */}
          <span className="select-all font-mono text-xl font-bold tracking-[0.25em] text-ink xs:text-2xl">
            {roomId}
          </span>
        </Card>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <InviteFriendButton />
          <Button variant="secondary" size="xs" onClick={onInvite}>
            {t('invite.button')}
          </Button>
          {/* Icon-only below `md` — three labelled buttons don't fit a phone row. */}
          <LeaveButton icon={<LogOut size={14} />} label={t('lobby.leaveRoom')} />
        </div>
      </div>
    </header>
  )
}
