import {
  BOARD,
  REGION_SET_RENT_MULTIPLIER,
  REGIONS,
  SELL_REFUND_RATE,
  TRANSPORT_RENT,
  type GameState,
  type RupiahAmount,
  type TileId,
  type TileState,
} from '@tuan-tanah/shared'
import type { TFunction } from 'i18next'
import { landBusinessName, landTierName, tierName, tileName } from '@/i18n/gameData.js'
import { Button, Card, Modal } from '@/components/ui/index.js'
import { ownsFullRegion, tileValue } from '@/features/game/lib/tileValue.js'
import { formatRupiah } from '@/store/gameStore.js'

/**
 * Everything a sale destroys beyond the tile itself. Selling wipes the tile's
 * track, tier, landBuild and priceMultiplier (see the engine's `sellProperty`),
 * and it can break a set the owner still holds — so each of these is value the
 * 70% refund does NOT pay back.
 */
function lossesFor(tile: TileState, state: GameState, t: TFunction): string[] {
  const def = BOARD[tile.id]
  if (!def) return []
  const losses: string[] = []

  if (tile.landBuild && tile.tier >= 1) {
    losses.push(
      t('sellConfirm.loseBusiness', {
        business: landBusinessName(t, tile.landBuild),
        tier: landTierName(t, tile.landBuild, tile.tier),
      }),
    )
  } else if (tile.track && tile.tier >= 1) {
    losses.push(t('sellConfirm.loseDevelopment', { name: tierName(t, tile.track, tile.tier) }))
  }

  if (tile.priceMultiplier > 1) {
    losses.push(t('sellConfirm.losePriceBoost', { mult: tile.priceMultiplier }))
  }

  // A full-region set pays REGION_SET_RENT_MULTIPLIER on every tile in it, so
  // selling one tile drops that bonus on all the others the owner keeps.
  if (
    def.region &&
    REGION_SET_RENT_MULTIPLIER > 1 &&
    ownsFullRegion(state.tiles, def.region, tile.ownerId)
  ) {
    losses.push(
      t('sellConfirm.loseRegionSet', {
        region: REGIONS[def.region].name,
        mult: REGION_SET_RENT_MULTIPLIER,
      }),
    )
  }

  // Transport rent is a ladder keyed on how many the owner holds, so dropping
  // one knocks the rest down a rung.
  if (def.type === 'transport' && tile.ownerId) {
    const owned = BOARD.filter(
      (d) => d.type === 'transport' && state.tiles[d.id]?.ownerId === tile.ownerId,
    ).length
    const before = TRANSPORT_RENT[owned]
    const after = TRANSPORT_RENT[owned - 1]
    if (owned > 1 && before != null && after != null) {
      losses.push(
        t('sellConfirm.loseTransportRung', {
          count: owned - 1,
          before: formatRupiah(before),
          after: formatRupiah(after),
        }),
      )
    }
  }

  return losses
}

/**
 * Confirmation dialog for selling a tile back to the bank. Spells out the refund
 * and — because the refund is partial and the sale wipes every upgrade — exactly
 * what the player gives up. Rendered on top of the tile modal.
 */
export function SellConfirmModal({
  tileId,
  tile,
  state,
  refund,
  open,
  onConfirm,
  onCancel,
  t,
}: {
  tileId: TileId
  tile: TileState
  state: GameState
  refund: RupiahAmount
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  t: TFunction
}) {
  const losses = lossesFor(tile, state, t)
  const invested = tileValue(tile, state.tiles)

  return (
    <Modal open={open} onClose={onCancel} title={t('sellConfirm.title')} size="sm">
      <p className="text-sm text-ink">
        {t('property.sellConfirm', { name: tileName(t, tileId), refund: formatRupiah(refund) })}
      </p>

      <Card flat tone="sunken" className="mt-3 space-y-1 p-3 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-ink-muted">{t('sellConfirm.invested')}</span>
          <span className="font-semibold tabular-nums text-ink">{formatRupiah(invested)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-ink-muted">
            {t('sellConfirm.refund', { rate: Math.round(SELL_REFUND_RATE * 100) })}
          </span>
          <span className="font-semibold tabular-nums text-ink">{formatRupiah(refund)}</span>
        </div>
      </Card>

      {losses.length > 0 && (
        <Card flat tone="danger" className="mt-3 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink">
            {t('sellConfirm.losesHeading')}
          </div>
          <ul className="mt-1.5 space-y-1 text-xs text-ink">
            {losses.map((loss) => (
              <li key={loss} className="flex gap-2">
                <span aria-hidden className="font-bold">
                  ·
                </span>
                <span>{loss}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-3 text-[11px] text-ink-muted">{t('sellConfirm.permanent')}</p>

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="sm" block onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" size="sm" block onClick={onConfirm}>
          {t('property.confirmSell')}
        </Button>
      </div>
    </Modal>
  )
}
