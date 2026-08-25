import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/index.js'
import { useAuth } from '@/features/auth/index.js'
import { FriendsButton } from './FriendsButton.js'
import { useFriends } from './friendsStore.js'

// The button owns the friends store's `init()`, which wires socket listeners.
// Nothing here should open a real connection under jsdom.
vi.mock('@/socket.js', () => {
  const stub = { on: () => {}, off: () => {}, emit: () => {}, connected: false, id: 'test-socket' }
  return {
    socket: stub,
    getActiveSocket: () => stub,
    createSocket: () => stub,
    setActiveSocket: () => {},
  }
})

const init = vi.fn()

beforeEach(async () => {
  await i18n.changeLanguage('en')
  init.mockClear()
  useFriends.setState({ friends: [], latestRequest: null, init })
})

/**
 * A build with accounts switched off must show no trace of the accounts feature
 * set — the same rule `AuthMenu` follows. A friends icon that opens a panel for
 * something the server cannot do is worse than no icon, and bringing up the
 * friends socket listeners on such a build is pure waste.
 */
describe('FriendsButton', () => {
  it('renders nothing and wires no listeners when accounts are disabled', () => {
    useAuth.setState({ user: null, loading: false, enabled: false })
    render(<FriendsButton />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(init).not.toHaveBeenCalled()
  })

  it('renders nothing while the session is still loading', () => {
    useAuth.setState({ user: null, loading: true, enabled: false })
    render(<FriendsButton />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders and wires listeners once accounts are enabled', () => {
    useAuth.setState({ user: null, loading: false, enabled: true })
    render(<FriendsButton />)
    expect(screen.getByRole('button', { name: /friends/i })).toBeInTheDocument()
    expect(init).toHaveBeenCalled()
  })

  it('still shows for a signed-out guest on a build that has accounts', () => {
    // The guest case is deliberately different from the disabled case: the
    // panel is what tells them to sign in, so the control has to exist.
    useAuth.setState({ user: null, loading: false, enabled: true })
    render(<FriendsButton />)
    expect(screen.getByRole('button', { name: /friends/i })).toBeInTheDocument()
  })
})
