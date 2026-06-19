@echo off
cd /d "%~dp0server"
if not exist node_modules (
  echo Installing server dependencies...
  call npm install
)
echo Starting Hooked game + rewards server...
node index.js
