const FENCED_RE =
  /^(?:\uFEFF)?(?:[ \t]*\r?\n)*-{3,}[ \t]*\r?\n([\s\S]*?)\r?\n-{3,}[ \t]*(?:\r?\n|$)/
const OPENING_RE = /^(?:\uFEFF)?(?:[ \t]*\r?\n)*-{3,}[ \t]*\r?\n/
const YAML_KEY_RE = /^[A-Za-z][A-Za-z0-9_-]*\s*:/
const META_KEYS = new Set([
  'tags',
  'tag',
  'created',
  'date',
  'updated',
  'paper',
  'title',
  'authors',
  'author',
  'venue',
  'conference',
  'journal',
  'affiliation',
  'pdf',
  'source',
  'doi',
  'year'
])

export const FRONTMATTER_LABELS: Record<string, string> = {
  tags: '标签',
  tag: '标签',
  created: '创建',
  date: '日期',
  updated: '更新',
  paper: '论文',
  title: '标题',
  authors: '作者',
  author: '作者',
  venue: '会议',
  conference: '会议',
  journal: '期刊',
  affiliation: '单位',
  pdf: 'PDF',
  source: '原文',
  doi: 'DOI',
  year: '年份'
}

export interface SplitFrontmatter {
  raw: string
  body: string
}

export interface FrontmatterField {
  key: string
  value: string
}

export function splitFrontmatter(markdown: string): SplitFrontmatter {
  const fenced = FENCED_RE.exec(markdown)
  if (fenced) {
    return {
      raw: fenced[1],
      body: markdown.slice(fenced[0].length)
    }
  }

  const opened = OPENING_RE.exec(markdown)
  if (opened) {
    const taken = takeYamlLines(markdown.slice(opened[0].length))
    if (looksLikeMeta(taken.raw)) return taken
  }

  const stripped = markdown.replace(/^\uFEFF/, '')
  const taken = takeYamlLines(stripped)
  if (looksLikeMeta(taken.raw)) return taken
  return { raw: '', body: markdown }
}

export function joinFrontmatter(raw: string, body: string): string {
  const yaml = raw.replace(/^\uFEFF/, '').trimEnd()
  const nextBody = body.replace(/^\uFEFF/, '').replace(/^\r?\n+/, '')
  if (!yaml.trim()) return nextBody
  return `---\n${yaml.trim()}\n---\n\n${nextBody}`
}

export function parseFrontmatterFields(raw: string): FrontmatterField[] {
  const fields: FrontmatterField[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (!match) continue
    fields.push({ key: match[1], value: unquote(match[2].trim()) })
  }
  return fields
}

export function parseTagList(value: string): string[] {
  const inner = value.replace(/^\[/, '').replace(/\]$/, '')
  return inner
    .split(',')
    .map((item) => unquote(item.trim()))
    .filter(Boolean)
}

function takeYamlLines(source: string): SplitFrontmatter {
  const lines = source.split(/\r?\n/)
  const yaml: string[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      const next = lines[index + 1]
      if (!next || /^#{1,6}\s/.test(next) || /^```/.test(next) || !YAML_KEY_RE.test(next)) break
      yaml.push(line)
      index += 1
      continue
    }
    if (/^#{1,6}\s/.test(line) || /^```/.test(line) || /^>/.test(line)) break
    if (!YAML_KEY_RE.test(line)) break
    yaml.push(line)
    index += 1
  }
  return {
    raw: yaml.join('\n'),
    body: lines.slice(index).join('\n').replace(/^\r?\n+/, '')
  }
}

function looksLikeMeta(raw: string): boolean {
  const keys = parseFrontmatterFields(raw).map((item) => item.key)
  return keys.length >= 2 && keys.some((key) => META_KEYS.has(key))
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1)
  }
  return value
}
