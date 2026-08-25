import { MAX_PLAYERS, type FriendSummary } from '@tuan-tanah/shared'
import { UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, Modal } from '@/components/ui/index.js'
import { useGame } from '@/store/gameStore.js'
import { useAuthUser } from './authBridge.js'
import { invitableFriends } from './friends.js'
import { useInvites } from './store.js'

/**
 * Lobby entry point for ClickUp subtask G: pull a friend straight into this
 * room. Hidden for guests — there's no friend list without an account, and the
 * share link (subtask C) is the guest path.
 */
export function InviteFriendButton() {
  const { t } = useTranslation()
  const user = useAuthUser()
  const [open, setOpen] = useState(false)

  if (!user) return null

  return (
    <>
      <Button variant="secondary" size="xs" onClick={() => setOpen(true)}>
        <UserPlus size={14} />
        {t('invite.friends.button')}
      </Button>
      <InviteFriendModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function InviteFriendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const friends = useInvites((s) => s.friends)
  const loading = useInvites((s) => s.friendsLoading)
  const unavailable = useInvites((s) => s.friendsUnavailable)
  const loadFriends = useInvites((s) => s.loadFriends)
  const playerCount = useGame((s) => s.state?.players.length ?? 0)

  useEffect(() => {
    if (open) loadFriends()
  }, [open, loadFriends])

  const list = invitableFriends(friends)
  const roomFull = playerCount >= MAX_PLAYERS

  return (
    <Modal open={open} onClose={onClose} title={t('invite.friends.title')} size="md">
      {roomFull && (
        <Card tone="danger" flat className="mb-3 px-3 py-2 text-sm font-semibold text-ink">
          {t('invite.friends.roomFull')}
        </Card>
      )}

      {loading && (
        <p className="py-6 text-center text-sm text-ink-muted">{t('invite.friends.loading')}</p>
      )}

      {!loading && unavailable && (
        <p className="py-6 text-center text-sm text-ink-muted">{t('invite.friends.unavailable')}</p>
      )}

      {!loading && !unavailable && list.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-muted">{t('invite.friends.empty')}</p>
      )}

      {!loading && !unavailable && list.length > 0 && (
        <ul className="space-y-2">
          {list.map((friend) => (
            <FriendRow key={friend.user.id} friend={friend} disabled={roomFull} />
          ))}
        </ul>
      )}

      <p className="mt-4 text-center text-xs text-ink-faint">{t('invite.friends.offlineHint')}</p>
    </Modal>
  )
}

function FriendRow({ friend, disabled }: { friend: FriendSummary; disabled: boolean }) {
  const { t } = useTranslation()
  const invite = useInvites((s) => s.invite)
  const sending = useInvites((s) => s.sending)
  const invited = useInvites((s) => s.invited)
  const roomId = useGame((s) => s.roomId)

  const alreadyHere = friend.currentRoomId !== null && friend.currentRoomId === roomId
  const sent = invited.includes(friend.user.id)
  const busy = sending === friend.user.id

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border-2 border-ink bg-surface px-3 py-2 shadow-brutal-sm">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink ${
          friend.online ? 'bg-success' : 'bg-surface-sunken'
        }`}
      />
      <span className="min-w-0 flex-1 basis-32 truncate text-sm font-bold text-ink">
        {friend.user.displayName}
      </span>
      {alreadyHere ? (
        <Badge tone="success" className="ml-auto">
          {t('invite.friends.alreadyHere')}
        </Badge>
      ) : (
        <Button
          variant={sent ? 'ghost' : 'primary'}
          size="xs"
          className="ml-auto shrink-0"
          disabled={disabled || busy || sent || !friend.online}
          onClick={() => invite(friend.user.id)}
        >
          {busy
            ? t('invite.friends.sending')
            : sent
              ? t('invite.friends.sent')
              : friend.online
                ? t('invite.friends.invite')
                : t('invite.friends.offline')}
        </Button>
      )}
    </li>
  )
}
