import mermaid from 'mermaid'
import type { ThemeName } from '@shared/types'
import { themeMeta } from '@renderer/lib/themes'

let ready = false
let currentTheme: ThemeName = 'paper'

export function ensureMermaid(theme: ThemeName): void {
  if (ready && currentTheme === theme) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: themeMeta(theme).scheme === 'dark' ? 'dark' : 'neutral',
    fontFamily: '"Noto Sans SC", sans-serif'
  })
  ready = true
  currentTheme = theme
}

export async function renderMermaidSvg(source: string, theme: ThemeName): Promise<string> {
  ensureMermaid(theme)
  const id = `zhijian${Date.now()}${Math.floor(Math.random() * 1_000_000)}`
  const { svg } = await mermaid.render(id, source)
  return svg
}
