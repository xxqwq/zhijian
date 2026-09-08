import { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/store/appStore'

export function PromptDialog() {
  const prompt = useAppStore((s) => s.prompt)
  const setPrompt = useAppStore((s) => s.setPrompt)
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(prompt?.value ?? '')
  }, [prompt])

  if (!prompt) return null

  return (
    <div className="overlay" onClick={() => setPrompt(null)}>
      <form
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const next = value.trim()
          if (!next) return
          void prompt.onSubmit(next)
          setPrompt(null)
        }}
      >
        <h3>{prompt.title}</h3>
        <label className="empty-hint" style={{ padding: 0 }}>
          {prompt.label}
        </label>
        <div className="search-row">
          <input value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
          <button className="icon-btn active" type="submit">
            {prompt.confirmText}
          </button>
        </div>
      </form>
    </div>
  )
}
