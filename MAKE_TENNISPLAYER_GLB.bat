@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "ROOT=%~dp0"
set "BLEND=%ROOT%assets\source\tennisplayer.blend"
set "EXPORTER=%ROOT%tools\export_tennisplayer_glb.py"
set "OUTPUT=%ROOT%assets\models\tennisplayer.glb"
set "BLENDER="

echo ============================================
echo  Rat Escape v9.3 - Tennis Player Export
echo ============================================

echo NOTE: You do NOT need to resave the .blend file.
echo.

if not exist "%BLEND%" (
  echo ERROR: assets\source\tennisplayer.blend was not found.
  goto :fail
)

if defined BLENDER_EXE if exist "%BLENDER_EXE%" set "BLENDER=%BLENDER_EXE%"

if not defined BLENDER (
  for /f "delims=" %%F in ('where blender.exe 2^>nul') do (
    if not defined BLENDER set "BLENDER=%%F"
  )
)

if not defined BLENDER if exist "%ProgramFiles%\Blender Foundation" (
  for /f "delims=" %%F in ('dir /b /s /a-d "%ProgramFiles%\Blender Foundation\blender.exe" 2^>nul') do (
    if not defined BLENDER set "BLENDER=%%F"
  )
)

if not defined BLENDER if exist "%LOCALAPPDATA%\Programs\Blender Foundation" (
  for /f "delims=" %%F in ('dir /b /s /a-d "%LOCALAPPDATA%\Programs\Blender Foundation\blender.exe" 2^>nul') do (
    if not defined BLENDER set "BLENDER=%%F"
  )
)

if not defined BLENDER (
  echo.
  echo ERROR: blender.exe could not be found automatically.
  echo Set BLENDER_EXE to the full path of blender.exe and try again.
  goto :fail
)

echo Blender: %BLENDER%
echo Blend  : %BLEND%
echo Output : %OUTPUT%
echo.

if exist "%OUTPUT%" del /q "%OUTPUT%" >nul 2>nul

"%BLENDER%" -b "%BLEND%" --python "%EXPORTER%" -- --output "%OUTPUT%"
if errorlevel 1 (
  echo.
  echo ERROR: Blender export failed.
  goto :fail
)

if not exist "%OUTPUT%" (
  echo.
  echo ERROR: tennisplayer.glb was not created.
  goto :fail
)

echo.
echo ============================================
echo  EXPORT COMPLETE
echo ============================================
echo Created:
echo   assets\models\tennisplayer.glb
echo.
echo Start the game and open Stage 2: Clubroom.
echo.
pause
exit /b 0

:fail
echo.
echo Export was not completed.
echo.
pause
exit /b 1
