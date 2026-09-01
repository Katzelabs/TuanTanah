// What matters about the rules page isn't its wording — that will churn — but
// that it stays *true*. Every number in it is interpolated from the `shared`
// constants, and these tests are what stops someone quietly hardcoding one back
// in when the copy gets edited.
import { JAIL_EXIT_COST, MAX_PLAYERS, META_ACTIONS_PER_LAP } from '@tuan-tanah/shared'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/index.js'
import { formatRupiah } from '@/store/gameStore.js'
import { HelpContent } from './HelpContent.js'
import { HelpModal } from './HelpModal.js'
import { HelpButton } from './HelpButton.js'
import { useHelp } from './helpStore.js'

beforeEach(async () => {
  await i18n.changeLanguage('en')
  useHelp.setState({ open: false })
})

describe('HelpContent', () => {
  it('quotes the live engine constants rather than hardcoded numbers', () => {
    render(<HelpContent />)
    const text = document.body.textContent ?? ''
    expect(text).toContain(String(MAX_PLAYERS))
    expect(text).toContain(String(META_ACTIONS_PER_LAP))
    expect(text).toContain(formatRupiah(JAIL_EXIT_COST))
  })

  it('has no untranslated keys left in it', () => {
    render(<HelpContent />)
    // A missing key renders as its own path, which is the one string that must
    // never appear on a page whose entire job is being readable.
    expect(document.body.textContent ?? '').not.toMatch(/help\./)
  })

  it('walks the turn one step at a time, with the control for each', async () => {
    const user = userEvent.setup()
    render(<HelpContent />)

    // Step 1 only — the point of a stepper is that the rest isn't shown yet.
    expect(screen.getByText(new RegExp(i18n.t('game.rollDice')))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('game.endTurn'))).toBeNull()

    const next = screen.getByRole('button', { name: i18n.t('help.turn.next') })
    await user.click(next)
    await user.click(next)
    // Step 3 renders the real MetaActionBar, so its own labels show up.
    expect(await screen.findByText(i18n.t('meta.hustle'))).toBeInTheDocument()

    await user.click(next)
    expect(await screen.findByText(i18n.t('game.endTurn'))).toBeInTheDocument()
  })

  it('lets you jump straight to a step, and stops at both ends', async () => {
    const user = userEvent.setup()
    render(<HelpContent />)

    const back = screen.getByRole('button', { name: i18n.t('help.turn.back') })
    // Nothing before the first step, so there's nowhere to go back to.
    expect(back).toBeDisabled()

    // Someone returning to check one step shouldn't have to click through.
    await user.click(screen.getByRole('button', { name: i18n.t('help.turn.goTo', { current: 4 }) }))
    expect(await screen.findByText(i18n.t('game.endTurn'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: i18n.t('help.turn.next') })).toBeDisabled()
    expect(back).toBeEnabled()
  })

  it('keeps the examples inert and out of the accessibility tree', async () => {
    const user = userEvent.setup()
    render(<HelpContent />)

    // A demo looks exactly like the live control, so tapping one must do
    // nothing, and a screen reader must not meet a button that goes nowhere.
    const demo = document.querySelector('[data-demo]')!
    expect(demo).toHaveClass('pointer-events-none')
    expect(demo).toHaveAttribute('aria-hidden', 'true')

    // The only real buttons on the page are the stepper's own controls.
    const names = screen.queryAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).not.toContain(null)

    // `pointer-events-none` is CSS-only in jsdom, so press one anyway.
    await user.click(screen.getByText(new RegExp(i18n.t('game.rollDice'))))
    expect(screen.getByText(i18n.t('help.turn.title'))).toBeInTheDocument()
  })

  it('renders the board legend from the real board data', () => {
    render(<HelpContent />)
    // Labels come from `tileInfo.type`, the same strings the tile modal uses.
    expect(screen.getByText(i18n.t('tileInfo.type.law_office'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('tileInfo.type.jail_go'))).toBeInTheDocument()
  })

  it('localizes with the viewer, like the rest of the client', async () => {
    const { unmount } = render(<HelpContent />)
    const english = document.body.textContent ?? ''
    unmount()

    await i18n.changeLanguage('id')
    render(<HelpContent />)
    expect(document.body.textContent).not.toEqual(english)
    expect(document.body.textContent ?? '').not.toMatch(/help\./)
  })
})

describe('HelpModal', () => {
  it('stays closed until something opens it, then closes again', async () => {
    const user = userEvent.setup()
    render(
      <>
        <HelpButton />
        <HelpModal />
      </>,
    )

    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: i18n.t('help.open') }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    // The panel animates out, so it outlives the click by a frame.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
