@echo off
setlocal
cd /d "%~dp0"
echo.
echo === Loya site - push to GitHub ===
echo.
git --version >nul 2>&1
if errorlevel 1 goto NOGIT
if exist ".git" goto HASGIT
echo Creating the repository...
git init -b main
:HASGIT
echo Staging files...
git add -A
echo Committing...
if exist "site\_retired\_gh\COMMIT_MSG.txt" goto MSGFILE
git commit -m "Liz Loya personal brand site - current state"
goto AFTERCOMMIT
:MSGFILE
git commit -F "site\_retired\_gh\COMMIT_MSG.txt"
:AFTERCOMMIT
echo Pointing at GitHub...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/XBased420/LOYA-Booking-Website.git
echo Pushing - this is 128 MB, give it a few minutes...
git push -u origin main
if errorlevel 1 goto FAILED
echo.
echo DONE. Open https://github.com/XBased420/LOYA-Booking-Website
goto END
:NOGIT
echo Git is not installed on this PC.
echo Download it from https://git-scm.com/download/win then run this again.
goto END
:FAILED
echo.
echo Push failed. Read the message above and send it to Claude.
goto END
:END
echo.
pause
