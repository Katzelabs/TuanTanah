import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { StyleGuide } from './StyleGuide.js'

/**
 * `/design` is the shared design-system reference — it is where the usage rules
 * for the scales in `tailwind.config.ts` are written down. A crash here would
 * silently take the reference away, so this smoke test just proves the page
 * mounts with every primitive on it (including the two that read stores,
 * `MoneyDelta` → `useRollAnim`) and that the documented rules are present.
 */
describe('StyleGuide', () => {
  it('renders every documented section', () => {
    render(
      <MemoryRouter>
        <StyleGuide />
      </MemoryRouter>,
    )
    for (const title of [
      'Breakpoints',
      'Accent semantics',
      'Type scale',
      'Borders & radius',
      'Elevation',
      'Buttons',
      'Cards',
      'Badges',
      'Tabs',
      'Tooltip',
      'Transient motion',
      'Overlays',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('documents the phone-portrait breakpoint and its landscape companion', () => {
    render(
      <MemoryRouter>
        <StyleGuide />
      </MemoryRouter>,
    )
    expect(screen.getByText('600px')).toBeInTheDocument()
    // `short` is the companion guard for a phone held sideways. It is easy to
    // mistake for a width step, so the page has to keep saying it isn't one.
    expect(screen.getByText('landscape ≤540px tall')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /short.*companion to.*hud/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /hud.*phone-portrait width guard/i }),
    ).toBeInTheDocument()
  })
})
