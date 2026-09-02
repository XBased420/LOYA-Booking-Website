@echo off
setlocal
cd /d "%~dp0"
echo.
echo === Loya site - push to GitHub ===
echo.
git --version >nul 2>&1
if errorlevel 1 goto NOGIT
rem Claude works in this folder over a mount that cannot delete files, so a
rem git lock left behind by its read-only checks would block every commit.
rem Clear a stale one here, where deletes actually work.
if not exist ".git\index.lock" goto NOLOCK
echo Clearing a stale git lock...
del /f /q ".git\index.lock"
:NOLOCK
if exist ".git" goto HASGIT
echo Creating the repository...
git init -b main
git remote add origin https://github.com/XBased420/LOYA-Booking-Website.git
:HASGIT
echo Staging files...
git add -A
if errorlevel 1 goto FAILED
git diff --cached --quiet
if not errorlevel 1 goto NOCHANGES
echo.
set "MSG="
set /p MSG=Describe what changed, then press Enter: 
if not defined MSG set "MSG=Update site"
git commit -m "%MSG%"
if errorlevel 1 goto FAILED
echo Pushing...
git push -u origin main
if errorlevel 1 goto FAILED
echo.
echo DONE. Now go to Settings - Pages - Source - GitHub Actions
echo Then watch the Actions tab.
goto END
:NOCHANGES
echo.
echo Nothing has changed since the last push.
goto END
:NOGIT
echo Git is not installed. Get it from https://git-scm.com/download/win
goto END
:FAILED
echo.
echo Something failed. Read the message above and send it to Claude.
goto END
:END
echo.
pause
