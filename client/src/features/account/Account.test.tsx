// The account page (ClickUp 86ey2z15r). The auth store is subtask B's and is
// still a declaration-only seam, so it is mocked here — this exercises the
// behaviour D owns: the guest bounce, the rename round-trip, and that deleting
// is gated behind an explicit confirmation.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@tuan-tanah/shared'
import type { AuthState } from '@/features/auth/index.js'
import i18n from '@/i18n/index.js'
import { Account } from './Account.js'

const USER: AuthUser = {
  id: 'user-1',
  displayName: 'Budi',
  avatarUrl: null,
  friendCode: 'TT-4KQ2',
  createdAt: '2026-08-01T00:00:00.000Z',
  email: 'budi@example.com',
}

const signOut = vi.fn(() => Promise.resolve())
const refresh = vi.fn(() => Promise.resolve())
let authState: AuthState

vi.mock('./authSeam.js', () => ({
  useAuthState: <T,>(selector: (s: AuthState) => T) => selector(authState),
}))

const updateDisplayName = vi.fn()
const deleteAccount = vi.fn()
vi.mock('./api.js', () => ({
  updateDisplayName: (name: string) => updateDisplayName(name) as unknown,
  deleteAccount: () => deleteAccount() as unknown,
}))

function renderAccount() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<Account />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  // The app defaults to Indonesian; assert against the English copy so the
  // expectations read as the strings a reviewer can find in en.json.
  await i18n.changeLanguage('en')
  authState = { user: USER, loading: false, enabled: true, signIn: vi.fn(), signOut, refresh }
  updateDisplayName.mockResolvedValue({ ok: true, value: USER })
  deleteAccount.mockResolvedValue({ ok: true, value: null })
})

describe('Account', () => {
  it('bounces a guest home rather than showing a login wall', () => {
    authState = { ...authState, user: null }
    renderAccount()
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  // The redirect must wait for the session probe, or a signed-in player who
  // opens /account directly is thrown home before their session resolves.
  it('waits for the session to settle before deciding', () => {
    authState = { ...authState, user: null, loading: true }
    renderAccount()
    expect(screen.queryByText('home')).not.toBeInTheDocument()
  })

  it('shows the friend code and the connected Google account read-only', () => {
    renderAccount()
    expect(screen.getByText('TT-4KQ2')).toBeInTheDocument()
    expect(screen.getByText('budi@example.com')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
  })

  it('saves a changed display name and re-reads the session', async () => {
    const user = userEvent.setup()
    updateDisplayName.mockResolvedValue({ ok: true, value: { ...USER, displayName: 'Budi Baru' } })
    renderAccount()

    const input = screen.getByLabelText(/display name/i)
    const save = screen.getByRole('button', { name: /^save$/i })
    // Nothing to save until the name actually changes.
    expect(save).toBeDisabled()

    await user.clear(input)
    await user.type(input, 'Budi Baru')
    expect(save).toBeEnabled()
    await user.click(save)

    expect(updateDisplayName).toHaveBeenCalledWith('Budi Baru')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('surfaces a rejected name as a localised message and keeps the draft', async () => {
    const user = userEvent.setup()
    updateDisplayName.mockResolvedValue({ ok: false, error: 'invalid_name' })
    renderAccount()

    await user.clear(screen.getByLabelText(/display name/i))
    await user.type(screen.getByLabelText(/display name/i), 'x')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/1–20 characters/)
    expect(screen.getByLabelText(/display name/i)).toHaveValue('x')
  })

  it('signs out and returns home', async () => {
    const user = userEvent.setup()
    renderAccount()

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(signOut).toHaveBeenCalledOnce()
    expect(await screen.findByText('home')).toBeInTheDocument()
  })

  it('never deletes on the first click — the confirmation is the gate', async () => {
    const user = userEvent.setup()
    renderAccount()

    await user.click(screen.getByRole('button', { name: /^delete account$/i }))
    expect(deleteAccount).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: /yes, delete it/i }))
    expect(deleteAccount).toHaveBeenCalledOnce()
    expect(await screen.findByText('home')).toBeInTheDocument()
  })

  // A failed delete that closed the dialog would read as "it worked".
  it('keeps the confirmation open when the delete fails', async () => {
    const user = userEvent.setup()
    deleteAccount.mockResolvedValue({ ok: false, error: 'unavailable' })
    renderAccount()

    await user.click(screen.getByRole('button', { name: /^delete account$/i }))
    await user.click(await screen.findByRole('button', { name: /yes, delete it/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, delete it/i })).toBeInTheDocument()
    expect(screen.queryByText('home')).not.toBeInTheDocument()
  })
})
