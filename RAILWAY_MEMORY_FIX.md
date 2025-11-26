# 🔧 FFmpeg SIGKILL Fehler beheben

## ❌ Problem: "ffmpeg was killed with signal SIGKILL"

Dieser Fehler bedeutet, dass FFmpeg vom System beendet wurde, meist wegen:
1. **Out of Memory (OOM)** - Zu wenig RAM auf Railway
2. **Zu lange Laufzeit** - Prozess wurde wegen Timeout beendet
3. **Zu große Dateien** - Audio-Datei ist zu groß

## ✅ Lösung 1: Railway Memory erhöhen

### Schritt 1: Railway Dashboard
1. Gehe zu [railway.app](https://railway.app)
2. Öffne dein **youtube-api** Projekt
3. Klicke auf deinen Service

### Schritt 2: Memory erhöhen
1. Gehe zu **Settings** → **Resources**
2. **Memory** auf mindestens **2GB** setzen (empfohlen: 4GB)
3. **CPU** auf mindestens **2 vCPU** setzen
4. **Speichern**

### Schritt 3: Redeploy
1. **Redeploy** den Service
2. Teste erneut

---

## ✅ Lösung 2: FFmpeg-Optionen optimiert

Der Code wurde bereits optimiert:
- ✅ **Preset**: `ultrafast` (weniger Memory, schneller)
- ✅ **CRF**: `28` (niedrigere Qualität = weniger Memory)
- ✅ **Audio Bitrate**: `128k` (reduziert)
- ✅ **Threads**: `2` (begrenzt Memory-Verbrauch)
- ✅ **Timeout**: 30 Minuten

---

## ✅ Lösung 3: Audio-Datei-Größe prüfen

Große Audio-Dateien (>100MB) können Probleme verursachen:

```typescript
// In upload-processor.service.ts wird die Dateigröße geloggt
console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
```

**Empfehlung:**
- Audio-Dateien sollten < 100MB sein
- Falls größer: Komprimierung vor dem Upload

---

## 🔍 Debugging

### Logs prüfen:
Nach dem Fehler solltest du sehen:
```
⚠️ FFmpeg was killed - likely out of memory or timeout
💡 Suggestions:
   1. Increase Railway service memory limit
   2. Use smaller audio files
   3. Reduce video quality settings
```

### Railway Logs prüfen:
1. Railway Dashboard → **Deployments** → **Logs**
2. Suche nach:
   - `Out of memory`
   - `OOM`
   - `killed`
   - `SIGKILL`

---

## 📊 Empfohlene Railway Settings:

| Resource | Minimum | Empfohlen |
|----------|---------|-----------|
| **Memory** | 2GB | 4GB |
| **CPU** | 2 vCPU | 4 vCPU |
| **Disk** | 10GB | 20GB |

---

## 🎯 Quick Fix Checklist:

- [ ] Railway Memory auf **mindestens 2GB** erhöht
- [ ] Railway CPU auf **mindestens 2 vCPU** erhöht
- [ ] Service **redeployed**
- [ ] Audio-Datei ist < 100MB
- [ ] Logs zeigen keine "Out of memory" Fehler

---

## 💡 Alternative: Video-Qualität weiter reduzieren

Falls Memory-Erhöhung nicht hilft, kann die Video-Qualität weiter reduziert werden:

In `video-processing.service.ts`:
```typescript
// Noch niedrigere Qualität (größere Datei, aber weniger Memory)
.outputOptions(['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30'])
.outputOptions(['-c:a', 'aac', '-b:a', '96k']) // Noch niedrigere Audio-Bitrate
.outputOptions(['-vf', 'scale=854:480']) // Kleinere Auflösung (480p statt 720p)
```

**Aber:** YouTube akzeptiert mindestens 720p, also besser Memory erhöhen! ✅

---

**Nach Memory-Erhöhung sollte es funktionieren!** 🚀

