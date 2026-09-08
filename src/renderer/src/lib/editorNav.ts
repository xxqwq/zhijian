import { previewScrollEl } from '@renderer/lib/tabs'

export function jumpToHeading(text: string, index: number): void {
  const root = document.querySelector('.milkdown')
  const stage = previewScrollEl()
  if (!root) return
  const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')]
  const match =
    headings.find((node) => node.textContent?.trim() === text) ?? headings[index]
  if (!match) return
  if (stage) {
    const top =
      match.getBoundingClientRect().top - stage.getBoundingClientRect().top + stage.scrollTop - 28
    const synced = Boolean(document.querySelector('.app.source-mode'))
    stage.scrollTo({ top, behavior: synced ? 'auto' : 'smooth' })
  } else {
    match.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

export function findInEditor(query: string, backward = false): boolean {
  if (!query) return false
  return window.find(query, false, backward, true)
}
