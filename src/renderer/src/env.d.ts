/// <reference types="vite/client" />
/// <reference path="../../preload/index.d.ts" />

declare global {
  interface Window {
    find(
      string: string,
      caseSensitive?: boolean,
      backwards?: boolean,
      wrapAround?: boolean,
      wholeWord?: boolean,
      searchInFrames?: boolean,
      showDialog?: boolean
    ): boolean
  }
}

export {}
