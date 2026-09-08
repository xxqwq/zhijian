@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   纸间 — 一键打包 Windows 安装包
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 18+
  echo 下载地址: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
set "CSC_IDENTITY_AUTO_DISCOVERY=false"

if not exist "node_modules\" (
  echo [1/2] 正在安装依赖，首次会比较慢...
  call npm install
  if errorlevel 1 (
    echo.
    echo [错误] 依赖安装失败
    pause
    exit /b 1
  )
) else (
  echo [1/2] 依赖已就绪
)

echo.
echo [2/2] 正在编译并打包，请稍候...
call npm run build:win
if errorlevel 1 (
  echo.
  echo [错误] 打包失败，请把上面的报错发过来
  pause
  exit /b 1
)

echo.
echo ========================================
echo   打包完成
echo   安装包目录: %cd%\release
echo ========================================
echo.

if exist "release\" start "" explorer "release"
pause
