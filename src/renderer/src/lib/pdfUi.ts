const FIND = 'zhijian-pdf-find'

let paneActive = false

export function setPdfPaneActive(next: boolean): void {
  paneActive = next
}

export function isPdfPaneActive(): boolean {
  return paneActive
}

export function requestPdfFind(): void {
  window.dispatchEvent(new Event(FIND))
}

export function onPdfFindRequest(handler: () => void): () => void {
  window.addEventListener(FIND, handler)
  return () => window.removeEventListener(FIND, handler)
}

export function selectionInPdf(): boolean {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return false
  const node = selection.anchorNode
  const el = node instanceof Element ? node : node?.parentElement
  return Boolean(el?.closest('.pdf-pane'))
}
