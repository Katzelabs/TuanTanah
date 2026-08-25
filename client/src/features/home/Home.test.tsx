// Home's redesign (Phase 2.A) is visual, so these tests guard the behaviour
// underneath it that must survive a reskin: the guest nickname path, the
// account-name prefill, the post-create `{ created: true }` handoff the lobby's
// invite sheet keys off, and "no room actions until the socket is up".
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@tuan-tanah/shared'
import i18n from '@/i18n/index.js'
import { useAuth } from '@/features/auth/index.js'
import { useGame } from '@/store/gameStore.js'
import { Home } from './Home.js'

// The page mounts FriendsButton (which wires socket listeners) and the game
// store; neither should open a real connection under jsdom.
vi.mock('@/socket.js', () => {
  const stub = {
    on: () => {},
    off: () => {},
    emit: () => {},
    connected: false,
    id: 'test-socket',
  }
  return {
    socket: stub,
    getActiveSocket: () => stub,
    createSocket: () => stub,
    setActiveSocket: () => {},
  }
})

const USER: AuthUser = {
  id: 'user-1',
  displayName: 'Sri Mulyani',
  avatarUrl: null,
  friendCode: 'TT-4KQ2',
  createdAt: '2026-08-01T00:00:00.000Z',
  email: 'sri@example.com',
}

const join = vi.fn()

/** Echoes the router state the room route was handed, so the flag is assertable. */
function RoomProbe() {
  const location = useLocation()
  const created = (location.state as { created?: boolean } | null)?.created
  return <p>room:{String(created)}</p>
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<RoomProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Runs the `onJoined` callback the page handed the store, as the store would. */
function landInRoom(roomId: string) {
  const onJoined = join.mock.calls[0]?.[2] as ((id: string) => void) | undefined
  expect(onJoined).toBeTypeOf('function')
  act(() => onJoined!(roomId))
}

const createButton = () => screen.getByRole('button', { name: /create new room/i })
const nameField = () => screen.getByLabelText(/your name/i)

beforeEach(async () => {
  await i18n.changeLanguage('en')
  join.mockClear()
  useAuth.setState({ user: null, loading: false, enabled: true })
  useGame.setState({ connected: true, joining: false, join })
})

describe('Home', () => {
  it('creates a room under a typed guest name and flags the create for the lobby', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.type(nameField(), 'Budi')
    await user.click(createButton())

    expect(join).toHaveBeenCalledWith('Budi', undefined, expect.any(Function))
    landInRoom('AB12CD')
    expect(screen.getByText('room:true')).toBeInTheDocument()
  })

  it('joins by code without the created flag', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.type(nameField(), 'Budi')
    await user.type(screen.getByPlaceholderText(/room code/i), 'ab12cd')
    await user.click(screen.getByRole('button', { name: /^join$/i }))

    expect(join).toHaveBeenCalledWith('Budi', 'AB12CD', expect.any(Function))
    landInRoom('AB12CD')
    expect(screen.getByText('room:undefined')).toBeInTheDocument()
  })

  it('keeps both room actions disabled until the socket connects', async () => {
    const user = userEvent.setup()
    useGame.setState({ connected: false })
    renderHome()

    await user.type(nameField(), 'Budi')
    await user.type(screen.getByPlaceholderText(/room code/i), 'AB12CD')

    expect(createButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: /^join$/i })).toBeDisabled()
  })

  it('prefills the signed-in account name but leaves it editable', async () => {
    const user = userEvent.setup()
    useAuth.setState({ user: USER })
    renderHome()

    expect(nameField()).toHaveValue('Sri Mulyani')

    await user.clear(nameField())
    await user.type(nameField(), 'Bu Sri')
    await user.click(createButton())

    expect(join).toHaveBeenCalledWith('Bu Sri', undefined, expect.any(Function))
  })

  it('offers guests the sign-in pitch and signed-in players their account entry points', () => {
    const { container, unmount } = renderHome()
    // Exactly one sign-in call to action — getByRole throws on a second.
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    expect(container.querySelector('a[href="/history"]')).toBeNull()
    unmount()

    useAuth.setState({ user: USER })
    const signedIn = renderHome()
    expect(signedIn.container.querySelector('a[href="/history"]')).not.toBeNull()
    expect(signedIn.container.querySelector('a[href="/account"]')).not.toBeNull()
  })

  it('shows no account surface at all on a build with accounts switched off', () => {
    useAuth.setState({ enabled: false })
    const { container } = renderHome()

    expect(screen.queryByRole('button', { name: /sign in with google/i })).toBeNull()
    expect(container.querySelector('a[href="/account"]')).toBeNull()
    // The guest path itself must still work.
    expect(createButton()).toBeInTheDocument()
  })
})
