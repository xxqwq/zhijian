import { app, dialog, shell, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

type WindowGetter = () => BrowserWindow | null

let getWindow: WindowGetter = () => null
let manualCheck = false
let suppressError = false

/** GitHub 安装包经国内加速站转发，避免直连 release-assets.githubusercontent.com */
export const UPDATE_FEEDS = [
  'https://gh-proxy.com/https://github.com/xxqwq/zhijian/releases/latest/download',
  'https://ghproxy.net/https://github.com/xxqwq/zhijian/releases/latest/download',
  'https://ghfast.top/https://github.com/xxqwq/zhijian/releases/latest/download'
]

function box(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
  const win = getWindow()
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
}

function applyFeed(url: string): void {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url,
    useMultipleRangeRequest: false
  })
}

export function openChinaInstallerDownload(): void {
  const url = `${UPDATE_FEEDS[0]}/zhijian-setup-${app.getVersion()}.exe`
  void shell.openExternal(url)
}

export function checkForAppUpdates(fromMenu: boolean): void {
  if (!app.isPackaged) {
    if (fromMenu) {
      void box({
        type: 'info',
        message: '开发模式不会检查更新',
        detail: '安装打包后的纸间，才会查询新版本。'
      })
    }
    return
  }

  void runUpdateCheck(fromMenu)
}

async function runUpdateCheck(fromMenu: boolean): Promise<void> {
  manualCheck = fromMenu
  suppressError = true
  let lastError: Error | null = null

  for (const url of UPDATE_FEEDS) {
    try {
      applyFeed(url)
      await autoUpdater.checkForUpdates()
      suppressError = false
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  suppressError = false
  if (fromMenu) {
    void box({
      type: 'error',
      message: '检查更新失败',
      detail: lastError?.message ?? '无法连接到更新服务器'
    })
  }
  manualCheck = false
}

export function setupUpdater(getter: WindowGetter): void {
  getWindow = getter
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  applyFeed(UPDATE_FEEDS[0])

  autoUpdater.on('update-available', (info) => {
    void box({
      type: 'info',
      message: `发现新版本 ${info.version}`,
      detail: '正在后台下载，完成后会提示重启。'
    })
  })

  autoUpdater.on('update-not-available', () => {
    if (manualCheck) {
      void box({
        type: 'info',
        message: '已是最新版本',
        detail: `当前版本 ${app.getVersion()}`
      })
    }
    manualCheck = false
  })

  autoUpdater.on('error', (error) => {
    if (suppressError) return
    if (manualCheck) {
      void box({
        type: 'error',
        message: '检查更新失败',
        detail: error.message
      })
    }
    manualCheck = false
  })

  autoUpdater.on('update-downloaded', (info) => {
    void box({
      type: 'info',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
      message: `纸间 ${info.version} 已下载完成`,
      detail: '重启后即可使用新版本。未保存的修改请先保存。'
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  setTimeout(() => checkForAppUpdates(false), 2000)
}
