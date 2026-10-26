@echo off
rem Start the local virtual-bank review build; no model or live-bank setup is implicit.
chcp 65001 >nul
cd /d "%~dp0"
echo TRUSTA local virtual bank - keep this window open.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-web.ps1" -OpenBrowser
pause
