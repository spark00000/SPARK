@echo off
setlocal
cd /d "%~dp0"

if "%~1"=="" goto :usage

if /I "%~1"=="start" goto :start
if /I "%~1"=="status" goto :status
if /I "%~1"=="stop" goto :stop
if /I "%~1"=="validate" goto :validate
if /I "%~1"=="help" goto :usage
if /I "%~1"=="--help" goto :usage
if /I "%~1"=="-h" goto :usage

echo Unknown command: %~1
goto :usage_error

:start
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-all.ps1"
exit /b %ERRORLEVEL%

:status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\status-all.ps1"
exit /b %ERRORLEVEL%

:stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-all.ps1"
exit /b %ERRORLEVEL%

:validate
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-windows-sprint2.ps1"
exit /b %ERRORLEVEL%

:usage
echo SPARK_Transport start ^| status ^| stop ^| validate
exit /b 0

:usage_error
echo SPARK_Transport start ^| status ^| stop ^| validate
exit /b 2
