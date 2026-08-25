import { useTranslation } from 'react-i18next'
import type { FriendSummary } from '@tuan-tanah/shared'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/index.js'

/**
 * One person in the friends panel. The same row serves all four sections —
 * requests, friends, blocks — with the section supplying its own buttons, so
 * identity is presented identically everywhere and only the verbs change.
 */
export function FriendRow({ entry, children }: { entry: FriendSummary; children?: ReactNode }) {
  const { t } = useTranslation()
  const { user, online, currentRoomId, status } = entry
  const showPresence = status === 'accepted'

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-ink bg-surface px-3 py-2 shadow-brutal-sm">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-accent-soft font-display text-base uppercase text-ink"
      >
        {user.displayName.slice(0, 1)}
      </span>

      <span className="min-w-0 flex-1 basis-40">
        <span className="flex items-center gap-1.5">
          {showPresence && (
            <span
              // Presence is a dot, not a word: it has to read at a glance in a
              // list, and the accessible name carries the meaning for everyone
              // who isn't reading the colour.
              role="img"
              aria-label={online ? t('friends.online') : t('friends.offline')}
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink ${
                online ? 'bg-success' : 'bg-surface-sunken'
              }`}
            />
          )}
          <span className="truncate font-bold text-ink">{user.displayName}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-2xs uppercase tracking-wider text-ink-faint">
            {user.friendCode}
          </span>
          {showPresence && online && currentRoomId && (
            <Badge tone="info">{t('friends.inRoom', { roomId: currentRoomId })}</Badge>
          )}
        </span>
      </span>

      {children && <span className="ml-auto flex shrink-0 items-center gap-1.5">{children}</span>}
    </li>
  )
}
