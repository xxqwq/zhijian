import { useEffect, useRef } from 'react'
import type { MenuCommand } from '@shared/types'
import { MilkdownEditor } from '@renderer/components/Editor/MilkdownEditor'
import { SourceEditor } from '@renderer/components/Editor/SourceEditor'
import { FileContextMenu, FileTree } from '@renderer/components/Sidebar/FileTree'
import { Outline } from '@renderer/components/Outline/Outline'
import { SearchPanel } from '@renderer/components/Search/SearchPanel'
import { QuickOpen } from '@renderer/components/QuickOpen'
import { StatusBar } from '@renderer/components/StatusBar/StatusBar'
import { PromptDialog } from '@renderer/components/PromptDialog'
import { TabBar } from '@renderer/components/TabBar'
import { ThemePicker } from '@renderer/components/ThemePicker'
import { buildExportHtml } from '@renderer/lib/exportHtml'
import { findInEditor, jumpToHeading } from '@renderer/lib/editorNav'
import {
  runClipboard,
  runEditorCommand,
  readDocumentMarkdown,
  type EditorCommand
} from '@renderer/lib/editorCommands'
import { PdfViewer } from '@renderer/components/Pdf/PdfViewer'
import { copyAs } from '@renderer/lib/copyAs'
import { countWords } from '@renderer/lib/markdown'
import { toggleNotePdf } from '@renderer/lib/openLocal'
import { isPdfPaneActive, requestPdfFind, setPdfPaneActive } from '@renderer/lib/pdfUi'
import { fileNameOf, useAppStore } from '@renderer/store/appStore'
import { writeStageScroll } from '@renderer/lib/tabs'

export default function App() {
  const currentFile = useAppStore((s) => s.currentFile)
  const content = useAppStore((s) => s.content)
  const savedContent = useAppStore((s) => s.savedContent)
  const theme = useAppStore((s) => s.theme)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const outlineOpen = useAppStore((s) => s.outlineOpen)
  const toast = useAppStore((s) => s.toast)
  const editorEpoch = useAppStore((s) => s.editorEpoch)
  const typewriter = useAppStore((s) => s.typewriter)
  const sourceMode = useAppStore((s) => s.sourceMode)
  const activeId = useAppStore((s) => s.activeId)
  const pdfPath = useAppStore((s) => s.pdfPath)
  const pdfWidth = useAppStore((s) => s.pdfWidth)
  const setContent = useAppStore((s) => s.setContent)
  const setToast = useAppStore((s) => s.setToast)
  const saveTimer = useRef<number | null>(null)
  const restored = useRef(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!window.ink) return
    const offMenu = window.ink.onMenu((command) => {
      void handleMenu(command)
    })
    const offWatch = window.ink.onWatchChange(() => {
      void useAppStore.getState().refreshTree()
    })
    return () => {
      offMenu()
      offWatch()
    }
  }, [])

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    void useAppStore.getState().restoreSession()
  }, [])

  useEffect(() => {
    if (!currentFile || content === savedContent) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void useAppStore.getState().save()
    }, 400)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [content, currentFile, savedContent])

  useEffect(() => {
    const tab = useAppStore.getState().tabs.find((item) => item.id === activeId)
    const top = tab?.scrollTop ?? 0
    writeStageScroll(top)
    const frame = window.requestAnimationFrame(() => writeStageScroll(top))
    const later = window.setTimeout(() => writeStageScroll(top), 80)
    const afterEditor = window.setTimeout(() => writeStageScroll(top), 280)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(later)
      window.clearTimeout(afterEditor)
    }
  }, [activeId, editorEpoch])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast, setToast])

  useEffect(() => {
    const stage = document.querySelector('.paper-stage')
    if (!(stage instanceof HTMLElement)) return
    let timer = 0
    const onScroll = (): void => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        useAppStore.getState().rememberScroll(stage.scrollTop)
      }, 120)
    }
    stage.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      stage.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [activeId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const store = useAppStore.getState()
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && key === 'p') {
        event.preventDefault()
        store.setQuickOpen(true)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && key === 'p') {
        event.preventDefault()
        void toggleNotePdf()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && key === 'c') {
        event.preventDefault()
        void copyAs('markdown')
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && !event.shiftKey && key === 'c') {
        event.preventDefault()
        void copyAs('html')
        return
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key === 'Tab') {
        event.preventDefault()
        store.cycleTab(event.shiftKey ? -1 : 1)
        return
      }
      if (event.key !== 'Escape') return
      if (store.quickOpen) {
        store.setQuickOpen(false)
        return
      }
      if (store.searchMode !== 'none') {
        store.setSearchMode('none')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onSelect = (): void => {
      const store = useAppStore.getState()
      const text = window.getSelection()?.toString() ?? ''
      store.setSelectionCount(text ? countWords(text) : 0)

      if (!store.typewriter) return
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const stage = document.querySelector('.paper-stage')
      if (!(stage instanceof HTMLElement)) return
      const node = selection.anchorNode
      if (!node || !stage.contains(node)) return
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      if (rect.height === 0 && rect.width === 0) return
      const delta = rect.top - stage.getBoundingClientRect().top - stage.clientHeight / 2
      stage.scrollTop += delta
    }
    document.addEventListener('selectionchange', onSelect)
    return () => document.removeEventListener('selectionchange', onSelect)
  }, [])

  return (
    <div
      className={`app ${typewriter ? 'typewriter' : ''} ${sourceMode ? 'source-mode' : ''}`}
    >
      <header className="chrome">
        <div className="brand">
          <span className="brand-mark">纸间</span>
          <span className="brand-sub">INK</span>
        </div>
        <div className="chrome-spacer" />
        <div className="chrome-actions">
          <ThemePicker />
          <button
            className="icon-btn"
            type="button"
            title="快速打开 Ctrl+P"
            onClick={() => useAppStore.getState().setQuickOpen(true)}
          >
            跳转
          </button>
          <button
            className={`icon-btn ${pdfPath ? 'active' : ''}`}
            type="button"
            title="PDF 阅读器 Ctrl+Shift+P"
            onClick={() => void toggleNotePdf()}
          >
            PDF
          </button>
          <button
            className={`icon-btn ${sourceMode ? 'active' : ''}`}
            type="button"
            title="源码对照 Ctrl+/"
            onClick={() => useAppStore.getState().toggleSource()}
          >
            源码
          </button>
          <button
            className={`icon-btn ${sidebarOpen ? 'active' : ''}`}
            type="button"
            onClick={() => useAppStore.getState().toggleSidebar()}
          >
            目录
          </button>
          <button
            className={`icon-btn ${outlineOpen ? 'active' : ''}`}
            type="button"
            onClick={() => useAppStore.getState().toggleOutline()}
          >
            大纲
          </button>
        </div>
      </header>
      <TabBar />

      <div
        className={`workspace ${sidebarOpen ? '' : 'no-sidebar'} ${outlineOpen ? '' : 'no-outline'}`}
      >
        {sidebarOpen && <FileTree />}
        <div className={`stage-split ${pdfPath ? 'has-pdf' : ''}`}>
          <main className="paper-stage" onPointerDown={() => setPdfPaneActive(false)}>
            <div className="paper-sheet">
              {sourceMode ? (
                <SourceEditor />
              ) : (
                <MilkdownEditor
                  key={activeId}
                  fileKey={`${activeId}:${editorEpoch}`}
                  tabId={activeId}
                  markdown={content}
                  theme={theme}
                  currentFile={currentFile}
                  onChange={setContent}
                />
              )}
            </div>
          </main>
          {pdfPath ? <PdfViewer path={pdfPath} width={pdfWidth} /> : null}
        </div>
        {outlineOpen && <Outline onJump={jumpToHeading} />}
      </div>

      <StatusBar />
      <SearchPanel onFind={findInEditor} />
      <QuickOpen />
      <PromptDialog />
      <FileContextMenu />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

async function handleMenu(command: MenuCommand): Promise<void> {
  const store = useAppStore.getState()
  switch (command) {
    case 'open-folder':
      await store.openWorkspace()
      break
    case 'open-file':
      await store.openFileDialog()
      break
    case 'new-file':
      await store.newUntitled()
      break
    case 'close-tab':
      await store.closeTab(store.activeId)
      break
    case 'next-tab':
      store.cycleTab(1)
      break
    case 'prev-tab':
      store.cycleTab(-1)
      break
    case 'save':
      await store.save()
      store.setToast('已保存')
      break
    case 'save-as':
      await store.saveAs()
      break
    case 'export-html':
      await exportCurrent('html')
      break
    case 'export-pdf':
      await exportCurrent('pdf')
      break
    case 'find':
      if (store.pdfPath && isPdfPaneActive()) {
        requestPdfFind()
        break
      }
      store.setSearchMode('file')
      break
    case 'find-workspace':
      store.setSearchMode('workspace')
      break
    case 'quick-open':
      store.setQuickOpen(true)
      break
    case 'toggle-sidebar':
      store.toggleSidebar()
      break
    case 'toggle-outline':
      store.toggleOutline()
      break
    case 'toggle-pdf':
      void toggleNotePdf()
      break
    case 'toggle-typewriter':
      store.toggleTypewriter()
      store.setToast(useAppStore.getState().typewriter ? '打字机滚动已开' : '打字机滚动已关')
      break
    case 'toggle-source':
      store.toggleSource()
      break
    case 'theme-paper':
      store.setTheme('paper')
      break
    case 'theme-celadon':
      store.setTheme('celadon')
      break
    case 'theme-ink':
      store.setTheme('ink')
      break
    case 'theme-dusk':
      store.setTheme('dusk')
      break
    case 'theme-cycle':
      store.cycleTheme()
      break
    case 'undo':
      runEditorCommand('undo')
      break
    case 'redo':
      runEditorCommand('redo')
      break
    case 'cut':
      await runClipboard('cut')
      break
    case 'copy':
      await runClipboard('copy')
      break
    case 'copy-as-markdown':
      await copyAs('markdown')
      break
    case 'copy-as-plain':
      await copyAs('plain')
      break
    case 'copy-as-html':
      await copyAs('html')
      break
    case 'paste':
      await runClipboard('paste')
      break
    case 'select-all':
      await runClipboard('selectAll')
      break
    case 'format-bold':
    case 'format-italic':
    case 'format-strike':
    case 'format-code':
    case 'format-paragraph':
    case 'format-heading-1':
    case 'format-heading-2':
    case 'format-heading-3':
    case 'format-heading-4':
    case 'format-heading-5':
    case 'format-heading-6':
    case 'format-bullet':
    case 'format-ordered':
    case 'format-task':
    case 'format-quote':
    case 'format-code-block':
      runEditorCommand(FORMAT_COMMANDS[command])
      break
  }
}

const FORMAT_COMMANDS: Record<
  | 'format-bold'
  | 'format-italic'
  | 'format-strike'
  | 'format-code'
  | 'format-paragraph'
  | 'format-heading-1'
  | 'format-heading-2'
  | 'format-heading-3'
  | 'format-heading-4'
  | 'format-heading-5'
  | 'format-heading-6'
  | 'format-bullet'
  | 'format-ordered'
  | 'format-task'
  | 'format-quote'
  | 'format-code-block',
  EditorCommand
> = {
  'format-bold': 'bold',
  'format-italic': 'italic',
  'format-strike': 'strikethrough',
  'format-code': 'inline-code',
  'format-paragraph': 'paragraph',
  'format-heading-1': 'heading-1',
  'format-heading-2': 'heading-2',
  'format-heading-3': 'heading-3',
  'format-heading-4': 'heading-4',
  'format-heading-5': 'heading-5',
  'format-heading-6': 'heading-6',
  'format-bullet': 'bullet-list',
  'format-ordered': 'ordered-list',
  'format-task': 'task-list',
  'format-quote': 'quote',
  'format-code-block': 'code-block'
}

async function exportCurrent(kind: 'html' | 'pdf'): Promise<void> {
  const store = useAppStore.getState()
  store.snapshotActive()
  const markdown = readDocumentMarkdown() ?? store.activeMarkdown()
  const currentFile = store.currentFile
  const theme = store.theme
  const setToast = store.setToast
  const base = fileNameOf(currentFile).replace(/\.(md|markdown|txt)$/i, '') || '未命名'
  const dest = await window.ink.exportPath(`${base}.${kind}`, [
    kind === 'html'
      ? { name: 'HTML', extensions: ['html'] }
      : { name: 'PDF', extensions: ['pdf'] }
  ])
  if (!dest) return
  const html = buildExportHtml(markdown, theme, base, kind)
  if (kind === 'html') await window.ink.exportHtml(dest, html)
  else await window.ink.exportPdf(dest, html)
  setToast(kind === 'html' ? '已导出 HTML' : '已导出 PDF')
}
