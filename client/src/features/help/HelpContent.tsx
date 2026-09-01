import {
  BOARD,
  JAIL_DURATION_TURNS,
  JAIL_EXIT_COST,
  MAX_PLAYERS,
  META_ACTIONS_PER_LAP,
  MIN_PLAYERS,
  PINJOL_INTEREST_RATE,
  PINJOL_MAX_LOANS,
  REGIONS,
  STARTING_CASH_DEFAULT,
  TIME_LIMIT_OPTIONS,
  type TileDef,
  type TileType,
  type TurnState,
} from '@tuan-tanah/shared'
import { Coins, Dices, Flag, LifeBuoy, Map as MapIcon, Zap, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '@/components/ui/index.js'
import { TileGlyph } from '@/features/game/Board/icons.js'
import { MetaActionBar } from '@/features/game/MetaActionBar/MetaActionBar.js'
import { TurnStepper } from './TurnStepper.js'
import { tileName, tileTypeLabel } from '@/i18n/gameData.js'
import { formatRupiah } from '@/store/gameStore.js'

/**
 * Every number quoted below is interpolated from the `shared` constants rather
 * than typed into the copy, the same contract `SpecialTileInfo` and
 * `MetaActionBar`'s tooltips hold: a balance change in `shared/data/` updates
 * this page for free and can't silently desync from what the engine does.
 */
const VALUES = {
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  clock: TIME_LIMIT_OPTIONS.join(' / '),
  startingCash: formatRupiah(STARTING_CASH_DEFAULT),
  metaPerLap: META_ACTIONS_PER_LAP,
  pinjolRate: Math.round(PINJOL_INTEREST_RATE * 100),
  pinjolMax: PINJOL_MAX_LOANS,
  jailTurns: JAIL_DURATION_TURNS,
  jailFee: formatRupiah(JAIL_EXIT_COST),
}

/**
 * The board's special tiles, one example def per type, in board order. Drawn
 * with the real `TileGlyph` the board itself uses and labelled from the same
 * `board.types` strings — so the legend can't drift from the board, and it
 * localizes and scales on a phone the way a screenshot of the board wouldn't.
 * Plain property tiles are omitted: they carry a price, not a glyph.
 */
const LEGEND: TileDef[] = (() => {
  const seen = new Map<TileType, TileDef>()
  for (const def of Object.values(BOARD)) {
    if (def.type !== 'property' && !seen.has(def.type)) seen.set(def.type, def)
  }
  return [...seen.values()]
})()

/**
 * A worked example of a real control, not a picture of one.
 *
 * Everything in here renders from the same primitives, the same components and
 * the same locale strings the game itself uses, so an example can't quietly
 * stop matching what the player will actually see — the failure mode a
 * screenshot has and this doesn't.
 *
 * `pointer-events-none` + `aria-hidden` matter as much as the styling: these
 * look exactly like the live controls, and a "Roll dice" button that silently
 * does nothing when tapped is precisely the confusion this page exists to
 * remove. The step's own text carries the meaning for assistive tech.
 */
function Demo({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      data-demo=""
      className="pointer-events-none select-none rounded-lg border-2 border-dashed border-ink/25 bg-surface-sunken p-2.5"
    >
      <div className="mx-auto max-w-[15rem]">{children}</div>
    </div>
  )
}

/** Enough of a turn for `MetaActionBar` to render its resting state. */
const DEMO_TURN: TurnState = {
  hasRolled: false,
  lastDice: null,
  rolledDoubles: false,
  doublesCount: 0,
  pendingBuyTileId: null,
  pendingLawOffice: false,
  deadline: null,
}

/** A real property off the board, so the buy example quotes a real price. */
const DEMO_BUY = Object.values(BOARD).find((d) => d.type === 'property' && d.region)!

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 font-display text-base uppercase tracking-tight text-ink">
        <Icon size={16} strokeWidth={2.5} aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Body copy for the sections that are a list of facts, not a sequence. The
 *  turn is the one ordered thing on the page and it uses `Step` instead. */
function Points({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-snug text-ink-muted marker:font-bold marker:text-ink">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * The rules reference itself — content only, no framing. Rendered inside the
 * modal (over a live game) and on the `/help` page, so it must not assume
 * either one's width or chrome.
 */
export function HelpContent() {
  const { t } = useTranslation()

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold leading-snug text-ink">{t('help.intro')}</p>

      <Section icon={Flag} title={t('help.goal.title')}>
        <Points items={[t('help.goal.win'), t('help.goal.early'), t('help.goal.setup', VALUES)]} />
      </Section>

      <Section icon={Dices} title={t('help.turn.title')}>
        <TurnStepper
          steps={[
            {
              body: t('help.turn.roll'),
              demo: (
                <Demo>
                  <Button block>🎲 {t('game.rollDice')}</Button>
                </Demo>
              ),
            },
            {
              body: t('help.turn.resolve'),
              demo: (
                <Demo>
                  <Button variant="success" block>
                    {t('game.buy', {
                      name: tileName(t, DEMO_BUY.id),
                      price: formatRupiah(REGIONS[DEMO_BUY.region!].buyPrice),
                    })}
                  </Button>
                </Demo>
              ),
            },
            {
              body: t('help.turn.act'),
              demo: (
                // The component itself, not a mock of it: it takes plain props,
                // so the page shows the real bar in its resting state.
                <Demo>
                  <MetaActionBar
                    turn={DEMO_TURN}
                    used={[]}
                    pendingAction={null}
                    onPick={() => {}}
                  />
                </Demo>
              ),
            },
            {
              body: t('help.turn.end'),
              demo: (
                <Demo>
                  <Button variant="secondary" size="sm" block>
                    {t('game.endTurn')}
                  </Button>
                </Demo>
              ),
            },
          ]}
        />
      </Section>

      <Section icon={Coins} title={t('help.money.title')}>
        <Points items={[t('help.money.salary'), t('help.money.rent'), t('help.money.upgrade')]} />
      </Section>

      <Section icon={Zap} title={t('help.actions.title')}>
        <Points
          items={[
            t('help.actions.meta', VALUES),
            t('help.actions.negotiate'),
            t('help.actions.pinjol', VALUES),
          ]}
        />
      </Section>

      <Section icon={LifeBuoy} title={t('help.trouble.title')}>
        <Points
          items={[t('help.trouble.debt'), t('help.trouble.jail', VALUES), t('help.trouble.out')]}
        />
      </Section>

      <Section icon={MapIcon} title={t('help.board.title')}>
        <Card tone="sunken" flat pad="sm">
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
            {LEGEND.map((def) => (
              <li key={def.type} className="flex items-center gap-2">
                <TileGlyph def={def} className="h-4 w-4 shrink-0" />
                <span className="text-xs font-semibold leading-tight text-ink">
                  {tileTypeLabel(t, def.type)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>
    </div>
  )
}
