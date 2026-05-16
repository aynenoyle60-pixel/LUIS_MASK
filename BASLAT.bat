@echo off
title Luis Mask QR Siparis Sistemi
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js bu bilgisayarda bulunamadi.
  echo Once Node.js LTS surumunu kurun: https://nodejs.org/
  echo Sonra bu dosyayi tekrar calistirin.
  echo.
  pause
  exit /b 1
)

echo.
echo Luis Mask QR Siparis Sistemi baslatiliyor...
echo.
echo Kasa bilgisayarinda:
echo http://localhost:3000/?view=cashier
echo.
echo QR ve masa linkleri icin:
echo http://localhost:3000/?view=qr
echo.
echo Bu pencere acik kaldigi surece sistem calisir.
echo Kapatmak icin bu pencereyi kapatabilirsiniz.
echo.

node server.js
pause
