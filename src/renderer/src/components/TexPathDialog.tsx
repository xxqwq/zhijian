import { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/store/appStore'

export function TexPathDialog() {
  const open = useAppStore((s) => s.texPathOpen)
  const setOpen = useAppStore((s) => s.setTexPathOpen)
  const setToast = useAppStore((s) => s.setToast)
  const [value, setValue] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (typeof window.ink?.getTexPath !== 'function') {
      setHint('请完全退出纸间后再设置 TeX 路径')
      return
    }
    void window.ink.getTexPath().then((info) => {
      setValue(info.path)
      setHint(
        info.latexmk
          ? `当前使用：${info.latexmk}`
          : info.detected
            ? `未指定，将尝试：${info.detected}`
            : '还没有找到 latexmk，请填写 bin 目录'
      )
    })
  }, [open])

  if (!open) return null

  const save = async (next: string): Promise<void> => {
    if (typeof window.ink?.setTexPath !== 'function') {
      setToast('请完全退出纸间后再设置 TeX 路径')
      return
    }
    const result = await window.ink.setTexPath(next)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setOpen(false)
    setToast(result.info.path ? '已保存 TeX 路径' : '已改回自动查找')
  }

  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <form
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          void save(value)
        }}
      >
        <h3>TeX 路径</h3>
        <label className="empty-hint" style={{ padding: 0 }}>
          本机 TeX Live / MiKTeX 的 bin 目录，也可以填 latexmk.exe。留空则自动查找。
        </label>
        <div className="search-row">
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError('')
            }}
            placeholder="例如 E:\texlive\2026\bin\windows"
            autoFocus
          />
          <button
            className="icon-btn"
            type="button"
            onClick={() => {
              if (typeof window.ink?.pickTexBin !== 'function') return
              void window.ink.pickTexBin(value || undefined).then((picked) => {
                if (picked) {
                  setValue(picked)
                  setError('')
                }
              })
            }}
          >
            浏览
          </button>
        </div>
        {hint ? <p className="dialog-hint">{hint}</p> : null}
        {error ? <p className="dialog-error">{error}</p> : null}
        <div className="dialog-actions">
          <button className="icon-btn" type="button" onClick={() => void save('')}>
            自动查找
          </button>
          <button className="icon-btn active" type="submit">
            保存
          </button>
        </div>
      </form>
    </div>
  )
}
