const WIN_ABS = /^[A-Za-z]:[\\/]/
const UNC = /^\\\\[^\\]/
const FILE_URL = /^file:/i
const HTTP = /^https?:\/\//i
const DOI_PREFIX = /^doi:\s*/i
const DOI = /^10\.\d{4,}\/\S+/
const FILE_EXT =
  /\.(pdf|png|jpe?g|gif|webp|svg|bmp|md|markdown|txt|docx?|xlsx?|pptx?|html?|zip|mp4|mp3)$/i
const PATH_KEYS = new Set(['pdf', 'source', 'file', 'path', 'attachment'])

export function decodeOpenTarget(value: string): string {
  const trimmed = value.trim().replace(/^<|>$/g, '')
  try {
    return decodeURIComponent(trimmed)
  } catch {
    return trimmed
  }
}

/** Strip trailing comments like ` (与本译文同目录)` and extra slashes. */
export function stripPathNoise(value: string): string {
  return value
    .replace(/\s*[\(（][^\)）]*[\)）]\s*$/u, '')
    .replace(/[\\/]+$/, '')
    .trim()
}

export function classifyOpenTarget(value: string, key?: string): 'url' | 'path' | null {
  const v = decodeOpenTarget(value)
  if (!v) return null
  if (HTTP.test(v) || DOI_PREFIX.test(v) || DOI.test(v)) return 'url'
  if (key?.toLowerCase() === 'doi') return 'url'
  if (FILE_URL.test(v) || WIN_ABS.test(v) || UNC.test(v)) return 'path'
  if (key && PATH_KEYS.has(key.toLowerCase())) return 'path'
  if (
    (v.startsWith('./') || v.startsWith('../') || v.includes('\\') || v.includes('/')) &&
    FILE_EXT.test(v)
  ) {
    return 'path'
  }
  return null
}

export function isPathLike(value: string): boolean {
  const v = decodeOpenTarget(value)
  return FILE_URL.test(v) || WIN_ABS.test(v) || UNC.test(v) || (v.includes('/') && v.length > 48)
}

export function isPdfPath(value: string): boolean {
  return /\.pdf$/i.test(decodeOpenTarget(value).split(/[?#]/)[0] ?? '')
}

export type ResolveResult =
  | { ok: true; kind: 'path'; value: string }
  | { ok: true; kind: 'url'; value: string }
  | { ok: false; error: string }
