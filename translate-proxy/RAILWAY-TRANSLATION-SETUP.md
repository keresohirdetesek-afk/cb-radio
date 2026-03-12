# 🚀 TRANSLATION PROXY - RAILWAY TELEPÍTÉS

## 📦 FÁJLOK:

1. **translate-proxy-server.js** - Backend szerver
2. **translate-package.json** - Átnevezd: **package.json**

---

## 🛤️ RAILWAY SETUP:

### **1. Új Service létrehozása:**

```
1. Railway.app → Dashboard
2. New Project → Deploy from GitHub repo
   VAGY
   New Project → Empty Project → New Service → GitHub Repo
3. Válaszd ki a repo-t ahol ezek a fájlok vannak
```

### **2. Root Directory beállítása (ha szükséges):**

```
Settings → Root Directory → (hagyad üresen ha a root-ban van)
```

### **3. Build Command:**

```
Settings → Build Command → (automatikus npm install)
```

### **4. Start Command:**

```
Settings → Start Command → node translate-proxy-server.js
```

---

## 🔑 ENVIRONMENT VARIABLES BEÁLLÍTÁSA:

### **KRITIKUS LÉPÉS!** 

```
1. Railway Service → Variables tab
2. Add Variable:
   
   Name:  GOOGLE_TRANSLATE_API_KEY
   Value: [ÚJ API KEY AMIT LÉTREHOZTÁL]
   
3. SAVE
4. Redeploy (Deploy → Redeploy)
```

**FONTOS:** 
- NE commitold GitHub-ra az API key-t!
- Csak Railway Environment Variables-ba!

---

## 🌐 DOMAIN:

Railway automatikusan ad egy domain-t:
```
https://translate-proxy-production-xxxx.up.railway.app
```

Vagy custom domain:
```
Settings → Domains → Generate Domain
→ translate.pilotradar.hu (ha van domain)
```

---

## 🧪 TESZT:

### **1. Health check:**

```bash
curl https://translate-proxy-production-xxxx.up.railway.app/health
```

**Válasz:**
```json
{
  "status": "ok",
  "service": "Translation Proxy",
  "timestamp": "2025-02-11T..."
}
```

### **2. Translation teszt:**

```bash
curl -X POST https://translate-proxy-production-xxxx.up.railway.app/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Szia, hol vagy?",
    "sourceLang": "hu",
    "targetLang": "en"
  }'
```

**Válasz:**
```json
{
  "translatedText": "Hi, where are you?",
  "sourceLang": "hu",
  "targetLang": "en",
  "originalText": "Szia, hol vagy?"
}
```

---

## 🔒 BIZTONSÁGI ELLENŐRZÉS:

### **✅ API Key biztonságos?**

```
1. GitHub repo → translate-proxy-server.js
2. Keresd: process.env.GOOGLE_TRANSLATE_API_KEY
3. ✅ Nincs hard-coded API key
4. ✅ Csak environment variable
```

### **✅ CORS beállítva?**

```javascript
cors({
    origin: [
        'https://keresohirdetesek-afk.github.io',
        // ... több domain
    ]
})
```

---

## 📊 KÖLTSÉG MONITORING:

### **Google Cloud Console:**

```
1. https://console.cloud.google.com
2. Billing → Reports
3. Nézd a Translation API költségeit
4. Set Budget Alert: $10/hó
```

---

## 🚨 TROUBLESHOOTING:

### **"Server configuration error"**
→ API key nincs beállítva Railway Variables-ban

### **"Translation API error"**
→ Ellenőrizd az API key-t Google Cloud-ban

### **CORS error**
→ Add hozzá a domain-t a CORS origins listához

### **404 Not Found**
→ Rossz endpoint URL

---

## 📝 RAILWAY LOGS:

```
Railway Dashboard → Service → Deployments → Latest → Logs

Nézd:
✅ "Translation Proxy listening on port 3001"
✅ "API Key set: ✅ YES"
❌ "API Key set: ❌ NO" → Nincs beállítva!
```

---

## 🎉 HA MINDEN MŰKÖDIK:

```
✅ Health check: OK
✅ Translation teszt: OK
✅ API key biztonságos: OK
✅ CORS beállítva: OK
✅ Railway deployment: LIVE
```

**→ Készen állsz a frontend integrációra!** 🚀

---

## 📞 BACKEND URL:

Mentsd el ezt a URL-t, kell majd a frontend-ben:
```
https://translate-proxy-production-xxxx.up.railway.app
```

**Ezt írd be később a CB Radio app kódjába!**
