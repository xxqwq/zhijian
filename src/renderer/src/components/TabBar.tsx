import { useEffect, useRef } from 'react'
import { isTabDirty, tabLabel } from '@renderer/lib/tabs'
import { useAppStore } from '@renderer/store/appStore'

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs)
  const activeId = useAppStore((s) => s.activeId)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const active = scroller.current?.querySelector('.tab.active')
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [activeId])

  return (
    <div className="tabbar">
      <div className="tabbar-scroll" ref={scroller}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeId ? 'active' : ''}`}
            onClick={() => useAppStore.getState().activateTab(tab.id)}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault()
                void useAppStore.getState().closeTab(tab.id)
              }
            }}
            title={tab.path ?? tabLabel(tab)}
          >
            {isTabDirty(tab) && <span className="dirty-dot" />}
            <span className="tab-name">{tabLabel(tab)}</span>
            <button
              className="tab-close"
              type="button"
              aria-label="关闭"
              onClick={(event) => {
                event.stopPropagation()
                void useAppStore.getState().closeTab(tab.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="tab-add"
        type="button"
        title="新建文稿 Ctrl+N"
        onClick={() => void useAppStore.getState().newUntitled()}
      >
        +
      </button>
    </div>
  )
}
