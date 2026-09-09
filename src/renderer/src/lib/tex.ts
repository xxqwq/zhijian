import type { OutlineItem } from '@renderer/lib/markdown'
import { isTexFile, isTexSource } from '@shared/types'
import { useAppStore } from '@renderer/store/appStore'

export { isTexFile, isTexSource }

export function extractTexOutline(source: string): OutlineItem[] {
  const items: OutlineItem[] = []
  const re =
    /\\(part|chapter|section|subsection|subsubsection)\*?\{((?:[^{}]|\{[^{}]*\})*)\}/g
  const levels: Record<string, number> = {
    part: 1,
    chapter: 1,
    section: 2,
    subsection: 3,
    subsubsection: 4
  }
  let match: RegExpExecArray | null
  let index = 0
  while ((match = re.exec(source))) {
    const text = match[2].replace(/\\[a-zA-Z]+\{?([^}]*)\}?/g, '$1').replace(/\s+/g, ' ').trim()
    if (!text) continue
    items.push({
      id: `tex-${index++}`,
      level: levels[match[1]] ?? 2,
      text
    })
  }
  return items
}

export async function exportCurrentTexPdf(): Promise<void> {
  const store = useAppStore.getState()
  const file = store.currentFile
  if (!file || !isTexSource(file)) {
    store.setToast('请先打开一个 .tex 文件')
    return
  }
  if (typeof window.ink?.copyFile !== 'function' || typeof window.ink.compileTex !== 'function') {
    store.setToast('请完全退出纸间后再导出')
    return
  }
  if (store.texCompiling) return
  if (store.content !== store.savedContent) await store.save()
  const base = file.replace(/^.*[\\/]/, '').replace(/\.tex$/i, '') || '未命名'
  const dest = await window.ink.exportPath(`${base}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }])
  if (!dest) return
  store.setTexCompiling(true)
  store.setTexLog('正在编译并导出…')
  store.setToast('正在编译并导出…')
  try {
    const result = await window.ink.compileTex(file)
    store.setTexLog(trimLog(result.log) || (result.ok ? '编译完成' : result.error))
    if (result.pdfPath) store.openPdf(result.pdfPath)
    if (!result.pdfPath) {
      store.setToast(result.ok ? '编译结束，但没有生成 PDF' : result.error)
      return
    }
    await window.ink.copyFile(result.pdfPath, dest)
    store.setToast(result.ok ? '已导出 PDF' : '已导出 PDF（编译有提示）')
  } catch {
    store.setToast('导出失败')
  } finally {
    store.setTexCompiling(false)
  }
}

export async function compileCurrentTex(): Promise<void> {
  const store = useAppStore.getState()
  const file = store.currentFile
  if (!file || !isTexSource(file)) {
    store.setToast('请先打开一个 .tex 文件')
    return
  }
  if (typeof window.ink?.compileTex !== 'function') {
    store.setToast('请完全退出纸间后再编译')
    return
  }
  if (store.texCompiling) return
  if (store.content !== store.savedContent) {
    await store.save()
  }
  store.setTexCompiling(true)
  store.setTexLog('正在用 TeX Live 编译…')
  try {
    const result = await window.ink.compileTex(file)
    store.setTexLog(trimLog(result.log) || (result.ok ? '编译完成' : result.error))
    if (result.pdfPath) store.openPdf(result.pdfPath)
    store.setToast(result.ok ? '编译完成' : result.error)
  } catch {
    store.setToast('编译失败')
  } finally {
    store.setTexCompiling(false)
  }
}

export async function importConferenceTemplate(): Promise<void> {
  const store = useAppStore.getState()
  if (typeof window.ink?.pickTexTemplate !== 'function') {
    store.setToast('请完全退出纸间后再导入模板')
    return
  }
  let workspace = store.workspacePath
  if (!workspace) {
    await store.openWorkspace()
    workspace = useAppStore.getState().workspacePath
  }
  if (!workspace) return
  const source = await window.ink.pickTexTemplate()
  if (!source) return
  const imported = await window.ink.importTexTemplate(workspace, source)
  if (!imported.ok) {
    store.setToast(imported.error)
    return
  }
  await store.refreshTree()
  await store.openFilePath(imported.texPath)
  store.setToast('模板已导入，可直接编译')
}

function trimLog(log: string): string {
  const lines = log.split(/\r?\n/)
  const errors = lines.filter(
    (line) =>
      /^! /.test(line) ||
      /Fatal error/i.test(line) ||
      /Unicode character/i.test(line) ||
      /:\d+:\s+(LaTeX Error|Package \S+ Error)/i.test(line)
  )
  const tail = lines.filter((line) => line.trim()).slice(-40)
  return [...errors.slice(0, 8), ...(errors.length ? ['---'] : []), ...tail].join('\n')
}
