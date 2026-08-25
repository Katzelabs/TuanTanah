import { MAX_PLAYERS, MIN_PLAYERS, REGIONS } from '@tuan-tanah/shared'
import { Crown, Handshake, History, MapPin, Settings, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ControlCluster } from '@/components/ControlCluster.js'
import { LanguageSwitcher } from '@/components/LanguageSwitcher.js'
import { SoundToggle } from '@/components/SoundToggle.js'
import { FriendsButton } from '@/features/social/index.js'
import { Badge, Button, Card } from '@/components/ui/index.js'
import { AuthMenu, Avatar, SignInButton, useAuth } from '@/features/auth/index.js'
import { useAuthUser } from '@/hooks/useAuthUser.js'
import { useGame } from '@/store/gameStore.js'

/** Matches the server's player-name cap. */
const NAME_MAX_LENGTH = 20
/** The server's room codes are 6 characters; below 4 the input is obviously unfinished. */
const CODE_MIN_LENGTH = 4
const CODE_LENGTH = 6

const INPUT =
  'w-full rounded-lg border-2 border-ink bg-surface px-3 py-2.5 font-medium text-ink outline-none transition placeholder:text-ink-faint focus:shadow-brutal-sm'

/**
 * The landing page — and, for most players, the first thing they ever see of
 * the game. It has three jobs, in this order:
 *
 *  1. Say what Tuan Tanah *is* to someone who arrived from a shared link.
 *  2. Get them into a room. Creating is the primary action; joining by code is
 *     the fallback (people invited to a room almost always arrive on a `/room/`
 *     URL, so typing a code is the rarer path and is de-emphasised, not hidden
 *     behind an "or" divider that made the two look equal).
 *  3. Tell a signed-in player what their account gets them, and tell a guest
 *     what they're missing — the two states used to differ only by a prefilled
 *     name field.
 */
export function Home() {
  const join = useGame((s) => s.join)
  const joining = useGame((s) => s.joining)
  const connected = useGame((s) => s.connected)
  const navigate = useNavigate()
  const account = useAuthUser()
  // `null` means "untouched", so the field follows the account name as it loads
  // instead of needing an effect to sync into state. Guests start on ''.
  const [typedName, setTypedName] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const name = typedName ?? account?.displayName.slice(0, NAME_MAX_LENGTH) ?? ''
  const canSubmit = name.trim().length > 0 && connected && !joining
  const goToRoom = (roomId: string) => navigate(`/room/${roomId}`)
  // Creating is the only path that gets the post-create share prompt.
  const goToCreatedRoom = (roomId: string) =>
    navigate(`/room/${roomId}`, { state: { created: true } })

  const create = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    join(name, undefined, goToCreatedRoom)
  }
  const joinByCode = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || code.trim().length < CODE_MIN_LENGTH) return
    join(name, code.trim(), goToRoom)
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-12 pt-4 sm:px-6">
      <header className="flex justify-end">
        <ControlCluster
          overflow={
            <>
              <SoundToggle />
              <LanguageSwitcher />
            </>
          }
        >
          {/* FriendsButton stays mounted for guests too: it owns the friends
              store's init() and the incoming-request toast. */}
          <FriendsButton />
          {/* Guests get their sign-in call to action from `AccountPanel`, where
              it comes with a reason. A second bare "Sign in with Google" up here
              would just be the same button twice. */}
          {account && <AuthMenu />}
        </ControlCluster>
      </header>

      <main className="flex flex-1 flex-col items-center">
        <Hero />

        <div className="mt-8 grid w-full gap-4 md:mt-10 md:grid-cols-5 md:items-start">
          <div className="md:col-span-3">
            <PlayCard
              name={name}
              onName={setTypedName}
              code={code}
              onCode={setCode}
              canSubmit={canSubmit}
              joining={joining}
              connected={connected}
              onCreate={create}
              onJoin={joinByCode}
            />
          </div>
          <div className="md:col-span-2">
            <AccountPanel />
          </div>
        </div>

        <HowItWorks />
      </main>
    </div>
  )
}

function Hero() {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col items-center pt-6 text-center sm:pt-10">
      <div className="-rotate-1">
        <h1 className="rounded-xl border-2 border-ink bg-accent px-5 py-2 font-display text-4xl uppercase text-ink shadow-brutal-lg xs:text-5xl sm:px-8 sm:py-3 sm:text-6xl">
          {t('home.title')}
        </h1>
      </div>
      <p className="mt-5 max-w-md text-balance text-base font-bold text-ink-muted sm:text-lg">
        {t('home.pitch')}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Badge size="md">{t('home.tag.players', { min: MIN_PLAYERS, max: MAX_PLAYERS })}</Badge>
        <Badge size="md">{t('home.tag.browser')}</Badge>
        <Badge size="md">{t('home.tag.free')}</Badge>
      </div>
    </section>
  )
}

interface PlayCardProps {
  name: string
  onName: (value: string) => void
  code: string
  onCode: (value: string) => void
  canSubmit: boolean
  joining: boolean
  connected: boolean
  onCreate: (e: FormEvent) => void
  onJoin: (e: FormEvent) => void
}

/**
 * Name + the two ways into a room. Both halves live in one card so the name is
 * visibly the shared prerequisite, but only "create" gets the hero button.
 */
function PlayCard({
  name,
  onName,
  code,
  onCode,
  canSubmit,
  joining,
  connected,
  onCreate,
  onJoin,
}: PlayCardProps) {
  const { t } = useTranslation()
  const account = useAuthUser()

  return (
    <Card pad="lg">
      <form onSubmit={onCreate} className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="home-name" className="text-sm font-bold text-ink">
              {t('home.yourName')}
            </label>
            <span className="text-2xs font-bold tabular-nums text-ink-faint">
              {name.length}/{NAME_MAX_LENGTH}
            </span>
          </div>
          <input
            id="home-name"
            aria-describedby="home-name-hint"
            className={`mt-1.5 ${INPUT}`}
            value={name}
            maxLength={NAME_MAX_LENGTH}
            placeholder={t('home.namePlaceholder')}
            autoComplete="nickname"
            onChange={(e) => onName(e.target.value)}
          />
          <p id="home-name-hint" className="mt-1.5 text-xs font-semibold text-ink-muted">
            {account ? t('home.nameFromAccount') : t('home.nameHint')}
          </p>
        </div>

        <ConnectionNotice connected={connected} />

        <Button type="submit" size="lg" block disabled={!canSubmit}>
          {joining ? t('home.creating') : t('home.createRoom')}
        </Button>
      </form>

      <form onSubmit={onJoin} className="mt-5 border-t-2 border-ink/15 pt-4">
        <label
          htmlFor="home-code"
          className="text-xs font-bold uppercase tracking-wide text-ink-faint"
        >
          {t('home.haveCode')}
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="home-code"
            className={`${INPUT} min-w-0 flex-1 font-mono font-bold uppercase tracking-[0.3em]`}
            value={code}
            maxLength={CODE_LENGTH}
            placeholder={t('home.roomCodePlaceholder')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => onCode(e.target.value.toUpperCase())}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={!canSubmit || code.trim().length < CODE_MIN_LENGTH}
            className="shrink-0"
          >
            {t('home.join')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

/**
 * Connection feedback sized to how much it matters. Both room actions are dead
 * until the socket is up, so while it's down this is a full-width explanation
 * of *why* the buttons are disabled; once it's up it shrinks to a one-line
 * confirmation rather than disappearing (a "is this thing on?" answer).
 */
function ConnectionNotice({ connected }: { connected: boolean }) {
  const { t } = useTranslation()

  if (connected) {
    return (
      <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wide text-ink-faint">
        <span className="inline-block h-2 w-2 rounded-full border-2 border-ink bg-success" />
        {t('connection.connected')}
      </p>
    )
  }

  return (
    <Card tone="info" flat pad="sm" role="status" className="flex items-start gap-2.5">
      <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full border-2 border-ink bg-info-strong" />
      <span>
        <span className="block text-sm font-bold text-ink">{t('connection.connecting')}</span>
        <span className="block text-xs font-semibold text-ink-muted">
          {t('connection.connectingHint')}
        </span>
      </span>
    </Card>
  )
}

/**
 * The half of the page that actually differs by sign-in state: an account's
 * entry points (history, settings) versus the case for making one. Renders
 * nothing on a build with accounts switched off — same contract as `AuthMenu`,
 * so a guest-only deployment sees no account surface anywhere.
 */
function AccountPanel() {
  const { t } = useTranslation()
  const user = useAuthUser()
  const loading = useAuth((s) => s.loading)
  const enabled = useAuth((s) => s.enabled)

  if (!enabled) return null
  // A placeholder rather than nothing: the session settles a beat after paint,
  // and popping a whole card into the grid moves the page under the cursor.
  if (loading) return <Card tone="sunken" flat pad="lg" className="h-32" aria-hidden />

  if (!user) {
    return (
      <Card tone="info" pad="lg" className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-tight text-ink">
          {t('home.guest.title')}
        </h2>
        <p className="text-sm font-semibold text-ink-muted">{t('home.guest.body')}</p>
        <ul className="space-y-1.5 text-sm font-bold text-ink">
          <Perk>{t('home.guest.perkFriends')}</Perk>
          <Perk>{t('home.guest.perkHistory')}</Perk>
          <Perk>{t('home.guest.perkName')}</Perk>
        </ul>
        <SignInButton block />
      </Card>
    )
  }

  return (
    <Card pad="lg" className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} size="md" />
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide text-ink-faint">
            {t('home.account.welcome')}
          </div>
          <div className="truncate font-display text-lg uppercase tracking-tight text-ink">
            {user.displayName}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Link to="/history" className="block">
          <Button variant="secondary" block className="justify-start">
            <History size={16} aria-hidden />
            {t('home.account.history')}
          </Button>
        </Link>
        <Link to="/account" className="block">
          <Button variant="secondary" block className="justify-start">
            <Settings size={16} aria-hidden />
            {t('home.account.settings')}
          </Button>
        </Link>
      </div>
      <p className="text-xs font-semibold text-ink-muted">{t('home.account.friendsHint')}</p>
    </Card>
  )
}

function Perk({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-px font-black text-success-strong">
        ✓
      </span>
      {children}
    </li>
  )
}

/**
 * The "what am I looking at" band. Deliberately below the action card — someone
 * who already knows the game never has to scroll past an explanation to play —
 * and built from the real board data, so the nine region names double as the
 * page's Indonesian identity instead of stock illustration.
 */
function HowItWorks() {
  const { t } = useTranslation()
  const regions = Object.values(REGIONS)

  return (
    <Card tone="sunken" pad="lg" className="mt-10 w-full">
      <h2 className="text-center font-display text-xl uppercase tracking-tight text-ink">
        {t('home.how.title')}
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Step n={1} icon={MapPin} title={t('home.how.own.title')} body={t('home.how.own.body')} />
        <Step
          n={2}
          icon={Crown}
          title={t('home.how.roles.title')}
          body={t('home.how.roles.body')}
        />
        <Step
          n={3}
          icon={Handshake}
          title={t('home.how.deals.title')}
          body={t('home.how.deals.body')}
        />
      </div>

      <div className="mt-6 border-t-2 border-ink/15 pt-5">
        <h3 className="text-center text-xs font-bold uppercase tracking-wide text-ink-faint">
          {t('home.regions.title')}
        </h3>
        <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
          {regions.map((region) => (
            <li key={region.id}>
              <Badge size="md">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink"
                  style={{ background: region.color }}
                />
                {region.name}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function Step({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number
  icon: LucideIcon
  title: string
  body: string
}) {
  return (
    <Card flat pad="md" className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface-sunken text-ink">
          <Icon size={16} aria-hidden />
        </span>
        <span className="font-mono text-2xs font-bold text-ink-faint">
          {String(n).padStart(2, '0')}
        </span>
      </div>
      <h3 className="font-display text-base uppercase tracking-tight text-ink">{title}</h3>
      <p className="text-sm font-semibold text-ink-muted">{body}</p>
    </Card>
  )
}
