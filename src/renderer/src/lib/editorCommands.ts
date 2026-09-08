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

let runner: Runner | null = null
let selectionReader: (() => string | null) | null = null

export function registerEditorCommands(next: Runner): () => void {
  runner = next
  return () => {
    if (runner === next) runner = null
  }
}

export function registerSelectionMarkdown(next: () => string | null): () => void {
  selectionReader = next
  return () => {
    if (selectionReader === next) selectionReader = null
  }
}

let documentReader: (() => string | null) | null = null

export function registerDocumentMarkdown(next: () => string | null): () => void {
  documentReader = next
  return () => {
    if (documentReader === next) documentReader = null
  }
}

export function readDocumentMarkdown(): string | null {
  return documentReader?.() ?? null
}

export function readSelectionMarkdown(): string | null {
  return selectionReader?.() ?? null
}

export function focusEditor(): HTMLElement | null {
  const el = document.querySelector<HTMLElement>('.milkdown .ProseMirror, .source-editor')
  el?.focus()
  return el
}

export function runEditorCommand(command: EditorCommand): boolean {
  focusEditor()
  return runner?.(command) ?? false
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
