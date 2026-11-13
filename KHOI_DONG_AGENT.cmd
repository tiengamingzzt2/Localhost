@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "NODE_EXE=node"
where node >nul 2>&1
if errorlevel 1 (
  if exist "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" (
    set "NODE_EXE=C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe"
  ) else (
    echo Khong tim thay Node.js. Hay cai Node.js LTS tu https://nodejs.org roi thu lai.
    pause
    exit /b 1
  )
)

"%NODE_EXE%" "%~dp0scripts\start-agent.cjs"
if errorlevel 1 (
  echo.
  echo Khong the khoi dong Agent. Xem thong bao loi o tren.
  pause
  exit /b 1
)
