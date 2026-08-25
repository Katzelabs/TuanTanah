// The shared corner cluster (Phase 2.A). What's worth pinning down here is the
// collapse contract Home and the Lobby both build on: overflow items exist
// exactly ONCE in the DOM (so a stateful control put in there isn't mounted
// twice), and the toggle only exists when there is something to collapse.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/index.js'
import { ControlCluster } from './ControlCluster.js'

const toggleOf = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('[aria-haspopup="true"]')

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

describe('ControlCluster', () => {
  it('renders overflow items exactly once', () => {
    render(
      <ControlCluster overflow={<button type="button">sound</button>}>
        <button type="button">account</button>
      </ControlCluster>,
    )
    // getBy* throws on more than one match — that's the assertion.
    expect(screen.getByRole('button', { name: 'sound' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'account' })).toBeInTheDocument()
  })

  it('has no overflow toggle when nothing is collapsible', () => {
    const { container } = render(
      <ControlCluster>
        <button type="button">account</button>
      </ControlCluster>,
    )
    expect(toggleOf(container)).toBeNull()
  })

  it('toggles the overflow panel and closes it on Escape', async () => {
    const user = userEvent.setup()
    const { container } = render(<ControlCluster overflow={<button type="button">sound</button>} />)

    const toggle = toggleOf(container)
    expect(toggle).not.toBeNull()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle!)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('pins itself to the corner only when asked to float', () => {
    const { container, rerender } = render(<ControlCluster placement="floating" />)
    expect(container.firstElementChild).toHaveClass('absolute')

    rerender(<ControlCluster />)
    expect(container.firstElementChild).not.toHaveClass('absolute')
  })
})
