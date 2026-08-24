import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance, type i18n as I18n } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en.json'
import id from '@/i18n/locales/id.json'
import { InviteModal } from './InviteModal.js'

function makeI18n(lng: 'en' | 'id' = 'en'): I18n {
  const i18n = createInstance()
  void i18n.init({
    lng,
    resources: { en: { translation: en }, id: { translation: id } },
    interpolation: { escapeValue: false },
  })
  return i18n
}

function renderModal({
  created = false,
  lng = 'en',
}: { created?: boolean; lng?: 'en' | 'id' } = {}) {
  return render(
    <I18nextProvider i18n={makeI18n(lng)}>
      <InviteModal open onClose={() => {}} code="ABCXYZ" created={created} />
    </I18nextProvider>,
  )
}

const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(() => {
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share')
})

describe('InviteModal', () => {
  it('keeps the room code readable as the low-tech fallback', () => {
    renderModal()
    expect(screen.getByText('ABCXYZ')).toBeInTheDocument()
    expect(screen.getByText(`${window.location.origin}/room/ABCXYZ`)).toBeInTheDocument()
  })

  it('renders a QR code for the room link', () => {
    renderModal()
    const qr = screen.getByRole('img', { name: /ABCXYZ/ })
    // One path over the whole module grid, so the SVG stays a single node.
    expect(qr.querySelectorAll('path')).toHaveLength(1)
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/)
  })

  it('copies the shareable link, not the bare code', async () => {
    // `userEvent.setup()` installs its own clipboard stub, so ours goes in after.
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderModal()
    await user.click(screen.getByRole('button', { name: en.invite.copyLink }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/room/ABCXYZ`)
    expect(await screen.findByText(en.roomActions.linkCopied)).toBeInTheDocument()
  })

  it('offers the native share sheet only where the browser has one', async () => {
    renderModal()
    expect(screen.queryByRole('button', { name: en.invite.share })).not.toBeInTheDocument()

    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    renderModal()

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: en.invite.share })[0])
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${window.location.origin}/room/ABCXYZ` }),
    )
  })

  it('leads with the created-room copy right after a create', () => {
    renderModal({ created: true })
    expect(screen.getByText(en.invite.createdSubtitle)).toBeInTheDocument()
    expect(screen.queryByText(en.invite.subtitle)).not.toBeInTheDocument()
  })

  it('translates to Indonesian', () => {
    renderModal({ lng: 'id' })
    expect(screen.getByText(id.invite.title)).toBeInTheDocument()
  })
})
