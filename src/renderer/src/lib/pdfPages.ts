const KEY = 'zhijian.pdfPages'
const MAX = 80

function readMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function readPdfPage(path: string): number {
  const page = readMap()[path]
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function writePdfPage(path: string, page: number): void {
  if (!path || page < 1) return
  try {
    const map = readMap()
    const next: Record<string, number> = { [path]: page }
    for (const [key, value] of Object.entries(map)) {
      if (key !== path) next[key] = value
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
