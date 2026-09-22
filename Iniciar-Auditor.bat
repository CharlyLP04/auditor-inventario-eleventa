@echo off
setlocal
chcp 65001 >nul
title Auditor de Inventario eleventa
cd /d "%~dp0"
echo ======================================================
echo   AUDITOR DE INVENTARIO - INICIO LOCAL
echo ======================================================
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22.12 o posterior y vuelve a abrir este archivo.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22 || a===22&&b>=12 ? 0 : 1)"
if errorlevel 1 (
  echo Se requiere Node.js 22.12 o posterior.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 goto :error
if not exist "node_modules\.bin\vite.cmd" (
  echo Instalando dependencias. Solo este primer paso requiere Internet.
  call npm ci
  if errorlevel 1 goto :error
)
echo Preparando la aplicacion local...
call npm run build
if errorlevel 1 goto :error
node scripts/local-server.mjs
if errorlevel 1 goto :error
exit /b 0
:error
echo.
echo No se pudo iniciar. Revisa el mensaje anterior.
pause
exit /b 1
