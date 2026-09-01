// EN and ID must stay in lockstep. `shared/i18n/messages` has had a parity test
// for the engine's log/error codes since those were keyed; the client's own UI
// strings never got one, and they're now the larger of the two surfaces.
//
// A missing key isn't a crash — i18next silently falls back to printing the key
// path — so nothing else in the suite would catch it.
import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import id from './locales/id.json'

type Tree = { [k: string]: string | Tree }

function paths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const here = prefix ? `${prefix}.${k}` : k
    return typeof v === 'string' ? [here] : paths(v, here)
  })
}

/** `{{name}}` placeholders a string expects, so a translation can't drop one. */
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{\{\s*([\w]+)/g)].map((m) => m[1]!).sort()
}

function at(tree: Tree, path: string): string {
  return path.split('.').reduce<string | Tree>((node, key) => (node as Tree)[key]!, tree) as string
}

describe('locale parity', () => {
  const enPaths = paths(en as Tree)
  const idPaths = paths(id as Tree)

  it('translates every English string into Indonesian', () => {
    expect(enPaths.filter((p) => !idPaths.includes(p))).toEqual([])
  })

  it('has no Indonesian strings with nothing to translate', () => {
    expect(idPaths.filter((p) => !enPaths.includes(p))).toEqual([])
  })

  it('keeps the same interpolation placeholders in both languages', () => {
    const mismatched = enPaths
      .filter((p) => idPaths.includes(p))
      .filter(
        (p) => placeholders(at(en as Tree, p)).join() !== placeholders(at(id as Tree, p)).join(),
      )
    expect(mismatched).toEqual([])
  })
})
