import { MIN_PLAYERS, type Player, type RoomSettings } from '@tuan-tanah/shared'

/**
 * Only the fields the start rules look at — keeps these helpers callable from a
 * test with a two-field literal instead of a whole `Player`.
 */
export type LobbyPlayer = Pick<Player, 'name' | 'role' | 'isConnected'>

/**
 * Why the room master can't press start yet. These are *display* mirrors of the
 * engine's `startGame` guards (`server/src/engine/index.ts`), the same way
 * `features/game/lib/tileValue.ts` mirrors rent math: the server still decides,
 * we only explain the wait instead of leaving a dead button.
 */
export type StartBlocker =
  /** Fewer than MIN_PLAYERS are connected. */
  | { kind: 'needPlayers'; missing: number }
  /** Connected players who haven't claimed a role yet. */
  | { kind: 'needRoles'; names: string[] }
  /** More role-less players than there are free enabled roles — a dead end
   *  until the host turns roles back on, so it's worth naming separately. */
  | { kind: 'notEnoughRoles'; enabled: number; players: number }

/**
 * Mirrors the engine exactly: it counts **connected** players only, so a player
 * who dropped out without picking a role doesn't hold the room hostage.
 */
export function canStartGame(players: readonly LobbyPlayer[]): boolean {
  const active = players.filter((p) => p.isConnected)
  return active.length >= MIN_PLAYERS && active.every((p) => p.role !== null)
}

/**
 * The blockers to show, most-blocking first. Always non-empty exactly when
 * {@link canStartGame} is false: `notEnoughRoles` can only fire while somebody
 * is role-less, which already produces a `needRoles` entry.
 */
export function startBlockers(
  players: readonly LobbyPlayer[],
  settings: Pick<RoomSettings, 'enabledRoles'>,
): StartBlocker[] {
  const active = players.filter((p) => p.isConnected)
  const blockers: StartBlocker[] = []

  if (active.length < MIN_PLAYERS) {
    blockers.push({ kind: 'needPlayers', missing: MIN_PLAYERS - active.length })
  }

  const roleless = active.filter((p) => p.role === null)
  if (roleless.length > 0) {
    blockers.push({ kind: 'needRoles', names: roleless.map((p) => p.name) })

    // A role held by a disconnected player is still taken, so count what's
    // genuinely free rather than trusting `enabledRoles.length` alone.
    const taken = new Set(players.map((p) => p.role).filter((r) => r !== null))
    const free = settings.enabledRoles.filter((r) => !taken.has(r)).length
    if (roleless.length > free) {
      blockers.push({
        kind: 'notEnoughRoles',
        enabled: settings.enabledRoles.length,
        players: active.length,
      })
    }
  }

  return blockers
}
