import { describe, expect, it } from 'vitest'
import { initialsOf } from './initials.js'

describe('initialsOf', () => {
  it('takes the first and last word', () => {
    expect(initialsOf('Sri Mulyani')).toBe('SM')
    expect(initialsOf('Raden Mas Said')).toBe('RS')
  })

  it('falls back to one letter for a single word', () => {
    expect(initialsOf('budi')).toBe('B')
  })

  it('tolerates padding and an empty name', () => {
    expect(initialsOf('  Sri   Mulyani  ')).toBe('SM')
    expect(initialsOf('   ')).toBe('?')
  })

  // Naive [0] indexing would slice a surrogate pair in half and render a
  // replacement glyph.
  it('keeps a non-BMP first character whole', () => {
    expect(initialsOf('😀 zidan')).toBe('😀Z')
  })
})
