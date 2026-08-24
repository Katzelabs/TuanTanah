/**
 * Up to two initials for an account: first letter of the first and last word.
 * Iterates code points, not UTF-16 units, so an emoji or a non-BMP name doesn't
 * come out as half a character.
 */
export function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = [...words[0]][0] ?? ''
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : ''
  return (first + last).toUpperCase()
}
