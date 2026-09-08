import { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, protocol, net, shell } from 'electron'
import { checkForAppUpdates, setupUpdater } from './updater'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, writeFile, rename } from 'fs/promises'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { randomBytes } from 'crypto'
import chokidar, { type FSWatcher } from 'chokidar'
import { classifyOpenTarget, decodeOpenTarget, type ResolveResult } from '@shared/openTarget'
import type { FileNode, MenuCommand, SearchHit } from '@shared/types'
import { TEXT_EXTENSIONS } from '@shared/types'

app.setName('纸间')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ink',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
])

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null
let watcher: FSWatcher | null = null
let dirty = false

function sendMenu(command: MenuCommand): void {
  mainWindow?.webContents.send('menu:command', command)
}

function menuItem(
  label: string,
  command: MenuCommand,
  accelerator?: string
): Electron.MenuItemConstructorOptions {
  return {
    label,
    accelerator,
    click: () => sendMenu(command)
  }
}

function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

async function readTree(dir: string): Promise<FileNode[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (['node_modules', 'out', 'dist', 'release'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: full,
        type: 'directory',
        children: await readTree(full)
      })
    } else if (isTextFile(entry.name)) {
      nodes.push({ name: entry.name, path: full, type: 'file' })
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
  return nodes
}

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        menuItem('打开文件夹…', 'open-folder', 'CmdOrCtrl+O'),
        menuItem('打开文件…', 'open-file', 'CmdOrCtrl+Shift+O'),
        menuItem('新建文件', 'new-file', 'CmdOrCtrl+N'),
        menuItem('关闭标签', 'close-tab', 'CmdOrCtrl+W'),
        { type: 'separator' },
        menuItem('保存', 'save', 'CmdOrCtrl+S'),
        menuItem('另存为…', 'save-as', 'CmdOrCtrl+Shift+S'),
        { type: 'separator' },
        menuItem('导出 HTML…', 'export-html'),
        menuItem('导出 PDF…', 'export-pdf'),
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        menuItem('撤销', 'undo', 'CmdOrCtrl+Z'),
        menuItem('重做', 'redo', 'CmdOrCtrl+Y'),
        { type: 'separator' },
        menuItem('剪切', 'cut', 'CmdOrCtrl+X'),
        menuItem('复制', 'copy', 'CmdOrCtrl+C'),
        {
          label: '复制为',
          submenu: [
            menuItem('Markdown', 'copy-as-markdown', 'CmdOrCtrl+Shift+C'),
            menuItem('纯文本', 'copy-as-plain'),
            menuItem('HTML（带样式）', 'copy-as-html', 'CmdOrCtrl+Alt+C')
          ]
        },
        menuItem('粘贴', 'paste', 'CmdOrCtrl+V'),
        menuItem('全选', 'select-all', 'CmdOrCtrl+A'),
        { type: 'separator' },
        menuItem('快速打开', 'quick-open', 'CmdOrCtrl+P'),
        menuItem('下一标签', 'next-tab', 'Ctrl+PageDown'),
        menuItem('上一标签', 'prev-tab', 'Ctrl+PageUp'),
        menuItem('查找', 'find', 'CmdOrCtrl+F'),
        menuItem('工作区搜索', 'find-workspace', 'CmdOrCtrl+Shift+F')
      ]
    },
    {
      label: '段落',
      submenu: [
        menuItem('正文', 'format-paragraph'),
        menuItem('一级标题', 'format-heading-1', 'Ctrl+Alt+1'),
        menuItem('二级标题', 'format-heading-2', 'Ctrl+Alt+2'),
        menuItem('三级标题', 'format-heading-3', 'Ctrl+Alt+3'),
        menuItem('四级标题', 'format-heading-4', 'Ctrl+Alt+4'),
        menuItem('五级标题', 'format-heading-5', 'Ctrl+Alt+5'),
        menuItem('六级标题', 'format-heading-6', 'Ctrl+Alt+6'),
        { type: 'separator' },
        menuItem('无序列表', 'format-bullet'),
        menuItem('有序列表', 'format-ordered'),
        menuItem('待办列表', 'format-task'),
        menuItem('引用', 'format-quote'),
        menuItem('代码块', 'format-code-block')
      ]
    },
    {
      label: '格式',
      submenu: [
        menuItem('粗体', 'format-bold', 'CmdOrCtrl+B'),
        menuItem('斜体', 'format-italic', 'CmdOrCtrl+I'),
        menuItem('删除线', 'format-strike', 'Alt+Shift+5'),
        menuItem('行内代码', 'format-code')
      ]
    },
    {
      label: '查看',
      submenu: [
        menuItem('侧边栏', 'toggle-sidebar', 'CmdOrCtrl+\\'),
        menuItem('大纲', 'toggle-outline', 'CmdOrCtrl+Shift+\\'),
        menuItem('PDF 阅读器', 'toggle-pdf'),
        menuItem('打字机滚动', 'toggle-typewriter', 'CmdOrCtrl+Shift+T'),
        menuItem('源码对照', 'toggle-source', 'CmdOrCtrl+/'),
        { type: 'separator' },
        menuItem('浅色纸面', 'theme-paper'),
        menuItem('青瓷', 'theme-celadon'),
        menuItem('深色墨夜', 'theme-ink'),
        menuItem('夜航', 'theme-dusk'),
        menuItem('下一个主题', 'theme-cycle', 'Ctrl+Alt+T'),
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { role: 'reload', label: '重新加载' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新',
          click: () => checkForAppUpdates(true)
        },
        { type: 'separator' },
        {
          label: '关于纸间',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              message: '纸间',
              detail: `版本 ${app.getVersion()}\nhttps://github.com/xxqwq/zhijian`
            })
          }
        }
      ]
    }
  ])
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 860,
    minHeight: 560,
    show: false,
    backgroundColor: '#f3eadc',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  Menu.setApplicationMenu(buildMenu())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) void openResolved(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    void openResolved(url)
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function isAppUrl(url: string): boolean {
  const renderer = process.env['ELECTRON_RENDERER_URL']
  if (isDev && renderer && url.startsWith(renderer)) return true
  if (url.startsWith('devtools:')) return true
  if (url.startsWith('ink:')) return true
  if (url.startsWith('file:') && /[/\\]renderer[/\\]/.test(url)) return true
  return false
}

function resolveOpenTarget(
  value: string,
  baseFile?: string | null,
  key?: string
): { type: 'url'; value: string } | { type: 'path'; value: string } | null {
  const raw = decodeOpenTarget(value)
  const kind = classifyOpenTarget(raw, key)
  if (!kind) return null

  if (kind === 'url') {
    if (/^https?:\/\//i.test(raw)) return { type: 'url', value: raw }
    const doi = raw.replace(/^doi:\s*/i, '')
    return { type: 'url', value: `https://doi.org/${doi}` }
  }

  let filePath = raw
  if (/^file:/i.test(raw)) {
    try {
      filePath = fileURLToPath(raw)
    } catch {
      return null
    }
  }
  if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')) {
    return { type: 'path', value: filePath }
  }
  if (!baseFile) return null
  return { type: 'path', value: path.resolve(path.dirname(baseFile), filePath) }
}

async function openResolved(
  value: string,
  baseFile?: string | null,
  key?: string
): Promise<{ ok: boolean; error?: string }> {
  const resolved = resolveOpenTarget(value, baseFile, key)
  if (!resolved) return { ok: false, error: '无法识别路径' }
  try {
    if (resolved.type === 'url') {
      const protocol = new URL(resolved.value).protocol
      if (protocol !== 'http:' && protocol !== 'https:') {
        return { ok: false, error: '不支持的链接' }
      }
      await shell.openExternal(resolved.value)
      return { ok: true }
    }
    if (!existsSync(resolved.value)) {
      return { ok: false, error: '找不到这个文件' }
    }
    const err = await shell.openPath(resolved.value)
    if (err) return { ok: false, error: err }
    return { ok: true }
  } catch {
    return { ok: false, error: '无法打开' }
  }
}

function registerIpc(): void {
  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveFile', async (_event, defaultPath?: string) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle(
    'dialog:exportPath',
    async (_event, defaultName: string, filters: Electron.FileFilter[]) => {
      if (!mainWindow) return null
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName,
        filters
      })
      return result.canceled ? null : result.filePath
    }
  )

  ipcMain.handle('dialog:confirmClose', async (_event, message?: string) => {
    if (!mainWindow) return 'cancel'
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['保存', '不保存', '取消'],
      defaultId: 0,
      cancelId: 2,
      message: message || '当前文件尚未保存，要先保存吗？'
    })
    if (result.response === 0) return 'save'
    if (result.response === 1) return 'discard'
    return 'cancel'
  })

  ipcMain.handle('fs:readTree', (_event, dir: string) => readTree(dir))

  ipcMain.handle('fs:exists', (_event, target: string) => existsSync(target))

  ipcMain.handle(
    'shell:resolve',
    (_event, target: string, baseFile?: string | null, key?: string): ResolveResult => {
      const resolved = resolveOpenTarget(target, baseFile, key)
      if (!resolved) return { ok: false, error: '无法识别路径' }
      if (resolved.type === 'url') return { ok: true, kind: 'url', value: resolved.value }
      if (!existsSync(resolved.value)) return { ok: false, error: '找不到这个文件' }
      return { ok: true, kind: 'path', value: resolved.value }
    }
  )

  ipcMain.handle(
    'shell:open',
    (_event, target: string, baseFile?: string | null, key?: string) =>
      openResolved(target, baseFile, key)
  )

  ipcMain.handle('fs:readBinary', async (_event, filePath: string) => {
    const buf = await readFile(filePath)
    return new Uint8Array(buf)
  })

  ipcMain.handle('fs:readFile', (_event, filePath: string) =>
    readFile(filePath, 'utf-8')
  )

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  })

  ipcMain.handle('fs:createFile', async (_event, dir: string, name: string) => {
    const filePath = path.join(dir, name.endsWith('.md') ? name : `${name}.md`)
    if (existsSync(filePath)) throw new Error('同名文件已存在')
    await writeFile(filePath, '', 'utf-8')
    return filePath
  })

  ipcMain.handle('fs:createFolder', async (_event, dir: string, name: string) => {
    const folderPath = path.join(dir, name)
    await mkdir(folderPath, { recursive: true })
    return folderPath
  })

  ipcMain.handle('fs:rename', async (_event, target: string, newName: string) => {
    const dest = path.join(path.dirname(target), newName)
    await rename(target, dest)
    return dest
  })

  ipcMain.handle('fs:trash', async (_event, target: string) => {
    await shell.trashItem(target)
  })

  ipcMain.handle(
    'fs:saveImage',
    async (_event, markdownPath: string, fileName: string, data: Uint8Array) => {
      const assetsDir = path.join(path.dirname(markdownPath), 'assets')
      await mkdir(assetsDir, { recursive: true })
      const ext = path.extname(fileName) || '.png'
      const base = path.basename(fileName, ext).replace(/[^\w\u4e00-\u9fff-]+/g, '-')
      const unique = `${base || 'image'}-${randomBytes(3).toString('hex')}${ext}`
      const dest = path.join(assetsDir, unique)
      await writeFile(dest, Buffer.from(data))
      return `assets/${unique}`
    }
  )

  ipcMain.handle('fs:toAssetUrl', (_event, markdownPath: string, src: string) => {
    if (!src || /^(https?:|data:|ink:|file:)/i.test(src)) return src
    const abs = path.resolve(path.dirname(markdownPath), src)
    return `ink://asset/?p=${encodeURIComponent(abs)}`
  })

  ipcMain.handle('search:workspace', async (_event, dir: string, query: string) => {
    const needle = query.trim()
    if (!needle) return []
    const hits: SearchHit[] = []
    const walk = async (current: string): Promise<void> => {
      const entries = await readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) {
          if (['node_modules', 'out', 'dist', 'release'].includes(entry.name)) continue
          await walk(full)
        } else if (isTextFile(entry.name)) {
          const text = await readFile(full, 'utf-8')
          const lines = text.split(/\r?\n/)
          lines.forEach((line, index) => {
            if (line.includes(needle) && hits.length < 200) {
              hits.push({ path: full, line: index + 1, text: line.trim() })
            }
          })
        }
      }
    }
    await walk(dir)
    return hits
  })

  ipcMain.handle('export:html', async (_event, dest: string, html: string) => {
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, html, 'utf-8')
  })

  ipcMain.handle('export:pdf', async (_event, dest: string, html: string) => {
    const pdfWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { sandbox: true }
    })
    const htmlPath = path.join(app.getPath('temp'), `zhijian-export-${Date.now()}.html`)
    await writeFile(htmlPath, html, 'utf-8')
    try {
      await pdfWindow.loadFile(htmlPath)
      await pdfWindow.webContents.executeJavaScript(
        'document.fonts ? document.fonts.ready.then(() => true) : true'
      )
      const pdf = await pdfWindow.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: 'none' }
      })
      await mkdir(path.dirname(dest), { recursive: true })
      await writeFile(dest, pdf)
    } finally {
      pdfWindow.destroy()
    }
  })

  ipcMain.handle('watch:start', async (_event, dir: string) => {
    await watcher?.close()
    watcher = chokidar.watch(dir, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../
    })
    const notify = (): void => {
      mainWindow?.webContents.send('watch:change')
    }
    watcher.on('add', notify).on('unlink', notify).on('addDir', notify).on('unlinkDir', notify)
  })

  ipcMain.handle(
    'edit:native',
    (_event, action: 'cut' | 'copy' | 'paste' | 'selectAll') => {
      const wc = mainWindow?.webContents
      if (!wc) return
      if (action === 'selectAll') wc.selectAll()
      else wc[action]()
    }
  )

  ipcMain.handle('clipboard:write', (_event, payload: { text: string; html?: string }) => {
    if (payload.html) clipboard.write({ text: payload.text, html: payload.html })
    else clipboard.writeText(payload.text)
  })

  ipcMain.handle('window:setDirty', (_event, nextDirty: boolean, title: string) => {
    dirty = nextDirty
    if (mainWindow) {
      mainWindow.setTitle(dirty ? `● ${title} — 纸间` : `${title} — 纸间`)
      mainWindow.setDocumentEdited(dirty)
    }
  })
}

app.whenReady().then(async () => {
  protocol.handle('ink', (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('p')
      if (!filePath) return new Response('missing path', { status: 400 })
      return net.fetch(pathToFileURL(filePath).href)
    } catch {
      return new Response('bad request', { status: 400 })
    }
  })

  registerIpc()
  await createWindow()
  setupUpdater(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  void watcher?.close()
  if (process.platform !== 'darwin') app.quit()
})

