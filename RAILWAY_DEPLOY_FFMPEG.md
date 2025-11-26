# 🚀 Railway Deployment mit FFmpeg - Schritt für Schritt

## Problem: FFmpeg ist nicht installiert

Railway muss so konfiguriert werden, dass es FFmpeg installiert. Es gibt **2 Wege**:

---

## ✅ Weg 1: Dockerfile verwenden (EMPFOHLEN)

### Schritt 1: Railway Dashboard öffnen
1. Gehe zu [railway.app](https://railway.app)
2. Öffne dein `youtube-api` Projekt

### Schritt 2: Build Settings prüfen
1. Klicke auf deinen Service (z.B. "youtube-api")
2. Gehe zu **Settings** → **Build & Deploy**
3. Prüfe **"Build Command"** und **"Start Command"**

### Schritt 3: Dockerfile aktivieren
1. In **Settings** → **Build & Deploy**
2. **"Builder"** sollte auf **"Dockerfile"** stehen
3. Falls nicht:
   - Wähle **"Dockerfile"** als Builder
   - Railway sollte automatisch `Dockerfile` finden
   - Falls nicht, setze **"Dockerfile Path"** auf `Dockerfile`

### Schritt 4: Deploy
1. **Redeploy** den Service:
   - Klicke auf **"Deploy"** oder
   - Push neuen Code zu GitHub (wenn Auto-Deploy aktiviert ist)
2. Warte bis der Build fertig ist
3. Prüfe die Logs - du solltest sehen:
   ```
   ✅ FFmpeg: Available for video processing
   ✅ Found FFmpeg at: /usr/bin/ffmpeg
   ```

---

## ✅ Weg 2: Nixpacks verwenden (Alternative)

Falls Dockerfile nicht funktioniert, verwende Nixpacks:

### Schritt 1: Nixpacks aktivieren
1. In Railway Dashboard → **Settings** → **Build & Deploy**
2. **"Builder"** auf **"Nixpacks"** setzen
3. Railway verwendet dann automatisch `nixpacks.toml`

### Schritt 2: Deploy
1. **Redeploy** den Service
2. Prüfe die Logs

---

## 🔍 Prüfen ob FFmpeg installiert ist

### In Railway Logs:
Nach dem Deploy solltest du sehen:
```
✅ Found FFmpeg at: /usr/bin/ffmpeg
✅ FFmpeg: Available for video processing
```

### Falls du einen Fehler siehst:
```
❌ FFmpeg: NOT FOUND!
```

**Dann:**
1. Prüfe ob `Dockerfile` im Root-Verzeichnis ist
2. Prüfe ob Railway das Dockerfile verwendet (Settings → Build & Deploy)
3. Redeploy den Service

---

## 📋 Checkliste:

- [ ] `Dockerfile` existiert im `youtube-api/` Ordner
- [ ] `railway.json` existiert (optional, aber hilfreich)
- [ ] Railway Builder ist auf **"Dockerfile"** gesetzt
- [ ] Service wurde **redeployed**
- [ ] Logs zeigen: `✅ Found FFmpeg at: /usr/bin/ffmpeg`

---

## 🐛 Troubleshooting

### Problem: "Cannot find ffmpeg" nach Deploy

**Lösung 1:** Prüfe Railway Settings
- Settings → Build & Deploy → Builder = "Dockerfile"

**Lösung 2:** Prüfe ob Dockerfile korrekt ist
```bash
# Lokal testen (optional):
docker build -t youtube-api-test .
docker run youtube-api-test ffmpeg -version
```

**Lösung 3:** Force Redeploy
- Settings → Deployments → "Redeploy" klicken

### Problem: Railway verwendet Nixpacks statt Dockerfile

**Lösung:** Explizit Dockerfile setzen
- Settings → Build & Deploy → Builder = "Dockerfile"
- Oder: Lösche `nixpacks.toml` (falls vorhanden)

---

## ✅ Nach erfolgreichem Deploy:

Du solltest in den Logs sehen:
```
🚀 YouTube API listening on port 4001
✅ Found FFmpeg at: /usr/bin/ffmpeg
✅ FFmpeg: Available for video processing
```

Dann funktioniert Video-Processing! 🎉

