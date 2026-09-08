import { useEffect, useRef } from 'react'
import { registerEditorCommands, registerSelectionMarkdown, type EditorCommand } from '@renderer/lib/editorCommands'
import { bindSplitScroll } from '@renderer/lib/scrollSync'
import { useAppStore } from '@renderer/store/appStore'

export function SourceEditor() {
  const content = useAppStore((s) => s.content)
  const setContent = useAppStore((s) => s.setContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    const source = textareaRef.current
    const preview = document.querySelector('.preview-pane')
    if (!source || !(preview instanceof HTMLElement)) return
    return bindSplitScroll(source, preview, () => useAppStore.getState().content)
  }, [])

  return (
    <textarea
      ref={textareaRef}
      className="source-editor"
      spellCheck={false}
      value={content}
      onChange={(event) => setContent(event.target.value)}
      aria-label="Markdown 源码"
    />
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
