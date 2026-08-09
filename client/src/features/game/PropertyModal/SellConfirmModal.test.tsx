import {
  BOARD,
  REGIONS,
  SELL_REFUND_RATE,
  TRANSPORT_RENT,
  type GameState,
  type TileState,
} from '@tuan-tanah/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance, type TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en.json'
import id from '@/i18n/locales/id.json'
import { SellConfirmModal } from './SellConfirmModal.js'
import { tileValue } from '@/features/game/lib/tileValue.js'

function makeT(lng: 'en' | 'id' = 'en'): TFunction {
  const i18n = createInstance()
  void i18n.init({
    lng,
    resources: { en: { translation: en }, id: { translation: id } },
    interpolation: { escapeValue: false },
  })
  return i18n.t
}

function makeTiles(): TileState[] {
  return BOARD.map((t) => ({
    id: t.id,
    ownerId: null,
    track: null,
    tier: 0,
    builderId: null,
    landBuild: null,
    priceMultiplier: 1,
  }))
}

function makeState(tiles: TileState[]): GameState {
  return { round: 1, tiles } as GameState
}

/** Renders the dialog for `tileId` with the refund the modal would pass in. */
function renderFor(tiles: TileState[], tileId: number, t = makeT()) {
  const state = makeState(tiles)
  const tile = tiles[tileId]!
  const refund = Math.round(tileValue(tile, tiles) * SELL_REFUND_RATE)
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <SellConfirmModal
      tileId={tileId}
      tile={tile}
      state={state}
      refund={refund}
      open
      onConfirm={onConfirm}
      onCancel={onCancel}
      t={t}
    />,
  )
  return { onConfirm, onCancel, refund }
}

const YOGYA = REGIONS.yogyakarta.tileIds // three property tiles
const TRANSPORTS = BOARD.filter((d) => d.type === 'transport').map((d) => d.id)

describe('SellConfirmModal', () => {
  it('shows the refund and warns about nothing extra for a bare tile', () => {
    const tiles = makeTiles()
    tiles[YOGYA[0]!]!.ownerId = 'p1'
    const { refund } = renderFor(tiles, YOGYA[0]!)
    // Refund is 70% of the region buy price, shown in the breakdown card.
    expect(refund).toBe(Math.round(REGIONS.yogyakarta.buyPrice * SELL_REFUND_RATE))
    expect(
      screen.getAllByText(`Rp ${refund.toLocaleString('id-ID')}`).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('You also give up')).not.toBeInTheDocument()
  })

  it('warns that built tiers are torn down', () => {
    const tiles = makeTiles()
    const tile = tiles[YOGYA[0]!]!
    tile.ownerId = 'p1'
    tile.track = 'property'
    tile.tier = 3
    renderFor(tiles, YOGYA[0]!)
    expect(screen.getByText('You also give up')).toBeInTheDocument()
    expect(screen.getByText(/every tier you built is torn down/)).toBeInTheDocument()
  })

  it('warns about a Law Office price boost', () => {
    const tiles = makeTiles()
    tiles[YOGYA[0]!]!.ownerId = 'p1'
    tiles[YOGYA[0]!]!.priceMultiplier = 3
    renderFor(tiles, YOGYA[0]!)
    expect(screen.getByText(/×3 price boost/)).toBeInTheDocument()
  })

  it('warns that selling breaks a full-region set', () => {
    const tiles = makeTiles()
    for (const id of YOGYA) tiles[id]!.ownerId = 'p1'
    renderFor(tiles, YOGYA[0]!)
    expect(screen.getByText(/set bonus/)).toBeInTheDocument()
  })

  it('does not claim a set bonus when the region is only partly owned', () => {
    const tiles = makeTiles()
    tiles[YOGYA[0]!]!.ownerId = 'p1'
    tiles[YOGYA[1]!]!.ownerId = 'p1' // third tile still unowned
    renderFor(tiles, YOGYA[0]!)
    expect(screen.queryByText(/set bonus/)).not.toBeInTheDocument()
  })

  it('quotes the transport rung the other transports fall to', () => {
    const tiles = makeTiles()
    for (const id of TRANSPORTS.slice(0, 3)) tiles[id]!.ownerId = 'p1'
    renderFor(tiles, TRANSPORTS[0]!)
    // 3 owned → selling one leaves 2, dropping rent from the 3-rung to the 2-rung.
    const before = TRANSPORT_RENT[3]!.toLocaleString('id-ID')
    const after = TRANSPORT_RENT[2]!.toLocaleString('id-ID')
    expect(screen.getByText(new RegExp(`${before}.*${after}`))).toBeInTheDocument()
  })

  it('does not mention the transport ladder when it is the only transport owned', () => {
    const tiles = makeTiles()
    tiles[TRANSPORTS[0]!]!.ownerId = 'p1'
    renderFor(tiles, TRANSPORTS[0]!)
    expect(screen.queryByText(/transport ladder/)).not.toBeInTheDocument()
  })

  it('fires onConfirm only when the confirm button is pressed', async () => {
    const user = userEvent.setup()
    const tiles = makeTiles()
    tiles[YOGYA[0]!]!.ownerId = 'p1'
    const { onConfirm, onCancel } = renderFor(tiles, YOGYA[0]!)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm sell' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('renders in Indonesian too', () => {
    const tiles = makeTiles()
    tiles[YOGYA[0]!]!.ownerId = 'p1'
    tiles[YOGYA[0]!]!.priceMultiplier = 2
    renderFor(tiles, YOGYA[0]!, makeT('id'))
    expect(screen.getByText('Kamu juga kehilangan')).toBeInTheDocument()
    expect(screen.getByText(/Pengali harga ×2/)).toBeInTheDocument()
  })
})
