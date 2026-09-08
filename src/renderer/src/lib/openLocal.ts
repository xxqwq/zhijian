import { classifyOpenTarget, isPdfPath } from '@shared/openTarget'
import { parseFrontmatterFields, splitFrontmatter } from '@renderer/lib/frontmatter'
import { useAppStore } from '@renderer/store/appStore'

export { classifyOpenTarget, isPathLike, isPdfPath } from '@shared/openTarget'

export async function openLocal(
  value: string,
  markdownPath?: string | null,
  key?: string
): Promise<void> {
  if (!window.ink?.resolveTarget) {
    useAppStore.getState().setToast('请重启纸间后再打开本地文件')
    return
  }
  try {
    const resolved = await window.ink.resolveTarget(value, markdownPath ?? null, key)
    if (!resolved.ok) {
      useAppStore.getState().setToast(resolved.error || '无法打开')
      return
    }
    if (resolved.kind === 'path' && isPdfPath(resolved.value)) {
      useAppStore.getState().openPdf(resolved.value)
      return
    }
    const opened = await window.ink.openTarget(resolved.value, markdownPath ?? null, key)
    if (!opened.ok) {
      useAppStore.getState().setToast(opened.error || '无法打开')
    }
  } catch {
    useAppStore.getState().setToast('请重启纸间后再打开本地文件')
  }
}

export async function toggleNotePdf(): Promise<void> {
  const store = useAppStore.getState()
  if (store.pdfPath) {
    store.closePdf()
    return
  }
  await openPdfFromNote(store.content, store.currentFile)
}

export async function openPdfFromNote(
  markdown: string,
  markdownPath: string | null
): Promise<void> {
  const fields = parseFrontmatterFields(splitFrontmatter(markdown).raw)
  const ordered = [
    ...fields.filter((item) => item.key === 'pdf'),
    ...fields.filter((item) => item.key === 'source'),
    ...fields.filter((item) => item.key !== 'pdf' && item.key !== 'source' && isPdfPath(item.value))
  ]
  for (const field of ordered) {
    if (!window.ink?.resolveTarget) break
    const resolved = await window.ink.resolveTarget(field.value, markdownPath, field.key)
    if (resolved.ok && resolved.kind === 'path' && isPdfPath(resolved.value)) {
      useAppStore.getState().openPdf(resolved.value)
      return
    }
  }
  useAppStore.getState().setToast('这篇笔记没有可打开的 PDF')
}
