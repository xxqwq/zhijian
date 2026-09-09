import { isMarkdownFile, isTexFile } from '@shared/types'
import { samePath } from '@renderer/lib/texLog'
import { fileNameOf, useAppStore } from '@renderer/store/appStore'

const timers = new Map<string, number>()
const skipped = new Map<string, string>()

export function onWorkspaceWatch(filePath?: string): void {
  void useAppStore.getState().refreshTree()
  if (!filePath || (!isMarkdownFile(filePath) && !isTexFile(filePath))) return
  const prev = timers.get(filePath)
  if (prev) window.clearTimeout(prev)
  timers.set(
    filePath,
    window.setTimeout(() => {
      timers.delete(filePath)
      void offerReload(filePath)
    }, 220)
  )
}

async function offerReload(filePath: string): Promise<void> {
  const store = useAppStore.getState()
  const tab = store.tabs.find((item) => item.path && samePath(item.path, filePath))
  if (!tab?.path) return
  if (!(await window.ink.pathExists(filePath))) return
  let disk = ''
  try {
    disk = await window.ink.readFile(filePath)
  } catch {
    return
  }
  const live = tab.id === store.activeId ? store.content : tab.content
  const saved = tab.id === store.activeId ? store.savedContent : tab.savedContent
  if (disk === live) {
    skipped.delete(filePath)
    return
  }
  if (skipped.get(filePath) === disk) return
  if (live !== saved) {
    if (typeof window.ink.confirmReload !== 'function') return
    const ok = await window.ink.confirmReload(fileNameOf(tab.path))
    if (!ok) {
      skipped.set(filePath, disk)
      return
    }
  }
  skipped.delete(filePath)
  store.reloadFromDisk(tab.path, disk)
}
