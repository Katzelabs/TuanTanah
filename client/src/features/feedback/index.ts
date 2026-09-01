// features/feedback — in-app bug reports and suggestions (ClickUp 86eyr3xtu).
//
// The modal is mounted once at the app root and opened from a store, so it works
// from inside a live game: a `/feedback` route would unmount the match to render
// it. Everything else imports only from here.
export { FeedbackButton } from './FeedbackButton.js'
export { FeedbackModal } from './FeedbackModal.js'
export { useFeedback } from './feedbackStore.js'
export type { FeedbackDraft, FeedbackState } from './feedbackStore.js'
