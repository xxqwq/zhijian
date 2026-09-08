import { WELCOME_MARKDOWN } from '@renderer/lib/welcome'

export interface OpenTab {
  id: string
  path: string | null
  content: string
  savedContent: string
  scrollTop: number
  sourceMode: boolean
}

export const MAX_TABS = 16

export function createTab(partial: Partial<OpenTab> & Pick<OpenTab, 'id'>): OpenTab {
  return {
    path: null,
    content: '',
    savedContent: '',
    scrollTop: 0,
    sourceMode: false,
    ...partial
  }
}

export function welcomeTab(): OpenTab {
  return createTab({
    id: 'untitled-0',
    content: WELCOME_MARKDOWN,
    savedContent: WELCOME_MARKDOWN
  })
}

export function isTabDirty(tab: OpenTab): boolean {
  return tab.content !== tab.savedContent
}

export function tabLabel(tab: OpenTab): string {
  if (tab.path) {
    return tab.path.split(/[/\\]/).pop()?.replace(/\.(md|markdown|txt)$/i, '') || tab.path
  }
  if (tab.content === WELCOME_MARKDOWN) return '欢迎'
  return '未命名'
}

export function readStageScroll(): number {
  const stage = document.querySelector('.paper-stage')
  return stage instanceof HTMLElement ? stage.scrollTop : 0
}

export function writeStageScroll(top: number): void {
  const stage = document.querySelector('.paper-stage')
  if (stage instanceof HTMLElement) stage.scrollTop = top
}
