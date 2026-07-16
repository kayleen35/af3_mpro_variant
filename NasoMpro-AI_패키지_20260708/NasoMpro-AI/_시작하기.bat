@echo off
chcp 65001 >nul
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%_menu.ps1"
