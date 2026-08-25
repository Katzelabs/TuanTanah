import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FriendSummary } from '@tuan-tanah/shared'
import { Button } from '@/components/ui/index.js'
import { FriendRow } from './FriendRow.js'
import { useFriends } from './friendsStore.js'
import {
  acceptedFriends,
  blockedUsers,
  incomingRequests,
  outgoingRequests,
} from './lib/grouping.js'

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint">
        {title} ({count})
      </h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

/**
 * Add-by-code, not search-by-name.
 *
 * A name lookup would let anyone walk the player list, and display names are
 * visible to everyone in a room — so the pair would turn "I saw your name in a
 * game" into "I can find your account". A code the owner chooses to hand out
 * keeps that under their control, and needs no search index to exist at all.
 */
function AddByCode() {
  const { t } = useTranslation()
  const sendRequest = useFriends((s) => s.sendRequest)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!code.trim() || sending) return
    setSending(true)
    setSent(false)
    const ok = await sendRequest(code.trim())
    setSending(false)
    if (ok) {
      setCode('')
      setSent(true)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm font-bold text-ink">{t('friends.addByCode')}</span>
        <span className="mt-1 flex flex-col gap-2 xs:flex-row">
          <input
            className="w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 font-mono font-bold uppercase tracking-widest outline-none transition focus:shadow-brutal-sm"
            value={code}
            maxLength={16}
            placeholder={t('friends.codePlaceholder')}
            aria-label={t('friends.addByCode')}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setSent(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
          <Button
            className="w-full shrink-0 xs:w-auto"
            disabled={code.trim().length === 0 || sending}
            onClick={() => void submit()}
          >
            {t('friends.send')}
          </Button>
        </span>
      </label>
      {sent && <p className="text-sm font-bold text-success-strong">{t('friends.requestSent')}</p>}
    </div>
  )
}

/** The signed-out / unconfigured state. Guests keep playing; they just can't add anyone. */
function Unavailable() {
  const { t } = useTranslation()
  const error = useFriends((s) => s.error)
  return (
    <p className="rounded-lg border-2 border-dashed border-ink/40 px-3 py-6 text-center text-sm font-bold text-ink-muted">
      {error ?? t('friends.signedOut')}
    </p>
  )
}

export function FriendsPanel() {
  const { t } = useTranslation()
  const friends = useFriends((s) => s.friends)
  const available = useFriends((s) => s.available)
  const loading = useFriends((s) => s.loading)
  const error = useFriends((s) => s.error)
  const respond = useFriends((s) => s.respond)
  const remove = useFriends((s) => s.remove)
  const setBlocked = useFriends((s) => s.setBlocked)

  if (available === null && loading) {
    return <p className="py-6 text-center font-bold text-ink-muted">{t('friends.loading')}</p>
  }
  if (available === false) return <Unavailable />

  const incoming = incomingRequests(friends)
  const outgoing = outgoingRequests(friends)
  const accepted = acceptedFriends(friends)
  const blocked = blockedUsers(friends)
  const empty = friends.length === 0

  const key = (f: FriendSummary) => f.user.id

  return (
    <div className="space-y-5">
      <AddByCode />

      {error && (
        <p role="alert" className="text-sm font-bold text-danger-strong">
          {error}
        </p>
      )}

      <Section title={t('friends.incoming')} count={incoming.length}>
        {incoming.map((f) => (
          <FriendRow key={key(f)} entry={f}>
            <Button size="sm" variant="success" onClick={() => respond(f.user.id, true)}>
              {t('friends.accept')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => respond(f.user.id, false)}>
              {t('friends.decline')}
            </Button>
          </FriendRow>
        ))}
      </Section>

      <Section title={t('friends.outgoing')} count={outgoing.length}>
        {outgoing.map((f) => (
          <FriendRow key={key(f)} entry={f}>
            <Button size="sm" variant="secondary" onClick={() => remove(f.user.id)}>
              {t('friends.cancel')}
            </Button>
          </FriendRow>
        ))}
      </Section>

      <Section title={t('friends.yourFriends')} count={accepted.length}>
        {accepted.map((f) => (
          <FriendRow key={key(f)} entry={f}>
            <Button size="sm" variant="secondary" onClick={() => remove(f.user.id)}>
              {t('friends.remove')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => setBlocked(f.user.id, true)}>
              {t('friends.block')}
            </Button>
          </FriendRow>
        ))}
      </Section>

      <Section title={t('friends.blocked')} count={blocked.length}>
        {blocked.map((f) => (
          <FriendRow key={key(f)} entry={f}>
            <Button size="sm" variant="secondary" onClick={() => setBlocked(f.user.id, false)}>
              {t('friends.unblock')}
            </Button>
          </FriendRow>
        ))}
      </Section>

      {empty && (
        <p className="rounded-lg border-2 border-dashed border-ink/40 px-3 py-6 text-center text-sm font-bold text-ink-muted">
          {t('friends.empty')}
        </p>
      )}
    </div>
  )
}
