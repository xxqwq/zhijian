import { useMemo, useState, type MouseEvent } from 'react'
import type { FileNode, WorkspaceKind } from '@shared/types'
import { isPdfFile, isTexSource } from '@shared/types'
import { pickPdfFile } from '@renderer/lib/openLocal'
import { countFiles, filterTreeByKind } from '@renderer/lib/files'
import { importConferenceTemplate } from '@renderer/lib/tex'
import { useAppStore } from '@renderer/store/appStore'

const KIND_KEY = 'zhijian.workspaceKind'

const KINDS: { id: WorkspaceKind; label: string; empty: string }[] = [
  { id: 'md', label: 'Markdown', empty: '还没有 Markdown。点下方新建，或把 .md 放进这个文件夹。' },
  { id: 'tex', label: 'LaTeX', empty: '还没有 LaTeX 文稿。可以导入会议模板，或新建 .tex。' },
  { id: 'pdf', label: 'PDF', empty: '还没有 PDF。编译论文后会出现在这里，也可以直接打开。' }
]

function readKind(): WorkspaceKind {
  try {
    const value = localStorage.getItem(KIND_KEY)
    if (value === 'md' || value === 'tex' || value === 'pdf') return value
  } catch {
    /* ignore */
  }
  return 'md'
}

function persistKind(kind: WorkspaceKind): void {
  try {
    localStorage.setItem(KIND_KEY, kind)
  } catch {
    /* ignore */
  }
}

export function FileTree() {
  const workspacePath = useAppStore((s) => s.workspacePath)
  const fileTree = useAppStore((s) => s.fileTree)
  const currentFile = useAppStore((s) => s.currentFile)
  const pdfPath = useAppStore((s) => s.pdfPath)
  const openWorkspace = useAppStore((s) => s.openWorkspace)
  const openFilePath = useAppStore((s) => s.openFilePath)
  const openPdf = useAppStore((s) => s.openPdf)
  const setContextMenu = useAppStore((s) => s.setContextMenu)
  const setPrompt = useAppStore((s) => s.setPrompt)
  const createFile = useAppStore((s) => s.createFile)
  const [kind, setKind] = useState<WorkspaceKind>(readKind)

  const trees = useMemo(
    () => ({
      md: filterTreeByKind(fileTree, 'md'),
      tex: filterTreeByKind(fileTree, 'tex'),
      pdf: filterTreeByKind(fileTree, 'pdf')
    }),
    [fileTree]
  )
  const visible = trees[kind]
  const meta = KINDS.find((item) => item.id === kind) ?? KINDS[0]
  const activePath = kind === 'pdf' ? pdfPath : currentFile

  const switchKind = (next: WorkspaceKind): void => {
    setKind(next)
    persistKind(next)
  }

  const openNode = (path: string): void => {
    if (isPdfFile(path)) openPdf(path)
    else void openFilePath(path)
  }

  return (
    <aside className="sidebar">
      <div className="panel-inner">
        <div className="panel-head">
          <span>工作区</span>
          <button className="icon-btn" type="button" onClick={() => void openWorkspace()}>
            打开
          </button>
        </div>
        <div className="workspace-kinds" role="tablist" aria-label="工作区类型">
          {KINDS.map((item) => (
            <button
              key={item.id}
              className={`workspace-kind ${kind === item.id ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={kind === item.id}
              onClick={() => switchKind(item.id)}
            >
              {item.label}
              {workspacePath ? <em>{countFiles(trees[item.id])}</em> : null}
            </button>
          ))}
        </div>
        {!workspacePath ? (
          <div className="empty-hint">
            打开一个本地文件夹。Markdown、LaTeX 和 PDF 会分开放在三个工作区里，点文件即可打开。
          </div>
        ) : (
          <div
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                node: {
                  name: workspacePath,
                  path: workspacePath,
                  type: 'directory',
                  children: visible
                }
              })
            }}
          >
            {visible.length === 0 ? (
              <div className="empty-hint">{meta.empty}</div>
            ) : (
              visible.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  activePath={activePath}
                  onOpen={openNode}
                  onMenu={(event, target) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setContextMenu({ x: event.clientX, y: event.clientY, node: target })
                  }}
                />
              ))
            )}
            {kind === 'md' ? (
              <button
                className="tree-item"
                type="button"
                style={{ paddingLeft: 10 }}
                onClick={() =>
                  setPrompt({
                    title: '新建 Markdown',
                    label: '文件名',
                    value: '未命名.md',
                    confirmText: '创建',
                    onSubmit: (name) => createFile(workspacePath, name)
                  })
                }
              >
                + 新建文稿
              </button>
            ) : null}
            {kind === 'tex' ? (
              <>
                <button
                  className="tree-item"
                  type="button"
                  style={{ paddingLeft: 10 }}
                  onClick={() => void importConferenceTemplate()}
                >
                  + 导入 LaTeX 模板
                </button>
                <button
                  className="tree-item"
                  type="button"
                  style={{ paddingLeft: 10 }}
                  onClick={() =>
                    setPrompt({
                      title: '新建 LaTeX',
                      label: '文件名',
                      value: 'main.tex',
                      confirmText: '创建',
                      onSubmit: (name) => createFile(workspacePath, name)
                    })
                  }
                >
                  + 新建 .tex
                </button>
              </>
            ) : null}
            {kind === 'pdf' ? (
              <button
                className="tree-item"
                type="button"
                style={{ paddingLeft: 10 }}
                onClick={() => void pickPdfFile()}
              >
                + 打开 PDF
              </button>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  )
}

function TreeNode({
  node,
  depth,
  activePath,
  onOpen,
  onMenu
}: {
  node: FileNode
  depth: number
  activePath: string | null
  onOpen: (path: string) => void
  onMenu: (event: MouseEvent, node: FileNode) => void
}) {
  const [open, setOpen] = useState(true)
  const mainTexPath = useAppStore((s) => s.mainTexPath)
  const isDir = node.type === 'directory'
  const pad = { paddingLeft: 10 + depth * 18 }

  if (isDir) {
    return (
      <div>
        <button
          className="tree-item"
          type="button"
          style={pad}
          onClick={() => setOpen((v) => !v)}
          onContextMenu={(event) => onMenu(event, node)}
        >
          <span className="caret">{open ? '▾' : '▸'}</span>
          <span className="tree-label">{node.name}</span>
        </button>
        {open && node.children && (
          <div className="tree-children">
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onOpen={onOpen}
                onMenu={onMenu}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      className={`tree-item ${activePath === node.path ? 'active' : ''}`}
      type="button"
      style={pad}
      onClick={() => onOpen(node.path)}
      onContextMenu={(event) => onMenu(event, node)}
    >
      <span className="caret">·</span>
      <span className="tree-label">{node.name}</span>
      {mainTexPath === node.path ? <em className="tree-main">主</em> : null}
    </button>
  )
}

export function FileContextMenu() {
  const menu = useAppStore((s) => s.contextMenu)
  const setContextMenu = useAppStore((s) => s.setContextMenu)
  const setPrompt = useAppStore((s) => s.setPrompt)
  const createFile = useAppStore((s) => s.createFile)
  const createFolder = useAppStore((s) => s.createFolder)
  const renameNode = useAppStore((s) => s.renameNode)
  const deleteNode = useAppStore((s) => s.deleteNode)
  const setMainTex = useAppStore((s) => s.setMainTex)
  const mainTexPath = useAppStore((s) => s.mainTexPath)

  const dir = useMemo(() => {
    if (!menu) return ''
    return menu.node.type === 'directory' ? menu.node.path : menu.node.path.replace(/[/\\][^/\\]+$/, '')
  }, [menu])

  if (!menu) return null

  return (
    <>
      <div className="scrim" onClick={() => setContextMenu(null)} />
      <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
        <button
          type="button"
          onClick={() => {
            setContextMenu(null)
            setPrompt({
              title: '新建文稿',
              label: '文件名',
              value: '未命名.md',
              confirmText: '创建',
              onSubmit: (name) => createFile(dir, name)
            })
          }}
        >
          新建 Markdown
        </button>
        <button
          type="button"
          onClick={() => {
            setContextMenu(null)
            setPrompt({
              title: '新建 LaTeX',
              label: '文件名',
              value: 'main.tex',
              confirmText: '创建',
              onSubmit: (name) => createFile(dir, name)
            })
          }}
        >
          新建 LaTeX
        </button>
        <button
          type="button"
          onClick={() => {
            setContextMenu(null)
            void importConferenceTemplate()
          }}
        >
          导入 LaTeX 模板
        </button>
        {menu.node.type === 'file' && isTexSource(menu.node.path) ? (
          <button
            type="button"
            onClick={() => {
              setContextMenu(null)
              setMainTex(menu.node.path)
            }}
          >
            {mainTexPath === menu.node.path ? '已是主文件' : '设为主文件'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setContextMenu(null)
            setPrompt({
              title: '新建文件夹',
              label: '名称',
              value: '新文件夹',
              confirmText: '创建',
              onSubmit: (name) => createFolder(dir, name)
            })
          }}
        >
          新建文件夹
        </button>
        <button
          type="button"
          onClick={() => {
            setContextMenu(null)
            setPrompt({
              title: '重命名',
              label: '新名称',
              value: menu.node.name,
              confirmText: '确定',
              onSubmit: (name) => renameNode(menu.node.path, name)
            })
          }}
        >
          重命名
        </button>
        <button
          type="button"
          onClick={() => {
            setContextMenu(null)
            void deleteNode(menu.node.path)
          }}
        >
          删除
        </button>
      </div>
    </>
  )
}
