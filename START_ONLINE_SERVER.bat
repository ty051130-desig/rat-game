@echo off
cd /d %~dp0
echo ================================
echo Rat Escape v11.2 Online Server
echo ================================
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js / npm が見つかりません。
  echo https://nodejs.org/ をインストールしてください。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 初回セットアップ: npm install を実行します...
  call npm install
  if errorlevel 1 (
    echo npm install に失敗しました。
    pause
    exit /b 1
  )
)
call npm start
pause
