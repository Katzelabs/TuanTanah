// The page has four states and only one of them is a list of games — the other
// three (guest, empty, failed) are what a player actually sees first, and they
// are easy to collapse into one another by accident.
import type { MatchHistoryEntry } from '@tuan-tanah/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en.json'
import id from '@/i18n/locales/id.json'
import { MatchHistory } from './MatchHistory.js'

function makeI18n(lng: 'en' | 'id' = 'en') {
  const i18n = createInstance()
  void i18n.init({
    lng,
    resources: { en: { translation: en }, id: { translation: id } },
    interpolation: { escapeValue: false },
  })
  return i18n
}

/** Only the three fields `api.ts` reads, so the test doesn't depend on `Response`. */
function stubFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(lng: 'en' | 'id' = 'en') {
  render(
    <I18nextProvider i18n={makeI18n(lng)}>
      <MemoryRouter>
        <MatchHistory />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

const GAME: MatchHistoryEntry = {
  gameId: 1,
  playedAt: '2026-08-24T10:00:00.000Z',
  role: 'pengusaha',
  finalWealth: 12_000_000,
  eliminated: false,
  won: true,
  playerCount: 4,
}

afterEach(() => vi.unstubAllGlobals())

describe('MatchHistory', () => {
  it('tells a guest why there is nothing to show instead of showing an empty list', async () => {
    stubFetch(401)
    renderPage()
    expect(await screen.findByText('Sign in to keep a match history')).toBeInTheDocument()
    expect(screen.queryByText('No finished games yet')).not.toBeInTheDocument()
  })

  it('separates "signed in, played nothing" from "signed out"', async () => {
    stubFetch(200, { games: [] })
    renderPage()
    expect(await screen.findByText('No finished games yet')).toBeInTheDocument()
    expect(screen.queryByText('Sign in to keep a match history')).not.toBeInTheDocument()
  })

  it('renders a game with its outcome, role, wealth and player count', async () => {
    stubFetch(200, { games: [GAME] })
    renderPage()
    expect(await screen.findByText('Won')).toBeInTheDocument()
    // Localized through the game-data overlay, not the raw constant.
    expect(screen.getByText('Entrepreneur')).toBeInTheDocument()
    expect(screen.getByText('Rp 12.000.000')).toBeInTheDocument()
    expect(screen.getByText(/4 players/)).toBeInTheDocument()
  })

  it('calls out the difference between losing and being eliminated', async () => {
    stubFetch(200, { games: [{ ...GAME, won: false, eliminated: true }] })
    renderPage()
    expect(await screen.findByText('Eliminated')).toBeInTheDocument()

    vi.unstubAllGlobals()
    stubFetch(200, { games: [{ ...GAME, won: false, eliminated: false }] })
    renderPage()
    expect(await screen.findByText('Lost')).toBeInTheDocument()
  })

  it('offers a retry when the request fails, rather than an empty history', async () => {
    const fetchMock = stubFetch(500)
    renderPage()
    expect(await screen.findByText("Couldn't load your match history")).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renders in the viewer language', async () => {
    stubFetch(200, { games: [GAME] })
    renderPage('id')
    expect(await screen.findByText('Menang')).toBeInTheDocument()
    expect(screen.getByText('Pengusaha')).toBeInTheDocument()
  })
})
