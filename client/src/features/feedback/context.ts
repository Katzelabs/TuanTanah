// Everything a report carries that nobody had to type.
//
// This is the part that turns "sometimes it breaks" into a reproducible ticket,
// so it is collected at submit time and never asked for. Read through
// `useGame.getState()` rather than a hook on purpose: the modal is mounted
// globally, and subscribing it to `state` would re-render it on every
// `game_state` broadcast — several times a turn — for data it only needs once.
import type { FeedbackContext, FeedbackGameSnapshot } from '@tuan-tanah/shared'
import i18n from '@/i18n/index.js'
import { APP_VERSION, BUILD_SHA } from '@/lib/version.js'
import { useGame } from '@/store/gameStore.js'

/**
 * The five fields that place a bug in a game, out of a `GameState` with dozens.
 *
 * Sending the whole state was the obvious alternative and is the wrong call: it
 * is tens of kilobytes against a 64 KB body limit, and it contains every other
 * player's cash and holdings — which the person filing the report never agreed
 * to send anywhere.
 */
function gameSnapshot(): FeedbackGameSnapshot | null {
  const { state, playerId } = useGame.getState()
  if (!state) return null
  return {
    phase: state.phase,
    round: state.round,
    currentPlayerId: state.players[state.currentPlayerIndex]?.id ?? null,
    myPlayerId: playerId,
    playerCount: state.players.length,
  }
}

export function collectContext(): FeedbackContext {
  const { roomId } = useGame.getState()
  return {
    appVersion: APP_VERSION,
    buildSha: BUILD_SHA,
    userAgent: navigator.userAgent,
    // The UI language they were actually reading, so a reply can be written in
    // it — not the browser's, which the app deliberately ignores.
    language: i18n.language,
    // `innerWidth` rather than `screen.width`: the layout responds to the
    // viewport, and "which breakpoint were they on" is the question a layout bug
    // needs answered.
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    roomId,
    game: gameSnapshot(),
  }
}
