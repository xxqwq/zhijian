import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx, serializerCtx, EditorStatus } from '@milkdown/kit/core'
import { replaceAll } from '@milkdown/kit/utils'
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history'
import {
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  headingSchema,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  setBlockTypeCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand
} from '@milkdown/kit/preset/commonmark'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import 'katex/dist/katex.min.css'
import { FrontmatterPanel } from '@renderer/components/Editor/FrontmatterPanel'
import { createCalloutPlugin } from '@renderer/lib/calloutPlugin'
import { createLinkOpenPlugin } from '@renderer/lib/openLocalPlugin'
import { registerEditorCommands, registerSelectionMarkdown, registerDocumentMarkdown, type EditorCommand } from '@renderer/lib/editorCommands'
import { joinFrontmatter, splitFrontmatter } from '@renderer/lib/frontmatter'
import { renderMermaidSvg } from '@renderer/lib/mermaid'
import type { ThemeName } from '@shared/types'

interface Props {
  fileKey: string
  tabId: string
  markdown: string
  theme: ThemeName
  currentFile: string | null
  onChange: (markdown: string, tabId: string) => void
  sourceMode?: boolean
}

export function MilkdownEditor({ fileKey, tabId, markdown, theme, currentFile, onChange, sourceMode = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const onChangeRef = useRef(onChange)
  const fileRef = useRef(currentFile)
  const themeRef = useRef(theme)
  const markdownRef = useRef(markdown)
  const frontmatterRef = useRef(splitFrontmatter(markdown).raw)
  const lastAppliedRef = useRef(markdown)
  const applyingRef = useRef(false)
  const sourceModeRef = useRef(sourceMode)
  const { raw } = splitFrontmatter(markdown)

  onChangeRef.current = onChange
  fileRef.current = currentFile
  themeRef.current = theme
  markdownRef.current = markdown
  frontmatterRef.current = splitFrontmatter(markdown).raw
  sourceModeRef.current = sourceMode

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let disposed = false
    const boundTabId = tabId
    const crepe = new Crepe({
      root,
      defaultValue: splitFrontmatter(markdown).body,
      features: {
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.TopBar]: false,
        [Crepe.Feature.Latex]: true
      },
      featureConfigs: {
        [Crepe.Feature.Toolbar]: {
          boldLabel: '粗体',
          italicLabel: '斜体',
          strikethroughLabel: '删除线',
          codeLabel: '行内代码',
          latexLabel: '行内公式',
          linkLabel: '链接'
        },
        [Crepe.Feature.Placeholder]: {
          text: '写下此刻…',
          mode: 'block'
        },
        [Crepe.Feature.CodeMirror]: {
          previewLabel: '预览',
          copyText: '复制',
          searchPlaceholder: '搜索语言',
          noResultText: '没有匹配的语言',
          previewToggleText: (previewOnly) => (previewOnly ? '显示源码' : '仅预览'),
          renderPreview: (language, content, applyPreview) => {
            if (language.toLowerCase() !== 'mermaid' || !content.trim()) return null
            void renderMermaidSvg(content, themeRef.current)
              .then((svg) => applyPreview(svg))
              .catch((error: Error) => applyPreview(`<pre>${error.message}</pre>`))
            return '正在绘制图表…'
          }
        },
        [Crepe.Feature.ImageBlock]: {
          onUpload: async (file) => uploadImage(file, fileRef.current),
          inlineOnUpload: async (file) => uploadImage(file, fileRef.current),
          blockOnUpload: async (file) => uploadImage(file, fileRef.current),
          inlineUploadPlaceholderText: '粘贴或输入图片地址',
          blockUploadPlaceholderText: '粘贴或输入图片地址',
          blockCaptionPlaceholderText: '图片说明',
          proxyDomURL: async (url) => {
            const path = fileRef.current
            if (!path) return url
            return window.ink.toAssetUrl(path, url)
          }
        },
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            label: '文本',
            text: { label: '正文' },
            h1: { label: '一级标题' },
            h2: { label: '二级标题' },
            h3: { label: '三级标题' },
            h4: { label: '四级标题' },
            h5: { label: '五级标题' },
            h6: { label: '六级标题' },
            quote: { label: '引用' },
            divider: { label: '分隔线' }
          },
          listGroup: {
            label: '列表',
            bulletList: { label: '无序列表' },
            orderedList: { label: '有序列表' },
            taskList: { label: '待办' }
          },
          advancedGroup: {
            label: '插入',
            image: { label: '图片' },
            codeBlock: { label: '代码块' },
            table: { label: '表格' },
            math: { label: '公式' }
          }
        }
      }
    })

    crepe.editor.use(createCalloutPlugin())
    crepe.editor.use(createLinkOpenPlugin(() => fileRef.current))

    const applyExternal = (next: string): void => {
      const current = crepeRef.current
      if (!current) return
      applyExternalMarkdown(current, next, lastAppliedRef, applyingRef)
    }

    lastAppliedRef.current = markdown
    applyingRef.current = false

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, next) => {
        if (disposed) return
        if (applyingRef.current) return
        if (sourceModeRef.current) {
          let focused = false
          try {
            crepe.editor.action((ctx) => {
              focused = ctx.get(editorViewCtx).hasFocus()
            })
          } catch {
            return
          }
          if (!focused) return
        }
        const full = joinFrontmatter(frontmatterRef.current, next)
        lastAppliedRef.current = full
        onChangeRef.current(full, boundTabId)
      })
    })

    let unregister: (() => void) | undefined
    let unregisterSelection: (() => void) | undefined
    let unregisterDocument: (() => void) | undefined

    void crepe.create().then(() => {
      if (disposed) {
        void crepe.destroy()
        return
      }
      crepeRef.current = crepe
      unregister = registerEditorCommands((command) => runMilkdownCommand(crepe, command), 'wysiwyg')
      unregisterSelection = registerSelectionMarkdown(() => readMilkdownSelection(crepe), 'wysiwyg')
      unregisterDocument = registerDocumentMarkdown(() => {
        if (crepe.editor.status !== EditorStatus.Created) return null
        return joinFrontmatter(frontmatterRef.current, crepe.getMarkdown())
      })
      applyExternal(markdownRef.current)
    })

    return () => {
      disposed = true
      unregister?.()
      unregisterSelection?.()
      unregisterDocument?.()
      crepeRef.current = null
      void crepe.destroy()
      root.innerHTML = ''
    }
    // Recreate only when switching files; typing is handled by onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey])

  useEffect(() => {
    const crepe = crepeRef.current
    if (!crepe) return
    if (markdown === lastAppliedRef.current) return
    const timer = window.setTimeout(() => {
      applyExternalMarkdown(crepe, markdown, lastAppliedRef, applyingRef)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [markdown])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const flush = (): void => {
      const crepe = crepeRef.current
      if (!crepe) return
      applyExternalMarkdown(crepe, markdownRef.current, lastAppliedRef, applyingRef)
    }
    root.addEventListener('focusin', flush)
    return () => root.removeEventListener('focusin', flush)
  }, [])

  return (
    <div className={raw ? 'wysiwyg has-frontmatter' : 'wysiwyg'}>
      {raw ? (
        <FrontmatterPanel
          raw={raw}
          markdownPath={currentFile}
          onChange={(nextRaw) =>
            onChange(joinFrontmatter(nextRaw, splitFrontmatter(markdown).body), tabId)
          }
        />
      ) : null}
      <div className="editor-root" ref={rootRef} />
    </div>
  )
}

function applyExternalMarkdown(
  crepe: Crepe,
  next: string,
  lastAppliedRef: { current: string },
  applyingRef: { current: boolean }
): void {
  if (crepe.editor.status !== EditorStatus.Created) return
  if (next === lastAppliedRef.current) return
  const { body } = splitFrontmatter(next)
  const prevBody = splitFrontmatter(lastAppliedRef.current).body
  lastAppliedRef.current = next
  if (body === prevBody) return
  applyingRef.current = true
  crepe.editor.action(replaceAll(body, true))
  window.setTimeout(() => {
    applyingRef.current = false
  }, 0)
}

async function uploadImage(file: File, markdownPath: string | null): Promise<string> {
  if (!markdownPath) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(file)
    })
  }
  const data = new Uint8Array(await file.arrayBuffer())
  return window.ink.saveImage(markdownPath, file.name, data)
}

function readMilkdownSelection(crepe: Crepe): string | null {
  if (crepe.editor.status !== EditorStatus.Created) return null
  let markdown: string | null = null
  try {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { from, to, empty } = view.state.selection
      if (empty) return
      const serializer = ctx.get(serializerCtx)
      markdown = serializer(view.state.doc.cut(from, to)).trim() || null
    })
  } catch {
    return window.getSelection()?.toString().trim() || null
  }
  return markdown
}

function runMilkdownCommand(crepe: Crepe, command: EditorCommand): boolean {
  if (crepe.editor.status !== EditorStatus.Created) return false
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.focus()
    const commands = ctx.get(commandsCtx)
    switch (command) {
      case 'undo':
        commands.call(undoCommand.key)
        break
      case 'redo':
        commands.call(redoCommand.key)
        break
      case 'bold':
        commands.call(toggleStrongCommand.key)
        break
      case 'italic':
        commands.call(toggleEmphasisCommand.key)
        break
      case 'strikethrough':
        commands.call(toggleStrikethroughCommand.key)
        break
      case 'inline-code':
        commands.call(toggleInlineCodeCommand.key)
        break
      case 'paragraph':
        commands.call(setBlockTypeCommand.key, { nodeType: paragraphSchema.type(ctx) })
        break
      case 'heading-1':
      case 'heading-2':
      case 'heading-3':
      case 'heading-4':
      case 'heading-5':
      case 'heading-6': {
        const level = Number(command.slice(-1))
        commands.call(setBlockTypeCommand.key, {
          nodeType: headingSchema.type(ctx),
          attrs: { level }
        })
        break
      }
      case 'bullet-list':
        commands.call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) })
        break
      case 'ordered-list':
        commands.call(wrapInBlockTypeCommand.key, { nodeType: orderedListSchema.type(ctx) })
        break
      case 'task-list':
        commands.call(wrapInBlockTypeCommand.key, {
          nodeType: listItemSchema.type(ctx),
          attrs: { checked: false }
        })
        break
      case 'quote':
        commands.call(wrapInBlockTypeCommand.key, { nodeType: blockquoteSchema.type(ctx) })
        break
      case 'code-block':
        commands.call(setBlockTypeCommand.key, { nodeType: codeBlockSchema.type(ctx) })
        break
    }
  })
  return true
}


