@echo off
cd /d "%~dp0"
title Yeosu Career Quest

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Install Node.js LTS from https://nodejs.org and run this file again.
  start https://nodejs.org
  pause
  exit /b 1
)

set MISSING=0
for %%F in (package.json main.js index.html css\style.css src\data.js src\core.js src\world.js src\minigames.js src\report.js src\game.js) do (
  if not exist "%%F" (
    echo [ERROR] Missing file: %%F
    set MISSING=1
  )
)
if "%MISSING%"=="1" (
  echo Check the file names and the css / src folders, then run again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing packages. This is needed only on the first run.
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
  )
)

echo Starting the game...
call npm start
if errorlevel 1 pause