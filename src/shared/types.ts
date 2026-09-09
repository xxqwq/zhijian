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
  | 'open-pdf'
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
  | 'tex-compile'
  | 'tex-import'
  | 'tex-path'

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.txt'] as const
export const TEX_EXTENSIONS = ['.tex', '.bib', '.sty', '.cls'] as const
export const TEXT_EXTENSIONS = [...MARKDOWN_EXTENSIONS, ...TEX_EXTENSIONS] as const
export const TEX_AUX_EXTENSIONS = [
  '.aux',
  '.bbl',
  '.blg',
  '.fdb_latexmk',
  '.fls',
  '.log',
  '.lof',
  '.lot',
  '.nav',
  '.out',
  '.snm',
  '.synctex.gz',
  '.toc',
  '.vrb'
] as const

export function fileExt(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name
  const index = base.lastIndexOf('.')
  return index >= 0 ? base.slice(index).toLowerCase() : ''
}

export function isMarkdownFile(name: string): boolean {
  return (MARKDOWN_EXTENSIONS as readonly string[]).includes(fileExt(name))
}

export function isTexFile(name: string): boolean {
  return (TEX_EXTENSIONS as readonly string[]).includes(fileExt(name))
}

export function isTexSource(name: string): boolean {
  return fileExt(name) === '.tex'
}

export function isTexAuxFile(name: string): boolean {
  const lower = name.toLowerCase()
  return (TEX_AUX_EXTENSIONS as readonly string[]).some((ext) => lower.endsWith(ext))
}

export function isPdfFile(name: string): boolean {
  return fileExt(name) === '.pdf'
}

export type WorkspaceKind = 'md' | 'tex' | 'pdf'

export function fileWorkspaceKind(name: string): WorkspaceKind | null {
  if (isPdfFile(name)) return 'pdf'
  if (isTexFile(name)) return 'tex'
  if (isMarkdownFile(name)) return 'md'
  return null
}
