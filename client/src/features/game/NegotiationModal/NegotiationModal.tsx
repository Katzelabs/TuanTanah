import {
  BOARD,
  type GameState,
  type NegotiationDeal,
  type NegotiationDealType,
  type TileId,
} from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { describeDeal } from '@/i18n/dealText.js'
import { tileName } from '@/i18n/gameData.js'
import { Button, Card, Modal } from '@/components/ui/index.js'
import { formatRupiah, useGame } from '@/store/gameStore.js'

const DEAL_TYPES: { type: NegotiationDealType; emoji: string }[] = [
  { type: 'property_swap', emoji: '🔄' },
  { type: 'cash_for_property', emoji: '🛒' },
  { type: 'sell_property', emoji: '💰' },
]

const JUTA = 1_000_000

function ownedTiles(state: GameState, playerId: string): { id: TileId; name: string }[] {
  return state.tiles
    .filter((t) => t.ownerId === playerId)
    .map((t) => ({ id: t.id, name: BOARD[t.id]!.name }))
}

const inputClass =
  'w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 text-sm outline-none transition focus:shadow-brutal-sm'
const labelClass = 'mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-faint'
const captionClass = 'mt-1 text-[11px] font-semibold text-ink-muted'
const warnClass = 'mt-1 text-[11px] font-semibold text-danger-strong'

export interface NegotiationPrefill {
  targetId?: string
  type?: NegotiationDealType
  requestTileId?: TileId
}

export function NegotiationModal({
  open,
  onClose,
  prefill,
}: {
  open: boolean
  onClose: () => void
  prefill?: NegotiationPrefill
}) {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const proposeDeal = useGame((s) => s.proposeDeal)

  const [targetId, setTargetId] = useState<string>(prefill?.targetId ?? '')
  const [type, setType] = useState<NegotiationDealType>(prefill?.type ?? 'property_swap')
  const [offerTileId, setOfferTileId] = useState<number | ''>('')
  const [requestTileId, setRequestTileId] = useState<number | ''>(prefill?.requestTileId ?? '')
  // Buy/sell price and swap top-up are separate so switching type never leaks values.
  const [priceJuta, setPriceJuta] = useState<number>(5)
  const [topupJuta, setTopupJuta] = useState<number>(0)
  const [topupFrom, setTopupFrom] = useState<'proposer' | 'target'>('proposer')

  if (!open || !state || !me) return null

  const targets = state.players.filter((p) => p.id !== me.id && !p.isEliminated)
  const target = targets.find((p) => p.id === targetId)
  const myTiles = ownedTiles(state, me.id)
  const targetTiles = targetId ? ownedTiles(state, targetId) : []

  const isSwap = type === 'property_swap'
  const isBuy = type === 'cash_for_property'
  const isSell = type === 'sell_property'
  const needsOffer = isSwap || isSell // my tile
  const needsRequest = isSwap || isBuy // their tile

  const price = Math.round(priceJuta * JUTA)
  const topup = Math.round(topupJuta * JUTA)

  // Affordability warnings (server re-validates; this is just friendly UX).
  const buyerBroke = isBuy && price > me.cash
  const sellerBroke = isSell && target != null && price > target.cash
  const topupPayerBroke =
    isSwap &&
    topup > 0 &&
    (topupFrom === 'proposer' ? topup > me.cash : target != null && topup > target.cash)

  const canPropose =
    targetId !== '' &&
    (!needsOffer || offerTileId !== '') &&
    (!needsRequest || requestTileId !== '') &&
    (isSwap ? topupJuta >= 0 : priceJuta > 0) &&
    !buyerBroke &&
    !sellerBroke &&
    !topupPayerBroke

  // Build the deal object that will be sent (also drives the live preview).
  const buildDeal = (): NegotiationDeal => ({
    id: '', // assigned server-side
    type,
    fromPlayerId: me.id,
    toPlayerId: targetId,
    status: 'pending',
    ...(needsOffer ? { offerTileId: offerTileId as TileId } : {}),
    ...(needsRequest ? { requestTileId: requestTileId as TileId } : {}),
    // Swap: only include a top-up when there's actually cash; buy/sell: the price.
    ...(isSwap && topupJuta > 0 ? { cashAmount: topup, cashFrom: topupFrom } : {}),
    ...(isBuy || isSell ? { cashAmount: price } : {}),
  })

  const submit = () => {
    proposeDeal(buildDeal())
    onClose()
  }

  const selectTile = (
    value: number | '',
    onChange: (v: number | '') => void,
    tiles: { id: TileId; name: string }[],
    placeholder: string,
    disabled = false,
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      disabled={disabled}
      className={`mt-1 ${inputClass} disabled:opacity-40`}
    >
      <option value="">{placeholder}</option>
      {tiles.map((tile) => (
        <option key={tile.id} value={tile.id}>
          {tileName(t, tile.id)}
        </option>
      ))}
    </select>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('negotiation.title')} size="sm">
      {/* 1 — Target player: clickable chips with token colours */}
      <div className={labelClass}>{t('negotiation.with')}</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {targets.map((p) => {
          const selected = p.id === targetId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setTargetId(p.id)
                setRequestTileId('')
              }}
              className={`inline-flex items-center gap-2 rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-bold transition ${
                selected
                  ? 'bg-accent text-ink shadow-brutal-sm'
                  : 'bg-surface hover:shadow-brutal-sm'
              }`}
            >
              <span
                className="h-3 w-3 rounded-full border-2 border-ink"
                style={{ background: p.color }}
              />
              {p.name}
            </button>
          )
        })}
      </div>

      {/* 2 — Deal type: one segmented row (tukar / beli / jual) */}
      <div className={labelClass}>{t('negotiation.dealType')}</div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {DEAL_TYPES.map(({ type: dt, emoji }) => (
          <Button
            key={dt}
            size="sm"
            variant={type === dt ? 'primary' : 'secondary'}
            onClick={() => setType(dt)}
          >
            {emoji} {t(`negotiation.typeShort.${dt}`)}
          </Button>
        ))}
      </div>
      <div className={captionClass}>{t(`negotiation.hints.${type}`)}</div>

      {/* 3 — Tiles */}
      {needsOffer && (
        <>
          <div className={labelClass}>
            {isSell ? t('negotiation.yourTileToSell') : t('negotiation.yourTileToGive')}
          </div>
          {selectTile(offerTileId, setOfferTileId, myTiles, t('negotiation.selectYourTile'))}
        </>
      )}
      {needsRequest && (
        <>
          <div className={labelClass}>{t('negotiation.theirTileWant')}</div>
          {selectTile(
            requestTileId,
            setRequestTileId,
            targetTiles,
            targetId ? t('negotiation.selectTheirTile') : t('negotiation.pickPlayerFirst'),
            !targetId,
          )}
        </>
      )}

      {/* 4 — Price (buy/sell) or optional cash top-up (swap) */}
      {(isBuy || isSell) && (
        <>
          <div className={labelClass}>
            {isBuy ? t('negotiation.buyPrice') : t('negotiation.sellPrice')}
          </div>
          <input
            type="number"
            min={1}
            value={priceJuta}
            onChange={(e) => setPriceJuta(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
          <div className={captionClass}>
            {t('negotiation.cashEquals', { amount: formatRupiah(price) })}
          </div>
          {buyerBroke && <div className={warnClass}>{t('negotiation.youCantAfford')}</div>}
          {sellerBroke && (
            <div className={warnClass}>
              {t('negotiation.theyCantAfford', { name: target?.name })}
            </div>
          )}
        </>
      )}
      {isSwap && (
        <>
          <div className={labelClass}>{t('negotiation.cashTopup')}</div>
          <input
            type="number"
            min={0}
            value={topupJuta}
            onChange={(e) => setTopupJuta(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
          {topupJuta > 0 && (
            <>
              <div className={captionClass}>
                {t('negotiation.cashEquals', { amount: formatRupiah(topup) })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={topupFrom === 'proposer' ? 'info' : 'secondary'}
                  onClick={() => setTopupFrom('proposer')}
                >
                  {t('negotiation.youAddCash')}
                </Button>
                <Button
                  size="sm"
                  variant={topupFrom === 'target' ? 'info' : 'secondary'}
                  onClick={() => setTopupFrom('target')}
                >
                  {t('negotiation.theyAddCash')}
                </Button>
              </div>
              {topupPayerBroke && (
                <div className={warnClass}>
                  {topupFrom === 'proposer'
                    ? t('negotiation.youCantAfford')
                    : t('negotiation.theyCantAfford', { name: target?.name })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Live preview — exactly what the target will see */}
      {canPropose && (
        <>
          <div className={labelClass}>{t('negotiation.preview', { name: target?.name ?? '' })}</div>
          <Card flat tone="sunken" className="mt-1 p-3 text-sm text-ink">
            {describeDeal(state, buildDeal(), t)}
          </Card>
        </>
      )}

      <Button block onClick={submit} disabled={!canPropose} className="mt-5">
        {t('negotiation.sendProposal')}
      </Button>
      <Button block variant="ghost" size="sm" onClick={onClose} className="mt-2">
        {t('negotiation.cancel')}
      </Button>
    </Modal>
  )
}
