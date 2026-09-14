@echo off
setlocal
cd /d "%~dp0"

if "%~1"=="" goto :usage

if /I "%~1"=="start" goto :start
if /I "%~1"=="restart" goto :restart
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

:restart
call "%~f0" stop
if errorlevel 1 exit /b %ERRORLEVEL%
call "%~f0" start
exit /b %ERRORLEVEL%

:status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\status-all.ps1"
exit /b %ERRORLEVEL%

:stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-all.ps1"
exit /b %ERRORLEVEL%

:validate
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0modules\transport\scripts\validate-windows.ps1"
exit /b %ERRORLEVEL%

:usage
echo SPARK 0.0.0 - Symbiotic Personal AI Robotic Keeper
echo.
echo Usage: SPARK [start ^| restart ^| status ^| stop ^| validate ^| help]
echo.
echo   start      Start Transport + Secure MCP Tunnel + ChatGPT UI
echo   restart    Stop and start all runtime components
echo   status     Show Transport, Tunnel, ChatGPT and ChatGPT UI status
echo   stop       Stop runtime components
echo   validate   Run Windows Transport validation
echo   help       Show this help
echo.
echo No argument shows this help. Use "SPARK start" to launch the runtime.
exit /b 0

:usage_error
echo Usage: SPARK [start ^| restart ^| status ^| stop ^| validate ^| help]
exit /b 2
