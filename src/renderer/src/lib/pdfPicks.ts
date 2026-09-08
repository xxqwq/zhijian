const KEY = 'zhijian.pdfPicks'
const MAX = 80

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function readPdfPick(notePath: string | null): string | null {
  if (!notePath) return null
  const value = readMap()[notePath]
  return value && typeof value === 'string' ? value : null
}

export function writePdfPick(notePath: string | null, pdfPath: string): void {
  if (!notePath || !pdfPath) return
  try {
    const map = readMap()
    const next: Record<string, string> = { [notePath]: pdfPath }
    for (const [key, value] of Object.entries(map)) {
      if (key !== notePath) next[key] = value
    }
    const keys = Object.keys(next)
    if (keys.length > MAX) {
      for (const key of keys.slice(MAX)) delete next[key]
    }
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
