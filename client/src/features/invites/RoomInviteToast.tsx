import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/index.js'
import { toastSlide } from '@/lib/motion.js'
import { useAuthUser } from '@/hooks/useAuthUser.js'
import { useInvites } from './store.js'

/**
 * App-level prompt for an incoming room invite (ClickUp subtask G). Mounted
 * once in `App`, because an invite can arrive anywhere — the home screen, a
 * lobby, or mid-game in another room.
 *
 * A pinned card rather than a modal: an invite is an offer, and a friend
 * shouldn't be able to throw a blocking dialog over someone's turn.
 */
export function RoomInviteToast() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthUser()
  const invite = useInvites((s) => s.incoming)
  const blocker = useInvites((s) => s.blocker)
  const accepting = useInvites((s) => s.accepting)
  const accept = useInvites((s) => s.accept)
  const dismiss = useInvites((s) => s.dismiss)

  const onAccept = () => {
    void accept(user?.displayName ?? '', (roomId) => navigate(`/room/${roomId}`))
  }

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          {...toastSlide}
          role="alert"
          className="fixed bottom-4 right-4 z-toast w-[min(20rem,calc(100vw-2rem))] rounded-xl border-2 border-ink bg-surface p-4 shadow-brutal"
        >
          <p className="text-sm font-bold text-ink">
            {t('invite.incoming.title', { name: invite.from.displayName })}
          </p>
          <p className="mt-1 text-xs font-semibold text-ink-muted">{t('invite.incoming.body')}</p>

          {blocker && (
            <p className="mt-2 rounded-lg border-2 border-ink bg-danger px-2 py-1 text-xs font-bold text-ink">
              {t(`invite.blocked.${blocker}`)}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="xs" block onClick={dismiss}>
              {t('invite.incoming.ignore')}
            </Button>
            <Button size="xs" block disabled={accepting} onClick={onAccept}>
              {accepting ? t('invite.incoming.joining') : t('invite.incoming.accept')}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
