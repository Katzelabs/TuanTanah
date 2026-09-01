// The rules reference's open/closed state.
//
// A store rather than local state for the same reason `feedbackStore` is one:
// the modal is mounted once at the app root so it can open over a live match,
// and the buttons that open it (home, lobby, in-game header) are scattered
// across three trees that share no common parent but the root.
import { create } from 'zustand'

export interface HelpState {
  open: boolean
  openHelp: () => void
  close: () => void
}

export const useHelp = create<HelpState>((set) => ({
  open: false,
  openHelp: () => set({ open: true }),
  close: () => set({ open: false }),
}))
