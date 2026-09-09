import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { previewScrollEl } from '@renderer/lib/tabs'
import { useAppStore } from '@renderer/store/appStore'

export function jumpTextareaToLine(textarea: HTMLTextAreaElement, line: number): void {
  const value = textarea.value
  const lines = value.split('\n')
  const index = Math.max(0, Math.min(Math.max(1, line) - 1, lines.length - 1))
  let start = 0
  for (let i = 0; i < index; i++) start += lines[i].length + 1
  const end = start + lines[index].length
  textarea.focus()
  textarea.setSelectionRange(start, Math.max(start, end))
  const ratio = start / Math.max(1, value.length)
  textarea.scrollTop = Math.max(0, textarea.scrollHeight * ratio - textarea.clientHeight * 0.28)
}

export function jumpToSourceLine(line: number, hint?: string): void {
  const textarea = document.querySelector('.source-editor')
  if (textarea instanceof HTMLTextAreaElement) {
    jumpTextareaToLine(textarea, line)
    return
  }
  const needle = hint?.trim()
  if (needle) findInEditor(needle.slice(0, 80))
}

export function caretLineCol(textarea: HTMLTextAreaElement): { line: number; column: number } {
  const before = textarea.value.slice(0, textarea.selectionStart)
  const at = before.split('\n')
  return { line: at.length, column: at[at.length - 1]?.length ?? 0 }
}

export function jumpToHeading(text: string, index: number): void {
  const textarea = document.querySelector('.source-editor')
  if (textarea instanceof HTMLTextAreaElement && document.querySelector('.app.tex-doc')) {
    jumpInSource(textarea, text)
    return
  }
  const root = document.querySelector('.milkdown')
  const stage = previewScrollEl()
  if (!root) return
  const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')]
  const match =
    headings.find((node) => node.textContent?.trim() === text) ?? headings[index]
  if (!match) return
  if (stage) {
    const top =
      match.getBoundingClientRect().top - stage.getBoundingClientRect().top + stage.scrollTop - 28
    const synced = Boolean(document.querySelector('.app.source-mode'))
    stage.scrollTo({ top, behavior: synced ? 'auto' : 'smooth' })
  } else {
    match.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function jumpInSource(textarea: HTMLTextAreaElement, text: string): void {
  const needle = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `\\\\(?:part|chapter|section|subsection|subsubsection)\\*?\\{${needle}\\}`
  )
  const match = re.exec(textarea.value)
  if (!match) return
  const at = match.index
  textarea.focus()
  textarea.setSelectionRange(at, at + match[0].length)
  const line = textarea.value.slice(0, at).split(/\n/).length
  textarea.scrollTop = Math.max(0, (line - 4) * 24)
}

export function findInEditor(query: string, backward = false): boolean {
  if (!query) return false
  const source = visibleSourceEditor()
  if (source) return findInTextarea(source, query, backward)
  return findInWysiwyg?.(query, backward) ?? false
}

export function replaceInEditor(query: string, replacement: string, all: boolean): number {
  if (!query) return 0
  if (all) return replaceAllMarkdown(query, replacement)
  const source = visibleSourceEditor()
  if (source) return replaceInTextarea(source, query, replacement)
  return replaceInWysiwyg?.(query, replacement) ?? 0
}

type FindFn = (query: string, backward?: boolean) => boolean
type ReplaceFn = (query: string, replacement: string) => number

let findInWysiwyg: FindFn | null = null
let replaceInWysiwyg: ReplaceFn | null = null

export function registerWysiwygFind(next: FindFn): () => void {
  findInWysiwyg = next
  return () => {
    if (findInWysiwyg === next) findInWysiwyg = null
  }
}

export function registerWysiwygReplace(next: ReplaceFn): () => void {
  replaceInWysiwyg = next
  return () => {
    if (replaceInWysiwyg === next) replaceInWysiwyg = null
  }
}

export function findInProseMirror(view: EditorView, query: string, backward = false): boolean {
  if (!query) return false
  const { text, map } = collectTextMap(view.state.doc)
  if (!text.includes(query)) return false
  const sel = view.state.selection
  const hit = nextIndex(text, query, textIndexForPos(map, backward ? sel.from : sel.to), backward)
  if (hit < 0) return false
  const from = map[hit]
  const last = map[hit + query.length - 1]
  if (from == null || last == null) return false
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, last + 1)).scrollIntoView())
  view.focus()
  return true
}

export function replaceInProseMirror(view: EditorView, query: string, replacement: string): number {
  const { from, to } = view.state.selection
  const selected = view.state.doc.textBetween(from, to, '')
  if (selected !== query && !findInProseMirror(view, query, false)) return 0
  const range = view.state.selection
  view.dispatch(view.state.tr.insertText(replacement, range.from, range.to).scrollIntoView())
  view.focus()
  return 1
}

function visibleSourceEditor(): HTMLTextAreaElement | null {
  if (!document.querySelector('.app.tex-doc') && !document.querySelector('.app.source-mode')) {
    return null
  }
  const source = document.querySelector('.source-editor')
  return source instanceof HTMLTextAreaElement ? source : null
}

function findInTextarea(textarea: HTMLTextAreaElement, query: string, backward: boolean): boolean {
  const { value } = textarea
  if (!value.includes(query)) return false
  const from = backward ? textarea.selectionStart : textarea.selectionEnd
  const at = nextIndex(value, query, from, backward)
  if (at < 0) return false
  textarea.focus()
  textarea.setSelectionRange(at, at + query.length)
  const ratio = at / Math.max(1, value.length)
  textarea.scrollTop = Math.max(0, textarea.scrollHeight * ratio - textarea.clientHeight * 0.28)
  return true
}

function replaceInTextarea(textarea: HTMLTextAreaElement, query: string, replacement: string): number {
  const { selectionStart, selectionEnd, value } = textarea
  if (value.slice(selectionStart, selectionEnd) !== query && !findInTextarea(textarea, query, false)) {
    return 0
  }
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const next = value.slice(0, start) + replacement + value.slice(end)
  useAppStore.getState().setContent(next)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start, start + replacement.length)
  })
  return 1
}

function replaceAllMarkdown(query: string, replacement: string): number {
  const store = useAppStore.getState()
  const source = store.content
  const count = source.split(query).length - 1
  if (count <= 0) return 0
  store.setContent(source.split(query).join(replacement))
  return count
}

function nextIndex(text: string, query: string, from: number, backward: boolean): number {
  if (backward) {
    const at = text.lastIndexOf(query, Math.max(0, from - 1))
    return at >= 0 ? at : text.lastIndexOf(query)
  }
  const at = text.indexOf(query, from)
  return at >= 0 ? at : text.indexOf(query)
}

function collectTextMap(doc: EditorView['state']['doc']): { text: string; map: number[] } {
  let text = ''
  const map: number[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (let i = 0; i < node.text.length; i += 1) {
      map.push(pos + i)
      text += node.text[i]
    }
  })
  return { text, map }
}

function textIndexForPos(map: number[], pos: number): number {
  const index = map.findIndex((value) => value >= pos)
  return index < 0 ? map.length : index
}
