import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { roomUrl } from '@/lib/roomLink.js'
import { useGame } from '@/store/gameStore.js'
import { Button, Modal } from './ui/index.js'

/** Copies the shareable room link (`/room/CODE`) to the clipboard. */
export function ShareLinkButton({
  code,
  className,
  label,
  variant = 'secondary',
  size = 'sm',
  block,
}: {
  code: string
  className?: string
  /** Overrides the default "Share link" text (e.g. "Copy link" in the invite sheet). */
  label?: string
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md'
  block?: boolean
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = roomUrl(code)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard blocked (insecure context / permissions) — fall back to prompt.
      window.prompt(t('roomActions.copyPrompt'), url)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button
      variant={variant}
      size={size}
      block={block}
      onClick={share}
      className={`${size === 'sm' ? 'text-xs' : ''} ${className ?? ''}`}
    >
      {copied ? t('roomActions.linkCopied') : (label ?? t('roomActions.shareLink'))}
    </Button>
  )
}

/**
 * Leaves the room/game and returns to home. In-game this is a forfeit, so we
 * confirm first when `confirm` is set.
 */
export function LeaveButton({
  confirm,
  label,
  icon,
  className,
}: {
  confirm?: string
  label?: string
  /** When set, the icon always shows and the label collapses to icon-only on mobile. */
  icon?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const leave = useGame((s) => s.leave)
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const doLeave = () => {
    leave()
    navigate('/')
  }
  const onClick = () => {
    if (confirm) setConfirming(true)
    else doLeave()
  }

  const text = label ?? t('roomActions.leave')
  return (
    <>
      <Button
        variant="danger"
        size="xs"
        onClick={onClick}
        aria-label={icon ? text : undefined}
        className={className}
      >
        {icon}
        <span className={icon ? 'hidden md:inline' : undefined}>{text}</span>
      </Button>
      {confirm && (
        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          title={t('roomActions.leaveTitle')}
          size="sm"
        >
          <p className="text-sm text-ink">{confirm}</p>
          <div className="mt-5 flex gap-2">
            <Button variant="ghost" size="sm" block onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" size="sm" block onClick={doLeave}>
              {t('roomActions.confirmLeave')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}

/**
 * Surrenders an in-progress game: the player is eliminated (forfeits their
 * properties) but stays in the room to spectate. Unlike {@link LeaveButton} it
 * doesn't navigate away — the player keeps watching the rest of the game.
 */
export function SurrenderButton({
  icon,
  className,
}: {
  /** When set, the icon always shows and the label collapses to icon-only on mobile. */
  icon?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const surrender = useGame((s) => s.surrender)
  const [confirming, setConfirming] = useState(false)

  const doSurrender = () => {
    surrender()
    setConfirming(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setConfirming(true)}
        aria-label={icon ? t('game.surrender') : undefined}
        className={className}
      >
        {icon}
        <span className={icon ? 'hidden md:inline' : undefined}>{t('game.surrender')}</span>
      </Button>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('roomActions.surrenderTitle')}
        size="sm"
      >
        <p className="text-sm text-ink">{t('game.surrenderConfirm')}</p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" size="sm" block onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" size="sm" block onClick={doSurrender}>
            {t('roomActions.confirmSurrender')}
          </Button>
        </div>
      </Modal>
    </>
  )
}
