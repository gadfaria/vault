/**
 * File types a browser shows without running anything. A blob: URL belongs to the app's
 * origin, so an SVG or HTML file opened from one could run a script that reads the Drive token.
 */
const INERT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'application/pdf',
])

export function isInertType(type: string): boolean {
  return INERT_TYPES.has(type.split(';')[0].trim().toLowerCase())
}

/** An object URL that is safe to open in a tab: anything not inert is served as a plain download. */
export function safeObjectUrl(blob: Blob): string {
  return URL.createObjectURL(isInertType(blob.type) ? blob : new Blob([blob], { type: 'application/octet-stream' }))
}
