import type { FileNode } from '@shared/types'

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

export function filterQuickItems(items: QuickItem[], query: string): QuickItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => {
    return item.name.toLowerCase().includes(needle) || item.path.toLowerCase().includes(needle)
  })
}
