export type TexSlotKind = 'slot' | 'mark'

export interface TexSlot {
  start: number
  end: number
  kind: TexSlotKind
}

const SLOT_COMMANDS = new Set([
  'title',
  'subtitle',
  'author',
  'thanks',
  'date',
  'part',
  'chapter',
  'section',
  'subsection',
  'subsubsection',
  'paragraph',
  'caption',
  'keywords',
  'IEEEkeywords',
  'IEEEauthorblockN',
  'IEEEauthorblockA',
  'authornote',
  'affiliation',
  'email',
  'institution',
  'address'
])

const PLACEHOLDER =
  /paper title|subsection heading here|subsubsection heading here|the abstract goes here|author name|given name surname|email address|anonymous author|lorem ipsum|your title|insert title|论文标题|作者姓名|待填|待替换|在此填写|TODO|FIXME|TBD|WIP/i

export function findTexSlots(source: string): TexSlot[] {
  if (!source || source.length > 400_000) return []
  const found: TexSlot[] = []
  collectCommandSlots(source, found)
  collectPlainMarks(source, found)
  return mergeSlots(found).slice(0, 400)
}

export function renderTexBackdrop(source: string, slots: TexSlot[]): string {
  const text = source || ' '
  if (slots.length === 0) return escapeHtml(text) + '\n'
  let html = ''
  let cursor = 0
  for (const slot of slots) {
    if (slot.start > cursor) html += escapeHtml(text.slice(cursor, slot.start))
    const cls = slot.kind === 'mark' ? 'tex-slot is-mark' : 'tex-slot'
    html += `<mark class="${cls}">${escapeHtml(text.slice(slot.start, slot.end))}</mark>`
    cursor = slot.end
  }
  if (cursor < text.length) html += escapeHtml(text.slice(cursor))
  return html + '\n'
}

function collectCommandSlots(source: string, out: TexSlot[]): void {
  const re = /\\([A-Za-z]+)\*?/g
  for (const match of source.matchAll(re)) {
    const index = match.index ?? 0
    if (isEscaped(source, index) || inComment(source, index)) continue
    if (!SLOT_COMMANDS.has(match[1])) continue
    let i = index + match[0].length
    i = skipSpace(source, i)
    if (source[i] === '[') {
      const close = skipGroup(source, i, '[', ']')
      if (close < 0) continue
      pushGroup(out, source, i, close)
      i = skipSpace(source, close + 1)
    }
    if (source[i] !== '{') continue
    const close = skipGroup(source, i, '{', '}')
    if (close < 0) continue
    pushGroup(out, source, i, close)
  }
}

function collectPlainMarks(source: string, out: TexSlot[]): void {
  for (const match of source.matchAll(/[!！]{2,}|[?？]{2,}/g)) {
    const index = match.index ?? 0
    out.push({ start: index, end: index + match[0].length, kind: 'mark' })
  }
  const lineRe = /^.*$/gm
  for (const match of source.matchAll(lineRe)) {
    const line = match[0]
    const percent = unescapedIndex(line, '%')
    if (percent < 0) continue
    const comment = line.slice(percent)
    PLACEHOLDER.lastIndex = 0
    if (!PLACEHOLDER.test(comment)) continue
    const start = (match.index ?? 0) + percent
    out.push({ start, end: start + comment.length, kind: 'mark' })
  }
}

function pushGroup(out: TexSlot[], source: string, open: number, close: number): void {
  if (close <= open) return
  if (close === open + 1) {
    out.push({ start: open, end: close + 1, kind: 'mark' })
    return
  }
  const inner = source.slice(open + 1, close)
  out.push({ start: open + 1, end: close, kind: looksLikePlaceholder(inner) ? 'mark' : 'slot' })
}

function looksLikePlaceholder(text: string): boolean {
  const trimmed = text.replace(/\\[a-zA-Z]+\*?/g, ' ').replace(/[{}\[\]]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!trimmed) return true
  if (/^[.!！?？,，、\-—_xX]+$/.test(trimmed)) return true
  if (/[!！]{2,}|[?？]{2,}/.test(trimmed)) return true
  PLACEHOLDER.lastIndex = 0
  return PLACEHOLDER.test(trimmed)
}

function mergeSlots(slots: TexSlot[]): TexSlot[] {
  if (slots.length === 0) return slots
  const sorted = [...slots].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: TexSlot[] = []
  for (const slot of sorted) {
    if (slot.end <= slot.start) continue
    const last = merged[merged.length - 1]
    if (!last || slot.start > last.end) {
      merged.push({ ...slot })
      continue
    }
    last.end = Math.max(last.end, slot.end)
    if (slot.kind === 'mark' || last.kind === 'mark') last.kind = 'mark'
  }
  return merged
}

function skipGroup(source: string, open: number, left: string, right: string): number {
  if (source[open] !== left) return -1
  let depth = 0
  const limit = Math.min(source.length, open + 80_000)
  for (let i = open; i < limit; i++) {
    const ch = source[i]
    if (ch === '\\') {
      i += 1
      continue
    }
    if (ch === '%') {
      const nl = source.indexOf('\n', i)
      if (nl < 0 || nl >= limit) return -1
      i = nl
      continue
    }
    if (ch === left) depth += 1
    else if (ch === right) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function skipSpace(source: string, index: number): number {
  let i = index
  while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i += 1
  return i
}

function isEscaped(source: string, index: number): boolean {
  let n = 0
  for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) n += 1
  return n % 2 === 1
}

function inComment(source: string, index: number): boolean {
  const line = source.lastIndexOf('\n', index - 1) + 1
  for (let i = line; i < index; i++) {
    if (source[i] === '\\') {
      i += 1
      continue
    }
    if (source[i] === '%') return true
  }
  return false
}

function unescapedIndex(line: string, needle: string): number {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') {
      i += 1
      continue
    }
    if (line[i] === needle) return i
  }
  return -1
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
