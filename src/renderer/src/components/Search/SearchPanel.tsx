import { useEffect, useState } from 'react'
import type { SearchHit } from '@shared/types'
import { useAppStore } from '@renderer/store/appStore'

interface Props {
  onFind: (query: string, backward?: boolean) => void
}

export function SearchPanel({ onFind }: Props) {
  const mode = useAppStore((s) => s.searchMode)
  const workspacePath = useAppStore((s) => s.workspacePath)
  const content = useAppStore((s) => s.content)
  const setSearchMode = useAppStore((s) => s.setSearchMode)
  const setContent = useAppStore((s) => s.setContent)
  const bumpEditor = useAppStore((s) => s.bumpEditor)
  const openFilePath = useAppStore((s) => s.openFilePath)
  const [query, setQuery] = useState('')
  const [replace, setReplace] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    setHits([])
    setStatus('')
  }, [mode])

  if (mode === 'none') return null

  const runWorkspaceSearch = async (): Promise<void> => {
    if (!workspacePath || !query.trim()) return
    const next = await window.ink.searchWorkspace(workspacePath, query.trim())
    setHits(next)
    setStatus(next.length ? `找到 ${next.length} 处` : '没有匹配')
  }

  const replaceInFile = (all: boolean): void => {
    if (!query) return
    const next = all ? content.split(query).join(replace) : content.replace(query, replace)
    setContent(next)
    bumpEditor()
    setStatus(all ? '已全部替换' : '已替换一处')
  }

  return (
    <div className="overlay" onClick={() => setSearchMode('none')}>
      <div className="search-card" onClick={(event) => event.stopPropagation()}>
        <h3>{mode === 'file' ? '查找当前文稿' : '搜索工作区'}</h3>
        <div className="search-row">
          <input
            autoFocus
            placeholder="查找内容"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (mode === 'file') onFind(query)
                else void runWorkspaceSearch()
              }
              if (event.key === 'Escape') setSearchMode('none')
            }}
          />
          {mode === 'file' ? (
            <>
              <button className="icon-btn active" type="button" onClick={() => onFind(query, true)}>
                上一个
              </button>
              <button className="icon-btn active" type="button" onClick={() => onFind(query)}>
                下一个
              </button>
            </>
          ) : (
            <button className="icon-btn active" type="button" onClick={() => void runWorkspaceSearch()}>
              搜索
            </button>
          )}
        </div>
        {mode === 'file' && (
          <div className="search-row">
            <input
              placeholder="替换为"
              value={replace}
              onChange={(event) => setReplace(event.target.value)}
            />
            <button className="icon-btn active" type="button" onClick={() => replaceInFile(false)}>
              替换
            </button>
            <button className="icon-btn active" type="button" onClick={() => replaceInFile(true)}>
              全部
            </button>
          </div>
        )}
        {status && <div className="empty-hint" style={{ padding: '4px 0' }}>{status}</div>}
        {mode === 'workspace' && (
          <div className="search-hits">
            {hits.map((hit) => (
              <button
                key={`${hit.path}:${hit.line}:${hit.text}`}
                className="search-hit"
                type="button"
                onClick={() => {
                  setSearchMode('none')
                  void openFilePath(hit.path)
                }}
              >
                <b>{hit.path.split(/[/\\]/).pop()}</b>:{hit.line} {hit.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
