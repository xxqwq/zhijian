import { classifyOpenTarget, isPdfPath } from '@shared/openTarget'
import { parseFrontmatterFields, splitFrontmatter } from '@renderer/lib/frontmatter'
import { readPdfPick, writePdfPick } from '@renderer/lib/pdfPicks'
import { useAppStore } from '@renderer/store/appStore'

export { classifyOpenTarget, isPathLike, isPdfPath } from '@shared/openTarget'

function rememberPdf(pdfPath: string): void {
  writePdfPick(useAppStore.getState().currentFile, pdfPath)
}

export async function pickPdfFile(): Promise<void> {
  const store = useAppStore.getState()
  const start = store.pdfPath ?? store.currentFile ?? store.workspacePath ?? undefined
  const filePath =
    typeof window.ink?.openPdfFile === 'function'
      ? await window.ink.openPdfFile(start)
      : await pickPdfViaInput()
  if (!filePath) return
  rememberPdf(filePath)
  store.openPdf(filePath)
}

function pickPdfViaInput(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,.pdf'
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0] as (File & { path?: string }) | undefined
        resolve(file?.path || null)
      },
      { once: true }
    )
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}

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
    if (resolved.kind === 'path') {
      if (isPdfPath(resolved.value)) {
        rememberPdf(resolved.value)
        useAppStore.getState().openPdf(resolved.value)
        return
      }
      if (window.ink.findPdf) {
        const pdf = await window.ink.findPdf(resolved.value, markdownPath ?? null, key)
        if (pdf.ok && pdf.kind === 'path') {
          rememberPdf(pdf.value)
          useAppStore.getState().openPdf(pdf.value)
          return
        }
      }
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
    store.dismissPdf()
    return
  }
  const fromNote = await findPdfForNote(store.content, store.currentFile, { folderFallback: true })
  if (fromNote) {
    store.openPdf(fromNote)
    return
  }
  const remembered = readPdfPick(store.currentFile)
  if (remembered && (await window.ink.pathExists(remembered))) {
    store.openPdf(remembered)
    return
  }
  await pickPdfFile()
}

export async function findPdfForNote(
  markdown: string,
  markdownPath: string | null,
  options?: { folderFallback?: boolean }
): Promise<string | null> {
  if (!window.ink?.findPdf) return null
  const fields = parseFrontmatterFields(splitFrontmatter(markdown).raw)
  const ordered = [
    ...fields.filter((item) => item.key === 'pdf' || /pdf/i.test(item.key)),
    ...fields.filter((item) => item.key === 'source'),
    ...fields.filter(
      (item) => item.key !== 'pdf' && item.key !== 'source' && !/pdf/i.test(item.key) && isPdfPath(item.value)
    )
  ]
  const seen = new Set<string>()
  for (const field of ordered) {
    const token = `${field.key}:${field.value}`
    if (seen.has(token)) continue
    seen.add(token)
    const found = await window.ink.findPdf(field.value, markdownPath, field.key)
    if (found.ok && found.kind === 'path') return found.value
  }
  if (options?.folderFallback && markdownPath) {
    const found = await window.ink.findPdf('.', markdownPath, 'pdf')
    if (found.ok && found.kind === 'path') return found.value
  }
  return null
}

let syncSeq = 0

export async function syncNotePdf(): Promise<void> {
  const seq = ++syncSeq
  const store = useAppStore.getState()
  const note = store.currentFile
  const tabId = store.activeId
  if (note && store.pdfDismissed[note]) {
    if (store.pdfPath) store.closePdf()
    return
  }
  const remembered = readPdfPick(note)
  const fromNote = await findPdfForNote(store.content, note, { folderFallback: false })
  if (seq !== syncSeq) return
  const now = useAppStore.getState()
  if (now.activeId !== tabId || now.currentFile !== note) return
  if (note && now.pdfDismissed[note]) return
  const rememberedOk =
    Boolean(remembered) &&
    (typeof window.ink.pathExists === 'function' ? await window.ink.pathExists(remembered as string) : true)
  if (seq !== syncSeq) return
  const latest = useAppStore.getState()
  if (latest.activeId !== tabId || latest.currentFile !== note) return
  if (note && latest.pdfDismissed[note]) return
  const pdf = rememberedOk && remembered ? remembered : fromNote
  if (pdf) {
    if (latest.pdfPath !== pdf) latest.openPdf(pdf)
    return
  }
  if (latest.pdfPath) latest.closePdf()
}
