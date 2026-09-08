import { selectionInPdf } from '@renderer/lib/pdfUi'

export type EditorCommand =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inline-code'
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'bullet-list'
  | 'ordered-list'
  | 'task-list'
  | 'quote'
  | 'code-block'

export type ClipboardCommand = 'cut' | 'copy' | 'paste' | 'selectAll'

type Runner = (command: EditorCommand) => boolean
export type EditorSurface = 'source' | 'wysiwyg'

let commandRunners: Partial<Record<EditorSurface, Runner>> = {}
let selectionReaders: Partial<Record<EditorSurface, () => string | null>> = {}
let documentReader: (() => string | null) | null = null

function activeSurface(): EditorSurface {
  const active = document.activeElement
  if (active instanceof HTMLTextAreaElement && active.classList.contains('source-editor')) {
    return 'source'
  }
  return 'wysiwyg'
}

export function registerEditorCommands(
  next: Runner,
  surface: EditorSurface = 'wysiwyg'
): () => void {
  commandRunners[surface] = next
  return () => {
    if (commandRunners[surface] === next) delete commandRunners[surface]
  }
}

export function registerSelectionMarkdown(
  next: () => string | null,
  surface: EditorSurface = 'wysiwyg'
): () => void {
  selectionReaders[surface] = next
  return () => {
    if (selectionReaders[surface] === next) delete selectionReaders[surface]
  }
}

export function registerDocumentMarkdown(next: () => string | null): () => void {
  documentReader = next
  return () => {
    if (documentReader === next) documentReader = null
  }
}

export function readDocumentMarkdown(): string | null {
  const source = document.querySelector<HTMLTextAreaElement>('.source-editor')
  if (source && (activeSurface() === 'source' || document.querySelector('.app.source-mode'))) {
    return source.value
  }
  return documentReader?.() ?? null
}

export function readSelectionMarkdown(): string | null {
  const surface = activeSurface()
  return (
    selectionReaders[surface]?.() ??
    selectionReaders.wysiwyg?.() ??
    selectionReaders.source?.() ??
    null
  )
}

export function focusEditor(): HTMLElement | null {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    if (active.classList.contains('source-editor')) return active
    const prose = active.closest('.ProseMirror')
    if (prose instanceof HTMLElement) return prose
  }
  if (document.querySelector('.app.source-mode')) {
    const source = document.querySelector<HTMLElement>('.source-editor')
    source?.focus()
    return source
  }
  const el = document.querySelector<HTMLElement>('.milkdown .ProseMirror, .source-editor')
  el?.focus()
  return el
}

export function runEditorCommand(command: EditorCommand): boolean {
  const surface = activeSurface()
  if (surface === 'source') {
    document.querySelector<HTMLTextAreaElement>('.source-editor')?.focus()
    return commandRunners.source?.(command) ?? false
  }
  focusEditor()
  return commandRunners.wysiwyg?.(command) ?? commandRunners.source?.(command) ?? false
}

export async function runClipboard(command: ClipboardCommand): Promise<void> {
  if ((command === 'copy' || command === 'cut') && selectionInPdf()) {
    const text = window.getSelection()?.toString() ?? ''
    if (text && window.ink?.writeClipboard) {
      await window.ink.writeClipboard({ text })
      return
    }
    document.execCommand('copy')
    return
  }
  focusEditor()
  if (!window.ink?.nativeEdit) {
    document.execCommand(command === 'selectAll' ? 'selectAll' : command)
    return
  }
  await window.ink.nativeEdit(command)
}
