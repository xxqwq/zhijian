import { create } from 'zustand'
import type { FileNode, ThemeName } from '@shared/types'
import { WELCOME_MARKDOWN } from '@renderer/lib/welcome'
import { countWords } from '@renderer/lib/markdown'
import { nextTheme, persistTheme, readStoredTheme } from '@renderer/lib/themes'
import { pushRecent, readSession, writeSession, type RecentFile } from '@renderer/lib/session'
import {
  createTab,
  isTabDirty,
  MAX_TABS,
  readStageScroll,
  welcomeTab,
  type OpenTab
} from '@renderer/lib/tabs'

export type SearchMode = 'none' | 'file' | 'workspace'

export interface PromptState {
  title: string
  label: string
  value: string
  confirmText: string
  onSubmit: (value: string) => void | Promise<void>
}

interface AppState {
  workspacePath: string | null
  fileTree: FileNode[]
  currentFile: string | null
  content: string
  savedContent: string
  theme: ThemeName
  sidebarOpen: boolean
  outlineOpen: boolean
  searchMode: SearchMode
  toast: string | null
  contextMenu: { x: number; y: number; node: FileNode } | null
  prompt: PromptState | null
  wordCount: number
  editorEpoch: number
  typewriter: boolean
  sourceMode: boolean
  quickOpen: boolean
  selectionCount: number
  recentFiles: RecentFile[]
  tabs: OpenTab[]
  activeId: string
  pdfPath: string | null
  pdfWidth: number

  dirty: () => boolean
  setTheme: (theme: ThemeName) => void
  cycleTheme: () => void
  setContent: (content: string, tabId?: string) => void
  toggleSidebar: () => void
  toggleOutline: () => void
  setSearchMode: (mode: SearchMode) => void
  setToast: (toast: string | null) => void
  setContextMenu: (menu: AppState['contextMenu']) => void
  setPrompt: (prompt: PromptState | null) => void
  bumpEditor: () => void
  setSelectionCount: (count: number) => void
  toggleTypewriter: () => void
  toggleSource: () => void
  setQuickOpen: (open: boolean) => void
  snapshotActive: () => void
  activeMarkdown: () => string
  rememberScroll: (scrollTop: number) => void
  activateTab: (id: string) => void
  closeTab: (id: string) => Promise<void>
  cycleTab: (direction: 1 | -1) => void
  persistSession: () => void
  restoreSession: () => Promise<void>
  openPdf: (path: string) => void
  closePdf: () => void
  setPdfWidth: (width: number) => void
  refreshTree: () => Promise<void>
  confirmIfDirty: (tab?: OpenTab) => Promise<boolean>
  openWorkspace: (dir?: string | null) => Promise<void>
  openFilePath: (filePath: string, silent?: boolean) => Promise<void>
  openFileDialog: () => Promise<void>
  newUntitled: () => Promise<void>
  save: () => Promise<boolean>
  saveAs: () => Promise<boolean>
  createFile: (dir: string, name: string) => Promise<void>
  createFolder: (dir: string, name: string) => Promise<void>
  renameNode: (target: string, newName: string) => Promise<void>
  deleteNode: (target: string) => Promise<void>
  syncWindowTitle: () => void
}

function fileTitle(filePath: string | null): string {
  if (!filePath) return '未命名'
  return filePath.split(/[/\\]/).pop() || '未命名'
}

function nextUntitledId(tabs: OpenTab[]): string {
  const used = new Set(
    tabs
      .map((tab) => /^untitled-(\d+)$/.exec(tab.id)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number)
  )
  let index = 1
  while (used.has(index)) index += 1
  return `untitled-${index}`
}

function readPdfWidth(): number {
  try {
    const n = Number(localStorage.getItem('zhijian.pdfWidth'))
    if (Number.isFinite(n) && n >= 260 && n <= 1600) return Math.round(n)
  } catch {
    /* ignore */
  }
  return 520
}

const initial = welcomeTab()

export const useAppStore = create<AppState>((set, get) => ({
  workspacePath: null,
  fileTree: [],
  currentFile: null,
  content: WELCOME_MARKDOWN,
  savedContent: WELCOME_MARKDOWN,
  theme: readStoredTheme(),
  sidebarOpen: true,
  outlineOpen: true,
  searchMode: 'none',
  toast: null,
  contextMenu: null,
  prompt: null,
  wordCount: countWords(WELCOME_MARKDOWN),
  editorEpoch: 0,
  typewriter: false,
  sourceMode: false,
  quickOpen: false,
  selectionCount: 0,
  recentFiles: readSession().recent,
  tabs: [initial],
  activeId: initial.id,
  pdfPath: null,
  pdfWidth: readPdfWidth(),

  dirty: () => get().tabs.some(isTabDirty),

  setTheme: (theme) => {
    persistTheme(theme)
    set({ theme })
  },
  cycleTheme: () => get().setTheme(nextTheme(get().theme)),

  setContent: (content, tabId) => {
    const { activeId, tabs } = get()
    const targetId = tabId ?? activeId
    set({
      tabs: tabs.map((tab) => (tab.id === targetId ? { ...tab, content } : tab)),
      ...(targetId === activeId ? { content, wordCount: countWords(content) } : {})
    })
    get().syncWindowTitle()
  },

  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  toggleOutline: () => set({ outlineOpen: !get().outlineOpen }),
  setSearchMode: (searchMode) => set({ searchMode, quickOpen: false }),
  setToast: (toast) => set({ toast }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setPrompt: (prompt) => set({ prompt }),
  bumpEditor: () => set({ editorEpoch: get().editorEpoch + 1 }),
  setSelectionCount: (selectionCount) => set({ selectionCount }),

  toggleTypewriter: () => set({ typewriter: !get().typewriter }),

  toggleSource: () => {
    const next = !get().sourceMode
    const { activeId, tabs } = get()
    set({
      sourceMode: next,
      tabs: tabs.map((tab) => (tab.id === activeId ? { ...tab, sourceMode: next } : tab))
    })
    if (!next) get().bumpEditor()
  },

  setQuickOpen: (quickOpen) => set({ quickOpen, searchMode: quickOpen ? 'none' : get().searchMode }),

  snapshotActive: () => {
    const { activeId, tabs, content, savedContent, sourceMode } = get()
    const scrollTop = readStageScroll()
    set({
      tabs: tabs.map((tab) =>
        tab.id === activeId ? { ...tab, content, savedContent, sourceMode, scrollTop } : tab
      )
    })
  },

  activeMarkdown: () => {
    const { tabs, activeId, content } = get()
    return tabs.find((tab) => tab.id === activeId)?.content ?? content
  },

  rememberScroll: (scrollTop) => {
    const { activeId, tabs } = get()
    set({
      tabs: tabs.map((tab) => (tab.id === activeId ? { ...tab, scrollTop } : tab))
    })
    get().persistSession()
  },

  activateTab: (id) => {
    if (id === get().activeId) {
      set({ quickOpen: false })
      return
    }
    get().snapshotActive()
    const prev = get().tabs.find((tab) => tab.id === get().activeId)
    if (prev?.path && isTabDirty(prev)) {
      void window.ink.writeFile(prev.path, prev.content).then(() => {
        const still = get().tabs.find((tab) => tab.id === prev.id)
        if (!still || still.content !== prev.content) return
        set({
          tabs: get().tabs.map((tab) =>
            tab.id === prev.id ? { ...tab, savedContent: prev.content } : tab
          ),
          savedContent: get().activeId === prev.id ? prev.content : get().savedContent
        })
        get().syncWindowTitle()
      })
    }
    const next = get().tabs.find((tab) => tab.id === id)
    if (!next) return
    set({
      activeId: next.id,
      currentFile: next.path,
      content: next.content,
      savedContent: next.savedContent,
      wordCount: countWords(next.content),
      sourceMode: next.sourceMode,
      editorEpoch: get().editorEpoch + 1,
      selectionCount: 0,
      quickOpen: false
    })
    get().syncWindowTitle()
    get().persistSession()
  },

  closeTab: async (id) => {
    get().snapshotActive()
    const tabsNow = get().tabs
    const tab = tabsNow.find((item) => item.id === id)
    if (!tab) return
    if (isTabDirty(tab) && !(await get().confirmIfDirty(tab))) return
    const index = tabsNow.findIndex((item) => item.id === id)
    let tabs = tabsNow.filter((item) => item.id !== id)
    if (tabs.length === 0) {
      tabs = [createTab({ id: nextUntitledId([]) })]
    }
    const wasActive = get().activeId === id
    const fallback = tabs[Math.min(index, tabs.length - 1)] ?? tabs[0]
    set({
      tabs,
      activeId: wasActive ? fallback.id : get().activeId,
      ...(wasActive
        ? {
            currentFile: fallback.path,
            content: fallback.content,
            savedContent: fallback.savedContent,
            wordCount: countWords(fallback.content),
            sourceMode: fallback.sourceMode,
            editorEpoch: get().editorEpoch + 1,
            selectionCount: 0
          }
        : {})
    })
    get().syncWindowTitle()
    get().persistSession()
  },

  cycleTab: (direction) => {
    const { tabs, activeId } = get()
    if (tabs.length < 2) return
    const index = tabs.findIndex((tab) => tab.id === activeId)
    const next = tabs[(index + direction + tabs.length) % tabs.length]
    get().activateTab(next.id)
  },

  persistSession: () => {
    const { workspacePath, currentFile, recentFiles, tabs, pdfPath } = get()
    writeSession({
      workspacePath,
      currentFile,
      recent: recentFiles,
      pdfPath,
      openTabs: tabs
        .filter((tab) => tab.path)
        .map((tab) => ({ path: tab.path as string, scrollTop: tab.scrollTop }))
    })
  },

  openPdf: (pdfPath) => {
    set({ pdfPath })
    get().persistSession()
  },
  closePdf: () => {
    set({ pdfPath: null })
    get().persistSession()
  },
  setPdfWidth: (pdfWidth) => {
    const width = Math.round(Math.min(1600, Math.max(260, pdfWidth)))
    set({ pdfWidth: width })
    try {
      localStorage.setItem('zhijian.pdfWidth', String(width))
    } catch {
      /* ignore */
    }
  },

  restoreSession: async () => {
    if (!window.ink?.pathExists) return
    try {
      const session = readSession()
      set({ recentFiles: session.recent })
      if (session.workspacePath && (await window.ink.pathExists(session.workspacePath))) {
        await window.ink.watch(session.workspacePath)
        set({ workspacePath: session.workspacePath })
        await get().refreshTree()
      }
      const sources = session.openTabs.length
        ? session.openTabs
        : session.currentFile
          ? [{ path: session.currentFile, scrollTop: 0 }]
          : []
      const tabs: OpenTab[] = []
      for (const item of sources) {
        if (!(await window.ink.pathExists(item.path))) continue
        const content = await window.ink.readFile(item.path)
        tabs.push(
          createTab({
            id: item.path,
            path: item.path,
            content,
            savedContent: content,
            scrollTop: item.scrollTop ?? 0
          })
        )
      }
      if (tabs.length === 0) return
      const active =
        tabs.find((tab) => tab.path === session.currentFile) ?? tabs[0]
      set({
        tabs,
        activeId: active.id,
        currentFile: active.path,
        content: active.content,
        savedContent: active.savedContent,
        wordCount: countWords(active.content),
        sourceMode: false,
        editorEpoch: get().editorEpoch + 1,
        recentFiles: session.recent
      })
      get().syncWindowTitle()
      if (session.pdfPath && (await window.ink.pathExists(session.pdfPath))) {
        set({ pdfPath: session.pdfPath })
      }
    } catch {
      /* 路径失效或旧预加载接口时静默跳过 */
    }
  },

  refreshTree: async () => {
    const dir = get().workspacePath
    if (!dir) {
      set({ fileTree: [] })
      return
    }
    const fileTree = await window.ink.readTree(dir)
    set({ fileTree })
  },

  confirmIfDirty: async (tab) => {
    const target = tab ?? get().tabs.find((item) => item.id === get().activeId)
    if (!target || !isTabDirty(target)) return true
    const name = fileTitle(target.path)
    const result = await window.ink.confirmClose(`「${name}」尚未保存，要先保存吗？`)
    if (result === 'cancel') return false
    if (result === 'save') {
      if (get().activeId !== target.id) get().activateTab(target.id)
      return get().save()
    }
    return true
  },

  openWorkspace: async (dir) => {
    const folder = dir ?? (await window.ink.openFolder())
    if (!folder) return
    await window.ink.watch(folder)
    set({ workspacePath: folder })
    await get().refreshTree()
    get().persistSession()
  },

  openFilePath: async (filePath, _silent = false) => {
    get().snapshotActive()
    const existing = get().tabs.find((tab) => tab.path === filePath)
    if (existing) {
      get().activateTab(existing.id)
      return
    }
    const content = await window.ink.readFile(filePath)
    const workspacePath = get().workspacePath ?? filePath.replace(/[/\\][^/\\]+$/, '')
    if (!get().workspacePath) {
      await window.ink.watch(workspacePath)
    }
    const incoming = createTab({
      id: filePath,
      path: filePath,
      content,
      savedContent: content
    })
    let tabs = get().tabs
    const loneWelcome =
      tabs.length === 1 &&
      !tabs[0].path &&
      tabs[0].content === WELCOME_MARKDOWN &&
      !isTabDirty(tabs[0])
    if (loneWelcome) {
      tabs = [incoming]
    } else {
      if (tabs.length >= MAX_TABS) {
        const drop = tabs.find((tab) => tab.id !== get().activeId && !isTabDirty(tab))
        if (!drop) {
          get().setToast(`最多同时打开 ${MAX_TABS} 篇`)
          return
        }
        tabs = tabs.filter((tab) => tab.id !== drop.id)
      }
      tabs = [...tabs, incoming]
    }
    set({
      tabs,
      activeId: incoming.id,
      currentFile: filePath,
      content,
      savedContent: content,
      wordCount: countWords(content),
      workspacePath,
      editorEpoch: get().editorEpoch + 1,
      sourceMode: false,
      quickOpen: false,
      selectionCount: 0,
      recentFiles: pushRecent(get().recentFiles, filePath)
    })
    await get().refreshTree()
    get().syncWindowTitle()
    get().persistSession()
  },

  openFileDialog: async () => {
    const filePath = await window.ink.openFile()
    if (filePath) await get().openFilePath(filePath)
  },

  newUntitled: async () => {
    get().snapshotActive()
    if (get().tabs.length >= MAX_TABS) {
      get().setToast(`最多同时打开 ${MAX_TABS} 篇`)
      return
    }
    const tab = createTab({ id: nextUntitledId(get().tabs) })
    set({
      tabs: [...get().tabs, tab],
      activeId: tab.id,
      currentFile: null,
      content: '',
      savedContent: '',
      wordCount: 0,
      editorEpoch: get().editorEpoch + 1,
      sourceMode: false,
      selectionCount: 0
    })
    get().syncWindowTitle()
  },

  save: async () => {
    const { currentFile, content, activeId, tabs } = get()
    if (!currentFile) return get().saveAs()
    await window.ink.writeFile(currentFile, content)
    set({
      savedContent: content,
      tabs: tabs.map((tab) => (tab.id === activeId ? { ...tab, content, savedContent: content } : tab))
    })
    get().syncWindowTitle()
    return true
  },

  saveAs: async () => {
    const dest = await window.ink.saveFile(get().currentFile ?? '未命名.md')
    if (!dest) return false
    await window.ink.writeFile(dest, get().content)
    const workspacePath = get().workspacePath ?? dest.replace(/[/\\][^/\\]+$/, '')
    const { activeId, tabs, content } = get()
    const withoutDup = tabs.filter((tab) => tab.path !== dest || tab.id === activeId)
    set({
      currentFile: dest,
      savedContent: content,
      workspacePath,
      tabs: withoutDup.map((tab) =>
        tab.id === activeId
          ? { ...tab, id: dest, path: dest, content, savedContent: content }
          : tab
      ),
      activeId: dest,
      recentFiles: pushRecent(get().recentFiles, dest)
    })
    await get().refreshTree()
    get().syncWindowTitle()
    get().persistSession()
    return true
  },

  createFile: async (dir, name) => {
    const filePath = await window.ink.createFile(dir, name)
    await get().refreshTree()
    await get().openFilePath(filePath)
  },

  createFolder: async (dir, name) => {
    await window.ink.createFolder(dir, name)
    await get().refreshTree()
  },

  renameNode: async (target, newName) => {
    const next = await window.ink.rename(target, newName)
    const { tabs, activeId } = get()
    const nextPath = (from: string | null): string | null => {
      if (!from) return from
      if (from === target) return next
      if (from.startsWith(target + '\\') || from.startsWith(target + '/')) {
        return next + from.slice(target.length)
      }
      return from
    }
    const renamed = tabs.map((tab) => {
      const path = nextPath(tab.path)
      if (!path || path === tab.path) return tab
      return { ...tab, id: path, path }
    })
    set({
      tabs: renamed,
      activeId: nextPath(activeId) ?? activeId,
      currentFile: nextPath(get().currentFile),
      recentFiles: get().recentFiles.map((item) => {
        const path = nextPath(item.path)
        if (!path || path === item.path) return item
        return { ...item, path, name: fileTitle(path) }
      })
    })
    get().syncWindowTitle()
    await get().refreshTree()
    get().persistSession()
  },

  deleteNode: async (target) => {
    await window.ink.trash(target)
    const { tabs, activeId } = get()
    const remaining = tabs.filter((tab) => {
      if (!tab.path) return true
      return tab.path !== target && !tab.path.startsWith(`${target}\\`) && !tab.path.startsWith(`${target}/`)
    })
    const closedActive = tabs.some((tab) => tab.path === target && tab.id === activeId)
    let nextTabs = remaining
    if (nextTabs.length === 0) nextTabs = [createTab({ id: nextUntitledId([]) })]
    const fallback = nextTabs.find((tab) => tab.id === activeId) ?? nextTabs[0]
    set({
      tabs: nextTabs,
      activeId: fallback.id,
      currentFile: fallback.path,
      content: closedActive ? fallback.content : get().content,
      savedContent: closedActive ? fallback.savedContent : get().savedContent,
      wordCount: countWords(closedActive ? fallback.content : get().content),
      sourceMode: closedActive ? fallback.sourceMode : get().sourceMode,
      editorEpoch: closedActive ? get().editorEpoch + 1 : get().editorEpoch,
      recentFiles: get().recentFiles.filter((item) => item.path !== target)
    })
    get().syncWindowTitle()
    await get().refreshTree()
    get().persistSession()
  },

  syncWindowTitle: () => {
    if (!window.ink) return
    const { currentFile, tabs } = get()
    const dirty = tabs.some(isTabDirty)
    void window.ink.setDirty(dirty, fileTitle(currentFile))
  }
}))

export function fileNameOf(filePath: string | null): string {
  return fileTitle(filePath)
}
