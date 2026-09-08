import type { ThemeName } from '@shared/types'

export interface ThemeMeta {
  id: ThemeName
  name: string
  hint: string
  scheme: 'light' | 'dark'
  swatch: [string, string]
  exportColors: {
    bg: string
    paper: string
    ink: string
    muted: string
    line: string
    accent: string
    code: string
  }
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'paper',
    name: '浅色纸面',
    hint: '暖黄宣纸，适合白天写作',
    scheme: 'light',
    swatch: ['#fbf6ec', '#9a4e2a'],
    exportColors: {
      bg: '#f3eadc',
      paper: '#fbf6ec',
      ink: '#2b2418',
      muted: '#7a6d5a',
      line: '#e2d5c2',
      accent: '#9a4e2a',
      code: '#efe6d6'
    }
  },
  {
    id: 'celadon',
    name: '青瓷',
    hint: '冷调浅色，像一间茶室',
    scheme: 'light',
    swatch: ['#eef5f1', '#2f6f5e'],
    exportColors: {
      bg: '#e4eee8',
      paper: '#f4faf6',
      ink: '#1e2f28',
      muted: '#5d746a',
      line: '#c9ddd4',
      accent: '#2f6f5e',
      code: '#e3eee8'
    }
  },
  {
    id: 'ink',
    name: '深色墨夜',
    hint: '暖调黑夜，夜里校对',
    scheme: 'dark',
    swatch: ['#1c1813', '#d9a066'],
    exportColors: {
      bg: '#14110d',
      paper: '#1c1813',
      ink: '#efe4d4',
      muted: '#b7a894',
      line: '#3a3228',
      accent: '#d9a066',
      code: '#12100c'
    }
  },
  {
    id: 'dusk',
    name: '夜航',
    hint: '蓝黑夜读，更冷静一些',
    scheme: 'dark',
    swatch: ['#121826', '#8fb4e0'],
    exportColors: {
      bg: '#0e1420',
      paper: '#151c2b',
      ink: '#e4ecf6',
      muted: '#93a4bb',
      line: '#2a364c',
      accent: '#8fb4e0',
      code: '#0c121c'
    }
  }
]

const STORAGE_KEY = 'zhijian.theme'

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return THEMES.some((theme) => theme.id === value)
}

export function themeMeta(id: ThemeName): ThemeMeta {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}

export function readStoredTheme(): ThemeName {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (isThemeName(value)) return value
  } catch {
    /* ignore */
  }
  return 'paper'
}

export function persistTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function nextTheme(current: ThemeName): ThemeName {
  const index = THEMES.findIndex((theme) => theme.id === current)
  return THEMES[(index + 1) % THEMES.length].id
}
