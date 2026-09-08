import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { CALLOUT_LABELS, CALLOUT_RE } from '@renderer/lib/calloutMeta'

export function createCalloutPlugin() {
  return $prose(() => {
    return new Plugin({
      key: new PluginKey('zhijian-callout'),
      props: {
        attributes: {
          spellcheck: 'false'
        },
        decorations(state) {
          const decorations: Decoration[] = []
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'blockquote') return
            const paragraph = node.firstChild
            if (!paragraph || paragraph.type.name !== 'paragraph') return
            const match = CALLOUT_RE.exec(paragraph.textContent)
            if (!match) return

            const type = match[1].toLowerCase()
            const title = match[3] ?? ''
            const markerLength = match[0].length - title.length
            const paraPos = pos + 1
            const textStart = paraPos + 1

            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: `md-callout md-callout--${type}`,
                'data-callout': type
              })
            )
            decorations.push(
              Decoration.node(paraPos, paraPos + paragraph.nodeSize, {
                class: 'md-callout-title'
              })
            )
            if (markerLength > 0) {
              decorations.push(
                Decoration.inline(textStart, textStart + markerLength, {
                  class: 'md-callout-mark',
                  'data-callout': type,
                  'data-label': CALLOUT_LABELS[type] ?? type
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
