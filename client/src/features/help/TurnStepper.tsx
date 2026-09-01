import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/index.js'
import { DURATION, EASE_STANDARD } from '@/lib/motion.js'

export interface TurnStep {
  /** What the player does at this point in the turn. */
  body: string
  /** The inert example of the control they'll do it with. */
  demo: ReactNode
}

/**
 * The turn, one step at a time — the onboarding stepper pattern.
 *
 * A stacked list showed all four at once, which reads as reference material:
 * fine if you already know what you're looking for, and exactly wrong for the
 * person this page is for. Taking them one at a time makes the turn feel like a
 * sequence you're walked through rather than a wall you have to parse, and it
 * keeps each example next to the single sentence it illustrates.
 *
 * Steps stay reachable out of order — the dots are real buttons — so someone who
 * only came back to check step 3 isn't made to click through 1 and 2 again.
 */
export function TurnStepper({ steps }: { steps: TurnStep[] }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  // Which way the panel slides. Jumping via the dots can move either direction.
  const [direction, setDirection] = useState(1)
  const reduceMotion = useReducedMotion()

  const go = (next: number) => {
    if (next < 0 || next >= steps.length) return
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }

  const step = steps[index]!
  const offset = reduceMotion ? 0 : 24

  return (
    <div
      className="rounded-lg border-2 border-ink bg-surface p-3"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1)
        if (e.key === 'ArrowLeft') go(index - 1)
      }}
    >
      <p className="text-3xs font-bold uppercase tracking-wide text-ink-faint">
        {t('help.turn.progress', { current: index + 1, total: steps.length })}
      </p>

      {/* Steps are genuinely different heights — the meta-action bar in step 3 is
          several times a single button — so the panel animates its own height
          rather than being pinned to a guessed maximum. The floor only stops a
          one-button step rendering as a sliver. */}
      <motion.div layout={!reduceMotion} className="relative mt-2 min-h-[7rem]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={index}
            initial={{ opacity: 0, x: direction * offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -offset }}
            transition={{ duration: DURATION.fast, ease: EASE_STANDARD }}
            className="space-y-2.5"
          >
            <p className="text-sm leading-snug text-ink-muted">{step.body}</p>
            {step.demo}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-ink/15 pt-3">
        <Button
          variant="secondary"
          size="xs"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          aria-label={t('help.turn.back')}
        >
          <ChevronLeft size={14} aria-hidden />
        </Button>

        <ol className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t('help.turn.goTo', { current: i + 1 })}
                aria-current={i === index ? 'step' : undefined}
                className={`block h-2.5 w-2.5 rounded-full border-2 border-ink transition ${
                  i === index ? 'bg-accent' : 'bg-surface hover:bg-surface-sunken'
                }`}
              />
            </li>
          ))}
        </ol>

        <Button
          variant="secondary"
          size="xs"
          disabled={index === steps.length - 1}
          onClick={() => go(index + 1)}
          aria-label={t('help.turn.next')}
        >
          <ChevronRight size={14} aria-hidden />
        </Button>
      </div>
    </div>
  )
}
