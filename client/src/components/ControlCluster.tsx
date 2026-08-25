import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type ControlClusterPlacement = 'inline' | 'floating'

export interface ControlClusterProps {
  /**
   * Controls that stay visible at every width. Keep this to the two or three
   * the page can't function without — on a 360px phone that is already most of
   * the available row.
   */
  children?: ReactNode
  /**
   * Controls that collapse behind a "⋯" toggle **below `sm` (640px)** and sit
   * inline from `sm` up. Settings-shaped things belong here: sound, language,
   * and any secondary room action.
   *
   * These render exactly once — the same node is a right-aligned dropdown panel
   * on phones and a plain row on wider screens — so it is safe to pass a
   * stateful control (one that owns a store, a modal or a toast) without it
   * being mounted twice. Anything that opens its **own** anchored dropdown
   * (`AuthMenu`) belongs in `children` instead, so its panel isn't nested
   * inside this one.
   */
  overflow?: ReactNode
  /**
   * `inline` (default) renders in flow — put it in a header row and let the
   * header do the positioning. `floating` pins the cluster to the page's
   * top-right corner for pages with no header of their own.
   */
  placement?: ControlClusterPlacement
  /** Accessible name for the group. Defaults to a generic "Settings". */
  label?: string
  className?: string
}

/**
 * The corner control cluster shared by Home and the Lobby — sound, language,
 * account, and the page's own room actions.
 *
 * It exists because both pages had grown the same hand-rolled `flex gap-2` row
 * of five-ish controls, which is the single worst thing on either page at phone
 * width: a "Sign in with Google" button plus two toggles plus two room actions
 * cannot share a 360px line. The fix is a priority split — `children` always
 * show, `overflow` folds into a menu below `sm` — done once, here.
 *
 * The collapse is pure CSS on a single set of nodes (no media-query hook), so
 * consumers don't inherit a `matchMedia` dependency in their tests and there is
 * no first-paint flash of the wrong layout.
 */
export function ControlCluster({
  children,
  overflow,
  placement = 'inline',
  label,
  className = '',
}: ControlClusterProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // Same dismiss contract as `AuthMenu`: outside pointer-down or Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const positioning = placement === 'floating' ? 'absolute right-4 top-4 z-panel' : ''

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label ?? t('controls.label')}
      className={`relative flex items-center justify-end gap-2 ${positioning} ${className}`}
    >
      {children}

      {overflow != null && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={t('controls.more')}
            title={t('controls.more')}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink text-ink shadow-brutal-sm transition sm:hidden ${
              open ? 'bg-accent' : 'bg-surface hover:bg-surface-sunken'
            }`}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>

          {/* One node, two layouts: a framed dropdown sheet below `sm`, a plain
              inline row from `sm` up (where the toggle above is hidden).

              Deliberately role-less. ARIA `menu` would promise `menuitem`
              children with roving focus and typeahead, and the children are
              ordinary controls (toggles, a language switcher, room buttons)
              that implement none of it — and at `sm` and up this isn't a popup
              at all, so the role would be wrong there in every case. The
              toggle's `aria-expanded` + `aria-controls` carry the real
              relationship. */}
          <div
            id={panelId}
            className={`${open ? 'flex' : 'hidden'} absolute right-0 top-full z-panel mt-2 w-max flex-col items-end gap-2 rounded-xl border-2 border-ink bg-surface p-2 shadow-brutal sm:static sm:mt-0 sm:flex sm:w-auto sm:flex-row sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
          >
            {overflow}
          </div>
        </>
      )}
    </div>
  )
}
