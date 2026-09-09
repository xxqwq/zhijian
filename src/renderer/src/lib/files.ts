import type { FileNode, WorkspaceKind } from '@shared/types'
import { fileWorkspaceKind } from '@shared/types'

export type { WorkspaceKind }

export interface QuickItem {
  path: string
  name: string
  hint?: string
}

export function flattenFiles(nodes: FileNode[]): QuickItem[] {
  const items: QuickItem[] = []
  const walk = (list: FileNode[]): void => {
    for (const node of list) {
      if (node.type === 'directory') {
        if (node.children) walk(node.children)
      } else {
        items.push({ path: node.path, name: node.name })
      }
    }
  }
  walk(nodes)
  return items
}

export function filterTreeByKind(nodes: FileNode[], kind: WorkspaceKind): FileNode[] {
  const next: FileNode[] = []
  for (const node of nodes) {
    if (node.type === 'directory') {
      const children = filterTreeByKind(node.children ?? [], kind)
      if (children.length) next.push({ ...node, children })
    } else if (fileWorkspaceKind(node.path) === kind) {
      next.push(node)
    }
  }
  return next
}

export function countFiles(nodes: FileNode[]): number {
  return flattenFiles(nodes).length
}

export function filterQuickItems(items: QuickItem[], query: string): QuickItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => {
    return item.name.toLowerCase().includes(needle) || item.path.toLowerCase().includes(needle)
  })
}
