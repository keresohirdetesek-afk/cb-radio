#!/bin/bash

echo "🚀 CB Rádió Szerver Telepítő"
echo "=============================="
echo ""

# Ellenőrzés hogy Node.js telepítve van-e
if ! command -v node &> /dev/null
then
    echo "❌ Node.js nincs telepítve!"
    echo "Telepítsd a Node.js-t: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js verzió: $(node --version)"
echo ""

# npm csomagok telepítése
echo "📦 Függőségek telepítése..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Függőségek sikeresen telepítve!"
    echo ""
    
    # Szerver indítása
    echo "🎯 Szerver indítása..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "A szerver elérhető lesz: ws://localhost:3001"
    echo "Nyisd meg a cb-radio-standalone.html fájlt böngészőben!"
    echo ""
    echo "Leállításhoz nyomd meg: Ctrl + C"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    npm start
else
    echo "❌ Hiba történt a telepítés során!"
    exit 1
fi
