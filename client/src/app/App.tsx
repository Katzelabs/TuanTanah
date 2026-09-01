import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuctionModal } from '@/features/game/AuctionModal/AuctionModal.js'
import { CardModal } from '@/features/game/CardModal/CardModal.js'
import { ErrorToast } from '@/components/ErrorToast.js'
import { IncomingDealModal } from '@/features/game/NegotiationModal/IncomingDealModal.js'
import { TurnBanner } from '@/features/game/TurnBanner/TurnBanner.js'
import { VotingModal } from '@/features/game/VotingModal/VotingModal.js'
import { Account } from '@/features/account/Account.js'
import { DevMultiplayer } from '@/app/DevMultiplayer.js'
import { useAuth } from '@/features/auth/index.js'
import { Changelog } from '@/features/changelog/index.js'
import { FeedbackModal, useFeedback } from '@/features/feedback/index.js'
import { HelpModal, HelpPage } from '@/features/help/index.js'
import { Home } from '@/features/home/Home.js'
import { MatchHistory } from '@/features/history/MatchHistory.js'
import { RoomGate } from '@/features/game/RoomGate.js'
import { StyleGuide } from '@/app/StyleGuide.js'
import { RoomInviteToast, useInvites } from '@/features/invites/index.js'
import { useGame } from '@/store/gameStore.js'

export function App() {
  const init = useGame((s) => s.init)
  const initInvites = useInvites((s) => s.init)
  const roomId = useGame((s) => s.roomId)
  const refreshAuth = useAuth((s) => s.refresh)
  const initFeedback = useFeedback((s) => s.init)

  useEffect(() => {
    init()
    initInvites()
  }, [init, initInvites])

  // Asks once whether this deployment has anywhere to send reports. Until it
  // answers, every feedback entry point stays hidden.
  useEffect(() => {
    void initFeedback()
  }, [initFeedback])

  // Hydrate the session once on boot. Also the return path from the Google
  // redirect: that comes back as a full page load, so this reads the new cookie.
  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  return (
    <div className="min-h-screen">
      <Routes>
        {/* If we're already seated in a room (e.g. an auto-rejoin succeeded),
            bounce the bare home URL into that room so returning resumes play. */}
        <Route path="/" element={roomId ? <Navigate to={`/room/${roomId}`} replace /> : <Home />} />
        <Route path="/room/:roomId" element={<RoomGate />} />
        <Route path="/history" element={<MatchHistory />} />
        {/* Public: release notes are for everyone, signed in or not. */}
        <Route path="/changelog" element={<Changelog />} />
        {/* Public, and deliberately a real URL: the rules are the thing you send
            someone before they've joined anything. */}
        <Route path="/help" element={<HelpPage />} />
        {/* Signed-in only; the page itself bounces guests home. */}
        <Route path="/account" element={<Account />} />
        <Route path="/design" element={<StyleGuide />} />
        {/* DEV-only: run several isolated clients (one per iframe) in one tab. */}
        {import.meta.env.DEV && <Route path="/dev" element={<DevMultiplayer />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ErrorToast />
      <TurnBanner />
      <CardModal />
      <VotingModal />
      <AuctionModal />
      <IncomingDealModal />
      <RoomInviteToast />
      {/* Same reason as the feedback modal below: the rules have to be readable
          mid-turn, and a route would unmount the match to show them. */}
      <HelpModal />
      {/* Mounted here, not in a route: a report must be fileable from inside a
          live game, and navigating to a page would unmount the match. */}
      <FeedbackModal />
    </div>
  )
}
