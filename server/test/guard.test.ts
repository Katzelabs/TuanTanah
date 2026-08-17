// The expected/unexpected split in `guard` is the thing that makes the fault
// stream readable, and it is invisible at the call site — every handler just calls
// guard(). A regression here would not fail any other test: the player still gets
// an error toast either way. So it gets its own test.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EngineError } from '../src/engine/index.js'
import { guard, type TTSocket } from '../src/realtime/common.js'

type ErrorPayload = { message: string; code?: string }

function fakeSocket() {
  const emitted: ErrorPayload[] = []
  const socket = {
    id: 'socket-under-test',
    emit: (event: string, payload: ErrorPayload) => {
      if (event === 'error') emitted.push(payload)
      return true
    },
  }
  return { socket: socket as unknown as TTSocket, emitted }
}

afterEach(() => vi.restoreAllMocks())

describe('guard', () => {
  it('passes an EngineError to the player without reporting it as a fault', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { socket, emitted } = fakeSocket()

    await guard(socket, async () => {
      throw new EngineError('core.notYourTurn')
    })

    expect(emitted).toHaveLength(1)
    expect(emitted[0]!.code).toBe('core.notYourTurn')
    expect(reported).not.toHaveBeenCalled()
  })

  it('reports anything that is not an EngineError, and tells the player nothing', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { socket, emitted } = fakeSocket()

    await guard(socket, async () => {
      throw new TypeError('cannot read properties of undefined')
    })

    expect(emitted).toHaveLength(1)
    expect(emitted[0]!.code).toBe('core.unexpected')

    expect(reported).toHaveBeenCalledTimes(1)
    const report = JSON.parse(reported.mock.calls[0]![0] as string)
    expect(report.err).toBe('cannot read properties of undefined')
    expect(report.at).toBe('socket-handler')
    expect(report.socketId).toBe('socket-under-test')
    expect(report.stack).toContain('TypeError')
    // A bug in one handler is caught and the server keeps serving — that is
    // `handled`. Only the process-level nets in bootstrap/ report otherwise, or
    // every dropped action would count against the crash rate.
    expect(report.handled).toBe(true)
  })

  it('emits nothing when the handler succeeds', async () => {
    const { socket, emitted } = fakeSocket()
    await guard(socket, async () => {})
    expect(emitted).toEqual([])
  })
})
