import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: ReactNode
}

type Size = 'sm' | 'md'

/** Matches the `Button` size steps so a tab strip sits level with nearby controls. */
const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm', // sidebars and in-game panels
  md: 'px-4 py-2 text-base', // page-level section switching
}

export interface TabsProps {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  /** `sm` (default) for panel strips, `md` for page-level tabs. */
  size?: Size
  className?: string
}

/**
 * Brutalist segmented control: a framed strip of tabs where the active one is
 * raised with an accent fill and hard shadow. Controlled — the parent owns the
 * `active` id and updates it from `onChange`.
 *
 * The strip is a `sunken` well with the frame weight; the active tab is the
 * only elevated child (`brutal-sm` — nested inside an already-framed parent).
 */
export function Tabs({ tabs, active, onChange, size = 'sm', className = '' }: TabsProps) {
  return (
    <div
      className={`flex gap-1 rounded-xl border-2 border-ink bg-surface-sunken p-1 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-lg font-bold transition ${SIZE[size]} ${
              isActive
                ? 'border-2 border-ink bg-accent text-ink shadow-brutal-sm'
                : 'border-2 border-transparent text-ink-muted hover:bg-surface'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
