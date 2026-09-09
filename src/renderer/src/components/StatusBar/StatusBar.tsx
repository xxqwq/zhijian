import { fileNameOf, useAppStore } from '@renderer/store/appStore'
import { isTexFile } from '@shared/types'
import { themeMeta } from '@renderer/lib/themes'
import { readingLabel } from '@renderer/lib/markdown'

export function StatusBar() {
  const currentFile = useAppStore((s) => s.currentFile)
  const wordCount = useAppStore((s) => s.wordCount)
  const selectionCount = useAppStore((s) => s.selectionCount)
  const typewriter = useAppStore((s) => s.typewriter)
  const sourceMode = useAppStore((s) => s.sourceMode)
  const texCompiling = useAppStore((s) => s.texCompiling)
  const theme = useAppStore((s) => s.theme)
  const cycleTheme = useAppStore((s) => s.cycleTheme)
  const toggleTypewriter = useAppStore((s) => s.toggleTypewriter)
  const dirty = useAppStore((s) => s.content !== s.savedContent)
  const texDoc = isTexFile(currentFile ?? '')

  return (
    <footer className="status">
      <span className="status-path">{currentFile ?? '尚未保存到磁盘'}</span>
      <span>
        {dirty ? '未保存 · ' : ''}
        {selectionCount > 0 ? `选中 ${selectionCount} 字 · ` : ''}
        {wordCount} 字 · {readingLabel(wordCount)}
        {sourceMode && !texDoc ? ' · 源码对照' : ''}
        {texDoc ? ' · LaTeX' : ''}
        {texCompiling ? ' · 正在编译' : ''}
        {' · '}
        <button
          className={`icon-btn ${typewriter ? 'active' : ''}`}
          type="button"
          title="打字机滚动"
          onClick={() => toggleTypewriter()}
        >
          打字机
        </button>
        {' · '}
        {fileNameOf(currentFile)}
        {' · '}
        <button
          className="icon-btn"
          type="button"
          title="切换到下一套主题"
          onClick={() => cycleTheme()}
        >
          {themeMeta(theme).name}
        </button>
      </span>
    </footer>
  )
}
