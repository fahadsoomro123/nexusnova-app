@echo off
setlocal
cd /d "%~dp0.."

echo ==========================================
echo  NexusNova app-ads.txt Firebase Hosting
echo ==========================================
echo.

where npx >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js / npx is not installed or not in PATH.
  echo Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)

echo [1/3] Checking Firebase login...
call npx --yes firebase-tools@latest login:list >nul 2>nul
if errorlevel 1 (
  echo Firebase login required. Your browser will open now.
  call npx --yes firebase-tools@latest login
  if errorlevel 1 goto :failed
)

echo.
echo [2/3] Deploying ONLY the lightweight developer site + app-ads.txt...
call npx --yes firebase-tools@latest deploy --only hosting --project nexusnova-6ade2
if errorlevel 1 goto :failed

echo.
echo [3/3] DONE.
echo Expected verification URL:
echo https://nexusnova-6ade2.web.app/app-ads.txt
echo.
echo IMPORTANT: This command does NOT deploy Cloud Functions and does NOT enable Blaze billing.
pause
exit /b 0

:failed
echo.
echo DEPLOY FAILED. Copy the last error shown above and send it to ChatGPT.
pause
exit /b 1
