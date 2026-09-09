function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function maxScroll(el: HTMLElement): number {
  return Math.max(0, el.scrollHeight - el.clientHeight)
}

function mapRange(pos: number, from: number[], to: number[]): number {
  if (from.length === 0 || to.length === 0) return 0
  if (pos <= from[0]) return to[0]
  for (let i = 1; i < from.length; i++) {
    if (pos <= from[i]) {
      const span = from[i] - from[i - 1]
      const t = span <= 0 ? 0 : (pos - from[i - 1]) / span
      return to[i - 1] + t * (to[i] - to[i - 1])
    }
  }
  return to[to.length - 1]
}

function headingLines(markdown: string): boolean[] {
  const flags: boolean[] = []
  let inFence = false
  const lines = markdown.split(/\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) inFence = !inFence
    flags.push(!inFence && /^(#{1,6})\s+\S/.test(line))
  }
  return flags
}

function ensureProbe(host: HTMLElement): HTMLDivElement {
  const existing = host.querySelector('.split-scroll-probe')
  if (existing instanceof HTMLDivElement) return existing
  const probe = document.createElement('div')
  probe.className = 'split-scroll-probe'
  probe.setAttribute('aria-hidden', 'true')
  host.appendChild(probe)
  return probe
}

function sourceHeadingYs(textarea: HTMLTextAreaElement, markdown: string, probe: HTMLDivElement): number[] {
  const cs = getComputedStyle(textarea)
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
  const padTop = parseFloat(cs.paddingTop) || 0
  probe.style.width = `${Math.max(0, textarea.clientWidth - padX)}px`
  probe.style.font = cs.font
  probe.style.lineHeight = cs.lineHeight
  probe.style.letterSpacing = cs.letterSpacing
  probe.style.tabSize = cs.tabSize

  const lines = markdown.split(/\n/)
  const flags = headingLines(markdown)
  let html = ''
  for (let i = 0; i < lines.length; i++) {
    const chunk = escapeHtml(lines[i])
    const nl = i === lines.length - 1 ? '' : '\n'
    html += flags[i] ? `<span data-h>${chunk}</span>${nl}` : chunk + nl
  }
  probe.innerHTML = html || ' '
  return [...probe.querySelectorAll('[data-h]')].map(
    (node) => padTop + (node as HTMLElement).offsetTop
  )
}

function previewHeadingYs(preview: HTMLElement): number[] {
  const top = preview.getBoundingClientRect().top
  return [...preview.querySelectorAll('.milkdown h1, .milkdown h2, .milkdown h3, .milkdown h4, .milkdown h5, .milkdown h6')].map(
    (node) => node.getBoundingClientRect().top - top + preview.scrollTop
  )
}

interface Anchors {
  source: number[]
  preview: number[]
  key: string
}

function buildAnchors(
  source: HTMLTextAreaElement,
  preview: HTMLElement,
  markdown: string,
  probe: HTMLDivElement
): Anchors {
  const sourceMax = maxScroll(source)
  const previewMax = maxScroll(preview)
  const sourceYs = [0]
  const previewYs = [0]
  const srcHeads = sourceHeadingYs(source, markdown, probe)
  const prevHeads = previewHeadingYs(preview)
  const count = Math.min(srcHeads.length, prevHeads.length)
  for (let i = 0; i < count; i++) {
    const s = Math.min(sourceMax, Math.max(0, srcHeads[i]))
    const p = Math.min(previewMax, Math.max(0, prevHeads[i]))
    if (s > sourceYs[sourceYs.length - 1] && p > previewYs[previewYs.length - 1]) {
      sourceYs.push(s)
      previewYs.push(p)
    }
  }
  if (sourceYs[sourceYs.length - 1] < sourceMax || previewYs[previewYs.length - 1] < previewMax) {
    sourceYs.push(sourceMax)
    previewYs.push(previewMax)
  }
  return {
    source: sourceYs,
    preview: previewYs,
    key: `${markdown.length}:${source.scrollHeight}:${preview.scrollHeight}:${source.clientHeight}:${preview.clientHeight}:${source.clientWidth}`
  }
}

export function bindSplitScroll(
  source: HTMLTextAreaElement,
  preview: HTMLElement,
  getMarkdown: () => string
): () => void {
  const probe = ensureProbe(source.parentElement ?? source)
  let anchors: Anchors | null = null
  let lock: HTMLElement | null = null
  let lockTimer = 0

  const anchorsNow = (): Anchors => {
    const markdown = getMarkdown()
    const key = `${markdown.length}:${source.scrollHeight}:${preview.scrollHeight}:${source.clientHeight}:${preview.clientHeight}:${source.clientWidth}`
    if (!anchors || anchors.key !== key) {
      anchors = buildAnchors(source, preview, markdown, probe)
    }
    return anchors
  }

  const apply = (from: HTMLElement, to: HTMLElement): void => {
    const next = anchorsNow()
    const fromKey = from === source ? 'source' : 'preview'
    const toKey = to === source ? 'source' : 'preview'
    to.scrollTop = mapRange(from.scrollTop, next[fromKey], next[toKey])
  }

  const onScroll = (from: HTMLElement, to: HTMLElement) => (): void => {
    if (lock && lock !== from) return
    lock = from
    window.clearTimeout(lockTimer)
    lockTimer = window.setTimeout(() => {
      lock = null
    }, 48)
    apply(from, to)
  }

  const onSource = onScroll(source, preview)
  const onPreview = onScroll(preview, source)
  source.addEventListener('scroll', onSource, { passive: true })
  preview.addEventListener('scroll', onPreview, { passive: true })

  let resizeRaf = 0

  const syncFromPreview = (): void => {
    lock = preview
    window.clearTimeout(lockTimer)
    apply(preview, source)
    lockTimer = window.setTimeout(() => {
      lock = null
    }, 48)
  }

  const frame = window.requestAnimationFrame(() => {
    window.requestAnimationFrame(syncFromPreview)
  })
  const later = window.setTimeout(syncFromPreview, 120)

  const resize = new ResizeObserver(() => {
    anchors = null
    window.cancelAnimationFrame(resizeRaf)
    resizeRaf = window.requestAnimationFrame(() => {
      if (document.activeElement === source) apply(source, preview)
      else apply(preview, source)
    })
  })
  resize.observe(source)
  resize.observe(preview)

  return () => {
    window.cancelAnimationFrame(frame)
    window.cancelAnimationFrame(resizeRaf)
    window.clearTimeout(later)
    window.clearTimeout(lockTimer)
    source.removeEventListener('scroll', onSource)
    preview.removeEventListener('scroll', onPreview)
    resize.disconnect()
    probe.remove()
  }
}
