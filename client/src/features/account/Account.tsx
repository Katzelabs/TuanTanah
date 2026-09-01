import { Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import type { AuthUser } from '@tuan-tanah/shared'
import { AppVersion } from '@/components/AppVersion.js'
import { LanguageSwitcher } from '@/components/LanguageSwitcher.js'
import { SoundToggle } from '@/components/SoundToggle.js'
import { Button, Card, Modal, Toast } from '@/components/ui/index.js'
import { DISPLAY_NAME_MAX } from './constants.js'
import { deleteAccount, updateDisplayName, type AccountErrorCode } from './api.js'
import { useAuthState } from './authSeam.js'

/**
 * `/account` — the signed-in player's own settings (ClickUp 86ey2z15r).
 *
 * Guests are bounced home rather than shown a login wall: accounts are optional
 * in this game, and a server with them switched off must not have a dead route.
 */
export function Account() {
  const { t } = useTranslation()
  const user = useAuthState((s) => s.user)
  const loading = useAuthState((s) => s.loading)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="font-bold text-ink-muted">{t('account.loading')}</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/" replace />
  // Keyed on the account id so switching accounts re-seeds the name field
  // instead of leaving the previous player's draft in the input.
  return <AccountSettings key={user.id} user={user} />
}

function AccountSettings({ user }: { user: AuthUser }) {
  const { t } = useTranslation()
  const signOut = useAuthState((s) => s.signOut)
  const refresh = useAuthState((s) => s.refresh)
  const navigate = useNavigate()
  const [error, setError] = useState<AccountErrorCode | null>(null)

  // Signing out and deleting both end the session. Re-read it before navigating:
  // the auth store is what every other screen reads from, and until it refreshes
  // it is still holding the account we just left.
  const leaveForHome = async () => {
    await refresh()
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="-rotate-1 rounded-xl border-2 border-ink bg-accent px-4 py-1.5 font-display text-2xl uppercase tracking-tight text-ink shadow-brutal">
          {t('account.title')}
        </h1>
        <Link
          to="/"
          className="text-xs font-bold text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          {t('common.backHome')}
        </Link>
      </header>

      <div className="space-y-4">
        <DisplayNameCard user={user} onError={setError} onSaved={refresh} />
        <FriendCodeCard friendCode={user.friendCode} />
        <ConnectedAccountCard user={user} />
        <PreferencesCard />
        <AboutCard />

        <Card
          pad="lg"
          className="flex flex-col gap-4 xs:flex-row xs:items-center xs:justify-between"
        >
          <div>
            <h2 className="font-display text-lg uppercase tracking-tight">
              {t('account.session.heading')}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">{t('account.session.hint')}</p>
          </div>
          <Button
            variant="secondary"
            className="w-full shrink-0 xs:w-auto"
            onClick={() => void signOut().then(leaveForHome)}
          >
            {t('account.session.signOut')}
          </Button>
        </Card>

        <DangerZoneCard onError={setError} onDeleted={() => void leaveForHome()} />
      </div>

      <Toast show={error !== null} tone="error" onDismiss={() => setError(null)}>
        {error && t(`account.errors.${error}`)}
      </Toast>
    </div>
  )
}

function SectionCard({
  heading,
  hint,
  children,
}: {
  heading: string
  hint?: string
  children: ReactNode
}) {
  return (
    <Card pad="lg">
      <h2 className="font-display text-lg uppercase tracking-tight">{heading}</h2>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function DisplayNameCard({
  user,
  onError,
  onSaved,
}: {
  user: AuthUser
  onError: (error: AccountErrorCode) => void
  onSaved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(user.displayName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const trimmed = draft.trim()
  const dirty = trimmed !== user.displayName
  const canSave = dirty && trimmed.length > 0 && !saving

  const save = async () => {
    setSaving(true)
    setSaved(false)
    const result = await updateDisplayName(trimmed)
    setSaving(false)
    if (!result.ok) {
      onError(result.error)
      return
    }
    // The server normalises (trim, collapse, strip control characters), so show
    // what it actually stored rather than what was typed.
    setDraft(result.value.displayName)
    setSaved(true)
    await onSaved()
  }

  return (
    <SectionCard heading={t('account.profile.heading')} hint={t('account.profile.hint')}>
      <div className="flex flex-col gap-3 xs:flex-row xs:items-end">
        <label className="block min-w-0 flex-1">
          <span className="text-sm font-bold text-ink">{t('account.profile.displayName')}</span>
          <input
            className="mt-1 w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 font-medium outline-none transition focus:shadow-brutal-sm"
            value={draft}
            maxLength={DISPLAY_NAME_MAX}
            onChange={(e) => {
              setDraft(e.target.value)
              setSaved(false)
            }}
          />
        </label>
        <Button
          className="w-full shrink-0 xs:w-auto"
          disabled={!canSave}
          onClick={() => void save()}
        >
          {saving ? t('account.profile.saving') : t('account.profile.save')}
        </Button>
      </div>
      {saved && !dirty && (
        <p className="mt-2 text-xs font-bold text-success-strong">{t('account.profile.saved')}</p>
      )}
    </SectionCard>
  )
}

function FriendCodeCard({ friendCode }: { friendCode: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(friendCode)
    } catch {
      // Clipboard blocked (insecure context / permissions) — same prompt
      // fallback the room share link uses.
      window.prompt(t('account.friendCode.copyPrompt'), friendCode)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <SectionCard heading={t('account.friendCode.heading')} hint={t('account.friendCode.hint')}>
      <div className="flex flex-col gap-3 xs:flex-row xs:items-center">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border-2 border-ink bg-surface-sunken px-3 py-2 text-center font-bold uppercase tracking-widest text-ink">
          {friendCode}
        </code>
        <Button
          variant="secondary"
          className="w-full shrink-0 xs:w-auto"
          onClick={() => void copy()}
        >
          {copied ? t('account.friendCode.copied') : t('account.friendCode.copy')}
        </Button>
      </div>
    </SectionCard>
  )
}

function ConnectedAccountCard({ user }: { user: AuthUser }) {
  const { t, i18n } = useTranslation()
  const memberSince = new Date(user.createdAt)

  return (
    <SectionCard heading={t('account.connected.heading')}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-ink-muted">{t('account.connected.provider')}</dt>
          <dd className="font-medium text-ink">Google</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-ink-muted">{t('account.connected.email')}</dt>
          <dd className="truncate font-medium text-ink">
            {user.email || t('account.connected.noEmail')}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-ink-muted">{t('account.connected.memberSince')}</dt>
          <dd className="font-medium text-ink">
            {Number.isNaN(memberSince.getTime())
              ? t('common.dash')
              : memberSince.toLocaleDateString(i18n.language)}
          </dd>
        </div>
      </dl>
    </SectionCard>
  )
}

function PreferencesCard() {
  const { t } = useTranslation()
  return (
    <SectionCard heading={t('account.preferences.heading')} hint={t('account.preferences.hint')}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-bold text-ink">{t('account.preferences.language')}</span>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-bold text-ink">{t('account.preferences.sound')}</span>
          <SoundToggle />
        </div>
      </div>
    </SectionCard>
  )
}

/**
 * Build identity, on the page a player is already on when something is wrong.
 *
 * Sits under Preferences rather than in the danger zone because it is reference
 * information, not a setting — nothing here is adjustable, and the hint says
 * what it is *for* so a reporter knows to include it.
 */
function AboutCard() {
  const { t } = useTranslation()
  return (
    <SectionCard heading={t('version.about')} hint={t('version.aboutHint')}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-bold text-ink">{t('version.label')}</span>
        <AppVersion className="text-xs" />
      </div>
      <Link to="/changelog" className="mt-3 block">
        <Button variant="secondary" block className="justify-start">
          <Sparkles size={16} aria-hidden />
          {t('changelog.read')}
        </Button>
      </Link>
    </SectionCard>
  )
}

function DangerZoneCard({
  onError,
  onDeleted,
}: {
  onError: (error: AccountErrorCode) => void
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    setDeleting(true)
    const result = await deleteAccount()
    setDeleting(false)
    if (!result.ok) {
      onError(result.error)
      // Leave the dialog open: a failed delete is retryable, and closing it
      // would read as "it worked".
      return
    }
    setConfirming(false)
    onDeleted()
  }

  return (
    <>
      <Card
        tone="danger"
        pad="lg"
        className="flex flex-col gap-4 xs:flex-row xs:items-center xs:justify-between"
      >
        <div>
          <h2 className="font-display text-lg uppercase tracking-tight">
            {t('account.danger.heading')}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">{t('account.danger.hint')}</p>
        </div>
        <Button
          variant="danger"
          className="w-full shrink-0 xs:w-auto"
          onClick={() => setConfirming(true)}
        >
          {t('account.danger.delete')}
        </Button>
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('account.danger.confirmTitle')}
        size="sm"
      >
        <p className="text-sm text-ink">{t('account.danger.confirmBody')}</p>
        <p className="mt-2 text-sm text-ink-muted">{t('account.danger.confirmHistory')}</p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" size="sm" block onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            block
            disabled={deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting ? t('account.danger.deleting') : t('account.danger.confirm')}
          </Button>
        </div>
      </Modal>
    </>
  )
}
