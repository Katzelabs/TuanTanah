import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Avatar } from './Avatar.js'
import { SignInButton } from './SignInButton.js'
import { useAuth } from './authStore.js'

/**
 * The header's account widget: a sign-in button for guests, a name chip with a
 * drop-down once signed in.
 *
 * Renders **nothing** while the session is still loading or when the server has
 * accounts switched off — a guest on a guest-only build must see no change
 * anywhere in the UI.
 */
export function AuthMenu({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const loading = useAuth((s) => s.loading)
  const enabled = useAuth((s) => s.enabled)
  const signOut = useAuth((s) => s.signOut)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (loading || !enabled) return null
  if (!user) return <SignInButton size="sm" className={className} />

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('auth.accountMenu')}
        className="inline-flex max-w-[11rem] items-center gap-2 rounded-lg border-2 border-ink bg-surface py-1 pl-1 pr-2 shadow-brutal-sm transition brutal-press hover:bg-surface-sunken"
      >
        <Avatar user={user} size="sm" />
        <span className="truncate text-sm font-bold text-ink">{user.displayName}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-panel mt-2 w-60 overflow-hidden rounded-lg border-2 border-ink bg-surface text-left shadow-brutal"
        >
          <div className="border-b-2 border-ink bg-surface-sunken px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
              {t('auth.signedInAs')}
            </div>
            <div className="truncate text-sm font-bold text-ink">{user.email}</div>
          </div>
          {/* `/account` is subtask D's route; until it lands the app's catch-all
              bounces it home rather than 404ing. */}
          <MenuItem
            icon={Settings}
            label={t('auth.account')}
            onClick={() => {
              setOpen(false)
              navigate('/account')
            }}
          />
          <MenuItem
            icon={LogOut}
            label={t('auth.signOut')}
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm font-bold text-ink transition hover:bg-accent-soft"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  )
}
