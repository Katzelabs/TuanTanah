import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGame } from '@/store/gameStore.js'
import { InviteModal } from './InviteModal.js'
import { LobbyHeader } from './LobbyHeader.js'
import { PlayerList } from './PlayerList.js'
import { RolePicker } from './RolePicker.js'
import { RoomSettings } from './RoomSettings.js'
import { StartPanel } from './StartPanel.js'

/**
 * The pre-game room. Composition only — every panel below owns its own layout,
 * and every state change goes through the store to the server.
 *
 * Reading order differs by size, which is the point of the `order-*` / explicit
 * grid placement pairing below. On a phone the column runs roster → roles →
 * start → settings, so you see who's here, do the one thing you're here to do,
 * and only then scroll into host controls. From `lg` the roles board takes the
 * main column and the other three stack in a sidebar beside it.
 */
export function Lobby() {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const pickRole = useGame((s) => s.pickRole)
  const updateSettings = useGame((s) => s.updateSettings)
  const startGame = useGame((s) => s.startGame)

  // Home hands over `state.created` after a create (never after a join), so the
  // room master's first sight of the lobby is the "send this link" sheet.
  const location = useLocation()
  const navigate = useNavigate()
  const createdHere = (location.state as { created?: boolean } | null)?.created === true
  const [invite, setInvite] = useState<'created' | 'manual' | null>(createdHere ? 'created' : null)

  // Drop the flag once consumed, so a refresh doesn't re-open the sheet.
  useEffect(() => {
    if (createdHere) navigate(location.pathname, { replace: true, state: null })
  }, [createdHere, location.pathname, navigate])

  if (!state) return <Centered>{t('lobby.loading')}</Centered>

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6 lg:py-8">
      <LobbyHeader roomId={state.roomId} onInvite={() => setInvite('manual')} />

      <InviteModal
        open={invite !== null}
        created={invite === 'created'}
        onClose={() => setInvite(null)}
        code={state.roomId}
      />

      <div className="mt-4 flex flex-col gap-3 sm:mt-6 sm:gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <PlayerList
          players={state.players}
          meId={me?.id}
          className="order-1 lg:col-start-2 lg:row-start-1"
        />
        <RolePicker
          players={state.players}
          meId={me?.id}
          enabledRoles={state.settings.enabledRoles}
          onPick={pickRole}
          className="order-2 lg:col-start-1 lg:row-span-3 lg:row-start-1"
        />
        <StartPanel
          players={state.players}
          settings={state.settings}
          me={me}
          onStart={startGame}
          className="order-3 lg:col-start-2 lg:row-start-2"
        />
        <RoomSettings
          settings={state.settings}
          isMaster={!!me?.isRoomMaster}
          onChange={updateSettings}
          className="order-4 lg:col-start-2 lg:row-start-3"
        />
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center font-semibold text-ink-muted">
      {children}
    </div>
  )
}
