import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Toast } from '@/components/ui/index.js'
import { FriendsPanel } from './FriendsPanel.js'
import { useFriends } from './friendsStore.js'
import { incomingRequests } from './lib/grouping.js'

/**
 * Entry point to the friends panel, styled to sit in the same corner cluster as
 * the sound and language toggles.
 *
 * It owns the store's `init()` so the listeners come up wherever the button is
 * mounted, and carries the unanswered-request count — a request that arrives
 * while the panel is closed still has to be visible.
 */
export function FriendsButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const init = useFriends((s) => s.init)
  const friends = useFriends((s) => s.friends)
  const latestRequest = useFriends((s) => s.latestRequest)
  const dismissLatestRequest = useFriends((s) => s.dismissLatestRequest)

  useEffect(() => {
    init()
  }, [init])

  const pending = incomingRequests(friends).length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('friends.title')}
        title={t('friends.title')}
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink bg-surface text-ink shadow-brutal-sm transition hover:bg-surface-sunken ${className ?? ''}`}
      >
        <Users size={16} aria-hidden />
        {pending > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-ink bg-danger px-1 text-[10px] font-black leading-none text-ink">
            {pending}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t('friends.title')} size="lg">
        <FriendsPanel />
      </Modal>

      <Toast show={latestRequest !== null} tone="info" onDismiss={dismissLatestRequest}>
        {t('friends.requestFrom', { name: latestRequest?.displayName ?? '' })}
      </Toast>
    </>
  )
}
