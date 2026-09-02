@echo off
REM ============================================================
REM  REFRESHBUILD.bat - rebuild dist\ from the source in site\.
REM
REM  Run this after ANY edit under site\. START.bat serves dist\,
REM  which is generated output — editing dist\ directly works
REM  until the next build silently overwrites it.
REM
REM  Needs Node. node_modules is not shipped in this folder (it is
REM  ~160 MB of regenerable files and would sync to OneDrive), so
REM  the first run installs it. That one takes a minute; every run
REM  after is a couple of seconds.
REM ============================================================

cd /d "%~dp0"

if not exist "site\package.json" (
  echo.
  echo   Cannot find site\package.json
  echo   Make sure REFRESHBUILD.bat is in the LoyaPersonalWebsite folder.
  echo.
  pause
  exit /b 1
)

REM Find node, then drive npm through node directly.
REM
REM Not using the npm.cmd shim on purpose: it locates npm-cli.js by
REM asking npm-prefix.js where the project root is, and running that
REM from a folder whose node_modules does not exist yet made it resolve
REM to a path that was not there. Calling node on npm-cli.js is the same
REM operation with none of that resolution.
set "NODEEXE="
for /f "delims=" %%N in ('where node 2^>nul') do (
  if not defined NODEEXE set "NODEEXE=%%N"
)
if not defined NODEEXE (
  if exist "%LocalAppData%\hermes\node\node.exe" set "NODEEXE=%LocalAppData%\hermes\node\node.exe"
)
if not defined NODEEXE (
  echo.
  echo   Node was not found on this machine.
  echo   Install Node from nodejs.org, then run this again.
  echo.
  pause
  exit /b 1
)

for %%N in ("%NODEEXE%") do set "NODEDIR=%%~dpN"
set "NPMCLI=%NODEDIR%node_modules\npm\bin\npm-cli.js"
if not exist "%NPMCLI%" (
  echo.
  echo   Found node at %NODEEXE%
  echo   but not its npm at %NPMCLI%
  echo.
  echo   Reinstall Node from nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

if not exist "site\node_modules" (
  echo.
  echo   First run - installing dependencies. This takes a minute.
  echo.
  pushd site
  call "%NODEEXE%" "%NPMCLI%" install
  if errorlevel 1 (
    popd
    echo.
    echo   npm install failed. Nothing was changed.
    echo.
    pause
    exit /b 1
  )
  popd
)

echo.
echo   Building...
echo.
pushd site
call "%NODEEXE%" "%NPMCLI%" run build
if errorlevel 1 (
  popd
  echo.
  echo   BUILD FAILED - dist\ was left alone, so START.bat still
  echo   serves the last good build. Fix the error above and rerun.
  echo.
  pause
  exit /b 1
)
popd

REM Only replace dist AFTER a successful build, so a broken build
REM never leaves you with no site at all.
echo   Copying build into dist\ ...
robocopy "site\dist" "dist" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo.
  REM parens must be escaped inside a parenthesised IF block, or they
  REM close it early and cmd chokes on whatever follows
  echo   Copy failed. Check that no program is holding a file in dist\
  echo   ^(close any START.bat window and try again^).
  echo.
  pause
  exit /b 1
)

echo.
echo   Done. dist\ is up to date.
echo   Double-click START.bat to look at it.
echo.
pause
