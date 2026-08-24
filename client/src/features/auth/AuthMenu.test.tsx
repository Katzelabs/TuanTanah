import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance, type i18n as I18n } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@tuan-tanah/shared'
import en from '@/i18n/locales/en.json'
import { AuthMenu } from './AuthMenu.js'
import { useAuth } from './authStore.js'

const USER: AuthUser = {
  id: 'u1',
  displayName: 'Sri Mulyani',
  avatarUrl: null,
  friendCode: 'ABC123',
  createdAt: '2026-08-01T00:00:00.000Z',
  email: 'sri@example.com',
}

function makeI18n(): I18n {
  const instance = createInstance()
  void instance.use(initReactI18next).init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  })
  return instance
}

function renderMenu() {
  return render(
    <I18nextProvider i18n={makeI18n()}>
      <MemoryRouter>
        <AuthMenu />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

beforeEach(() => {
  useAuth.setState({ user: null, loading: false, enabled: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AuthMenu', () => {
  // The load-bearing guarantee of the ticket: a guest on a build without
  // accounts sees no change anywhere.
  it('renders nothing when accounts are disabled', () => {
    useAuth.setState({ enabled: false })
    const { container } = renderMenu()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing until the session settles', () => {
    useAuth.setState({ loading: true })
    const { container } = renderMenu()
    expect(container).toBeEmptyDOMElement()
  })

  it('offers sign-in to a guest', () => {
    renderMenu()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows the account chip and its menu once signed in', async () => {
    const user = userEvent.setup()
    useAuth.setState({ user: USER })
    renderMenu()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /account menu/i }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText(USER.email)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /account settings/i })).toBeInTheDocument()
  })

  it('closes the menu on Escape', async () => {
    const user = userEvent.setup()
    useAuth.setState({ user: USER })
    renderMenu()

    await user.click(screen.getByRole('button', { name: /account menu/i }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('signs out through the server and drops back to guest', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    useAuth.setState({ user: USER })
    renderMenu()

    await user.click(screen.getByRole('button', { name: /account menu/i }))
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(useAuth.getState().user).toBeNull()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })
})
