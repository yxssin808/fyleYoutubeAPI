# Environment Variables - Frontend & Backend

## 📱 Frontend (fyle)

### Required Environment Variables

Diese Variablen müssen im Frontend gesetzt werden (z.B. in Vercel → Environment Variables):

| Variable | Beschreibung | Beispiel | Wo zu finden |
|----------|-------------|----------|--------------|
| `VITE_YOUTUBE_API_URL` | **YouTube API Service URL** | `https://youtube-api-production.up.railway.app` | Railway Dashboard → Service URL |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://xxxxx.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anonymous Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Dashboard → Settings → API |
| `VITE_STORAGE_API_URL` | Storage Service URL (für signed URLs) | `https://fylestorage.vercel.app/api` | Dein Storage Service URL |

### Optional Environment Variables

| Variable | Beschreibung | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Main API Service URL | `http://localhost:4000/api` |
| `VITE_CDN_BASE_URL` | CDN Base URL | - |

### Frontend Setup

**Für Vercel:**
1. Gehe zu Vercel Dashboard → Dein Projekt → Settings → Environment Variables
2. Füge alle `VITE_*` Variablen hinzu
3. Stelle sicher, dass sie für **Production**, **Preview** und **Development** gesetzt sind

**Für lokale Entwicklung:**
1. Erstelle `.env.local` im `fyle/` Ordner
2. Füge alle Variablen hinzu:
```env
VITE_YOUTUBE_API_URL=http://localhost:4001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STORAGE_API_URL=http://localhost:4002/api
```

---

## 🔧 Backend (youtube-api)

### Required Environment Variables

Diese Variablen müssen im Backend gesetzt werden (z.B. in Railway → Variables):

| Variable | Beschreibung | Beispiel | Wo zu finden |
|----------|-------------|----------|--------------|
| `SUPABASE_URL` | Supabase Project URL | `https://xxxxx.supabase.co` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (⚠️ Secret!) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Dashboard → Settings → API → service_role key |
| `FRONTEND_URL` | Frontend URL für CORS | `https://fyle-cloud.com` | Deine Production Frontend URL |
| `GOOGLE_CLIENT_ID` | Google OAuth2 Client ID | `xxxxx.apps.googleusercontent.com` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 Client Secret | `GOCSPX-xxxxx` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_REDIRECT_URI` | OAuth2 Redirect URI | `https://fyle-cloud.com/youtube/oauth/callback` | Muss exakt mit Google Cloud Console übereinstimmen |
| `STORAGE_API_URL` | Storage Service URL | `https://fylestorage.vercel.app/api` | Dein Storage Service URL |

### Optional Environment Variables

| Variable | Beschreibung | Default |
|----------|-------------|---------|
| `PORT` | Server Port | `4001` (Railway setzt dies automatisch) |
| `NODE_ENV` | Node Environment | `production` (Railway setzt dies automatisch) |

### Backend Setup

**Für Railway:**
1. Gehe zu Railway Dashboard → Dein Service → Variables
2. Füge alle Required Variablen hinzu
3. Railway setzt `PORT` und `NODE_ENV` automatisch

**Für lokale Entwicklung:**
1. Erstelle `.env.local` im `youtube-api/` Ordner
2. Kopiere `env.example` zu `.env.local`
3. Fülle alle Werte aus:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/youtube/oauth/callback
STORAGE_API_URL=http://localhost:4002/api
PORT=4001
```

---

## 🔗 Wichtige Verbindungen

### 1. Frontend → Backend
- Frontend verwendet `VITE_YOUTUBE_API_URL` um API Calls zu machen
- Diese URL muss auf deinen YouTube API Service zeigen (Railway oder Vercel)

### 2. Backend → Supabase
- Backend verwendet `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY`
- Service Role Key umgeht RLS (Row Level Security) - **⚠️ Geheim halten!**

### 3. Backend → Google OAuth
- Backend verwendet `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` muss **exakt** mit Google Cloud Console übereinstimmen

### 4. Backend → Storage Service
- Backend verwendet `STORAGE_API_URL` um signed URLs für S3 Files zu generieren
- Nur nötig wenn Files in S3 liegen und kein `cdn_url` vorhanden ist

---

## ✅ Checkliste

### Frontend Setup
- [ ] `VITE_YOUTUBE_API_URL` gesetzt (Railway/Vercel URL)
- [ ] `VITE_SUPABASE_URL` gesetzt
- [ ] `VITE_SUPABASE_ANON_KEY` gesetzt
- [ ] `VITE_STORAGE_API_URL` gesetzt (falls verwendet)

### Backend Setup
- [ ] `SUPABASE_URL` gesetzt
- [ ] `SUPABASE_SERVICE_ROLE_KEY` gesetzt (⚠️ Secret!)
- [ ] `FRONTEND_URL` gesetzt (für CORS)
- [ ] `GOOGLE_CLIENT_ID` gesetzt
- [ ] `GOOGLE_CLIENT_SECRET` gesetzt (⚠️ Secret!)
- [ ] `GOOGLE_REDIRECT_URI` gesetzt (muss mit Google Cloud Console übereinstimmen!)
- [ ] `STORAGE_API_URL` gesetzt (falls verwendet)

### Google OAuth Setup
- [ ] YouTube Data API v3 aktiviert in Google Cloud Console
- [ ] OAuth Consent Screen konfiguriert
- [ ] Redirect URI in Google Cloud Console hinzugefügt:
  - Production: `https://fyle-cloud.com/youtube/oauth/callback`
  - Development: `http://localhost:5173/youtube/oauth/callback`

---

## 🚨 Häufige Fehler

### 1. `redirect_uri_mismatch`
**Problem:** `GOOGLE_REDIRECT_URI` stimmt nicht mit Google Cloud Console überein

**Lösung:**
- Prüfe Google Cloud Console → Credentials → OAuth 2.0 Client ID
- Stelle sicher, dass die exakte URL in "Authorized redirect URIs" steht
- Keine trailing slashes, exakte Groß-/Kleinschreibung

### 2. `invalid_grant`
**Problem:** OAuth Code ist abgelaufen oder wurde bereits verwendet

**Lösung:**
- User muss sich neu verbinden
- Codes sind nur ~10 Minuten gültig

### 3. CORS Fehler
**Problem:** `FRONTEND_URL` stimmt nicht mit der tatsächlichen Frontend URL überein

**Lösung:**
- Prüfe `FRONTEND_URL` im Backend
- Stelle sicher, dass die exakte URL (ohne trailing slash) gesetzt ist

### 4. `File not found in database`
**Problem:** File hat weder `cdn_url` noch `s3_key`

**Lösung:**
- Prüfe ob File in Supabase `files` Tabelle existiert
- Stelle sicher, dass `cdn_url` oder `s3_key` gesetzt ist

---

## 📝 Beispiel .env.local Files

### Frontend (`fyle/.env.local`)
```env
VITE_YOUTUBE_API_URL=https://youtube-api-production.up.railway.app
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_STORAGE_API_URL=https://fylestorage.vercel.app/api
```

### Backend (`youtube-api/.env.local`)
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FRONTEND_URL=https://fyle-cloud.com
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://fyle-cloud.com/youtube/oauth/callback
STORAGE_API_URL=https://fylestorage.vercel.app/api
PORT=4001
```

---

## 🔍 Testing

### Frontend Test
```bash
# Prüfe ob VITE_YOUTUBE_API_URL gesetzt ist
console.log(import.meta.env.VITE_YOUTUBE_API_URL);
```

### Backend Test
```bash
# Health Check
curl https://your-youtube-api-url.railway.app/health

# Sollte zurückgeben:
# {"status":"ok","service":"youtube-api","timestamp":"..."}
```

---

## 📚 Weitere Dokumentation

- **Railway Setup:** Siehe `RAILWAY_SETUP.md`
- **OAuth Setup:** Siehe `FIX_REDIRECT_URI_MISMATCH.md` und `FIX_OAUTH_ACCESS_DENIED.md`
- **README:** Siehe `README.md`

