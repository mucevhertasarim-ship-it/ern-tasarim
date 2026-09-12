@echo off
title Ern Tasarim Canli Web & Yonetim Sunucusu (Flask + IMAP/SMTP)
echo ===================================================
echo   ERN TASARIM - CANLI WEB & YONETICI PANEL SUNUCUSU
echo ===================================================
echo.
echo Flask + IMAP/SMTP E-Posta Sunucusu Baslatiliyor...
echo Panel Adresi: http://localhost:8085/yonetici.html
echo.
start "" "http://localhost:8085/yonetici.html"
python "%~dp0server.py"
if errorlevel 1 (
    echo Python dogrudan bulunamadi, powershell deneniyor...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
)
pause
