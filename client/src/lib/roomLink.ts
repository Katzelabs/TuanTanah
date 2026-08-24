/** The shareable URL for a room code — what `/room/:roomId` resolves. */
export function roomUrl(code: string): string {
  return `${window.location.origin}/room/${code}`
}
