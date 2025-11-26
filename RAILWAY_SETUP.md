# Railway Setup Guide für YouTube API Service

Diese Anleitung führt dich Schritt für Schritt durch die Einrichtung des YouTube API Services auf Railway.

## Voraussetzungen

- Railway Account ([railway.app](https://railway.app))
- GitHub Repository mit dem `youtube-api` Code
- Supabase Projekt (für Datenbank)
- Google Cloud Console Projekt (für OAuth)

## Schritt 1: Railway Projekt erstellen

1. Gehe zu [Railway Dashboard](https://railway.app/dashboard)
2. Klicke auf **"New Project"**
3. Wähle **"Deploy from GitHub repo"**
4. Verbinde dein GitHub Account (falls noch nicht verbunden)
5. Wähle das Repository aus, das den `youtube-api` Code enthält
6. Railway erstellt automatisch ein neues Projekt

## Schritt 2: Service hinzufügen

1. Im Railway Dashboard, klicke auf **"New"** → **"Service"**
2. Wähle **"GitHub Repo"** aus
3. Wähle dein Repository und den **`youtube-api`** Ordner aus
4. Railway erkennt automatisch:
   - `Dockerfile` → Build mit Docker
   - `railway.json` → Build/Deploy Konfiguration
   - `package.json` → Node.js Service

## Schritt 3: Environment Variables setzen

Im Railway Dashboard → Dein Service → **"Variables"** Tab:

### Supabase Konfiguration

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Wo findest du diese?**
- Supabase Dashboard → Settings → API → Project URL & service_role key

### Frontend URL

```
FRONTEND_URL=https://fyle-cloud.com
```

**Wichtig:** Die exakte URL deines Frontends (ohne trailing slash)

### Google OAuth2

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://fyle-cloud.com/youtube/oauth/callback
```

**Wo findest du diese?**
- Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID

**Wichtig:** 
- `GOOGLE_REDIRECT_URI` muss exakt mit der URL in Google Cloud Console übereinstimmen
- Für lokale Entwicklung: `http://localhost:5173/youtube/oauth/callback`

### Storage API URL

```
STORAGE_API_URL=https://fylestorage.vercel.app/api
```

**Wichtig:** Die URL deines Storage Services (für signed URLs)

### Optional: Port

Railway setzt `PORT` automatisch. Du kannst es überschreiben, aber normalerweise nicht nötig.

## Schritt 4: Deploy

1. Railway startet automatisch den Build-Prozess
2. Du siehst die Build-Logs in Echtzeit:
   - Docker Image wird gebaut
   - FFmpeg wird installiert
   - Dependencies werden installiert
   - TypeScript wird kompiliert
   - Service startet

3. Warte bis der Build erfolgreich ist (grüner Haken ✅)

## Schritt 5: Service URL finden

1. Im Railway Dashboard → Dein Service → **"Settings"** Tab
2. Scrolle zu **"Networking"**
3. Klicke auf **"Generate Domain"** (falls noch nicht vorhanden)
4. Railway erstellt eine URL wie: `https://youtube-api-production.up.railway.app`

**Wichtig:** Diese URL ist deine neue YouTube API URL!

## Schritt 6: Frontend aktualisieren

Aktualisiere dein Frontend, um die neue Railway URL zu verwenden:

**In `fyle/src/config/constants.ts` oder ähnlich:**

```typescript
export const YOUTUBE_API_URL = 'https://youtube-api-production.up.railway.app';
```

Oder als Environment Variable:

```env
VITE_YOUTUBE_API_URL=https://youtube-api-production.up.railway.app
```

## Schritt 7: Health Check testen

Teste ob der Service läuft:

```bash
curl https://youtube-api-production.up.railway.app/health
```

Erwartete Antwort:
```json
{
  "status": "ok",
  "service": "youtube-api",
  "timestamp": "2025-01-31T12:00:00.000Z"
}
```

## Schritt 8: Logs überwachen

Im Railway Dashboard → Dein Service → **"Deployments"** Tab:

- Klicke auf den neuesten Deployment
- Sieh dir die **"Logs"** an
- Du solltest sehen:
  ```
  🚀 YouTube API listening on port 4001
  📡 Environment: production
  🎬 FFmpeg: Available for video processing
  ```

## Troubleshooting

### Build schlägt fehl

**Problem:** Docker Build schlägt fehl

**Lösung:**
- Prüfe die Build-Logs in Railway
- Stelle sicher, dass `Dockerfile` im `youtube-api` Ordner ist
- Prüfe ob `package.json` korrekt ist

### Service startet nicht

**Problem:** Service crashed nach Start

**Lösung:**
- Prüfe die Logs in Railway
- Stelle sicher, dass alle Environment Variables gesetzt sind
- Prüfe ob `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` korrekt sind

### FFmpeg nicht gefunden

**Problem:** `FFmpeg not found` Fehler

**Lösung:**
- Das Dockerfile installiert FFmpeg automatisch
- Prüfe die Build-Logs, ob FFmpeg installiert wurde
- Falls nicht, prüfe das Dockerfile

### OAuth Fehler

**Problem:** `redirect_uri_mismatch` oder `access_denied`

**Lösung:**
- Siehe `FIX_REDIRECT_URI_MISMATCH.md` und `FIX_OAUTH_ACCESS_DENIED.md`
- Stelle sicher, dass `GOOGLE_REDIRECT_URI` exakt mit Google Cloud Console übereinstimmt

### Video Processing schlägt fehl

**Problem:** Videos werden nicht erstellt

**Lösung:**
- Prüfe die Logs in Railway für FFmpeg-Fehler
- Stelle sicher, dass Audio-URLs erreichbar sind
- Prüfe ob `STORAGE_API_URL` korrekt ist

## Nächste Schritte

1. ✅ Service läuft auf Railway
2. ✅ Frontend zeigt auf Railway URL
3. ✅ Teste einen YouTube Upload
4. ✅ Prüfe die Logs für Fehler

## Monitoring

Railway bietet:
- **Logs**: Echtzeit-Logs deines Services
- **Metrics**: CPU, Memory, Network Usage
- **Deployments**: Deployment-Historie
- **Alerts**: Email-Benachrichtigungen bei Fehlern

## Kosten

Railway bietet:
- **Free Tier**: $5 Gratis-Credits pro Monat
- **Hobby Plan**: $5/Monat (wenn Credits aufgebraucht)
- **Pro Plan**: $20/Monat (mehr Ressourcen)

**Tipp:** Der YouTube API Service ist relativ leichtgewichtig und sollte im Free Tier laufen.

## Support

Bei Problemen:
1. Prüfe die Railway Logs
2. Prüfe die Railway Dokumentation: [docs.railway.app](https://docs.railway.app)
3. Prüfe die Service-Logs für detaillierte Fehlermeldungen

