export type ThemeName = 'paper' | 'celadon' | 'ink' | 'dusk'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export interface SearchHit {
  path: string
  line: number
  text: string
}

export type MenuCommand =
  | 'open-folder'
  | 'open-file'
  | 'new-file'
  | 'save'
  | 'save-as'
  | 'export-html'
  | 'export-pdf'
  | 'find'
  | 'find-workspace'
  | 'toggle-sidebar'
  | 'toggle-outline'
  | 'theme-paper'
  | 'theme-celadon'
  | 'theme-ink'
  | 'theme-dusk'
  | 'theme-cycle'
  | 'toggle-typewriter'
  | 'toggle-source'
  | 'toggle-pdf'
  | 'quick-open'
  | 'close-tab'
  | 'next-tab'
  | 'prev-tab'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'copy-as-markdown'
  | 'copy-as-plain'
  | 'copy-as-html'
  | 'paste'
  | 'select-all'
  | 'format-bold'
  | 'format-italic'
  | 'format-strike'
  | 'format-code'
  | 'format-paragraph'
  | 'format-heading-1'
  | 'format-heading-2'
  | 'format-heading-3'
  | 'format-heading-4'
  | 'format-heading-5'
  | 'format-heading-6'
  | 'format-bullet'
  | 'format-ordered'
  | 'format-task'
  | 'format-quote'
  | 'format-code-block'

export const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt'] as const
