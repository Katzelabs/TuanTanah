import { Lock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '@/components/ui/index.js'

/**
 * The banner that replaces the old silent-disabled-controls state: a non-master
 * used to see greyed inputs with nothing saying why. Everything below it then
 * renders read-only (a value, not a dead control), so guests can still *read*
 * the room's setup.
 */
export function HostOnlyNote() {
  const { t } = useTranslation()
  return (
    <Card
      tone="info"
      flat
      pad="sm"
      className="flex items-center gap-2 text-2xs font-semibold leading-snug text-ink"
    >
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {t('lobby.hostOnly')}
    </Card>
  )
}

/** A settings value shown to someone who can't change it. */
export function ReadOnlyValue({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-ink bg-surface px-3 py-1.5 text-sm font-bold text-ink shadow-brutal-sm">
      {children}
    </div>
  )
}

/** A row of mutually exclusive values (the time limit). */
export function ChoiceGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  /** Renders each option's text — options are raw values (e.g. minutes). */
  label: (option: T) => ReactNode
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          block
          variant={option === value ? 'primary' : 'secondary'}
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {label(option)}
        </Button>
      ))}
    </div>
  )
}

/** A framed checkbox row — the whole row is the hit target. */
export function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  hint?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border-2 border-ink bg-surface px-3 py-2 shadow-brutal-sm transition hover:bg-accent-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-accent-strong"
      />
      <span className="min-w-0">
        <span className={`block text-sm font-bold ${checked ? 'text-ink' : 'text-ink-muted'}`}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-2xs leading-snug text-ink-faint">{hint}</span>}
      </span>
    </label>
  )
}

/**
 * A range slider that stays visually responsive while dragging but only emits
 * `onCommit` once the value is released (mouse up / touch end / key up). This
 * keeps the slider smooth without flooding the server with one `update_settings`
 * per pixel of drag — which would otherwise trip the per-socket rate limiter.
 */
export function SettingSlider({
  value,
  min,
  max,
  step,
  format,
  onCommit,
}: {
  value: number
  min: number
  max: number
  step: number
  format: (n: number) => string
  onCommit: (n: number) => void
}) {
  // While dragging we track the value locally; `null` means "follow the
  // authoritative server value". The local override is dropped whenever the
  // confirmed server value changes (adjusting state during render, per the
  // React "you might not need an effect" guidance).
  const [local, setLocal] = useState<number | null>(null)
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setLocal(null)
  }
  const display = local ?? value

  const commit = (n: number) => {
    if (n !== value) onCommit(n)
  }

  return (
    <div>
      <div className="text-lg font-bold text-ink">{format(display)}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={display}
        onChange={(e) => setLocal(Number(e.target.value))}
        onMouseUp={(e) => commit(Number(e.currentTarget.value))}
        onTouchEnd={(e) => commit(Number(e.currentTarget.value))}
        onKeyUp={(e) => commit(Number(e.currentTarget.value))}
        className="mt-1 w-full accent-accent-strong"
      />
      <div className="flex justify-between text-3xs font-bold uppercase text-ink-faint">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}
