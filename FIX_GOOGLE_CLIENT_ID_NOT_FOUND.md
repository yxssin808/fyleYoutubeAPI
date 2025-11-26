# Fix: GOOGLE_CLIENT_ID is not configured

## Problem

Der Fehler sagt:
```
GOOGLE_CLIENT_ID is not configured. Please set it in Railway/Vercel environment variables.
```

Aber die Variable ist in Railway gesetzt.

## ✅ Lösung

### 1. Prüfe Railway Logs beim Start

Nach dem Deploy solltest du in den Railway Logs sehen:

```
🔍 Google OAuth Environment Variables Check:
  hasGOOGLE_CLIENT_ID: true/false
  hasGOOGLE_CLIENT_SECRET: true/false
  ...
```

**Wenn `hasGOOGLE_CLIENT_ID: false`** → Die Variable ist nicht richtig gesetzt.

### 2. Prüfe Railway Variables

1. **Gehe zu Railway Dashboard** → Dein Service → **Variables**
2. **Prüfe ob `GOOGLE_CLIENT_ID` existiert:**
   - Name muss **exakt** sein: `GOOGLE_CLIENT_ID` (Großbuchstaben, Unterstriche)
   - Keine Leerzeichen am Anfang/Ende
   - Wert sollte sein: `960379334054-d0803vbf6slo3r375fices913qnb` (nur der erste Teil, ohne Domain!)

3. **Prüfe Environment:**
   - Stelle sicher, dass die Variable für **"Production"** oder **"All"** gesetzt ist
   - Nicht nur für "Development"!

### 3. Service neu deployen

**Wichtig:** Nach dem Setzen/Ändern von Environment Variables muss der Service **neu deployed** werden!

1. **Railway Dashboard** → Dein Service
2. **Deployments Tab**
3. **Klicke auf "Redeploy"** oder **"Deploy Latest"**
4. **Warte bis Deployment fertig ist**

### 4. Prüfe die Logs nach dem Deploy

Nach dem Deploy solltest du sehen:

```
✅ All critical environment variables are set
```

Oder:

```
❌ Missing critical environment variables: GOOGLE_CLIENT_ID, ...
```

### 5. Häufige Fehler

#### Fehler 1: Variable nur für Development gesetzt
**Problem:** Variable ist nur für "Development" Environment gesetzt, nicht für "Production"

**Lösung:**
- Railway → Variables → Klicke auf die Variable
- Stelle sicher, dass **"All"** oder **"Production"** ausgewählt ist

#### Fehler 2: Falscher Variablenname
**Problem:** Variable heißt `GOOGLE_CLIENT_ID` aber Railway hat `google_client_id` oder `Google_Client_Id`

**Lösung:**
- Variable muss **exakt** `GOOGLE_CLIENT_ID` heißen (Großbuchstaben, Unterstriche)
- Lösche die alte Variable und erstelle eine neue mit dem korrekten Namen

#### Fehler 3: Variable enthält Leerzeichen
**Problem:** Der Wert hat Leerzeichen am Anfang/Ende oder enthält beide Teile:
```
960379334054-d0803vbf6slo3r375fices913qnb g3h3.apps.googleusercontent.com
```

**Lösung:**
- Der Wert sollte **nur** sein: `960379334054-d0803vbf6slo3r375fices913qnb`
- Keine Leerzeichen, keine Domain am Ende

#### Fehler 4: Service wurde nicht neu deployed
**Problem:** Variable wurde gesetzt, aber Service läuft noch mit altem Code

**Lösung:**
- Railway → Deployments → **Redeploy**

### 6. Test-Endpoint

Nach dem Deploy, teste den Health-Check:

```bash
curl https://fyleyoutubeapi-production.up.railway.app/health
```

In den Logs solltest du dann sehen, ob die Variables geladen wurden.

### 7. Debug-Logging

Wenn du den OAuth authorize Endpoint aufrufst, siehst du jetzt in den Logs:

```
🔍 Environment Variables Check:
  hasClientId: true/false
  clientIdLength: ...
  clientIdPreview: ...
  allEnvKeys: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ...
```

Das zeigt dir genau, welche Variables verfügbar sind.

---

## 📋 Checkliste

- [ ] `GOOGLE_CLIENT_ID` ist in Railway → Variables gesetzt
- [ ] Variable Name ist **exakt** `GOOGLE_CLIENT_ID` (Großbuchstaben)
- [ ] Variable ist für **"Production"** oder **"All"** gesetzt
- [ ] Variable Wert ist nur der Client ID (ohne Domain, ohne Leerzeichen)
- [ ] Service wurde **nach dem Setzen** neu deployed
- [ ] Railway Logs zeigen `✅ All critical environment variables are set`

---

## 🔍 Debugging

### Im Railway Dashboard:

1. **Service → Variables** → Prüfe ob `GOOGLE_CLIENT_ID` existiert
2. **Service → Deployments → Logs** → Suche nach:
   ```
   🔍 Google OAuth Environment Variables Check
   ```
3. **Service → Deployments → Logs** → Suche nach:
   ```
   ✅ All critical environment variables are set
   ```
   oder
   ```
   ❌ Missing critical environment variables
   ```

### Wenn Variable fehlt:

1. **Lösche die Variable** (falls vorhanden mit falschem Namen)
2. **Erstelle neue Variable:**
   - Name: `GOOGLE_CLIENT_ID`
   - Value: `960379334054-d0803vbf6slo3r375fices913qnb` (nur der erste Teil!)
   - Environment: **All** oder **Production**
3. **Redeploy Service**
4. **Prüfe Logs erneut**

---

## 💡 Tipp

Wenn du unsicher bist, ob die Variable gesetzt ist:

1. **Railway Dashboard** → Service → **Variables**
2. **Klicke auf `GOOGLE_CLIENT_ID`**
3. **Prüfe:**
   - Name ist exakt `GOOGLE_CLIENT_ID`
   - Value ist nur der Client ID (ohne Domain)
   - Environment ist "All" oder "Production"
4. **Falls nicht:** Bearbeite oder erstelle neu
5. **Redeploy Service**

