/**
 * Mirrors `DISPLAY_NAME_MAX` in `server/src/modules/auth/account.ts` — the client
 * can't import from the server workspace, and this is a UI affordance (the input's
 * `maxLength`), not the rule. The server still normalises and rejects; keeping the
 * numbers equal only means the player doesn't get a 400 they could have been
 * stopped from triggering.
 */
export const DISPLAY_NAME_MAX = 20
