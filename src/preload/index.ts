import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron'
import type { FileNode, MenuCommand, SearchHit } from '@shared/types'
import type { ResolveResult } from '@shared/openTarget'

const api = {
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
  openFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', defaultPath),
  exportPath: (
    defaultName: string,
    filters: { name: string; extensions: string[] }[]
  ): Promise<string | null> => ipcRenderer.invoke('dialog:exportPath', defaultName, filters),
  readTree: (dir: string): Promise<FileNode[]> => ipcRenderer.invoke('fs:readTree', dir),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  createFile: (dir: string, name: string): Promise<string> =>
    ipcRenderer.invoke('fs:createFile', dir, name),
  createFolder: (dir: string, name: string): Promise<string> =>
    ipcRenderer.invoke('fs:createFolder', dir, name),
  rename: (target: string, newName: string): Promise<string> =>
    ipcRenderer.invoke('fs:rename', target, newName),
  trash: (target: string): Promise<void> => ipcRenderer.invoke('fs:trash', target),
  saveImage: (markdownPath: string, fileName: string, data: Uint8Array): Promise<string> =>
    ipcRenderer.invoke('fs:saveImage', markdownPath, fileName, data),
  toAssetUrl: (markdownPath: string, src: string): Promise<string> =>
    ipcRenderer.invoke('fs:toAssetUrl', markdownPath, src),
  searchWorkspace: (dir: string, query: string): Promise<SearchHit[]> =>
    ipcRenderer.invoke('search:workspace', dir, query),
  exportHtml: (dest: string, html: string): Promise<void> =>
    ipcRenderer.invoke('export:html', dest, html),
  exportPdf: (dest: string, html: string): Promise<void> =>
    ipcRenderer.invoke('export:pdf', dest, html),
  watch: (dir: string): Promise<void> => ipcRenderer.invoke('watch:start', dir),
  onWatchChange: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on('watch:change', listener)
    return () => ipcRenderer.removeListener('watch:change', listener)
  },
  onMenu: (handler: (command: MenuCommand) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, command: MenuCommand): void => {
      handler(command)
    }
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.removeListener('menu:command', listener)
  },
  nativeEdit: (action: 'cut' | 'copy' | 'paste' | 'selectAll'): Promise<void> =>
    ipcRenderer.invoke('edit:native', action),
  writeClipboard: (payload: { text: string; html?: string }): Promise<void> =>
    ipcRenderer.invoke('clipboard:write', payload),
  setDirty: (dirty: boolean, title: string): Promise<void> =>
    ipcRenderer.invoke('window:setDirty', dirty, title),
  confirmClose: (message?: string): Promise<'save' | 'discard' | 'cancel'> =>
    ipcRenderer.invoke('dialog:confirmClose', message),
  pathExists: (target: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', target),
  resolveTarget: (
    target: string,
    baseFile?: string | null,
    key?: string
  ): Promise<ResolveResult> => ipcRenderer.invoke('shell:resolve', target, baseFile, key),
  openTarget: (
    target: string,
    baseFile?: string | null,
    key?: string
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('shell:open', target, baseFile, key),
  readBinary: (filePath: string): Promise<Uint8Array> => ipcRenderer.invoke('fs:readBinary', filePath)
}

export type InkApi = typeof api

contextBridge.exposeInMainWorld('ink', api)

