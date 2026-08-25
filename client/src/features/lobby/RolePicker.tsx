import { ALL_ROLES, ROLES, type Player, type Role } from '@tuan-tanah/shared'
import { Check, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/index.js'
import { roleAbility, roleName } from '@/i18n/gameData.js'
import { formatRupiah } from '@/store/gameStore.js'
import { LobbyPanel } from './LobbyPanel.js'

/**
 * The role board. A role belongs to at most one player, so each tile is really
 * a seat: open, yours, someone else's, or switched off by the host. Those four
 * states get four different frames rather than one shared `opacity-50`, which
 * previously made a taken role and a disabled role look identical — and made
 * the ability text (the whole reason to read a tile) unreadable in both.
 */
export function RolePicker({
  players,
  meId,
  enabledRoles,
  onPick,
  className = '',
}: {
  players: Player[]
  meId: string | undefined
  enabledRoles: Role[]
  onPick: (role: Role | null) => void
  className?: string
}) {
  const { t } = useTranslation()
  const ownerOf = (role: Role) => players.find((p) => p.role === role)
  const open = ALL_ROLES.filter((r) => enabledRoles.includes(r) && !ownerOf(r)).length

  return (
    <LobbyPanel
      title={t('lobby.roles')}
      aside={
        <span className="text-2xs font-bold uppercase tracking-wide text-ink-faint">
          {t('lobby.rolesOpen', { count: open })}
        </span>
      }
      className={className}
    >
      <p className="-mt-1 text-2xs font-medium text-ink-muted sm:text-xs">{t('lobby.rolesHint')}</p>
      {/* One column on a small phone: the ability line is a full sentence and
          two 160px columns turn it into a word ladder. */}
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {ALL_ROLES.map((role) => {
          const owner = ownerOf(role)
          return (
            <RoleTile
              key={role}
              role={role}
              owner={owner}
              mine={!!owner && owner.id === meId}
              enabled={enabledRoles.includes(role)}
              onPick={onPick}
            />
          )
        })}
      </div>
    </LobbyPanel>
  )
}

function RoleTile({
  role,
  owner,
  mine,
  enabled,
  onPick,
}: {
  role: Role
  owner: Player | undefined
  mine: boolean
  enabled: boolean
  onPick: (role: Role | null) => void
}) {
  const { t } = useTranslation()
  const def = ROLES[role]
  const takenByOther = !!owner && !mine
  const disabled = !enabled || takenByOther

  // Frame carries the state: raised + accent = yours, raised white = free to
  // take, seated flat = someone has it, dashed = not in this game at all.
  const frame = mine
    ? 'border-ink bg-accent-soft shadow-brutal'
    : !enabled
      ? 'cursor-not-allowed border-dashed border-ink/40 bg-surface-sunken'
      : takenByOther
        ? 'cursor-not-allowed border-ink bg-surface-sunken'
        : 'border-ink bg-surface shadow-brutal-sm brutal-press'

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={mine}
      onClick={() => onPick(mine ? null : role)}
      className={`flex h-full flex-col rounded-xl border-2 p-2.5 text-left transition sm:p-3 ${frame}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className={`font-bold leading-tight ${enabled ? 'text-ink' : 'text-ink-faint'}`}>
          {roleName(t, role)}
        </span>
        {mine && <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden />}
        {!enabled && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />}
      </div>

      <span className={`text-2xs font-bold ${enabled ? 'text-ink-muted' : 'text-ink-faint'}`}>
        {t('lobby.salary', { amount: formatRupiah(def.salary) })}
      </span>
      <span
        className={`mt-1 text-2xs leading-snug ${enabled ? 'text-ink-muted' : 'text-ink-faint'}`}
      >
        {roleAbility(t, role)}
      </span>

      {/* Pinned to the bottom so tiles in a row line their status up. */}
      <span className="mt-auto pt-2">
        {owner ? (
          <Badge color={owner.color}>{mine ? t('lobby.you') : owner.name}</Badge>
        ) : (
          <span className="text-3xs font-bold uppercase tracking-wide text-ink-faint">
            {enabled ? t('lobby.roleOpen') : t('lobby.roleOff')}
          </span>
        )}
      </span>
    </button>
  )
}
