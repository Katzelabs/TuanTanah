// The one-shot update card (ClickUp 86eyr3xvf). The ticket calls this "high
// impact, but easy to make annoying", and every test here is about the annoying
// half: it must never greet a first-time player, never appear twice for the same
// release, and always be dismissible for good.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP_VERSION } from '@tuan-tanah/shared'
import i18n from '@/i18n/index.js'
import { WhatsNew } from './WhatsNew.js'

const KEY = 'tuan-tanah:lastSeenVersion'

function renderCard() {
  return render(
    <MemoryRouter>
      <WhatsNew />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  window.localStorage.clear()
})

describe('WhatsNew', () => {
  it('shows nothing to a first-time player, and remembers them silently', () => {
    const { container } = renderCard()

    // They have missed nothing — a list of changes from before they arrived is
    // pure noise on someone's first visit.
    expect(container).toBeEmptyDOMElement()
    // But their version is now on record, so the NEXT release is the first thing
    // they hear about.
    expect(window.localStorage.getItem(KEY)).toBe(APP_VERSION)
  })

  it('shows nothing to someone already on this version', () => {
    window.localStorage.setItem(KEY, APP_VERSION)
    const { container } = renderCard()
    expect(container).toBeEmptyDOMElement()
  })

  it('tells a returning player what changed', () => {
    window.localStorage.setItem(KEY, '0.1.0')
    renderCard()
    expect(
      screen.getByText(new RegExp(`New in v${APP_VERSION.replace(/\./g, '\\.')}`)),
    ).toBeInTheDocument()
  })

  it('stays dismissed once dismissed', async () => {
    window.localStorage.setItem(KEY, '0.1.0')
    const user = userEvent.setup()
    const { container } = renderCard()

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(container).toBeEmptyDOMElement()
    // Recorded, not just hidden — a reload must not bring it back.
    expect(window.localStorage.getItem(KEY)).toBe(APP_VERSION)
  })

  it('survives a browser that blocks site data', () => {
    window.localStorage.setItem(KEY, '0.1.0')
    const getItem = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('blocked')
    }
    try {
      // The home page must still render. A dismissible card is not worth taking
      // the landing page down for.
      expect(() => renderCard()).not.toThrow()
    } finally {
      Storage.prototype.getItem = getItem
    }
  })
})
