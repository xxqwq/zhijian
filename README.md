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

macOS 用 `Command` 代替下面的 `Ctrl`。

- `Ctrl+O` 打开文件夹
- `Ctrl+S` 保存（编辑后约 0.4 秒也会自动保存）
- `Ctrl+F` 查找当前文稿
- `Ctrl+Shift+F` 搜索工作区
- `Ctrl+\` 显示/隐藏侧边栏

## 下载

国内网络不要直接点 GitHub 的 Assets，会跳到 `release-assets.githubusercontent.com` 并断开。请用加速地址（发版完成后可用）：

- Windows：https://gh-proxy.com/https://github.com/xxqwq/zhijian/releases/latest/download/zhijian-setup-0.1.2.exe
- macOS：https://gh-proxy.com/https://github.com/xxqwq/zhijian/releases/latest/download/zhijian-0.1.2-mac.dmg
- Linux：https://gh-proxy.com/https://github.com/xxqwq/zhijian/releases/latest/download/zhijian-0.1.2.AppImage

装好后可用 **帮助 → 检查更新**，或 **帮助 → 国内下载安装包**。

macOS 安装包未签名。第一次打开若被拦截，请到 **系统设置 → 隐私与安全性** 允许打开。

## 打包

**Windows：** 双击项目根目录的 `打包.bat`，完成后打开 `release` 文件夹。

也可以在对应系统上执行：

```powershell
# Windows
npm run build:win

# macOS（必须在 Mac 上）
npm run build:mac

# Linux
npm run build:linux
```

跨平台安装包由 GitHub Actions 构建：推送 `v*` 标签（例如 `v0.1.2`），或在仓库的 Actions 页手动运行 **Release** 工作流。macOS 会打成 Intel + Apple Silicon 通用包。
