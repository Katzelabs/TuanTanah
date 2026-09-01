// The feedback form's own store.
//
// Separate from `gameStore` for the same reason `authStore` is: game state is
// server-broadcast and replaced wholesale on every `game_state`, and a
// half-written bug report must survive that. It also has to survive being opened
// from inside a live game, which is the entire reason this is a modal on a store
// rather than a route.
import { create } from 'zustand'
import type { FeedbackErrorCode, FeedbackType } from '@tuan-tanah/shared'
import { fetchFeedbackEnabled, submitFeedback } from './api.js'
import { collectContext } from './context.js'

export interface FeedbackDraft {
  type: FeedbackType
  title: string
  description: string
  contact: string
}

export interface FeedbackState {
  /** False until the server confirms it has somewhere to send reports. */
  enabled: boolean
  open: boolean
  submitting: boolean
  /** True once a report has landed — the form is replaced by a confirmation. */
  sent: boolean
  error: FeedbackErrorCode | null
  /** Read availability once, at boot. */
  init: () => Promise<void>
  openForm: () => void
  close: () => void
  submit: (draft: FeedbackDraft) => Promise<void>
}

// Boot and any late caller share one request rather than racing two.
let inFlight: Promise<void> | null = null

export const useFeedback = create<FeedbackState>((set) => ({
  // Pessimistic until the server says otherwise, so no entry point flashes on a
  // deployment with the feature switched off.
  enabled: false,
  open: false,
  submitting: false,
  sent: false,
  error: null,

  init: async () => {
    inFlight ??= fetchFeedbackEnabled()
      .then((enabled) => set({ enabled }))
      .finally(() => {
        inFlight = null
      })
    return inFlight
  },

  // Clears the previous outcome but NOT the draft — the modal owns the field
  // values, so reopening after a failed send still has what they typed.
  openForm: () => set({ open: true, sent: false, error: null }),

  close: () => set({ open: false, submitting: false }),

  submit: async (draft) => {
    set({ submitting: true, error: null })
    const result = await submitFeedback({
      type: draft.type,
      title: draft.title.trim(),
      description: draft.description.trim(),
      ...(draft.contact.trim() ? { contact: draft.contact.trim() } : {}),
      // Collected at submit time, so an in-game report carries the state it was
      // actually filed from rather than whatever was true when the form opened.
      context: collectContext(),
    })

    if (!result.ok) {
      // Deliberately stays open on failure: closing would throw away what they
      // wrote, and a report worth writing is worth retrying.
      set({ submitting: false, error: result.error })
      return
    }
    set({ submitting: false, sent: true, error: null })
  },
}))
