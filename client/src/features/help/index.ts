// features/help — the rules reference ("How to play"), ClickUp 86eyr3x1k.
//
// The same content is served two ways: `HelpModal` (mounted at the app root,
// opened from `useHelp`) so it works from inside a live game, and the `/help`
// route so the rules have a link that can be shared before a match. Everything
// else imports only from here.
export { HelpButton } from './HelpButton.js'
export { HelpContent } from './HelpContent.js'
export { HelpModal } from './HelpModal.js'
export { HelpPage } from './HelpPage.js'
export { useHelp } from './helpStore.js'
export type { HelpState } from './helpStore.js'
