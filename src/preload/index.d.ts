import type { InkApi } from './index'

declare global {
  interface Window {
    ink: InkApi
  }
}

export {}
