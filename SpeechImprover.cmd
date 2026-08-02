@echo off
REM One-click launcher. First run installs deps; then starts the dev server and
REM opens the browser (Vite --open). Close this window to stop the app.
title SpeechImprover
cd /d "%~dp0speechimprover"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but was not found. Install it from https://nodejs.org and re-run.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies ^(first run only^)...
  call npm install || (echo npm install failed. & pause & exit /b 1)
)

echo Starting SpeechImprover at http://localhost:53134 ...
call npm run dev -- --open
