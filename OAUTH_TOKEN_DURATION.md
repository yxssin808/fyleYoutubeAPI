# YouTube OAuth Token Duration & Management

## Token-Dauer (von Google festgelegt)

### Access Tokens
- **Gültigkeitsdauer**: **1 Stunde (3600 Sekunden)**
- **Kann nicht geändert werden**: Diese Dauer wird von Google festgelegt und kann nicht beeinflusst werden
- **Automatisches Refresh**: Das System refresht automatisch Access Tokens, wenn sie ablaufen oder innerhalb von 5 Minuten ablaufen

### Refresh Tokens
- **Gültigkeitsdauer**: **6 Monate** (typischerweise)
- **Kann ablaufen**: Refresh Tokens können ablaufen, wenn:
  - Der Benutzer den Zugriff widerruft
  - Der Benutzer sein Google-Passwort ändert
  - Der Benutzer die App nicht für 6 Monate verwendet
  - Google die Tokens aus Sicherheitsgründen widerruft

## Was kann als Entwickler beeinflusst werden?

### 1. Refresh-Timing anpassen

Die aktuelle Implementierung refresht Tokens, wenn sie innerhalb von **5 Minuten** ablaufen:

```typescript
// In oauth.service.ts, Zeile 41-44
const fiveMinutes = 5 * 60 * 1000;
const isExpiredOrExpiringSoon = !expiresAt || (expiresAt - now) < fiveMinutes;
```

**Anpassung möglich:**
- Ändere `fiveMinutes` zu einem anderen Wert (z.B. 10 Minuten, 30 Minuten)
- Beispiel: `const tenMinutes = 10 * 60 * 1000;`

### 2. Token-Expiration-Check anpassen

Die Logik prüft, ob ein Token abgelaufen ist oder bald abläuft:

```typescript
// Aktuell: 5 Minuten vor Ablauf
const isExpiredOrExpiringSoon = !expiresAt || (expiresAt - now) < fiveMinutes;
```

**Anpassung möglich:**
- Früher refreshen: Erhöhe den Wert (z.B. 15 Minuten vor Ablauf)
- Später refreshen: Verringere den Wert (z.B. 1 Minute vor Ablauf)
- **Wichtig**: Nicht zu spät refreshen, sonst können API-Calls fehlschlagen

### 3. Automatisches Refresh bei jedem API-Call

Die aktuelle Implementierung refresht automatisch bei jedem Upload:

```typescript
// In youtube.service.ts, Zeile 37-54
if (refreshToken) {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    // ...
  }
}
```

**Anpassung möglich:**
- Entferne das automatische Refresh, wenn du es nur bei Bedarf machen willst
- Oder füge zusätzliche Checks hinzu, um unnötige Refreshes zu vermeiden

## Best Practices

### 1. Proaktives Refresh
- ✅ **Empfohlen**: Refresh 5-10 Minuten vor Ablauf
- ✅ Verhindert, dass API-Calls während des Uploads fehlschlagen

### 2. Refresh Token Handling
- ✅ Immer Refresh Token speichern (für langfristigen Zugriff)
- ✅ Fehlerbehandlung für abgelaufene Refresh Tokens
- ✅ Benutzer benachrichtigen, wenn Re-Authentifizierung nötig ist

### 3. Fehlerbehandlung
- ✅ Bei `invalid_grant` oder `invalid_token`: Benutzer muss sich neu verbinden
- ✅ Bei Netzwerkfehlern: Retry-Logik implementieren
- ✅ Bei abgelaufenen Tokens: Automatisches Refresh versuchen

## Code-Stellen zum Anpassen

### Token-Refresh-Timing ändern:
**Datei**: `fyleYoutubeAPI/src/services/oauth.service.ts`
```typescript
// Zeile 41-44
const fiveMinutes = 5 * 60 * 1000; // Ändere diesen Wert
const isExpiredOrExpiringSoon = !expiresAt || (expiresAt - now) < fiveMinutes;
```

### Automatisches Refresh bei Upload anpassen:
**Datei**: `fyleYoutubeAPI/src/services/youtube.service.ts`
```typescript
// Zeile 37-54
if (refreshToken) {
  // Hier kannst du zusätzliche Checks hinzufügen
  // z.B. nur refreshen, wenn Token wirklich abgelaufen ist
}
```

## Zusammenfassung

| Token-Typ | Dauer | Beeinflussbar? |
|-----------|-------|----------------|
| Access Token | 1 Stunde | ❌ Nein (von Google festgelegt) |
| Refresh Token | 6 Monate | ❌ Nein (von Google festgelegt) |
| Refresh-Timing | 5 Min vor Ablauf | ✅ Ja (Code anpassen) |
| Auto-Refresh | Bei jedem Upload | ✅ Ja (Code anpassen) |

**Wichtig**: Die tatsächliche Token-Dauer kann nicht geändert werden, aber die Refresh-Logik kann angepasst werden, um Tokens früher oder später zu refreshen.






