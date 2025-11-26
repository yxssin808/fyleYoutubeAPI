# ⚡ Quick Start: FFmpeg auf Railway installieren

## 🎯 Das Problem
FFmpeg ist nicht installiert → Video-Processing funktioniert nicht

## ✅ Lösung in 3 Schritten:

### 1️⃣ Railway Dashboard öffnen
- Gehe zu: https://railway.app
- Öffne dein **youtube-api** Projekt

### 2️⃣ Builder auf Dockerfile setzen
1. Klicke auf deinen **youtube-api** Service
2. Gehe zu **Settings** (⚙️)
3. Scrolle zu **"Build & Deploy"**
4. Unter **"Builder"** wähle: **"Dockerfile"**
5. Falls **"Dockerfile Path"** leer ist, setze es auf: `Dockerfile`

### 3️⃣ Redeploy
1. Klicke auf **"Deployments"** Tab
2. Klicke auf **"Redeploy"** (oder den letzten Deployment)
3. Warte bis Build fertig ist (2-3 Minuten)

### 4️⃣ Prüfen
In den **Logs** solltest du sehen:
```
✅ Found FFmpeg at: /usr/bin/ffmpeg
✅ FFmpeg: Available for video processing
```

**Fertig!** 🎉

---

## 🐛 Falls es nicht funktioniert:

### Problem: "Builder" Option fehlt
→ Railway erkennt das Dockerfile automatisch. Prüfe ob `Dockerfile` im Root-Ordner ist.

### Problem: Build schlägt fehl
→ Prüfe die Build-Logs in Railway. Meistens liegt es an:
- Fehlende Dependencies
- TypeScript-Fehler
- Falsche Node-Version

### Problem: FFmpeg immer noch nicht gefunden
→ Prüfe ob im Dockerfile wirklich `ffmpeg` installiert wird (Zeile 5-7)

---

## 📸 Screenshots (was du sehen solltest):

**Settings → Build & Deploy:**
```
Builder: [Dockerfile ▼]
Dockerfile Path: [Dockerfile]
```

**Nach erfolgreichem Deploy in Logs:**
```
✅ Found FFmpeg at: /usr/bin/ffmpeg
✅ FFmpeg: Available for video processing
🚀 YouTube API listening on port 4001
```

---

## 💡 Alternative: Nixpacks

Falls Dockerfile nicht funktioniert:
1. **Builder** auf **"Nixpacks"** setzen
2. Railway verwendet dann automatisch `nixpacks.toml`
3. Redeploy

---

**Das war's!** Nach dem Redeploy sollte FFmpeg funktionieren. 🚀

