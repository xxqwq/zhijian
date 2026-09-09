import { extractOutline } from '@renderer/lib/markdown'
import { extractTexOutline, isTexFile } from '@renderer/lib/tex'
import { useAppStore } from '@renderer/store/appStore'

interface Props {
  onJump: (text: string, index: number) => void
}

export function Outline({ onJump }: Props) {
  const content = useAppStore((s) => s.content)
  const currentFile = useAppStore((s) => s.currentFile)
  const texDoc = isTexFile(currentFile ?? '')
  const items = texDoc ? extractTexOutline(content) : extractOutline(content)

  return (
    <aside className="outline">
      <div className="panel-inner">
        <div className="panel-head">
          <span>大纲</span>
        </div>
        {items.length === 0 ? (
          <div className="empty-hint">
            {texDoc
              ? '用 \\section{...} 写下章节，即可在这里跳转。'
              : '标题会出现在这里。用 # 写下章节，即可在文稿中跳转。'}
          </div>
        ) : (
          items.map((item, index) => (
            <button
              key={`${item.id}-${item.text}`}
              className="outline-item"
              type="button"
              style={{ paddingLeft: 8 + (item.level - 1) * 12 }}
              onClick={() => onJump(item.text, index)}
            >
              {item.text}
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
