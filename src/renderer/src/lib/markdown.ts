import { splitFrontmatter } from '@renderer/lib/frontmatter'

export interface OutlineItem {
  id: string
  level: number
  text: string
}

export function extractOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = []
  let inFence = false
  let index = 0

  for (const line of splitFrontmatter(markdown).body.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue
    const text = match[2].replace(/[*_`]+/g, '').trim()
    items.push({
      id: `h-${index++}`,
      level: match[1].length,
      text
    })
  }
  return items
}

export function countWords(markdown: string): number {
  const withoutCode = splitFrontmatter(markdown).body.replace(/```[\s\S]*?```/g, ' ')
  const chinese = withoutCode.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  const latin = withoutCode.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g)?.length ?? 0
  return chinese + latin
}

export function readingLabel(words: number): string {
  if (words <= 0) return '约 0 分钟'
  const minutes = Math.max(1, Math.round(words / 400))
  return `约 ${minutes} 分钟`
}
