# Railway Variables: Shared vs Service-Level

## ⚠️ WICHTIG: Shared Variables funktionieren nicht immer!

In Railway gibt es zwei Arten von Environment Variables:

1. **Project-Level (Shared Variables)** - Für alle Services im Projekt
2. **Service-Level Variables** - Nur für einen spezifischen Service

## 🔍 Problem mit Shared Variables

**Shared Variables können Probleme verursachen:**
- Werden manchmal nicht richtig geladen
- Funktionieren nicht bei privaten Projekten
- Werden nicht immer an alle Services weitergegeben

## ✅ Lösung: Service-Level Variables verwenden

**Immer Variables direkt am Service setzen, nicht am Project!**

### Schritt-für-Schritt:

1. **Gehe zu Railway Dashboard**
2. **Wähle dein PROJECT** (nicht den Service!)
3. **Klicke auf den SERVICE "youtube-api"** (nicht auf Project Settings!)
4. **Klicke auf "Variables" Tab**
5. **Falls Shared Variables vorhanden sind:**
   - **Lösche sie NICHT** (können für andere Services sein)
   - **Aber setze die Variables auch am Service-Level!**

6. **Klicke auf "+ New Variable"**
7. **Setze jede Variable einzeln direkt am SERVICE:**

```
GOOGLE_CLIENT_ID = 960379334054-d0803vbf6slo3r375fices913qnb
GOOGLE_CLIENT_SECRET = GOCSPX-xxxxx
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FRONTEND_URL = https://fyle-cloud.com
GOOGLE_REDIRECT_URI = https://fyle-cloud.com/youtube/oauth/callback
STORAGE_API_URL = https://fylestorage.vercel.app/api
```

8. **Wichtig:**
   - **Environment:** Wähle **"All"** oder **"Production"**
   - **Keine Leerzeichen** in den Namen
   - **Exakte Schreibweise** beachten

9. **Nach dem Setzen:**
   - Service wird automatisch neu deployed
   - Oder manuell: Service → Deployments → Redeploy

## 🔍 Prüfen ob es funktioniert:

Nach dem Deployment sollten in den Logs erscheinen:

```
🔍 Google OAuth Environment Variables Check:
  hasGOOGLE_CLIENT_ID: true
  hasGOOGLE_CLIENT_SECRET: true
  ...
✅ All critical environment variables are set
```

Statt:
```
❌ Missing critical environment variables: GOOGLE_CLIENT_ID
```

## 📋 Unterschied: Project vs Service

### Project-Level (Shared Variables):
- **Wo:** Project → Settings → Variables
- **Für:** Alle Services im Projekt
- **Problem:** Werden manchmal nicht geladen
- **Empfehlung:** ❌ Nicht verwenden für kritische Variables

### Service-Level Variables:
- **Wo:** Project → Service "youtube-api" → Variables
- **Für:** Nur diesen Service
- **Problem:** Keine
- **Empfehlung:** ✅ **IMMER HIER SETZEN!**

## 🎯 Best Practice

**Für kritische Variables (wie GOOGLE_CLIENT_ID):**
1. ✅ **Immer am Service-Level setzen**
2. ❌ **NICHT nur am Project-Level**

**Warum?**
- Service-Level Variables sind zuverlässiger
- Werden immer geladen
- Funktionieren auch bei privaten Projekten
- Keine Probleme mit Shared Variables

## 🐛 Troubleshooting

### Problem: Variable ist in Shared Variables, aber Service findet sie nicht

**Lösung:**
1. Gehe zu Service → Variables
2. Setze die Variable **auch hier** (Service-Level)
3. Redeploy Service

### Problem: Projekt ist privat und Shared Variables funktionieren nicht

**Lösung:**
- Setze alle Variables **direkt am Service**
- Ignoriere Shared Variables komplett
- Service-Level Variables funktionieren immer!

## ✅ Checkliste

- [ ] Variables sind am **Service-Level** gesetzt (nicht nur Project-Level)
- [ ] Variable Name ist **exakt** korrekt (Großbuchstaben, Unterstriche)
- [ ] Environment ist **"All"** oder **"Production"**
- [ ] Service wurde **nach dem Setzen** neu deployed
- [ ] Logs zeigen `✅ All critical environment variables are set`

---

## 💡 Tipp

**Wenn du unsicher bist:**
1. Setze die Variable **sowohl** am Project-Level **als auch** am Service-Level
2. Service-Level hat **Vorrang**
3. So funktioniert es garantiert!

