# 纸间

类 Typora 的本地 Markdown 桌面编辑器：所见即所得、工作区文件树、大纲、查找、公式与 Mermaid、导出 HTML/PDF。

## 运行

需要已安装 Node.js 18+。若 Electron 下载因证书失败，可先设置镜像再安装：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm install
npm run dev
```

## 常用快捷键

- `Ctrl+O` 打开文件夹
- `Ctrl+S` 保存（编辑后约 0.4 秒也会自动保存）
- `Ctrl+F` 查找当前文稿
- `Ctrl+Shift+F` 搜索工作区
- `Ctrl+\` 显示/隐藏侧边栏

## 打包

**一键打包（推荐）：** 双击项目根目录的 `打包.bat`。首次会自动安装依赖，完成后会打开 `release` 文件夹，安装包名为 `纸间-0.1.0-Setup.exe`。安装后可用菜单 **帮助 → 检查更新**；新版本会发布到 [GitHub Releases](https://github.com/xxqwq/zhijian/releases)。

也可以在终端执行：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run build:win
```
