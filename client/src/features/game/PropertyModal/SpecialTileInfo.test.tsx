import {
  BOARD,
  HUSTLE_CARDS,
  KEJADIAN_CARDS,
  type GameState,
  type Player,
  type TileState,
} from '@tuan-tanah/shared'
import { render, screen } from '@testing-library/react'
import { createInstance, type TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import id from '@/i18n/locales/id.json'
import { SpecialTileInfo } from './SpecialTileInfo.js'

/** A bare i18next instance (no React provider needed — `t` is passed as a prop). */
function makeT(lng: 'en' | 'id'): TFunction {
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

function makeState(tiles: TileState[] = makeTiles()): GameState {
  return { round: 2, tiles, kejadianDeck: ['a', 'b'], hustleDeck: ['c'] } as GameState
}

const ME = { id: 'p1', name: 'P1', role: 'sales', cash: 4_000_000 } as Player

// Every tile type that should get an explainer panel, plus the two that shouldn't
// (their own rent/development tables already cover them).
const EXPLAINED = [
  'go',
  'tax',
  'event',
  'hustle',
  'jail_visit',
  'jail_go',
  'buildable_land',
  'law_office',
  'vacation',
] as const
const UNEXPLAINED = ['property', 'transport'] as const

describe('SpecialTileInfo', () => {
  it.each(['en', 'id'] as const)('renders a panel for every explained tile type (%s)', (lng) => {
    const t = makeT(lng)
    const state = makeState()
    for (const type of EXPLAINED) {
      const def = BOARD.find((d) => d.type === type)
      expect(def, `no ${type} tile on the board`).toBeDefined()
      const { unmount } = render(
        <SpecialTileInfo def={def!} tile={state.tiles[def!.id]!} state={state} me={ME} t={t} />,
      )
      expect(screen.getByText(t('tileInfo.heading'))).toBeInTheDocument()
      unmount()
    }
  })

  it('renders nothing for property and transport tiles', () => {
    const state = makeState()
    for (const type of UNEXPLAINED) {
      const def = BOARD.find((d) => d.type === type)!
      const { container, unmount } = render(
        <SpecialTileInfo
          def={def}
          tile={state.tiles[def.id]!}
          state={state}
          me={ME}
          t={makeT('en')}
        />,
      )
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })

  it('previews the income tax the viewer would owe right now', () => {
    const def = BOARD.find((d) => d.type === 'tax' && d.taxBasis === 'cash')!
    const state = makeState()
    render(
      <SpecialTileInfo
        def={def}
        tile={state.tiles[def.id]!}
        state={state}
        me={ME}
        t={makeT('en')}
      />,
    )
    // 11% of Rp 4jt cash on hand, no role discount for Sales.
    expect(screen.getByText('Rp 440.000')).toBeInTheDocument()
    expect(screen.getByText('11% of cash on hand')).toBeInTheDocument()
  })

  it('shows dashes instead of a preview when there is no viewing player', () => {
    const def = BOARD.find((d) => d.type === 'go')!
    const state = makeState()
    render(
      <SpecialTileInfo
        def={def}
        tile={state.tiles[def.id]!}
        state={state}
        me={null}
        t={makeT('en')}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('only pitches the asking price of empty land while it is unowned', () => {
    const t = makeT('en')
    const def = BOARD.find((d) => d.type === 'buildable_land')!
    const tiles = makeTiles()
    const { unmount } = render(
      <SpecialTileInfo def={def} tile={tiles[def.id]!} state={makeState(tiles)} me={ME} t={t} />,
    )
    expect(screen.getByText(t('tileInfo.land.desc', { price: 'Rp 1.500.000' }))).toBeInTheDocument()
    unmount()

    tiles[def.id]!.ownerId = 'p2'
    render(
      <SpecialTileInfo def={def} tile={tiles[def.id]!} state={makeState(tiles)} me={ME} t={t} />,
    )
    expect(screen.getByText(t('tileInfo.land.descOwned'))).toBeInTheDocument()
  })

  it('reports how many cards are left in each deck', () => {
    const t = makeT('en')
    const state = makeState()
    const event = BOARD.find((d) => d.type === 'event')!
    const { unmount } = render(
      <SpecialTileInfo def={event} tile={state.tiles[event.id]!} state={state} me={ME} t={t} />,
    )
    expect(screen.getByText(`2 of ${KEJADIAN_CARDS.length} cards left`)).toBeInTheDocument()
    unmount()
    const hustle = BOARD.find((d) => d.type === 'hustle')!
    render(
      <SpecialTileInfo def={hustle} tile={state.tiles[hustle.id]!} state={state} me={ME} t={t} />,
    )
    expect(screen.getByText(`1 of ${HUSTLE_CARDS.length} cards left`)).toBeInTheDocument()
  })
})
