# CB Rádió - Webes Hangrögzítő Alkalmazás 📻

Valós idejű hang kommunikációs alkalmazás WebRTC technológiával. Mobilon is működik, támogatja a hangerő gomb használatát PTT (Push-To-Talk) funkcióhoz.

## ✨ Funkciók

- ✅ **40 csatorna** - Válassz csatornát 1-40 között
- ✅ **Push-to-Talk (PTT)** - Nyomd és tartsd a gombot adáshoz
- ✅ **Hangerő gomb támogatás** - Mobilon használhatod a hangerő fel gombot
- ✅ **Valós idejű hang átvitel** - WebRTC technológia
- ✅ **Fülhallgató támogatás** - Működik vezetékes és Bluetooth fülhallgatóval
- ✅ **Több felhasználó** - Korlátlan számú felhasználó egy csatornán
- ✅ **Vizuális visszajelzés** - Láthatod ki beszél éppen
- ✅ **Mobilbarát** - Reszponzív dizájn

## 🚀 Telepítés

### 1. Szerver telepítése

```bash
# Töltsd le a fájlokat
cd szerver-konyvtar

# Node.js függőségek telepítése
npm install

# Szerver indítása
npm start
```

A szerver alapértelmezetten a **3001** porton fut.

### 2. React alkalmazás beágyazása

A `cb-radio.jsx` fájlt add hozzá a React projektedhez:

```javascript
import CBRadioApp from './cb-radio';

function App() {
  return <CBRadioApp />;
}
```

**FONTOS:** A `cb-radio.jsx` fájl tetején módosítsd a szerver URL-t:

```javascript
const WS_SERVER = 'ws://localhost:3001'; // Változtasd meg a saját szervereddre
// Éles környezetben: 'wss://your-domain.com'
```

### 3. Weboldalba ágyazás (HTML)

Ha nem React-et használsz, hanem egyszerű HTML-t:

```html
<!DOCTYPE html>
<html>
<head>
    <title>CB Rádió</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="root"></div>
    <script type="module">
        // Itt illeszd be a cb-radio.jsx tartalmát
    </script>
</body>
</html>
```

## 📱 Használat

### Alapvető használat

1. **Nyisd meg az alkalmazást** böngészőben
2. **Engedélyezd a mikrofon hozzáférést** amikor a böngésző kéri
3. **Válassz csatornát** (1-40)
4. **Nyomd és tartsd** a zöld gombot beszéléshez
5. **Engedd el** a gombot ha végeztél

### Mobilon (hangerő gomb használata)

1. Nyisd meg az alkalmazást mobil böngészőben (Chrome/Safari)
2. A **hangerő fel** gomb megnyomása = adás kezdése
3. A **hangerő fel** gomb elengedése = adás vége

### Fülhallgatóval

- Működik vezetékes és Bluetooth fülhallgatóval is
- A mikrofon lehet a fülhallgatóé vagy a telefon beépített mikrofonja
- Hangerő gomb a fülhallgatón is használható (ha van rajta)

## ⚙️ Konfiguráció

### Szerver beállítások

A `cb-radio-server.js` fájlban:

```javascript
const PORT = process.env.PORT || 3001; // Port módosítása
```

### WebRTC beállítások

A `cb-radio.jsx` fájlban módosíthatod a STUN szervereket:

```javascript
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // További STUN/TURN szerverek...
  ]
};
```

## 🌐 Éles környezetben (Production)

### HTTPS szükséges!

A WebRTC **HTTPS-t igényel** éles környezetben. Két lehetőség:

1. **Nginx reverse proxy** SSL-lel
2. **Node.js HTTPS szerver**

### Példa HTTPS szerverrel:

```javascript
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  cert: fs.readFileSync('path/to/cert.pem'),
  key: fs.readFileSync('path/to/key.pem')
}, app);
```

### WebSocket URL módosítása

Éles környezetben használj **WSS** protokollt:

```javascript
const WS_SERVER = 'wss://your-domain.com'; // HTTPS esetén WSS!
```

## 🔧 Hibaelhárítás

### "Mikrofon hozzáférés megtagadva"
- Ellenőrizd a böngésző beállításait
- HTTPS szükséges (nem HTTP!)
- Mobilon előfordulhat hogy újra kell engedélyezni

### "Nincs kapcsolat a szerverrel"
- Ellenőrizd hogy a szerver fut-e (`npm start`)
- Ellenőrizd a WebSocket URL-t a kódban
- Firewall beállítások ellenőrzése

### "Nem hallom a másikat"
- Ellenőrizd a hangerő beállításokat
- Próbáld újratölteni az oldalt
- Mindkét félnek ugyanazon a csatornán kell lennie

### Hangerő gomb nem működik mobilon
- Nem minden böngésző támogatja (legjobb Chrome Android-on)
- iOS Safari-n korlátozott támogatás
- Alternatíva: használd a képernyőn lévő gombot

## 📋 Rendszerkövetelmények

### Szerver
- **Node.js** 14.0 vagy újabb
- **npm** vagy **yarn**
- Nyitott port (alapértelmezett: 3001)

### Kliens (böngésző)
- Modern böngésző WebRTC támogatással:
  - Chrome 74+
  - Firefox 66+
  - Safari 12.1+
  - Edge 79+
- Mikrofon hozzáférés
- HTTPS (éles környezetben)

## 🔒 Biztonság

- ✅ WebRTC peer-to-peer titkosítás
- ✅ Csak hang átvitel, nincs videó
- ⚠️ Éles környezetben használj HTTPS-t
- ⚠️ Implementálj rate limiting-et a szerveren
- ⚠️ Fontold meg autentikáció hozzáadását

## 📝 Licensz

MIT License - szabadon felhasználható.

## 🤝 Támogatás

Ha problémád van:
1. Ellenőrizd a böngésző konzolt (F12)
2. Nézd meg a szerver log-okat
3. Teszteld egy másik böngészőben

## 🚀 Következő lépések / Továbbfejlesztési ötletek

- [ ] Felhasználói nevek
- [ ] Csatorna jelszó védelem
- [ ] Hangrögzítés (recording)
- [ ] Push notification
- [ ] Üzenet előzmények
- [ ] Emoji reakciók
- [ ] Téma választás (dark/light mode)
- [ ] Több nyelvű felület

---

**Készítve:** 2025  
**Technológiák:** React, WebRTC, WebSocket, Tailwind CSS
