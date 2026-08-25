import type { Player, Role } from '@tuan-tanah/shared'
import { ALL_ROLES } from '@tuan-tanah/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance, type i18n as I18n } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en.json'
import { StartPanel } from './StartPanel.js'

function makeI18n(): I18n {
  const i18n = createInstance()
  void i18n.init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  })
  return i18n
}

const player = (over: Partial<Player> & { id: string; name: string }): Player => ({
  color: '#FF6B6B',
  role: null,
  cash: 0,
  position: 0,
  inJail: false,
  jailTurnsLeft: 0,
  loans: [],
  ownedCards: [],
  isEliminated: false,
  isRoomMaster: false,
  isConnected: true,
  forcedLoanRound: 0,
  metaActionsUsed: [],
  roleBonusThisLap: 0,
  owesLapInterest: false,
  afkStrikes: 0,
  ...over,
})

/**
 * Asserts on structure (button state, one list item per blocker) rather than on
 * copy: the panel's new `lobby.*` strings are merged into the locale files by
 * the i18n owner, so matching rendered text here would test the merge, not the
 * component.
 */
function renderPanel(players: Player[], meId: string, enabledRoles: Role[] = ALL_ROLES) {
  const onStart = vi.fn()
  render(
    <I18nextProvider i18n={makeI18n()}>
      <StartPanel
        players={players}
        settings={{ enabledRoles }}
        me={players.find((p) => p.id === meId) ?? null}
        onStart={onStart}
      />
    </I18nextProvider>,
  )
  return { onStart, blockers: () => screen.queryAllByRole('listitem') }
}

const host = player({ id: 'h', name: 'Budi', isRoomMaster: true, role: 'sales' })

describe('StartPanel', () => {
  it('starts the game once the room clears every engine guard', async () => {
    const { onStart, blockers } = renderPanel(
      [host, player({ id: 'g', name: 'Sari', role: 'pejabat' })],
      'h',
    )
    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(blockers()).toHaveLength(0)
    await userEvent.click(button)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('keeps start disabled and shows a reason instead of a dead button', () => {
    const { blockers } = renderPanel([host], 'h')
    expect(screen.getByRole('button')).toBeDisabled()
    expect(blockers()).toHaveLength(1)
  })

  it('flags a room whose enabled roles can never cover its players', () => {
    // `sales` is the only role on and the host already holds it, so Sari is
    // stuck: that's a second, separate reason worth spelling out.
    const { blockers } = renderPanel([host, player({ id: 'g', name: 'Sari' })], 'h', ['sales'])
    expect(screen.getByRole('button')).toBeDisabled()
    expect(blockers()).toHaveLength(2)
  })

  it('gives a non-host the wait and the blockers, but no start button', () => {
    const { blockers } = renderPanel([host, player({ id: 'g', name: 'Sari' })], 'g')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(blockers()).toHaveLength(1)
  })
})
