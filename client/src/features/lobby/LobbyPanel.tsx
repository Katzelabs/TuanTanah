import type { ReactNode } from 'react'
import { Card } from '@/components/ui/index.js'

/**
 * The lobby's one panel shape: a sunken well on the paper background holding
 * white, framed content (rows, tiles, controls). It's the same figure/ground
 * the `Tabs` strip uses — a recessed track with raised pieces in it — so the
 * three panels read as one system instead of three stacks of loose cards.
 *
 * Nested content should be `flat` (`brutal-sm`): it sits inside an already
 * framed parent, per the elevation table in `tailwind.config.ts`.
 */
export function LobbyPanel({
  title,
  aside,
  children,
  className = '',
}: {
  title: ReactNode
  /** Right-hand slot on the heading row — a count chip, a status badge. */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card tone="sunken" pad="sm" className={`space-y-3 sm:p-4 ${className}`}>
      <div className="flex min-h-[1.5rem] items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  )
}

/** Sub-heading inside a panel — one step quieter than the panel title. */
export function PanelSubheading({ children }: { children: ReactNode }) {
  return <h3 className="text-2xs font-bold uppercase tracking-wide text-ink-muted">{children}</h3>
}
