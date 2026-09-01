// Guards the one thing about this component that can silently rot: that what a
// player reads on screen is the version the repo actually shipped, not a string
// someone typed into the locale files.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { APP_VERSION } from '@tuan-tanah/shared'
// Initialises the shared i18next instance the component's `useTranslation` reads.
import '@/i18n/index.js'
import { AppVersion } from './AppVersion.js'

describe('AppVersion', () => {
  it('renders the shared release version', () => {
    render(<AppVersion />)
    expect(screen.getByText(new RegExp(APP_VERSION.replace(/\./g, '\\.')))).toBeInTheDocument()
  })

  it('omits the build SHA when built from source', () => {
    // Vitest sets no VITE_BUILD_SHA, which is the `pnpm dev` case — the label
    // must degrade to a bare version rather than a dangling separator.
    render(<AppVersion />)
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument()
  })
})
