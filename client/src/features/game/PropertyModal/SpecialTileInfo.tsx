import {
  HUSTLE_CARDS,
  JAIL_DURATION_TURNS,
  JAIL_EXIT_COST,
  KEJADIAN_CARDS,
  LAHAN_LAND_PRICE,
  LAW_OFFICE_FREEPASS_PRICE,
  LAW_OFFICE_JAIL_FEE,
  LAW_OFFICE_PRICE_MULT_MAX,
  LAW_OFFICE_PRICE_MULT_MIN,
  LAW_OFFICE_TRANSFER_RATE,
  META_ACTIONS_PER_LAP,
  RINJANI_FEE,
  type GameState,
  type Player,
  type TileDef,
  type TileState,
} from '@tuan-tanah/shared'
import type { TFunction } from 'i18next'
import { Card } from '@/components/ui/index.js'
import { TileGlyph, TYPE_COLOR } from '@/features/game/Board/icons.js'
import { playerWealth, salaryFor, taxMultiplier } from '@/features/game/lib/playerMath.js'
import { formatRupiah } from '@/store/gameStore.js'
import { Row } from './Row.js'

interface TileInfo {
  /** Lead paragraph: what happens when you land here. */
  desc: string
  /** Label/value facts — the concrete numbers. */
  facts: { label: string; value: string }[]
  /** Bulleted choices (Kantor Hukum's menu of legal powers). */
  bullets: string[]
  /** Footnote for exceptions, passes, and role passives. */
  note?: string
}

/**
 * The rules blurb for a tile type, assembled from the shared economy constants so
 * the copy can never drift from the numbers the engine actually uses. Returns
 * null for tiles whose own panels already explain them (property / transport).
 */
function infoFor(
  def: TileDef,
  tile: TileState,
  state: GameState,
  me: Player | null,
  t: TFunction,
): TileInfo | null {
  switch (def.type) {
    case 'go':
      return {
        desc: t('tileInfo.go.desc'),
        facts: [
          {
            label: t('tileInfo.go.salary'),
            value: me?.role ? formatRupiah(salaryFor(state, me)) : '—',
          },
          {
            label: t('tileInfo.go.metaActions'),
            value: t('tileInfo.go.metaActionsValue', { max: META_ACTIONS_PER_LAP }),
          },
        ],
        bullets: [],
        note: t('tileInfo.go.note'),
      }

    case 'tax': {
      const percent = def.taxPercent ?? 0
      const onCash = def.taxBasis === 'cash'
      const base = me ? (onCash ? me.cash : playerWealth(state, me)) : 0
      const due = me ? Math.round((base * percent * taxMultiplier(me)) / 100) : 0
      return {
        desc: onCash ? t('tileInfo.tax.descCash') : t('tileInfo.tax.descWealth'),
        facts: [
          {
            label: t('tileInfo.tax.rate'),
            value: onCash
              ? t('tileInfo.tax.rateCash', { percent })
              : t('tileInfo.tax.rateWealth', { percent }),
          },
          { label: t('tileInfo.tax.base'), value: me ? formatRupiah(base) : '—' },
          { label: t('tileInfo.tax.due'), value: me ? formatRupiah(due) : '—' },
        ],
        bullets: [],
        note:
          me?.role === 'ojol_driver'
            ? `${t('tileInfo.tax.note')} ${t('tileInfo.tax.noteOjol')}`
            : t('tileInfo.tax.note'),
      }
    }

    case 'event':
      return {
        desc: t('tileInfo.event.desc'),
        facts: [
          {
            label: t('tileInfo.deck'),
            value: t('tileInfo.deckValue', {
              left: state.kejadianDeck.length,
              total: KEJADIAN_CARDS.length,
            }),
          },
        ],
        bullets: [],
      }

    case 'hustle':
      return {
        desc: t('tileInfo.hustle.desc'),
        facts: [
          {
            label: t('tileInfo.deck'),
            value: t('tileInfo.deckValue', {
              left: state.hustleDeck.length,
              total: HUSTLE_CARDS.length,
            }),
          },
        ],
        bullets: [],
      }

    case 'jail_visit':
      return { desc: t('tileInfo.jailVisit.desc'), facts: [], bullets: [] }

    case 'jail_go':
      return {
        desc: t('tileInfo.jailGo.desc'),
        facts: [
          {
            label: t('tileInfo.jailGo.sentence'),
            value: t('tileInfo.jailGo.sentenceValue', { turns: JAIL_DURATION_TURNS }),
          },
          {
            label: t('tileInfo.jailGo.getOut'),
            value: t('tileInfo.jailGo.getOutValue', { bail: formatRupiah(JAIL_EXIT_COST) }),
          },
        ],
        bullets: [],
        note: t('tileInfo.jailGo.note'),
      }

    case 'law_office':
      return {
        desc: t('tileInfo.lawOffice.desc'),
        facts: [],
        bullets: [
          t('tileInfo.lawOffice.buy'),
          t('tileInfo.lawOffice.forceBuy', {
            percent: Math.round(LAW_OFFICE_TRANSFER_RATE * 100),
          }),
          t('tileInfo.lawOffice.jail', { fee: formatRupiah(LAW_OFFICE_JAIL_FEE) }),
          t('tileInfo.lawOffice.freepass', { price: formatRupiah(LAW_OFFICE_FREEPASS_PRICE) }),
          t('tileInfo.lawOffice.priceUpgrade', {
            min: LAW_OFFICE_PRICE_MULT_MIN,
            max: LAW_OFFICE_PRICE_MULT_MAX,
          }),
        ],
        note: t('tileInfo.lawOffice.note'),
      }

    case 'vacation':
      return {
        desc: t('tileInfo.vacation.desc'),
        facts: [{ label: t('tileInfo.vacation.fee'), value: formatRupiah(RINJANI_FEE) }],
        bullets: [],
        note: t('tileInfo.vacation.note'),
      }

    case 'buildable_land':
      return {
        // Only pitch the asking price while the plot is still on the market.
        desc: tile.ownerId
          ? t('tileInfo.land.descOwned')
          : t('tileInfo.land.desc', { price: formatRupiah(LAHAN_LAND_PRICE) }),
        facts: [],
        bullets: [],
        note: t('tileInfo.land.note'),
      }

    default:
      return null
  }
}

/**
 * "How this tile works" panel for tiles the rent/development tables don't
 * explain — GO, tax, card, jail, Kantor Hukum, Rinjani, and Lahan Kosong. Purely
 * informational: every number comes from the shared constants.
 */
export function SpecialTileInfo({
  def,
  tile,
  state,
  me,
  t,
}: {
  def: TileDef
  tile: TileState
  state: GameState
  me: Player | null
  t: TFunction
}) {
  const info = infoFor(def, tile, state, me, t)
  if (!info) return null

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
        {t('tileInfo.heading')}
      </div>
      <Card flat tone="sunken" className="space-y-3 p-3 text-sm">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-ink shadow-brutal-xs"
            style={{ background: `${TYPE_COLOR[def.type]}26` }}
          >
            <TileGlyph def={def} className="h-5 w-5" />
          </span>
          <p className="text-ink">{info.desc}</p>
        </div>

        {info.bullets.length > 0 && (
          <ul className="space-y-1.5 border-t-2 border-dashed border-ink-faint/40 pt-3">
            {info.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-ink-muted">
                <span aria-hidden className="font-bold text-ink">
                  ›
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {info.facts.length > 0 && (
          <div className="space-y-2 border-t-2 border-dashed border-ink-faint/40 pt-3">
            {info.facts.map((fact) => (
              <Row key={fact.label} label={fact.label}>
                {fact.value}
              </Row>
            ))}
          </div>
        )}

        {info.note && <p className="text-xs text-ink-muted">{info.note}</p>}
      </Card>
    </div>
  )
}
