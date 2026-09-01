import { Bug, CircleCheckBig, Lightbulb, MessageCircle, Send, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_DESCRIPTION_MAX,
  FEEDBACK_TITLE_MAX,
  type FeedbackType,
} from '@tuan-tanah/shared'
import { Button, Card, Modal } from '@/components/ui/index.js'
import { useAuthUser } from '@/hooks/useAuthUser.js'
import { AppVersion } from '@/components/AppVersion.js'
import { useFeedback, type FeedbackDraft } from './feedbackStore.js'

const INPUT =
  'w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 font-medium text-ink outline-none transition placeholder:text-ink-faint focus:shadow-brutal-sm'

const TYPE_ICON: Record<FeedbackType, LucideIcon> = {
  bug: Bug,
  suggestion: Lightbulb,
  other: MessageCircle,
}

const TYPES: readonly FeedbackType[] = ['bug', 'suggestion', 'other']

/**
 * The report form, mounted once at the app root.
 *
 * A modal rather than a route, and that is the load-bearing decision: `/room/:id`
 * renders the whole game, so navigating to a `/feedback` page would unmount the
 * match. The acceptance criterion "reachable from inside an active game without
 * leaving it" can only be met by something that renders on top.
 */
export function FeedbackModal() {
  const { t } = useTranslation()
  const open = useFeedback((s) => s.open)
  const close = useFeedback((s) => s.close)
  const sent = useFeedback((s) => s.sent)

  // The form's field state resets on its own between openings: `Modal` renders
  // nothing while closed, so the children unmount and remount.
  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title={sent ? t('feedback.sent.title') : t('feedback.title')}
    >
      {sent ? <SentPanel onClose={close} /> : <FeedbackForm />}
    </Modal>
  )
}

function SentPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-ink bg-success text-ink shadow-brutal">
        <CircleCheckBig size={24} aria-hidden />
      </span>
      {/* Says what happens next rather than just "thanks" — the ticket's whole
          premise is that a reporter who never hears anything stops reporting. */}
      <p className="max-w-sm text-sm font-semibold text-ink-muted">{t('feedback.sent.body')}</p>
      <Button onClick={onClose} className="mt-1">
        {t('common.close')}
      </Button>
    </div>
  )
}

function FeedbackForm() {
  const { t } = useTranslation()
  const account = useAuthUser()
  const submitting = useFeedback((s) => s.submitting)
  const error = useFeedback((s) => s.error)
  const submit = useFeedback((s) => s.submit)

  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // `null` means untouched, so the field follows the account's email as it loads
  // rather than needing an effect to sync it. Guests start on ''.
  const [typedContact, setTypedContact] = useState<string | null>(null)
  const contact = typedContact ?? account?.email ?? ''

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !submitting

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const draft: FeedbackDraft = { type, title, description, contact }
    void submit(draft)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm font-semibold text-ink-muted">{t('feedback.intro')}</p>

      <fieldset>
        <legend className="text-sm font-bold text-ink">{t('feedback.type.label')}</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {TYPES.map((value) => {
            const Icon = TYPE_ICON[value]
            const active = type === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setType(value)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 border-ink px-2 py-2.5 text-xs font-bold shadow-brutal-sm transition ${
                  active
                    ? 'bg-accent text-ink'
                    : 'bg-surface text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                <Icon size={16} aria-hidden />
                {t(`feedback.type.${value}`)}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="feedback-title" className="text-sm font-bold text-ink">
            {t('feedback.field.title')}
          </label>
          <span className="text-2xs font-bold tabular-nums text-ink-faint">
            {title.length}/{FEEDBACK_TITLE_MAX}
          </span>
        </div>
        <input
          id="feedback-title"
          className={`mt-1.5 ${INPUT}`}
          value={title}
          maxLength={FEEDBACK_TITLE_MAX}
          placeholder={t('feedback.field.titlePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="feedback-description" className="text-sm font-bold text-ink">
            {t('feedback.field.description')}
          </label>
          <span className="text-2xs font-bold tabular-nums text-ink-faint">
            {description.length}/{FEEDBACK_DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id="feedback-description"
          rows={5}
          className={`mt-1.5 resize-y ${INPUT}`}
          value={description}
          maxLength={FEEDBACK_DESCRIPTION_MAX}
          placeholder={t('feedback.field.descriptionPlaceholder')}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="feedback-contact" className="text-sm font-bold text-ink">
          {t('feedback.field.contact')}
        </label>
        <input
          id="feedback-contact"
          aria-describedby="feedback-contact-hint"
          className={`mt-1.5 ${INPUT}`}
          value={contact}
          maxLength={FEEDBACK_CONTACT_MAX}
          placeholder={t('feedback.field.contactPlaceholder')}
          autoComplete="email"
          onChange={(e) => setTypedContact(e.target.value)}
        />
        <p id="feedback-contact-hint" className="mt-1.5 text-xs font-semibold text-ink-muted">
          {t('feedback.field.contactHint')}
        </p>
      </div>

      <AttachedNotice />

      {error && (
        <Card tone="danger" flat pad="sm" role="alert">
          <p className="text-sm font-bold text-ink">{t(`feedback.errors.${error}`)}</p>
        </Card>
      )}

      <Button type="submit" block disabled={!canSubmit}>
        <Send size={16} aria-hidden />
        {submitting ? t('feedback.sending') : t('feedback.send')}
      </Button>
    </form>
  )
}

/**
 * Says out loud what the report will carry.
 *
 * Not a legal notice — a practical one. It stops people retyping their device
 * and version into the description, and someone about to describe a bug deserves
 * to know a snapshot of their game goes with it rather than discovering that
 * later.
 */
function AttachedNotice() {
  const { t } = useTranslation()
  return (
    <Card tone="sunken" flat pad="sm">
      <p className="text-xs font-semibold text-ink-muted">
        {t('feedback.attached')} <AppVersion className="ml-1 align-middle" />
      </p>
    </Card>
  )
}
