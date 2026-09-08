import MarkdownIt from 'markdown-it'
import katex from 'katex'
import { CALLOUT_LABELS, CALLOUT_RE } from '@renderer/lib/calloutMeta'
import {
  FRONTMATTER_LABELS,
  parseFrontmatterFields,
  parseTagList,
  splitFrontmatter
} from '@renderer/lib/frontmatter'
import { isPathLike } from '@shared/openTarget'
import type { ThemeName } from '@shared/types'
import { themeMeta } from '@renderer/lib/themes'

export type ExportKind = 'html' | 'pdf'

const PRINT_COLORS = {
  bg: '#ffffff',
  paper: '#ffffff',
  ink: '#1c1915',
  muted: '#5c564c',
  line: '#d8d0c4',
  accent: '#8a4b28',
  code: '#f4efe4',
  info: '#2f6494',
  infoBg: '#eef5fb',
  warn: '#8a5a12',
  warnBg: '#fbf4e4',
  ok: '#2c6b4a',
  okBg: '#eaf6ef',
  danger: '#a33b32',
  dangerBg: '#fbeeee'
}

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str: string, lang: string): string {
    if (lang === 'mermaid') {
      return `<div class="mermaid">${md.utils.escapeHtml(str)}</div>`
    }
    return `<pre class="hl"><code class="language-${md.utils.escapeHtml(lang || '')}">${md.utils.escapeHtml(str)}</code></pre>`
  }
})

md.core.ruler.after('block', 'callout', (state) => {
  const tokens = state.tokens
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== 'blockquote_open') continue
    if (tokens[index + 1]?.type !== 'paragraph_open' || tokens[index + 2]?.type !== 'inline') {
      continue
    }
    const inline = tokens[index + 2]
    const match = CALLOUT_RE.exec(inline.content)
    if (!match) continue
    const type = match[1].toLowerCase()
    const title = (match[3] ?? '').trim()
    tokens[index].attrJoin('class', `md-callout md-callout--${type}`)
    tokens[index + 1].attrJoin('class', 'md-callout-title')
    inline.content = title || CALLOUT_LABELS[type] || type
    inline.children = null
  }
})

function renderMath(source: string): string {
  const blocks: string[] = []
  const withBlocks = source.replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex: string) => {
    const html = katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })
    blocks.push(html)
    return `%%MATH_BLOCK_${blocks.length - 1}%%`
  })

  const withInline = withBlocks.replace(/\$([^$\n]+?)\$/g, (_match, tex: string) => {
    return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false })
  })

  return withInline.replace(/%%MATH_BLOCK_(\d+)%%/g, (_match, index: string) => {
    return blocks[Number(index)] ?? ''
  })
}

function paperCss(theme: ThemeName, kind: ExportKind): string {
  const print = kind === 'pdf'
  const colors = print ? PRINT_COLORS : themeMeta(theme).exportColors
  return `
    :root {
      color-scheme: light;
      --bg: ${colors.bg};
      --paper: ${colors.paper};
      --ink: ${colors.ink};
      --muted: ${colors.muted};
      --line: ${colors.line};
      --accent: ${colors.accent};
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      background: ${print ? '#fff' : colors.bg};
      color: ${colors.ink};
      font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", Georgia, serif;
      line-height: 1.8;
    }
    .page {
      max-width: ${print ? 'none' : '760px'};
      margin: 0 auto;
      padding: ${print ? '0' : '64px 48px 96px'};
      background: ${print ? '#fff' : colors.paper};
      min-height: ${print ? '0' : '100vh'};
    }
    h1, h2, h3, h4 {
      font-family: "Fraunces", "Noto Serif SC", "SimSun", serif;
      font-weight: 600;
      line-height: 1.35;
      overflow-wrap: anywhere;
      color: ${colors.ink};
    }
    h1 { font-size: 1.7rem; margin: 0.4em 0 0.7em; }
    h2 { font-size: 1.32rem; margin-top: 1.8em; }
    h3 { font-size: 1.12rem; }
    p, li { color: ${colors.ink}; }
    a { color: ${colors.accent}; }
    blockquote {
      margin: 1.2em 0;
      padding: 0.15em 0 0.15em 1em;
      border-left: 3px solid ${colors.accent};
      color: ${colors.ink};
    }
    code { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
    code, pre, .hl { font-family: "IBM Plex Mono", Consolas, ui-monospace, monospace; }
    ${metaAndCalloutCss(print)}
    pre.hl {
      background: ${colors.code};
      padding: 14px 16px;
      overflow: auto;
      border-radius: 8px;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--line); padding: 8px 10px; }
    img { max-width: 100%; }
    .katex-display { margin: 1.2em 0; }
    @page { size: A4; margin: 16mm 16mm 18mm; }
    @media print {
      html, body, .page {
        background: #fff !important;
        color: ${PRINT_COLORS.ink} !important;
      }
      blockquote, p, li, h1, h2, h3, h4, dd { color: ${PRINT_COLORS.ink} !important; }
    }
  `
}

export function renderMarkdownBody(markdown: string): string {
  const { raw, body } = splitFrontmatter(markdown)
  const html = md.render(renderMath(body))
  return (raw ? renderFrontmatterHtml(raw) : '') + html
}

export function markdownToPlain(markdown: string): string {
  const host = document.createElement('div')
  host.innerHTML = renderMarkdownBody(markdown).replace(
    /<div class="mermaid">([\s\S]*?)<\/div>/g,
    '<pre>$1</pre>'
  )
  return (host.innerText || host.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

export function buildCopyHtml(markdown: string, theme: ThemeName, filePath: string | null): string {
  const colors = themeMeta(theme).exportColors
  let body = renderMarkdownBody(markdown).replace(
    /<div class="mermaid">([\s\S]*?)<\/div>/g,
    '<pre class="hl">$1</pre>'
  )
  body = rewriteLocalImages(body, filePath)
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; color: ${colors.ink}; font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif; line-height: 1.8; }
  h1, h2, h3, h4 { font-weight: 600; line-height: 1.35; }
  a { color: ${colors.accent}; }
  blockquote { margin: 1.4em 0; padding: 0.2em 0 0.2em 1em; border-left: 3px solid ${colors.accent}; color: ${colors.ink}; }
  code { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
  code, pre { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; }
  ${metaAndCalloutCss(false)}
  pre.hl { background: ${colors.code}; padding: 14px 16px; overflow: auto; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid ${colors.line}; padding: 8px 10px; }
  img { max-width: 100%; }
</style>
</head>
<body>
<!--StartFragment-->
<article>${body}</article>
<!--EndFragment-->
</body>
</html>`
}

function rewriteLocalImages(html: string, filePath: string | null): string {
  if (!filePath) return html
  const dir = filePath.replace(/[/\\][^/\\]+$/, '')
  const sep = filePath.includes('\\') ? '\\' : '/'
  return html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"/g, (match, attrs: string, src: string) => {
    if (/^(https?:|data:|file:|ink:)/i.test(src)) return match
    const abs = resolveBeside(dir, src, sep)
    const href = abs.startsWith('/') ? `file://${abs}` : `file:///${abs.replace(/\\/g, '/')}`
    return `<img${attrs}src="${href}"`
  })
}

function resolveBeside(dir: string, rel: string, sep: string): string {
  const parts = dir.split(/[/\\]/)
  for (const segment of rel.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join(sep)
}

export function buildExportHtml(
  markdown: string,
  theme: ThemeName,
  title: string,
  kind: ExportKind = 'html'
): string {
  const body = renderMarkdownBody(markdown)
  const mermaidTheme = kind === 'pdf' ? 'neutral' : themeMeta(theme).scheme === 'dark' ? 'dark' : 'neutral'
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" />
  <style>${paperCss(theme, kind)}</style>
</head>
<body>
  <article class="page">
    ${body}
  </article>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
    mermaid.initialize({ startOnLoad: true, theme: '${mermaidTheme}' })
  </script>
</body>
</html>`
}

function renderFrontmatterHtml(raw: string): string {
  const fields = parseFrontmatterFields(raw)
  const tagsField = fields.find((item) => item.key === 'tags' || item.key === 'tag')
  const tags = tagsField ? parseTagList(tagsField.value) : []
  const created = fields.find((item) => item.key === 'created' || item.key === 'date')
  const rest = fields.filter((item) => !['tags', 'tag', 'created', 'date'].includes(item.key))
  const chips = tags.map((tag) => `<span class="fm-tag">${escapeHtml(tag)}</span>`).join('')
  const rows = rest
    .map((field) => {
      const label = FRONTMATTER_LABELS[field.key] ?? field.key
      const pathClass = isPathLike(field.value) ? ' class="fm-path"' : ''
      return `<div class="fm-row"><dt>${escapeHtml(label)}</dt><dd${pathClass}>${escapeHtml(field.value)}</dd></div>`
    })
    .join('')
  return `<section class="frontmatter">
    <div class="fm-head">${chips ? `<div class="fm-tags">${chips}</div>` : ''}${
      created ? `<time class="fm-date">${escapeHtml(created.value)}</time>` : ''
    }</div>
    ${rows ? `<dl class="fm-grid">${rows}</dl>` : ''}
  </section>`
}

function metaAndCalloutCss(print: boolean): string {
  const info = print ? PRINT_COLORS.info : '#3d7ab0'
  const infoBg = print ? PRINT_COLORS.infoBg : '#eaf2fa'
  const warn = print ? PRINT_COLORS.warn : '#a06b16'
  const warnBg = print ? PRINT_COLORS.warnBg : '#f8f1e0'
  const ok = print ? PRINT_COLORS.ok : '#2f7a56'
  const okBg = print ? PRINT_COLORS.okBg : '#e8f4ee'
  const danger = print ? PRINT_COLORS.danger : '#b04a40'
  const dangerBg = print ? PRINT_COLORS.dangerBg : '#f8eceb'
  return `
    .frontmatter {
      margin: 0 0 1.6em;
      padding: 12px 16px 10px;
      border: 1px solid ${print ? PRINT_COLORS.line : 'var(--line)'};
      border-radius: 10px;
      background: ${print ? '#f7f1e8' : '#f4eee4'};
      font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    .fm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .fm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .fm-tag {
      font-size: 11.5px;
      padding: 2px 8px;
      border-radius: 999px;
      background: ${print ? '#eadcc8' : '#efe0cc'};
      color: ${print ? PRINT_COLORS.accent : 'var(--accent)'};
    }
    .fm-date { color: ${print ? PRINT_COLORS.muted : 'var(--muted)'}; font-size: 12px; white-space: nowrap; }
    .fm-grid { margin: 8px 0 0; }
    .fm-row { display: grid; grid-template-columns: 3.5em minmax(0, 1fr); gap: 4px 12px; padding: 5px 0; }
    .fm-row + .fm-row { border-top: 1px dashed ${print ? PRINT_COLORS.line : 'var(--line)'}; }
    .fm-row dt { color: ${print ? PRINT_COLORS.muted : 'var(--muted)'}; font-size: 12px; }
    .fm-row dd { margin: 0; font-size: 13.5px; overflow-wrap: anywhere; color: ${print ? PRINT_COLORS.ink : 'var(--ink)'}; }
    .fm-path { font-family: "IBM Plex Mono", Consolas, monospace; font-size: 12px; word-break: break-all; }
    .md-callout {
      margin: 1.25em 0;
      padding: 12px 16px 10px 14px;
      border-radius: 8px;
      border-left: 3px solid ${info};
      background: ${infoBg};
      color: ${print ? PRINT_COLORS.ink : 'var(--ink)'} !important;
    }
    .md-callout p, .md-callout li { color: inherit !important; }
    .md-callout-title {
      margin: 0 0 0.45em;
      font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 0.95em;
      font-weight: 700;
      color: ${info};
    }
    .md-callout--tip, .md-callout--hint, .md-callout--success { border-left-color: ${ok}; background: ${okBg}; }
    .md-callout--tip .md-callout-title, .md-callout--hint .md-callout-title, .md-callout--success .md-callout-title { color: ${ok}; }
    .md-callout--warning, .md-callout--caution, .md-callout--question { border-left-color: ${warn}; background: ${warnBg}; }
    .md-callout--warning .md-callout-title, .md-callout--caution .md-callout-title, .md-callout--question .md-callout-title { color: ${warn}; }
    .md-callout--danger, .md-callout--failure, .md-callout--bug { border-left-color: ${danger}; background: ${dangerBg}; }
    .md-callout--danger .md-callout-title, .md-callout--failure .md-callout-title, .md-callout--bug .md-callout-title { color: ${danger}; }
  `
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
