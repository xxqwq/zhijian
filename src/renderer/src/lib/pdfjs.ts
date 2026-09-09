import {
  GlobalWorkerOptions,
  TextLayer,
  getDocument,
  type PDFDocumentProxy,
  type RenderTask
} from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorker

export { TextLayer, getDocument, type PDFDocumentProxy, type RenderTask }

export function toPdfBytes(raw: unknown): Uint8Array {
  const copy = (bytes: Uint8Array): Uint8Array => {
    const out = new Uint8Array(bytes.byteLength)
    out.set(bytes)
    return out
  }
  if (raw instanceof ArrayBuffer) return copy(new Uint8Array(raw))
  if (raw instanceof Uint8Array) return copy(raw)
  if (ArrayBuffer.isView(raw)) {
    return copy(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength))
  }
  if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as { data: unknown }).data)) {
    return copy(Uint8Array.from((raw as { data: number[] }).data))
  }
  throw new Error('无法读取 PDF 数据')
}
