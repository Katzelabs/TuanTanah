import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/index.js'
import { HelpContent } from './HelpContent.js'
import { useHelp } from './helpStore.js'

/**
 * Mounted once at the app root. That placement is the whole point: it opens
 * over a live match without unmounting it, so a confused player can read the
 * rules mid-turn instead of leaving the room to find them.
 */
export function HelpModal() {
  const { t } = useTranslation()
  const open = useHelp((s) => s.open)
  const close = useHelp((s) => s.close)

  return (
    <Modal open={open} onClose={close} title={t('help.title')} size="lg">
      <HelpContent />
    </Modal>
  )
}
