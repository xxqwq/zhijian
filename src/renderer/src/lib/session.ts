export interface RecentFile {
  path: string
  name: string
  at: number
}

export interface SessionTab {
  path: string
  scrollTop: number
}

export interface SessionState {
  workspacePath: string | null
  currentFile: string | null
  openTabs: SessionTab[]
  recent: RecentFile[]
  pdfPath: string | null
  mainTexPath: string | null
}

const KEY = 'zhijian.session'
const MAX_RECENT = 24

export function readSession(): SessionState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return { workspacePath: null, currentFile: null, openTabs: [], recent: [], pdfPath: null, mainTexPath: null }
    }
    const parsed = JSON.parse(raw) as Partial<SessionState>
    const openTabs = Array.isArray(parsed.openTabs)
      ? parsed.openTabs.filter((item): item is SessionTab => Boolean(item?.path))
      : parsed.currentFile
        ? [{ path: parsed.currentFile, scrollTop: 0 }]
        : []
    return {
      workspacePath: parsed.workspacePath ?? null,
      currentFile: parsed.currentFile ?? null,
      openTabs,
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      pdfPath: parsed.pdfPath ?? null,
      mainTexPath: parsed.mainTexPath ?? null
    }
  } catch {
    return { workspacePath: null, currentFile: null, openTabs: [], recent: [], pdfPath: null, mainTexPath: null }
  }
}

export function writeSession(state: SessionState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}

export function pushRecent(list: RecentFile[], filePath: string): RecentFile[] {
  const next: RecentFile = {
    path: filePath,
    name: filePath.split(/[/\\]/).pop() || filePath,
    at: Date.now()
  }
  return [next, ...list.filter((item) => item.path !== filePath)].slice(0, MAX_RECENT)
}
