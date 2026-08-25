import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { HudDrawer } from './HudDrawer.js'

/**
 * The drawer's gesture layer can't be exercised in jsdom (no real pointer
 * velocity), so these cover the part that has to work without it: the handle is
 * a real disclosure button, and the two automatic behaviours — nudge open when
 * the player must act, hold shut while the board needs to be tappable.
 */
describe('HudDrawer', () => {
  it('starts closed and toggles on the handle', async () => {
    const user = userEvent.setup()
    render(
      <HudDrawer title="Waiting for Budi…">
        <p>panel body</p>
      </HudDrawer>,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Waiting for Budi…')).toBeInTheDocument()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens itself on the rising edge of demandsAttention, and stays put after', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [turn, setTurn] = useState(false)
      return (
        <>
          <button onClick={() => setTurn((v) => !v)}>toggle turn</button>
          <HudDrawer title="t" demandsAttention={turn}>
            body
          </HudDrawer>
        </>
      )
    }
    render(<Harness />)
    const drawer = screen.getAllByRole('button')[1]!
    expect(drawer).toHaveAttribute('aria-expanded', 'false')

    // Turn starts → the drawer nudges itself open.
    await user.click(screen.getByText('toggle turn'))
    expect(drawer).toHaveAttribute('aria-expanded', 'true')

    // Player closes it mid-turn; it must not spring back while the turn is live.
    await user.click(drawer)
    expect(drawer).toHaveAttribute('aria-expanded', 'false')
  })

  it('holds shut while the board has to be tappable, then restores', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [targeting, setTargeting] = useState(false)
      return (
        <>
          <button onClick={() => setTargeting((v) => !v)}>toggle targeting</button>
          <HudDrawer title="t" yieldToBoard={targeting}>
            body
          </HudDrawer>
        </>
      )
    }
    render(<Harness />)
    const drawer = screen.getAllByRole('button')[1]!

    await user.click(drawer)
    expect(drawer).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByText('toggle targeting'))
    expect(drawer).toHaveAttribute('aria-expanded', 'false')

    // Targeting resolved — the player gets their drawer back, not a closed one.
    await user.click(screen.getByText('toggle targeting'))
    expect(drawer).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders its children so the panel content is reachable', () => {
    render(
      <HudDrawer title="t">
        <p>player panel</p>
      </HudDrawer>,
    )
    expect(screen.getByText('player panel')).toBeInTheDocument()
  })
})
