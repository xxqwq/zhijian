import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { classifyOpenTarget } from '@shared/openTarget'
import { openLocal } from '@renderer/lib/openLocal'

const SKIP_PARENTS = new Set(['code_block', 'code'])

export function createLinkOpenPlugin(getBaseFile: () => string | null) {
  return $prose(() => {
    return new Plugin({
      key: new PluginKey('zhijian-open-local'),
      props: {
        handleDOMEvents: {
          click(_view, event) {
            const target = event.target as HTMLElement | null
            if (!target) return false
            const link = target.closest('a')
            const pathEl = target.closest('.md-local-path')
            const href = link?.getAttribute('href')
            const value = href || pathEl?.textContent || ''
            if (!value || href?.startsWith('#')) return false
            if (!classifyOpenTarget(value) && !pathEl) {
              if (link) event.preventDefault()
              return false
            }
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault()
              void openLocal(value, getBaseFile())
              return true
            }
            if (link) event.preventDefault()
            return false
          }
        },
        decorations(state) {
          const decorations: Decoration[] = []
          state.doc.descendants((node, pos, parent) => {
            if (parent && SKIP_PARENTS.has(parent.type.name)) return false
            if (SKIP_PARENTS.has(node.type.name)) return false
            if (!node.isText || !node.text) return
            if (node.marks.some((mark) => mark.type.name === 'link' || mark.type.name === 'code')) {
              return
            }
            const re = /[A-Za-z]:[\\/][^\n"<>|*?]+/g
            let match: RegExpExecArray | null
            while ((match = re.exec(node.text))) {
              const text = match[0].replace(/[.,;:!?)\]]+$/, '').trimEnd()
              if (text.length < 4) continue
              const from = pos + match.index
              const to = from + text.length
              decorations.push(
                Decoration.inline(from, to, {
                  class: 'md-local-path',
                  title: 'Ctrl+单击打开'
                })
              )
            }
          })
          return DecorationSet.create(state.doc, decorations)
        }
      }
    })
  })
}
