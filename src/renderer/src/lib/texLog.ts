const HIT_RE = /((?:[A-Za-z]:[\\/])?[^:\n]*?\.tex):(\d+):/g

export type TexLogPart = { text: string; file?: string; line?: number }

export function splitTexLog(log: string): TexLogPart[] {
  const parts: TexLogPart[] = []
  const re = new RegExp(HIT_RE.source, 'g')
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(log))) {
    if (match.index > last) parts.push({ text: log.slice(last, match.index) })
    parts.push({ text: match[0], file: match[1], line: Number(match[2]) })
    last = match.index + match[0].length
  }
  if (last < log.length) parts.push({ text: log.slice(last) })
  return parts
}

export function joinPath(root: string, name: string): string {
  const file = name.replace(/^\.[\\/]/, '')
  if (/^[a-zA-Z]:[\\/]/.test(file) || file.startsWith('/')) return file
  const sep = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[\\/]+$/, '')}${sep}${file.replace(/[\\/]+/g, sep)}`
}

export function dirOf(file: string): string {
  return file.replace(/[/\\][^/\\]+$/, '')
}

export function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase()
}

export function underDir(root: string, file: string): boolean {
  const left = root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const right = file.replace(/\\/g, '/').toLowerCase()
  return right === left || right.startsWith(`${left}/`)
}
