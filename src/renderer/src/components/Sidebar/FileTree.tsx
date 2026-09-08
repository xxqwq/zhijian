import { useMemo, useState, type MouseEvent } from 'react'
import type { FileNode } from '@shared/types'
import { useAppStore } from '@renderer/store/appStore'

export function FileTree() {
  const workspacePath = useAppStore((s) => s.workspacePath)
  const fileTree = useAppStore((s) => s.fileTree)
  const currentFile = useAppStore((s) => s.currentFile)
  const openWorkspace = useAppStore((s) => s.openWorkspace)
  const openFilePath = useAppStore((s) => s.openFilePath)
  const setContextMenu = useAppStore((s) => s.setContextMenu)
  const setPrompt = useAppStore((s) => s.setPrompt)
  const createFile = useAppStore((s) => s.createFile)

  return (
    <aside className="sidebar">
      <div className="panel-inner">
        <div className="panel-head">
          <span>工作区</span>
          <button className="icon-btn" type="button" onClick={() => void openWorkspace()}>
            打开
          </button>
        </div>
        {!workspacePath ? (
          <div className="empty-hint">
            打开一个本地文件夹，纸间会列出其中的 Markdown 文稿。右键可以新建、重命名或删除。
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
                  children: fileTree
                }
              })
            }}
          >
            {fileTree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                currentFile={currentFile}
                onOpen={openFilePath}
                onMenu={(event, target) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setContextMenu({ x: event.clientX, y: event.clientY, node: target })
                }}
              />
            ))}
            <button
              className="tree-item"
              type="button"
              style={{ paddingLeft: 10 }}
              onClick={() =>
                setPrompt({
                  title: '新建文稿',
                  label: '文件名',
                  value: '未命名.md',
                  confirmText: '创建',
                  onSubmit: (name) => createFile(workspacePath, name)
                })
              }
            >
              + 新建文稿
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function TreeNode({
  node,
  depth,
  currentFile,
  onOpen,
  onMenu
}: {
  node: FileNode
  depth: number
  currentFile: string | null
  onOpen: (path: string) => Promise<void>
  onMenu: (event: MouseEvent, node: FileNode) => void
}) {
  const [open, setOpen] = useState(true)
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
                currentFile={currentFile}
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
      className={`tree-item ${currentFile === node.path ? 'active' : ''}`}
      type="button"
      style={pad}
      onClick={() => void onOpen(node.path)}
      onContextMenu={(event) => onMenu(event, node)}
    >
      <span className="caret">·</span>
      <span className="tree-label">{node.name}</span>
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
          新建文件
        </button>
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
