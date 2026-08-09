import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal.js'

describe('Modal', () => {
  it('closes on Escape when dismissable', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Outer">
        body
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ignores Escape when not dismissable', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Forced" dismissable={false}>
        body
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  // A confirm dialog rendered inside another modal must not dismiss both — the
  // sell confirmation sits on top of the tile modal exactly this way.
  it('Escape dismisses only the top-most modal when nested', async () => {
    const user = userEvent.setup()
    const onOuterClose = vi.fn()
    const onInnerClose = vi.fn()
    render(
      <Modal open onClose={onOuterClose} title="Outer">
        <Modal open onClose={onInnerClose} title="Inner">
          confirm
        </Modal>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onInnerClose).toHaveBeenCalledOnce()
    expect(onOuterClose).not.toHaveBeenCalled()
  })

  it('hands Escape back to the outer modal once the inner one closes', async () => {
    const user = userEvent.setup()
    const onOuterClose = vi.fn()

    function Nested() {
      const [innerOpen, setInnerOpen] = useState(true)
      return (
        <Modal open onClose={onOuterClose} title="Outer">
          <button onClick={() => setInnerOpen(false)}>close inner</button>
          <Modal open={innerOpen} onClose={() => setInnerOpen(false)} title="Inner">
            confirm
          </Modal>
        </Modal>
      )
    }
    render(<Nested />)

    await user.click(screen.getByRole('button', { name: 'close inner' }))
    // AnimatePresence keeps the closing modal mounted through its exit animation.
    await waitFor(() => expect(screen.queryByText('Inner')).not.toBeInTheDocument())
    await user.keyboard('{Escape}')
    expect(onOuterClose).toHaveBeenCalledOnce()
  })

  it('restores body scroll after the last modal closes', async () => {
    const user = userEvent.setup()

    function Nested() {
      const [innerOpen, setInnerOpen] = useState(true)
      const [outerOpen, setOuterOpen] = useState(true)
      return (
        <>
          <button onClick={() => setInnerOpen(false)}>close inner</button>
          <button onClick={() => setOuterOpen(false)}>close outer</button>
          <Modal open={outerOpen} onClose={() => setOuterOpen(false)} title="Outer">
            <Modal open={innerOpen} onClose={() => setInnerOpen(false)} title="Inner">
              confirm
            </Modal>
          </Modal>
        </>
      )
    }
    render(<Nested />)
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getByRole('button', { name: 'close inner' }))
    expect(document.body.style.overflow).toBe('hidden') // outer still open
    await user.click(screen.getByRole('button', { name: 'close outer' }))
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'))
  })
})
