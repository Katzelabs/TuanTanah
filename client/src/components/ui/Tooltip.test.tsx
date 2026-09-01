// The long-press path, which is the only way a tooltip is reachable on a phone —
// where most of this game is played. The contract worth pinning: holding
// explains the button, and the hold must NOT also press it.
import { render, screen } from '@testing-library/react'
import { fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Tooltip } from './Tooltip.js'

/** Touch events land on the wrapper; the click that follows lands on the button
 *  and bubbles back up through it — which is exactly the path being tested. */
const press = (wrapper: HTMLElement) => fireEvent.touchStart(wrapper)
const release = (wrapper: HTMLElement, button: HTMLElement) => {
  fireEvent.touchEnd(wrapper)
  fireEvent.click(button)
}

describe('Tooltip', () => {
  it('renders the trigger alone when there is nothing to say', () => {
    render(
      <Tooltip content="">
        <button type="button">roll</button>
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.getByRole('button', { name: 'roll' })).toBeInTheDocument()
  })

  it('opens on hover and closes on leave', async () => {
    render(
      <Tooltip content="what this does">
        <button type="button">roll</button>
      </Tooltip>,
    )
    const wrapper = screen.getByRole('button', { name: 'roll' }).parentElement!

    fireEvent.mouseEnter(wrapper)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('what this does')

    fireEvent.mouseLeave(wrapper)
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })

  it('opens on a long press and swallows the click it would have fired', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onClick = vi.fn()
    render(
      <Tooltip content="what this does">
        <button type="button" onClick={onClick}>
          roll
        </button>
      </Tooltip>,
    )
    const button = screen.getByRole('button', { name: 'roll' })
    const wrapper = button.parentElement!

    press(wrapper)
    await vi.advanceTimersByTimeAsync(500)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('what this does')

    release(wrapper, button)
    // The whole point: reading what a button does must not spend the action.
    expect(onClick).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('lets a normal tap through untouched', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onClick = vi.fn()
    render(
      <Tooltip content="what this does">
        <button type="button" onClick={onClick}>
          roll
        </button>
      </Tooltip>,
    )
    const button = screen.getByRole('button', { name: 'roll' })
    const wrapper = button.parentElement!

    press(wrapper)
    await vi.advanceTimersByTimeAsync(100)
    release(wrapper, button)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('tooltip')).toBeNull()
    vi.useRealTimers()
  })
})
