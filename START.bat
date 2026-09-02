@echo off
REM ============================================================
REM  START.bat - open the Elizabeth Loya site on this laptop.
REM
REM  Double-click it. A browser opens at http://localhost:8767
REM  and this window stays open running the server.
REM  CLOSING THIS WINDOW STOPS THE SITE.
REM
REM  Port 8767, not 8766, so this can run at the same time as
REM  the Schedule App without either refusing to bind.
REM
REM  Serves the dist folder. If you changed anything under site\,
REM  run REFRESHBUILD.bat first or you will be looking at the
REM  previous build.
REM
REM  No internet needed.
REM ============================================================

cd /d "%~dp0"

if not exist "dist\index.html" (
  echo.
  echo   Cannot find dist\index.html
  echo.
  echo   Run REFRESHBUILD.bat first to build the dist folder,
  echo   and make sure START.bat is sitting in the
  echo   LoyaPersonalWebsite folder.
  echo.
  pause
  exit /b 1
)

REM Prefer the py launcher; fall back to python on PATH.
set "PYEXE="
where py >nul 2>&1 && set "PYEXE=py"
if not defined PYEXE (
  where python >nul 2>&1 && set "PYEXE=python"
)
if not defined PYEXE (
  echo.
  echo   Python was not found on this machine.
  echo   Install it from python.org, then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Elizabeth Loya - personal site
echo   ------------------------------
echo   Opening http://localhost:8767
echo.
echo   Leave this window open while you look at the site.
echo   Close it when you are done.
echo.

REM Prefer Chrome, wherever this machine keeps it. Falls back to the
REM default browser if Chrome is not installed, so this never blocks.
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

REM Open the browser a moment after the server has had time to bind.
if defined CHROME (
  start "" /b cmd /c "timeout /t 2 >nul & start "" "%CHROME%" http://localhost:8767/"
) else (
  start "" /b cmd /c "timeout /t 2 >nul & start "" http://localhost:8767/"
)

REM Runs in the foreground on purpose: closing this window stops the
REM server, so no stray process is left listening afterwards.
%PYEXE% "%~dp0serve.py" 8767 "%~dp0dist"
