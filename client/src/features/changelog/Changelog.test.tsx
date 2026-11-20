import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP_VERSION, CHANGELOG } from '@tuan-tanah/shared'
import i18n from '@/i18n/index.js'
import { Changelog } from './Changelog.js'

const KEY = 'tuan-tanah:lastSeenVersion'

function renderPage() {
  return render(
    <MemoryRouter>
      <Changelog />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  window.localStorage.clear()
})

describe('Changelog', () => {
  it('leads with the version the player is running', () => {
    renderPage()
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument()
    expect(screen.getByText(/you're on this/i)).toBeInTheDocument()
  })

  it('groups changes under New / Improved / Fixed', () => {
    renderPage()
    // One heading per kind per release — counted across every release on the
    // page, so the test holds once the changelog has more than one entry.
    const labels = { new: /^New$/, improved: /^Improved$/, fixed: /^Fixed$/ } as const
    for (const kind of Object.keys(labels) as (keyof typeof labels)[]) {
      const releasesWithKind = CHANGELOG.filter((r) => r.changes.some((c) => c.kind === kind))
      expect(screen.queryAllByText(labels[kind])).toHaveLength(releasesWithKind.length)
    }
  })

  it('renders every line of the newest release', () => {
    renderPage()
    for (const change of CHANGELOG[0]!.changes) {
      expect(screen.getByText(change.en)).toBeInTheDocument()
    }
  })

  it('renders the entries in the viewer language', async () => {
    await i18n.changeLanguage('id')
    renderPage()
    const change = CHANGELOG[0]!.changes[0]!
    expect(screen.getByText(change.id)).toBeInTheDocument()
    expect(screen.queryByText(change.en)).not.toBeInTheDocument()
  })

  it('counts as catching up, so the home card stops nagging', () => {
    window.localStorage.setItem(KEY, '0.1.0')
    renderPage()
    expect(window.localStorage.getItem(KEY)).toBe(APP_VERSION)
  })
})
