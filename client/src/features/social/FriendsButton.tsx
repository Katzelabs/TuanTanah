import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Toast } from '@/components/ui/index.js'
import { useAuth } from '@/features/auth/index.js'
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
 *
 * Renders **nothing** while the session is loading or when the server has
 * accounts switched off, the same rule `AuthMenu` follows: a guest-only build
 * must show no trace of the accounts feature set, and a friends icon that opens
 * a panel for something the build cannot do is worse than no icon. The store's
 * `init()` is gated on the same flag, so a disabled build never brings up the
 * friends socket listeners at all.
 *
 * Note this reads `enabled`, NOT `user` — the guest case is different. On a
 * build that *has* accounts, a signed-out player still gets the button, and the
 * panel tells them to sign in. That's also why `friendsStore` itself still
 * refuses to import the auth store (see its header): whether friends *work* is
 * the server's answer, and this is only about whether the control exists.
 */
export function FriendsButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const accountsEnabled = useAuth((s) => s.enabled)
  const authLoading = useAuth((s) => s.loading)
  const init = useFriends((s) => s.init)
  const friends = useFriends((s) => s.friends)
  const latestRequest = useFriends((s) => s.latestRequest)
  const dismissLatestRequest = useFriends((s) => s.dismissLatestRequest)

  useEffect(() => {
    if (!accountsEnabled) return
    init()
  }, [accountsEnabled, init])

  const pending = incomingRequests(friends).length

  if (authLoading || !accountsEnabled) return null

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
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-ink bg-danger px-1 text-3xs font-black leading-none text-ink">
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
