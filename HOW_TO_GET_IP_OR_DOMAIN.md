# Wie bekomme ich die IP-Adresse oder Domain des YouTube API Services?

## 🎯 Wichtig: Normalerweise brauchst du KEINE IP-Adresse!

Bei Railway, Vercel und anderen Cloud-Plattformen bekommst du eine **Domain** (z.B. `youtube-api-production.up.railway.app`), keine statische IP-Adresse.

**Die IP-Adresse ändert sich bei jedem Deployment!** Deshalb verwendet man immer die Domain.

---

## 🌐 Domain/URL herausfinden

### Railway

1. **Gehe zu Railway Dashboard**
2. **Wähle dein Projekt** → **Service "youtube-api"**
3. **Settings Tab** → **Networking**
4. **Service URL** wird angezeigt:
   ```
   https://youtube-api-production.up.railway.app
   ```
5. **Oder:** Klicke auf **"Generate Domain"** falls noch keine Domain vorhanden

### Vercel

1. **Gehe zu Vercel Dashboard**
2. **Wähle dein Projekt**
3. **Deployments Tab** → Neuester Deployment
4. **Domain** wird angezeigt:
   ```
   https://fyle-youtube-api.vercel.app
   ```
5. **Oder:** Settings → Domains

---

## 🔍 IP-Adresse herausfinden (falls wirklich nötig)

### Methode 1: DNS Lookup (Command Line)

```bash
# Windows (PowerShell)
nslookup youtube-api-production.up.railway.app

# macOS/Linux
dig youtube-api-production.up.railway.app
# oder
nslookup youtube-api-production.up.railway.app
```

**Beispiel Output:**
```
Name:    youtube-api-production.up.railway.app
Address: 35.123.45.67
```

### Methode 2: Online DNS Lookup Tools

1. Gehe zu: https://www.whatismyip.com/dns-lookup/
2. Oder: https://dnschecker.org/
3. Gib deine Domain ein: `youtube-api-production.up.railway.app`
4. Klicke auf "Lookup"
5. IP-Adresse wird angezeigt

### Methode 3: Ping (zeigt IP)

```bash
# Windows
ping youtube-api-production.up.railway.app

# macOS/Linux
ping -c 4 youtube-api-production.up.railway.app
```

**Beispiel Output:**
```
Pinging youtube-api-production.up.railway.app [35.123.45.67] with 32 bytes of data:
```

---

## ⚠️ Wichtig: IP-Adressen ändern sich!

**Bei Railway/Vercel:**
- IP-Adressen sind **nicht statisch**
- Sie ändern sich bei jedem Deployment
- Sie können sich auch ohne Deployment ändern
- **Deshalb: Immer Domain verwenden, nie IP!**

---

## 🎯 Wofür brauchst du die IP/Domain?

### 1. Google OAuth Redirect URI

**❌ FALSCH (IP-Adresse):**
```
http://35.123.45.67/youtube/oauth/callback
```

**✅ RICHTIG (Domain):**
```
https://fyle-cloud.com/youtube/oauth/callback
```

**Wichtig:** Google OAuth verwendet die **Frontend Domain**, nicht die Backend IP!

### 2. Frontend Environment Variable

**✅ RICHTIG:**
```env
VITE_YOUTUBE_API_URL=https://youtube-api-production.up.railway.app
```

**❌ FALSCH:**
```env
VITE_YOUTUBE_API_URL=http://35.123.45.67
```

### 3. CORS Configuration

**✅ RICHTIG:**
```env
FRONTEND_URL=https://fyle-cloud.com
```

**❌ FALSCH:**
```env
FRONTEND_URL=http://123.45.67.89
```

---

## 📋 Checkliste: Was brauchst du wo?

### Google Cloud Console (OAuth)

**Benötigt:** Frontend Domain (nicht Backend IP!)

```
Authorized redirect URIs:
- https://fyle-cloud.com/youtube/oauth/callback
- http://localhost:5173/youtube/oauth/callback (für Dev)
```

### Frontend Environment Variables

**Benötigt:** Backend Domain (nicht IP!)

```env
VITE_YOUTUBE_API_URL=https://youtube-api-production.up.railway.app
```

### Backend Environment Variables

**Benötigt:** Frontend Domain (nicht IP!)

```env
FRONTEND_URL=https://fyle-cloud.com
GOOGLE_REDIRECT_URI=https://fyle-cloud.com/youtube/oauth/callback
```

---

## 🔧 Service URL im Code loggen

Falls du die URL zur Laufzeit herausfinden willst, kannst du sie im Backend loggen:

```typescript
// In youtube-api/src/index.ts
app.listen(PORT, () => {
  console.log(`🚀 YouTube API listening on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Service URL: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}`);
  console.log(`🎬 FFmpeg: Available for video processing`);
});
```

**Railway setzt automatisch:**
- `RAILWAY_PUBLIC_DOMAIN` - Die öffentliche Domain
- `PORT` - Der Port

---

## 🧪 Testen ob Service erreichbar ist

### Health Check

```bash
# Mit Domain (✅ Empfohlen)
curl https://youtube-api-production.up.railway.app/health

# Sollte zurückgeben:
# {"status":"ok","service":"youtube-api","timestamp":"..."}
```

### Mit IP (⚠️ Nicht empfohlen, nur zum Testen)

```bash
# IP-Adresse herausfinden
nslookup youtube-api-production.up.railway.app

# Dann testen (funktioniert nur wenn Host-Header gesetzt wird)
curl -H "Host: youtube-api-production.up.railway.app" http://35.123.45.67/health
```

**Wichtig:** Viele Cloud-Services (Railway, Vercel) funktionieren **nur mit Domain**, nicht mit direkter IP!

---

## 📝 Zusammenfassung

| Was du brauchst | Wo du es findest | Beispiel |
|----------------|------------------|-----------|
| **Backend Domain** | Railway Dashboard → Service → Settings → Networking | `https://youtube-api-production.up.railway.app` |
| **Frontend Domain** | Vercel/Netlify Dashboard → Domains | `https://fyle-cloud.com` |
| **IP-Adresse** | ❌ Normalerweise **nicht nötig** | Nur für Debugging mit `nslookup` oder `dig` |

---

## 🚨 Häufige Fehler

### ❌ Fehler 1: IP-Adresse in Google OAuth
```
Authorized redirect URI: http://35.123.45.67/youtube/oauth/callback
```
**Problem:** IP ändert sich, OAuth schlägt fehl

**Lösung:** Verwende Frontend Domain:
```
https://fyle-cloud.com/youtube/oauth/callback
```

### ❌ Fehler 2: IP-Adresse in Frontend
```env
VITE_YOUTUBE_API_URL=http://35.123.45.67
```
**Problem:** IP ändert sich, API Calls schlagen fehl

**Lösung:** Verwende Backend Domain:
```env
VITE_YOUTUBE_API_URL=https://youtube-api-production.up.railway.app
```

### ❌ Fehler 3: IP-Adresse für CORS
```env
FRONTEND_URL=http://123.45.67.89
```
**Problem:** IP ändert sich, CORS schlägt fehl

**Lösung:** Verwende Frontend Domain:
```env
FRONTEND_URL=https://fyle-cloud.com
```

---

## 💡 Tipp

**Immer Domain verwenden, nie IP!** 

Cloud-Services (Railway, Vercel, etc.) sind darauf ausgelegt, mit Domains zu arbeiten. IP-Adressen sind nur für Debugging nötig.

