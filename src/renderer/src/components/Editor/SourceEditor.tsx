import { useEffect, useMemo, useRef } from 'react'
import { registerEditorCommands, registerSelectionMarkdown, type EditorCommand } from '@renderer/lib/editorCommands'
import { caretLineCol, jumpTextareaToLine } from '@renderer/lib/editorNav'
import { findTexSlots, renderTexBackdrop } from '@renderer/lib/texSlots'
import { isTexSource } from '@shared/types'
import { useAppStore } from '@renderer/store/appStore'

export function SourceEditor() {
  const content = useAppStore((s) => s.content)
  const currentFile = useAppStore((s) => s.currentFile)
  const setContent = useAppStore((s) => s.setContent)
  const reveal = useAppStore((s) => s.reveal)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLPreElement>(null)
  const texDoc = isTexSource(currentFile ?? '')
  const backdrop = useMemo(
    () => (texDoc ? renderTexBackdrop(content, findTexSlots(content)) : ''),
    [content, texDoc]
  )

  const syncBackdrop = (): void => {
    const source = textareaRef.current
    const layer = backdropRef.current
    if (!source || !layer) return
    layer.scrollTop = source.scrollTop
    layer.scrollLeft = source.scrollLeft
  }

  useEffect(() => {
    const offCommands = registerEditorCommands((command) => {
      const textarea = textareaRef.current
      if (!textarea) return false
      return applySourceCommand(textarea, command, setContent)
    }, 'source')
    const offSelection = registerSelectionMarkdown(() => {
      const textarea = textareaRef.current
      if (!textarea) return null
      const { selectionStart, selectionEnd, value } = textarea
      if (selectionStart === selectionEnd) return null
      return value.slice(selectionStart, selectionEnd)
    }, 'source')
    textareaRef.current?.focus()
    return () => {
      offCommands()
      offSelection()
    }
  }, [setContent])

  useEffect(() => {
    syncBackdrop()
  }, [backdrop, content])

  useEffect(() => {
    const wrap = textareaRef.current?.parentElement
    if (!wrap) return
    const ro = new ResizeObserver(() => syncBackdrop())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [texDoc])

  useEffect(() => {
    if (!reveal || !currentFile) return
    if (reveal.path.replace(/\\/g, '/').toLowerCase() !== currentFile.replace(/\\/g, '/').toLowerCase()) {
      return
    }
    const textarea = textareaRef.current
    if (!textarea) return
    const { path, line } = reveal
    window.requestAnimationFrame(() => {
      if (textareaRef.current) jumpTextareaToLine(textarea, line)
      const current = useAppStore.getState().reveal
      if (current?.path === path && current.line === line) {
        useAppStore.getState().clearReveal()
      }
    })
  }, [reveal, currentFile])

  const editor = (
    <textarea
      ref={textareaRef}
      className="source-editor"
      spellCheck={false}
      title={texDoc ? 'Ctrl+点击跳到 PDF 对应页' : undefined}
      value={content}
      onChange={(event) => setContent(event.target.value)}
      onScroll={syncBackdrop}
      onClick={(event) => {
        if (!texDoc || (!event.ctrlKey && !event.metaKey)) return
        const textarea = textareaRef.current
        if (!textarea) return
        event.preventDefault()
        const { line, column } = caretLineCol(textarea)
        void syncSourceToPdf(line, column)
      }}
      aria-label="源码"
    />
  )

  if (!texDoc) return editor

  return (
    <div className="source-editor-wrap">
      <pre
        ref={backdropRef}
        className="source-editor-backdrop"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: backdrop }}
      />
      {editor}
    </div>
  )
}

function applySourceCommand(
  textarea: HTMLTextAreaElement,
  command: EditorCommand,
  setContent: (value: string) => void
): boolean {
  textarea.focus()
  if (command === 'undo') return document.execCommand('undo')
  if (command === 'redo') return document.execCommand('redo')

  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end)

  const replace = (next: string, selectFrom: number, selectTo: number): void => {
    setContent(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(selectFrom, selectTo)
    })
  }

  const wrap = (before: string, after = before): boolean => {
    replace(
      value.slice(0, start) + before + selected + after + value.slice(end),
      start + before.length,
      end + before.length
    )
    return true
  }

  const prefixLine = (prefix: string): boolean => {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    replace(value.slice(0, lineStart) + prefix + value.slice(lineStart), start + prefix.length, end + prefix.length)
    return true
  }

  switch (command) {
    case 'bold':
      return wrap('**')
    case 'italic':
      return wrap('*')
    case 'strikethrough':
      return wrap('~~')
    case 'inline-code':
      return wrap('`')
    case 'heading-1':
      return prefixLine('# ')
    case 'heading-2':
      return prefixLine('## ')
    case 'heading-3':
      return prefixLine('### ')
    case 'heading-4':
      return prefixLine('#### ')
    case 'heading-5':
      return prefixLine('##### ')
    case 'heading-6':
      return prefixLine('###### ')
    case 'bullet-list':
      return prefixLine('- ')
    case 'ordered-list':
      return prefixLine('1. ')
    case 'task-list':
      return prefixLine('- [ ] ')
    case 'quote':
      return prefixLine('> ')
    case 'code-block':
      return wrap('\n```\n', '\n```\n')
    case 'paragraph':
      return true
    default:
      return false
  }
}

async function syncSourceToPdf(line: number, column: number): Promise<void> {
  const store = useAppStore.getState()
  const texPath = store.currentFile
  const pdfPath = store.pdfPath
  if (!texPath || !pdfPath) {
    store.setToast('请先编译出 PDF')
    return
  }
  if (typeof window.ink?.synctexView !== 'function') {
    store.setToast('请完全退出纸间后再同步 PDF')
    return
  }
  const result = await window.ink.synctexView(texPath, line, column, pdfPath)
  if (!result.ok) {
    store.setToast(result.error)
    return
  }
  store.setPdfSync(result.page, result.y)
}
