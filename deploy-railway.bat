@echo off
title Deploy Hooked to Railway
echo.
echo  Hooked - Railway deploy
echo  =======================
echo.
echo  This uploads your project folder to Railway (no zip needed).
echo  A browser window will open to log in the first time.
echo.
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node/npm not found. Install Node from https://nodejs.org
  pause
  exit /b 1
)
echo Installing Railway CLI...
call npm install -g @railway/cli
if errorlevel 1 (
  echo Trying without global install...
  call npx @railway/cli login
  call npx @railway/cli init
  call npx @railway/cli up
) else (
  call railway login
  call railway init
  call railway up
)
echo.
echo Done. In Railway: Settings - Networking - Generate Domain
echo Then add your Variables from RAILWAY-ENV-VARIABLES.txt
echo.
pause
