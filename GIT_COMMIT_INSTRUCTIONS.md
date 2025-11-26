# 📤 Dockerfile zu GitHub pushen

## ✅ Dateien sind vorbereitet!

Die folgenden Dateien sind bereits **staged** (vorbereitet zum Committen):
- ✅ `Dockerfile` - Installiert FFmpeg
- ✅ `railway.json` - Railway Konfiguration
- ✅ `nixpacks.toml` - Alternative Build-Konfiguration
- ✅ `src/index.ts` - FFmpeg-Check beim Start
- ✅ `src/services/video-processing.service.ts` - FFmpeg-Setup
- ✅ `.dockerignore` - Ignoriert unnötige Dateien

## 🚀 Jetzt committen und pushen:

### Option 1: Via Terminal (empfohlen)

```bash
# 1. Commit erstellen
git commit -m "Add Dockerfile with FFmpeg support for Railway deployment"

# 2. Zu GitHub pushen
git push origin main
```

### Option 2: Via VS Code / Cursor

1. **Source Control** Panel öffnen (Strg+Shift+G)
2. **Commit Message** eingeben: `Add Dockerfile with FFmpeg support for Railway deployment`
3. **Commit** Button klicken (✓)
4. **Push** Button klicken (↑)

## ✅ Nach dem Push:

1. **Railway** wird automatisch neu deployen (wenn Auto-Deploy aktiviert ist)
2. Oder: **Manuell redeployen** in Railway Dashboard
3. **Logs prüfen** - du solltest sehen:
   ```
   ✅ Found FFmpeg at: /usr/bin/ffmpeg
   ✅ FFmpeg: Available for video processing
   ```

## 📍 Wo muss das Dockerfile sein?

Das Dockerfile muss im **Root-Verzeichnis** des `youtube-api` Ordners sein:

```
youtube-api/
  ├── Dockerfile          ← HIER!
  ├── package.json
  ├── src/
  ├── railway.json
  └── ...
```

**Aktueller Stand:** ✅ Das Dockerfile ist bereits im richtigen Ordner!

## 🔍 Prüfen ob es auf GitHub ist:

Nach dem Push, prüfe auf GitHub:
- Gehe zu deinem Repository
- Prüfe ob `Dockerfile` im `youtube-api/` Ordner sichtbar ist

---

**Fertig!** Nach dem Push sollte Railway das Dockerfile automatisch verwenden. 🎉

