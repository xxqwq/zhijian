import { useMemo, useState } from 'react'
import { FRONTMATTER_LABELS, parseFrontmatterFields, parseTagList } from '@renderer/lib/frontmatter'
import { classifyOpenTarget, isPathLike, isPdfPath, openLocal } from '@renderer/lib/openLocal'

const PRIMARY_ORDER = [
  'paper',
  'title',
  'authors',
  'author',
  'venue',
  'conference',
  'journal',
  'affiliation',
  'year',
  'doi',
  'pdf',
  'source'
]

interface Props {
  raw: string
  markdownPath: string | null
  onChange: (raw: string) => void
}

export function FrontmatterPanel({ raw, markdownPath, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const fields = useMemo(() => parseFrontmatterFields(raw), [raw])
  const tags = useMemo(() => {
    const field = fields.find((item) => item.key === 'tags' || item.key === 'tag')
    return field ? parseTagList(field.value) : []
  }, [fields])
  const created = fields.find((item) => item.key === 'created' || item.key === 'date')
  const rest = sortFields(
    fields.filter((item) => !['tags', 'tag', 'created', 'date'].includes(item.key))
  )

  return (
    <section className="frontmatter" aria-label="文稿元数据">
      <header className="fm-head">
        <div className="fm-tags">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span className="fm-tag" key={tag}>
                {tag}
              </span>
            ))
          ) : (
            <span className="fm-kicker">YAML</span>
          )}
        </div>
        <div className="fm-head-meta">
          {created ? <time className="fm-date">{created.value}</time> : null}
          <button
            className="fm-toggle"
            type="button"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? '完成' : '编辑'}
          </button>
        </div>
      </header>

      {editing ? (
        <textarea
          className="fm-source"
          spellCheck={false}
          value={raw}
          onChange={(event) => onChange(event.target.value)}
          aria-label="YAML 源码"
        />
      ) : rest.length > 0 ? (
        <dl className="fm-grid">
          {rest.map((field) => (
            <div className="fm-row" key={field.key}>
              <dt>{FRONTMATTER_LABELS[field.key] ?? field.key}</dt>
              <dd className={isPathLike(field.value) ? 'fm-path' : undefined}>
                <FieldValue field={field} markdownPath={markdownPath} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

function sortFields(fields: { key: string; value: string }[]): { key: string; value: string }[] {
  return [...fields].sort((a, b) => {
    const ai = PRIMARY_ORDER.indexOf(a.key)
    const bi = PRIMARY_ORDER.indexOf(b.key)
    const av = ai === -1 ? PRIMARY_ORDER.length : ai
    const bv = bi === -1 ? PRIMARY_ORDER.length : bi
    return av - bv
  })
}

function FieldValue({
  field,
  markdownPath
}: {
  field: { key: string; value: string }
  markdownPath: string | null
}) {
  const kind = classifyOpenTarget(field.value, field.key)
  if (!kind) return field.value
  const title =
    kind === 'url'
      ? '打开链接'
      : isPdfPath(field.value) || field.key === 'pdf' || field.key === 'source'
        ? '在纸间中阅读'
        : '用系统默认程序打开'
  return (
    <button
      className="fm-open"
      type="button"
      title={title}
      onClick={() => void openLocal(field.value, markdownPath, field.key)}
    >
      {field.value}
    </button>
  )
}
