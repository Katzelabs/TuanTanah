// The whole point of the bridge: subtask B's `useAuth` doesn't exist at runtime
// yet, and a component that calls a missing hook takes the entire app down —
// not just the invite UI. This asserts the standalone-branch path stays inert
// rather than fatal, so the guard can't be "tidied away" by accident.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAuthUser } from './authBridge.js'

function Probe() {
  const user = useAuthUser()
  return <span data-testid="who">{user ? user.displayName : 'guest'}</span>
}

describe('useAuthUser', () => {
  it('reports a guest while the auth store is declarations only', () => {
    render(<Probe />)
    expect(screen.getByTestId('who')).toHaveTextContent('guest')
  })
})
