import { app, dialog, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

type WindowGetter = () => BrowserWindow | null

let getWindow: WindowGetter = () => null
let manualCheck = false

function box(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
  const win = getWindow()
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
}

export function checkForAppUpdates(fromMenu: boolean): void {
  if (!app.isPackaged) {
    if (fromMenu) {
      void box({
        type: 'info',
        message: '开发模式不会检查更新',
        detail: '安装打包后的纸间，才会向 GitHub 查询新版本。'
      })
    }
    return
  }

  manualCheck = fromMenu
  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error)
    if (manualCheck) {
      void box({
        type: 'error',
        message: '检查更新失败',
        detail
      })
    }
    manualCheck = false
  })
}

export function setupUpdater(getter: WindowGetter): void {
  getWindow = getter
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    if (manualCheck) {
      void box({
        type: 'info',
        message: `发现新版本 ${info.version}`,
        detail: '正在后台下载，完成后会提示重启。'
      })
    }
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

  setTimeout(() => checkForAppUpdates(false), 8000)
}
