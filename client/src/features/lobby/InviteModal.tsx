import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { encode } from 'uqr'
import { ShareLinkButton } from '@/components/RoomActions.js'
import { Button, Card, Modal } from '@/components/ui/index.js'
import { roomUrl } from '@/lib/roomLink.js'

/** `navigator.share` exists on mobile browsers (and nowhere in jsdom). */
function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * The room-invite sheet: a QR code, a copy-link button, and — on mobile — the
 * native share sheet, which is how rooms actually travel (WhatsApp).
 *
 * The 6-character room code stays visible as the low-tech fallback: reading it
 * out loud is what everyone did before this modal existed, and it still works.
 */
export function InviteModal({
  open,
  onClose,
  code,
  created,
}: {
  open: boolean
  onClose: () => void
  code: string
  /** Opened right after creating the room — nudges the master to send the link. */
  created?: boolean
}) {
  const { t } = useTranslation()
  const url = roomUrl(code)

  const share = async () => {
    try {
      await navigator.share({
        title: t('invite.shareTitle'),
        text: t('invite.shareText', { code }),
        url,
      })
    } catch {
      // Dismissed by the user, or the target rejected it — nothing to report.
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={created ? t('invite.createdTitle') : t('invite.title')}
      size="sm"
    >
      <p className="text-sm font-medium text-ink-muted">
        {created ? t('invite.createdSubtitle') : t('invite.subtitle')}
      </p>

      <div className="mt-4 flex justify-center">
        <RoomQr url={url} label={t('invite.qrAlt', { code })} />
      </div>
      <p className="mt-2 text-center text-xs font-bold uppercase text-ink-faint">
        {t('invite.scan')}
      </p>

      <Card tone="sunken" flat className="mt-4 px-4 py-3 text-center">
        <div className="text-xs font-bold uppercase text-ink-faint">{t('invite.roomCode')}</div>
        <div className="select-all font-mono text-2xl font-bold tracking-[0.3em] text-ink">
          {code}
        </div>
        <div className="mt-1 break-all font-mono text-[11px] text-ink-muted">{url}</div>
      </Card>
      <p className="mt-1 text-center text-xs text-ink-faint">{t('invite.codeHint')}</p>

      <div className="mt-5 space-y-2">
        {canNativeShare() && (
          <Button block onClick={share}>
            {t('invite.share')}
          </Button>
        )}
        <ShareLinkButton
          code={code}
          label={t('invite.copyLink')}
          size="md"
          variant={canNativeShare() ? 'secondary' : 'primary'}
          block
        />
      </div>
    </Modal>
  )
}

/**
 * The invite URL as an inline SVG QR code. One `<path>` rather than a rect per
 * module keeps a ~30×30 grid to a single DOM node.
 */
function RoomQr({ url, label }: { url: string; label: string }) {
  const path = useMemo(() => {
    // ECC 'M' survives the glare and finger-smudges of a phone pointed at a
    // laptop screen; border 4 is the quiet zone the spec asks for, so the white
    // margin scanners lock on to is part of the image rather than CSS padding.
    const qr = encode(url, { ecc: 'M', border: 4 })
    let d = ''
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.data[y][x]) d += `M${x} ${y}h1v1h-1z`
      }
    }
    return { d, size: qr.size }
  }, [url])

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${path.size} ${path.size}`}
      shapeRendering="crispEdges"
      className="h-44 w-44 rounded-lg border-2 border-ink bg-white text-ink shadow-brutal-sm"
    >
      <path d={path.d} fill="currentColor" />
    </svg>
  )
}
