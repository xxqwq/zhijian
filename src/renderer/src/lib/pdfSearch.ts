import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface PdfMatch {
  page: number
  itemFrom: number
  itemTo: number
}

function isTextItem(item: unknown): item is { str: string } {
  return Boolean(item && typeof item === 'object' && typeof (item as { str?: unknown }).str === 'string')
}

export async function searchPdfDocument(pdf: PDFDocumentProxy, query: string): Promise<PdfMatch[]> {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const matches: PdfMatch[] = []
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const content = await pdf.getPage(page).then((item) => item.getTextContent())
    const items: { str: string }[] = []
    for (const item of content.items) {
      if (isTextItem(item)) items.push(item)
    }
    let acc = ''
    const starts: number[] = []
    for (const item of items) {
      starts.push(acc.length)
      acc += item.str
    }
    const haystack = acc.toLowerCase()
    let from = 0
    while (from < haystack.length) {
      const at = haystack.indexOf(needle, from)
      if (at < 0) break
      const end = at + needle.length
      let itemFrom = 0
      while (itemFrom < starts.length - 1 && starts[itemFrom + 1] <= at) itemFrom += 1
      let itemTo = itemFrom
      while (itemTo < starts.length - 1 && starts[itemTo + 1] < end) itemTo += 1
      matches.push({ page, itemFrom, itemTo })
      from = at + 1
    }
  }
  return matches.slice(0, 400)
}
