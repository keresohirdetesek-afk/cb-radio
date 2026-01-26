@echo off
chcp 65001 >nul
title CB Rádió Szerver

echo.
echo 🚀 CB Rádió Szerver Telepítő
echo ==============================
echo.

:: Node.js ellenőrzése
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js nincs telepítve!
    echo Telepítsd a Node.js-t: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js verzió: %NODE_VERSION%
echo.

:: npm csomagok telepítése
echo 📦 Függőségek telepítése...
call npm install

if %errorlevel% equ 0 (
    echo ✅ Függőségek sikeresen telepítve!
    echo.
    
    :: Szerver indítása
    echo 🎯 Szerver indítása...
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo.
    echo A szerver elérhető lesz: ws://localhost:3001
    echo Nyisd meg a cb-radio-standalone.html fájlt böngészőben!
    echo.
    echo Leállításhoz nyomd meg: Ctrl + C
    echo.
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo.
    
    call npm start
) else (
    echo ❌ Hiba történt a telepítés során!
    pause
    exit /b 1
)
