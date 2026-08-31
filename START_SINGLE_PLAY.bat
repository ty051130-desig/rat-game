@echo off
cd /d %~dp0
echo ================================
echo Rat Escape v11.2 - Local Server
echo ================================
set PORT=8000
where py >nul 2>nul
if not errorlevel 1 (
  start "" http://localhost:%PORT%/
  py -m http.server %PORT%
  goto :eof
)
where python >nul 2>nul
if not errorlevel 1 (
  start "" http://localhost:%PORT%/
  python -m http.server %PORT%
  goto :eof
)
where python3 >nul 2>nul
if not errorlevel 1 (
  start "" http://localhost:%PORT%/
  python3 -m http.server %PORT%
  goto :eof
)
echo Python が見つかりません。
echo PowerShell から python3 -m http.server 8000 を試してください。
pause
