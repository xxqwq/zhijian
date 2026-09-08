import { buildCopyHtml, markdownToPlain } from '@renderer/lib/exportHtml'
import { readDocumentMarkdown, readSelectionMarkdown } from '@renderer/lib/editorCommands'
import { useAppStore } from '@renderer/store/appStore'

export type CopyAsKind = 'markdown' | 'plain' | 'html'

export async function copyAs(kind: CopyAsKind): Promise<void> {
  const store = useAppStore.getState()
  const { theme, currentFile, setToast } = store
  const selected = readSelectionMarkdown()
  const markdown = selected ?? readDocumentMarkdown() ?? store.activeMarkdown()
  if (!markdown.trim()) {
    setToast('没有可复制的内容')
    return
  }

  if (kind === 'markdown') {
    await writeClipboard({ text: markdown })
    setToast(selected ? '已复制选区 Markdown' : '已复制全文 Markdown')
    return
  }

  const plain = markdownToPlain(markdown)
  if (kind === 'plain') {
    await writeClipboard({ text: plain })
    setToast(selected ? '已复制选区纯文本' : '已复制全文纯文本')
    return
  }

  await writeClipboard({
    text: plain,
    html: buildCopyHtml(markdown, theme, currentFile)
  })
  setToast(selected ? '已复制选区 HTML' : '已复制全文 HTML')
}

async function writeClipboard(payload: { text: string; html?: string }): Promise<void> {
  if (window.ink?.writeClipboard) {
    await window.ink.writeClipboard(payload)
    return
  }
  await navigator.clipboard.writeText(payload.text)
}
