import { useEffect, useMemo, useState } from 'react'
import { filterQuickItems, flattenFiles, type QuickItem } from '@renderer/lib/files'
import { useAppStore } from '@renderer/store/appStore'

export function QuickOpen() {
  const open = useAppStore((s) => s.quickOpen)
  const recentFiles = useAppStore((s) => s.recentFiles)
  const fileTree = useAppStore((s) => s.fileTree)
  const currentFile = useAppStore((s) => s.currentFile)
  const setQuickOpen = useAppStore((s) => s.setQuickOpen)
  const openFilePath = useAppStore((s) => s.openFilePath)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const items = useMemo(() => {
    const recent: QuickItem[] = recentFiles.map((item) => ({
      path: item.path,
      name: item.name,
      hint: '最近'
    }))
    const workspace = flattenFiles(fileTree).filter(
      (item) => !recent.some((entry) => entry.path === item.path)
    )
    return filterQuickItems([...recent, ...workspace], query).slice(0, 8)
  }, [recentFiles, fileTree, query])

  useEffect(() => {
    setQuery('')
    setActive(0)
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  const choose = (path: string): void => {
    void openFilePath(path)
  }

  return (
    <div className="overlay overlay-quick" onClick={() => setQuickOpen(false)}>
      <div className="search-card quick-card" onClick={(event) => event.stopPropagation()}>
        <div className="search-row">
          <input
            autoFocus
            placeholder="跳转到文件"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((value) => Math.min(value + 1, Math.max(items.length - 1, 0)))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((value) => Math.max(value - 1, 0))
              } else if (event.key === 'Enter' && items[active]) {
                choose(items[active].path)
              } else if (event.key === 'Escape') {
                setQuickOpen(false)
              }
            }}
          />
        </div>
        <div className="search-hits">
          {items.length === 0 ? (
            <div className="empty-hint" style={{ padding: '8px 4px' }}>
              没有匹配的文稿。打开文件夹后会出现在这里。
            </div>
          ) : (
            items.map((item, index) => (
              <button
                key={item.path}
                className={`search-hit ${index === active ? 'active' : ''} ${item.path === currentFile ? 'current' : ''}`}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item.path)}
              >
                <b>{item.name}</b>
                {item.hint ? <i>{item.hint}</i> : null}
                <span className="hit-path">{item.path}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
