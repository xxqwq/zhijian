import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { getDocument, TextLayer, toPdfBytes, type PDFDocumentProxy, type RenderTask } from '@renderer/lib/pdfjs'
import { searchPdfDocument, type PdfMatch } from '@renderer/lib/pdfSearch'
import { readPdfPage, writePdfPage } from '@renderer/lib/pdfPages'
import { onPdfFindRequest, setPdfPaneActive } from '@renderer/lib/pdfUi'
import { pickPdfFile } from '@renderer/lib/openLocal'
import { useAppStore } from '@renderer/store/appStore'

interface Props {
  path: string
  width: number | null
}

export function PdfViewer({ path, width }: Props) {
  const dismissPdf = useAppStore((s) => s.dismissPdf)
  const setPdfWidth = useAppStore((s) => s.setPdfWidth)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [fit, setFit] = useState(true)
  const [status, setStatus] = useState('正在打开…')
  const [findOpen, setFindOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<PdfMatch[]>([])
  const [matchIndex, setMatchIndex] = useState(0)
  const [findStatus, setFindStatus] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const findRef = useRef<HTMLInputElement>(null)
  const pageWidthRef = useRef(612)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const restoredRef = useRef(false)
  const matchesRef = useRef<PdfMatch[]>([])
  const searchingRef = useRef(false)
  matchesRef.current = matches

  useEffect(() => {
    let cancelled = false
    let loadingTask: ReturnType<typeof getDocument> | null = null
    restoredRef.current = false
    searchingRef.current = false
    matchesRef.current = []
    setPdf(null)
    setPageCount(0)
    setPage(readPdfPage(path))
    setStatus('正在打开…')
    setMatches([])
    setMatchIndex(0)
    setFindStatus('')
    void (async () => {
      try {
        const raw = await window.ink.readBinary(path)
        const data = toPdfBytes(raw)
        loadingTask = getDocument({ data })
        const doc = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }
        const first = await doc.getPage(1)
        pageWidthRef.current = first.getViewport({ scale: 1 }).width
        setPdf(doc)
        setPageCount(doc.numPages)
        setStatus('')
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : '无法阅读这份 PDF')
      }
    })()
    return () => {
      cancelled = true
      void loadingTask?.destroy()
    }
  }, [path])

  const applyFit = useCallback(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const next = Math.max(0.5, Math.min(2.4, (scroll.clientWidth - 28) / pageWidthRef.current))
    setScale(Number(next.toFixed(2)))
  }, [])

  useEffect(() => {
    if (!fit || !pdf) return
    applyFit()
    const scroll = scrollRef.current
    if (!scroll) return
    const observer = new ResizeObserver(() => applyFit())
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [applyFit, fit, pdf, width])

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      zoom(event.deltaY > 0 ? -0.08 : 0.08)
    }
    scroll.addEventListener('wheel', onWheel, { passive: false })
    return () => scroll.removeEventListener('wheel', onWheel)
  }, [pdf])

  useEffect(() => {
    const onMove = (event: MouseEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      setPdfWidth(drag.startWidth + (drag.startX - event.clientX))
    }
    const onUp = (): void => {
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setPdfWidth])

  useEffect(() => {
    if (!restoredRef.current) return
    writePdfPage(path, page)
  }, [page, path])

  useEffect(() => {
    if (!pdf || restoredRef.current) return
    const target = Math.min(pageCount, Math.max(1, readPdfPage(path)))
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      const node = scrollRef.current?.querySelector(`[data-pdf-page="${target}"]`)
      if (!node && tries < 20) return
      window.clearInterval(timer)
      restoredRef.current = true
      jumpToPage(target)
    }, 50)
    return () => window.clearInterval(timer)
  }, [pdf, pageCount, path])

  useEffect(() => {
    return onPdfFindRequest(() => {
      setFindOpen(true)
      window.setTimeout(() => findRef.current?.focus(), 20)
    })
  }, [])

  useEffect(() => {
    if (findOpen) window.setTimeout(() => findRef.current?.focus(), 20)
  }, [findOpen])

  useEffect(() => {
    const match = matches[matchIndex]
    if (!match) return
    jumpToPage(match.page)
    window.setTimeout(() => {
      scrollRef.current?.querySelector('.pdf-hit-active')?.scrollIntoView({
        block: 'center',
        inline: 'nearest'
      })
    }, 60)
  }, [matchIndex, matches])

  const name = path.split(/[/\\]/).pop() || 'PDF'

  return (
    <aside
      className={`pdf-pane ${width ? 'is-fixed' : ''}`}
      style={width ? { width } : undefined}
      aria-label="PDF 阅读器"
      onPointerDown={() => setPdfPaneActive(true)}
      onCopy={(event) => {
        const text = window.getSelection()?.toString()
        if (!text) return
        event.preventDefault()
        event.clipboardData?.setData('text/plain', text)
      }}
    >
      <div
        className="pdf-resizer"
        onMouseDown={(event) => {
          event.preventDefault()
          const pane = (event.currentTarget.parentElement as HTMLElement | null)?.offsetWidth
          dragRef.current = { startX: event.clientX, startWidth: width ?? pane ?? 520 }
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }}
      />
      <header className="pdf-toolbar">
        <span className="pdf-title" title={path}>
          {name}
        </span>
        <div className="pdf-tools">
          <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => jump(-1)}>
            上一页
          </button>
          <span className="pdf-page-label">{pageCount ? `${page} / ${pageCount}` : '—'}</span>
          <button
            type="button"
            className="icon-btn"
            disabled={!pageCount || page >= pageCount}
            onClick={() => jump(1)}
          >
            下一页
          </button>
          <button type="button" className="icon-btn" onClick={() => zoom(-0.1)} title="缩小">
            −
          </button>
          <button
            type="button"
            className={`icon-btn ${fit ? 'active' : ''}`}
            onClick={() => {
              setFit(true)
              applyFit()
            }}
            title="适合宽度"
          >
            {Math.round(scale * 100)}%
          </button>
          <button type="button" className="icon-btn" onClick={() => zoom(0.1)} title="放大">
            +
          </button>
          <button
            type="button"
            className={`icon-btn ${findOpen ? 'active' : ''}`}
            title="在 PDF 中查找"
            onClick={() => setFindOpen((value) => !value)}
          >
            查找
          </button>
          <button
            type="button"
            className="icon-btn"
            title="选择任意 PDF"
            onClick={() => void pickPdfFile()}
          >
            打开
          </button>
          <button
            type="button"
            className="icon-btn"
            title="用系统阅读器打开"
            onClick={() => void window.ink.openTarget(path)}
          >
            系统
          </button>
          <button type="button" className="icon-btn" onClick={() => dismissPdf()}>
            关闭
          </button>
        </div>
      </header>
      {findOpen ? (
        <div className="pdf-find">
          <input
            ref={findRef}
            value={query}
            placeholder="在 PDF 中查找"
            onChange={(event) => {
              setQuery(event.target.value)
              matchesRef.current = []
              setMatches([])
              setMatchIndex(0)
              setFindStatus('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'F3') {
                event.preventDefault()
                void runFind(event.shiftKey ? -1 : 1)
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setFindOpen(false)
              }
            }}
          />
          <span className="pdf-find-count">
            {findStatus || (matches.length ? `${matchIndex + 1} / ${matches.length}` : '')}
          </span>
          <button type="button" className="icon-btn" onClick={() => void runFind(-1)}>
            上一个
          </button>
          <button type="button" className="icon-btn" onClick={() => void runFind(1)}>
            下一个
          </button>
        </div>
      ) : null}
      <div className="pdf-scroll" ref={scrollRef} onScroll={onScroll}>
        {status ? <div className="pdf-status">{status}</div> : null}
        {pdf
          ? Array.from({ length: pageCount }, (_, index) => (
              <PdfPage
                key={`${path}-${index + 1}-${scale}`}
                pdf={pdf}
                pageNumber={index + 1}
                scale={scale}
                scrollRoot={scrollRef}
                matches={matches}
                matchIndex={matchIndex}
              />
            ))
          : null}
      </div>
    </aside>
  )

  function zoom(delta: number): void {
    setFit(false)
    setScale((value) => Math.max(0.5, Math.min(2.4, Number((value + delta).toFixed(2)))))
  }

  function jump(delta: number): void {
    jumpToPage(Math.max(1, Math.min(pageCount, page + delta)))
  }

  function jumpToPage(next: number): void {
    const node = scrollRef.current?.querySelector(`[data-pdf-page="${next}"]`)
    node?.scrollIntoView({ block: 'start' })
    setPage(next)
  }

  function onScroll(): void {
    if (!restoredRef.current) return
    const root = scrollRef.current
    if (!root) return
    const mid = root.scrollTop + root.clientHeight * 0.28
    let current = 1
    root.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((node) => {
      if (node.offsetTop <= mid) current = Number(node.dataset.pdfPage) || current
    })
    setPage(current)
  }

  async function runFind(direction: 1 | -1): Promise<void> {
    if (!pdf || !query.trim()) {
      setMatches([])
      setFindStatus('')
      return
    }
    let nextMatches = matchesRef.current
    if (nextMatches.length === 0) {
      if (searchingRef.current) return
      searchingRef.current = true
      setFindStatus('正在查找…')
      try {
        nextMatches = await searchPdfDocument(pdf, query)
      } finally {
        searchingRef.current = false
      }
      matchesRef.current = nextMatches
      setMatches(nextMatches)
      if (!nextMatches.length) {
        setFindStatus('没有匹配')
        setMatchIndex(0)
        return
      }
      setFindStatus('')
      setMatchIndex(direction < 0 ? nextMatches.length - 1 : 0)
      return
    }
    setFindStatus('')
    setMatchIndex((index) => (index + direction + nextMatches.length) % nextMatches.length)
  }
}

function PdfPage({
  pdf,
  pageNumber,
  scale,
  scrollRoot,
  matches,
  matchIndex
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  scrollRoot: RefObject<HTMLDivElement | null>
  matches: PdfMatch[]
  matchIndex: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const matchesRef = useRef(matches)
  const matchIndexRef = useRef(matchIndex)
  const textDivsRef = useRef<HTMLElement[]>([])
  matchesRef.current = matches
  matchIndexRef.current = matchIndex
  const [box, setBox] = useState({ width: 0, height: 800 })

  useEffect(() => {
    let cancelled = false
    void pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      setBox({ width: viewport.width, height: viewport.height })
    })
    return () => {
      cancelled = true
    }
  }, [pdf, pageNumber, scale])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const layer = textRef.current
    const root = scrollRoot.current
    if (!host || !canvas || !layer || !root) return
    const surface = canvas
    const overlay = layer
    let task: RenderTask | undefined
    let textLayer: TextLayer | undefined
    let alive = true

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || !alive) return
        void renderPage()
      },
      { root, rootMargin: '900px 0px' }
    )
    observer.observe(host)
    const rootRect = root.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    if (hostRect.bottom >= rootRect.top - 900 && hostRect.top <= rootRect.bottom + 900) {
      void renderPage()
    }

    async function renderPage(): Promise<void> {
      const page = await pdf.getPage(pageNumber)
      if (!alive) return
      const viewport = page.getViewport({ scale })
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      surface.width = Math.floor(viewport.width * dpr)
      surface.height = Math.floor(viewport.height * dpr)
      surface.style.width = `${viewport.width}px`
      surface.style.height = `${viewport.height}px`
      const context = surface.getContext('2d')
      if (!context) return
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      task?.cancel()
      task = page.render({ canvasContext: context, viewport, canvas: surface })
      try {
        await task.promise
      } catch {
        return
      }
      if (!alive) return
      overlay.replaceChildren()
      overlay.style.width = `${viewport.width}px`
      overlay.style.height = `${viewport.height}px`
      textLayer?.cancel()
      textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: overlay,
        viewport
      })
      try {
        await textLayer.render()
      } catch {
        /* cancelled */
      }
      if (alive) {
        textDivsRef.current = textLayer?.textDivs ?? []
        paintHits(textDivsRef.current, matchesRef.current, matchIndexRef.current, pageNumber)
      }
    }

    return () => {
      alive = false
      observer.disconnect()
      task?.cancel()
      textLayer?.cancel()
    }
  }, [pdf, pageNumber, scale, scrollRoot])

  useEffect(() => {
    paintHits(textDivsRef.current, matches, matchIndex, pageNumber)
  }, [matches, matchIndex, pageNumber])

  return (
    <div
      className="pdf-page"
      data-pdf-page={pageNumber}
      ref={hostRef}
      style={{
        width: box.width || undefined,
        minHeight: box.height,
        ['--scale-factor' as string]: String(scale),
        ['--total-scale-factor' as string]: String(scale)
      }}
    >
      <canvas ref={canvasRef} />
      <div className="textLayer" ref={textRef} />
    </div>
  )
}

function paintHits(
  spans: HTMLElement[],
  matches: PdfMatch[],
  matchIndex: number,
  pageNumber: number
): void {
  spans.forEach((span) => span.classList.remove('highlight', 'selected', 'pdf-hit-active'))
  matches.forEach((match, index) => {
    if (match.page !== pageNumber) return
    for (let i = match.itemFrom; i <= match.itemTo; i += 1) {
      const span = spans[i]
      if (!span) continue
      span.classList.add('highlight')
      if (index === matchIndex) span.classList.add('selected', 'pdf-hit-active')
    }
  })
}
