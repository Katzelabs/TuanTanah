import {
  JUDOL_JACKPOT_MULTIPLIER,
  JUDOL_WIN_MULT_MAX,
  JUDOL_WIN_MULT_MIN,
  KORUPSI_STEAL_AMOUNT,
  META_ACTIONS_PER_LAP,
  SABOTAGE_DURATION_ROUNDS,
  type MetaActionType,
  type TurnState,
} from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { Button, Tooltip } from '@/components/ui/index.js'
import { JUDOL_ODDS, KORUPSI_ODDS } from '@/features/game/lib/odds.js'
import { formatRupiah } from '@/store/gameStore.js'

// Odds and stakes quoted in the action tooltips, all derived from the shared
// constants so the copy can't drift from what the engine rolls. One object for
// every action — i18next ignores the values a given description doesn't use.
const TOOLTIP_VALUES = {
  judolWinPercent: JUDOL_ODDS.winPercent,
  judolMinMult: JUDOL_WIN_MULT_MIN,
  judolMaxMult: JUDOL_WIN_MULT_MAX,
  judolJackpotPercent: JUDOL_ODDS.jackpotPercent,
  judolJackpotMult: JUDOL_JACKPOT_MULTIPLIER,
  korupsiSuccessPercent: KORUPSI_ODDS.successPercent,
  korupsiBustPercent: KORUPSI_ODDS.bustPercent,
  korupsiSteal: formatRupiah(KORUPSI_STEAL_AMOUNT),
  sabotageRounds: SABOTAGE_DURATION_ROUNDS,
}

export type MetaTarget = 'none' | 'player' | 'tile'

export interface MetaActionDef {
  action: MetaActionType
  target: MetaTarget
  needsUnrolled?: boolean // Work must be chosen before rolling
}

// Turn structure step 5 — one optional meta action per turn. Labels are looked
// up at render time via `meta.<action>` so they localize per player.
export const META_ACTIONS: MetaActionDef[] = [
  // Judol opens a deposit modal (handled in Game.tsx) rather than emitting on pick.
  { action: 'judol', target: 'none' },
  { action: 'work', target: 'none', needsUnrolled: true },
  { action: 'hustle', target: 'none' },
  { action: 'lobby', target: 'player' },
  { action: 'sabotage', target: 'tile' },
  { action: 'korupsi', target: 'none' },
  // Note: negotiation is offered as a dedicated button (opens the deal modal),
  // not as a meta action — the engine's `negotiate` meta only signals intent.
]

interface Props {
  turn: TurnState
  // Meta actions already used this lap (resets when the player passes GO).
  used: MetaActionType[]
  pendingAction: MetaActionType | null
  onPick: (def: MetaActionDef) => void
}

export function MetaActionBar({ turn, used, pendingAction, onPick }: Props) {
  const { t } = useTranslation()
  const remaining = META_ACTIONS_PER_LAP - used.length
  return (
    <div className="space-y-1.5 rounded-lg border-2 border-ink bg-surface-sunken p-2">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-ink-muted">
        <span>{t('meta.title')}</span>
        <span>{t('meta.remaining', { count: remaining })}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {META_ACTIONS.map((def) => {
          const alreadyUsed = used.includes(def.action)
          const disabled = Boolean(def.needsUnrolled && turn.hasRolled) || alreadyUsed
          const active = pendingAction === def.action
          return (
            <Tooltip
              key={def.action}
              content={
                alreadyUsed
                  ? t('meta.alreadyUsed')
                  : t(`meta.descriptions.${def.action}`, TOOLTIP_VALUES)
              }
              className="w-full"
            >
              <Button
                size="sm"
                block
                variant={active ? 'info' : 'secondary'}
                disabled={disabled}
                onClick={() => onPick(def)}
              >
                {t(`meta.${def.action}`)}
              </Button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
