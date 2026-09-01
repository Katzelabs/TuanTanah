// The report form (ClickUp 86eyr3xtu). What's worth guarding here is the
// behaviour that makes the feature worth having, none of which is visible in the
// markup:
//
//  1. Context is attached without the reporter typing it — including the game
//     they were in, which is what makes an in-game bug reproducible.
//  2. A failed send keeps what they wrote. Losing a bug report to a flaky
//     network is how you teach someone never to file another one.
//  3. Success replaces the form with a confirmation, so nobody sends twice
//     wondering whether it worked.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/index.js'
import { useGame } from '@/store/gameStore.js'
import { FeedbackModal } from './FeedbackModal.js'
import { useFeedback } from './feedbackStore.js'

vi.mock('./api.js', () => ({
  fetchFeedbackEnabled: vi.fn(async () => true),
  submitFeedback: vi.fn(async () => ({ ok: true })),
}))

// The store's own socket-free dependency, but the game store still pulls in the
// socket singleton on import.
vi.mock('@/socket.js', () => {
  const stub = { on: () => {}, off: () => {}, emit: () => {}, connected: false, id: 'test-socket' }
  return {
    socket: stub,
    getActiveSocket: () => stub,
    createSocket: () => stub,
    setActiveSocket: () => {},
  }
})

const { submitFeedback } = await import('./api.js')
const submitMock = vi.mocked(submitFeedback)

beforeEach(async () => {
  await i18n.changeLanguage('en')
  submitMock.mockReset()
  submitMock.mockResolvedValue({ ok: true })
  useFeedback.setState({ enabled: true, open: true, submitting: false, sent: false, error: null })
  useGame.setState({ roomId: null, playerId: null, state: null })
})

async function fillAndSend(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/summary/i), 'Dice did nothing')
  await user.type(screen.getByLabelText(/what happened/i), 'Pressed roll, token never moved.')
  await user.click(screen.getByRole('button', { name: /send report/i }))
}

describe('FeedbackModal', () => {
  it('requires a summary and a description before it will send', async () => {
    const user = userEvent.setup()
    render(<FeedbackModal />)

    expect(screen.getByRole('button', { name: /send report/i })).toBeDisabled()
    await user.type(screen.getByLabelText(/summary/i), 'Something broke')
    // Still disabled: a one-line title with no detail is the report shape that
    // always needs a follow-up round-trip.
    expect(screen.getByRole('button', { name: /send report/i })).toBeDisabled()

    await user.type(screen.getByLabelText(/what happened/i), 'Here is what I did.')
    expect(screen.getByRole('button', { name: /send report/i })).toBeEnabled()
  })

  it('attaches build and device context the reporter never typed', async () => {
    const user = userEvent.setup()
    render(<FeedbackModal />)
    await fillAndSend(user)

    await waitFor(() => expect(submitMock).toHaveBeenCalled())
    const { context } = submitMock.mock.calls[0]![0]
    expect(context.appVersion).toBeTruthy()
    expect(context.userAgent).toBe(navigator.userAgent)
    expect(context.viewportWidth).toBe(window.innerWidth)
    expect(context.language).toBe('en')
  })

  it('attaches a snapshot of the game a report was filed from', async () => {
    useGame.setState({
      roomId: 'ABC123',
      playerId: 'p1',
      state: {
        roomId: 'ABC123',
        phase: 'playing',
        round: 7,
        currentPlayerIndex: 1,
        players: [{ id: 'p1' }, { id: 'p2' }],
      } as never,
    })
    const user = userEvent.setup()
    render(<FeedbackModal />)
    await fillAndSend(user)

    await waitFor(() => expect(submitMock).toHaveBeenCalled())
    const { context } = submitMock.mock.calls[0]![0]
    expect(context.roomId).toBe('ABC123')
    expect(context.game).toEqual({
      phase: 'playing',
      round: 7,
      currentPlayerId: 'p2',
      myPlayerId: 'p1',
      playerCount: 2,
    })
  })

  it('sends no user id for the server to trust', async () => {
    const user = userEvent.setup()
    render(<FeedbackModal />)
    await fillAndSend(user)

    await waitFor(() => expect(submitMock).toHaveBeenCalled())
    // Identity is the server's to read off the session cookie. A client-supplied
    // id would let anyone file in someone else's name.
    expect(submitMock.mock.calls[0]![0]).not.toHaveProperty('userId')
  })

  it('confirms when the report lands', async () => {
    const user = userEvent.setup()
    render(<FeedbackModal />)
    await fillAndSend(user)

    expect(await screen.findByText(/report sent/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send report/i })).not.toBeInTheDocument()
  })

  it('keeps the draft and explains itself when sending fails', async () => {
    submitMock.mockResolvedValue({ ok: false, error: 'network' })
    const user = userEvent.setup()
    render(<FeedbackModal />)
    await fillAndSend(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no connection/i)
    // The whole draft is still there to retry with.
    expect(screen.getByLabelText(/summary/i)).toHaveValue('Dice did nothing')
    expect(screen.getByLabelText(/what happened/i)).toHaveValue('Pressed roll, token never moved.')
  })

  it('names the rate limit rather than blaming the report', async () => {
    submitMock.mockResolvedValue({ ok: false, error: 'rate_limited' })
    const user = userEvent.setup()
    render(<FeedbackModal />)
    await fillAndSend(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/short time/i)
  })
})
