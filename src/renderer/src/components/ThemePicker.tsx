import { useEffect, useRef, useState } from 'react'
import { THEMES, themeMeta } from '@renderer/lib/themes'
import { useAppStore } from '@renderer/store/appStore'

export function ThemePicker() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = themeMeta(theme)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        className={`icon-btn ${open ? 'active' : ''}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="切换主题"
        onClick={() => setOpen((value) => !value)}
      >
        主题
      </button>
      {open && (
        <div className="theme-menu" role="listbox" aria-label="选择主题">
          <div className="theme-menu-head">选择主题</div>
          {THEMES.map((item) => (
            <button
              key={item.id}
              className={`theme-option ${item.id === theme ? 'selected' : ''}`}
              type="button"
              role="option"
              aria-selected={item.id === theme}
              onClick={() => {
                setTheme(item.id)
                setOpen(false)
              }}
            >
              <span
                className="theme-swatch"
                style={{
                  background: `linear-gradient(135deg, ${item.swatch[0]} 52%, ${item.swatch[1]} 52%)`
                }}
              />
              <span>
                <strong>{item.name}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
          <div className="theme-menu-foot">当前：{current.name} · Ctrl+Alt+T 轮换</div>
        </div>
      )}
    </div>
  )
}
