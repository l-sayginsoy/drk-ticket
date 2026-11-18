# Sicherheitsumbau: echte Anmeldung statt Klartext-Passwörter

Stand: 18.11.2026 abends · **live**: Schritte 0 bis 7 erledigt (Backup, Anmeldung, Konten, Cloud Function `adminManageUser`, neuer Client, Regeln geschlossen, Passwortfelder entfernt). Konto `admin` bewusst nicht angelegt. Backup mit den alten Passwörtern: `~/Documents/haustechnik-backup-2026-11-18.json`.

## 1. Befund (Stand 18.11.2026, von Levent geprüft)

Mit dem öffentlichen Web-Schlüssel aus `firebase-applet-config.json` kann jeder ohne Anmeldung per REST:

- `app_data/facility-management-users` lesen: 6 Benutzer mit **Klartext-Passwort** (Ali Najafi hat nur 4 Zeichen)
- alle Tickets lesen (34 aktive, dazu Archiv und Serienaufträge)
- `app_data` und `events` **schreiben**, Tickets **löschen** (`allow write: if true`)

Die Anmeldung lief nur im Browser (`Portal.tsx` verglich `u.password === Eingabe`), die angemeldete Person samt Passwort lag im `localStorage`. Zusätzlich standen Startpasswörter im ausgelieferten JavaScript (`constants.ts`).

## 2. Ziel-Design

| Thema | Lösung |
|---|---|
| Anmeldung | Firebase Auth (E-Mail/Passwort). Die Adresse ist nur ein technischer Schlüssel aus dem Anmeldenamen: `Heiko Saupert` → `heiko.saupert@haustechnik.local`, `Carlo` → `carlo@haustechnik.local` (`utils/loginName.ts`). Es werden nie Mails dorthin gesendet. |
| Rollen | `users/{uid}` = `{ role: admin / techniker / hauswirtschaft, name, userId, active }`. Nur Admins dürfen es schreiben. **Die Rolle kommt ausschließlich daraus**, nicht mehr aus der Benutzerliste in `app_data`. |
| Passwörter | Stehen nirgends mehr (nur gehasht bei Firebase Auth). Aus `constants.ts`, Benutzerliste, `localStorage` entfernt. Mindestlänge 6. |
| Carlo und Levent | Immer Administratoren, nicht sperr-, herabstuf- oder löschbar (erzwungen in der Cloud Function und im Migrationsskript). Beide mit eigenem Passwort, das nur im Terminal verdeckt abgefragt wird. |
| Melder-Portal (anonym) | Darf nur: Ticket anlegen, **ein** Ticket per Nummer lesen (`get`, nie `list`), eigene Nachricht anhängen, abgeschlossenes Ticket wiedereröffnen, `app_data/portal-public` und `app_data/deleted-ticket-ids` lesen. Alles Weitere ist zu. |
| Öffentliche Daten | Neues Dokument `app_data/portal-public`: App-Name, Untertitel, Wartungsmodus, Kategorien (Name, Standardpriorität), Namen der Standorte, Namen des Service-Teams (für die Auswahlliste beim Anmelden). Wird von Admin-Browsern aktuell gehalten. Keine E-Mail-Adressen, keine Regeln. |
| Passwortverwaltung | Cloud Function `adminManageUser` (anlegen, Passwort setzen, Rolle/Name ändern, sperren, löschen). Ein Browser kann fremde Passwörter nicht setzen. `SettingsView`/`UserModal` rufen sie auf. |

### Was sich für die Leute ändert

- Anmeldung sieht gleich aus (Name wählen/tippen + Passwort). Alle bekommen **einmalig ein Startpasswort** von Levent. Die alten Passwörter funktionieren nicht mehr, auch nicht `admin`/`admin` als Notnagel.
- Meldungen aus dem Portal werden **nicht mehr sofort** automatisch zugewiesen, sondern in dem Moment, in dem ein angemeldeter Mitarbeiter-Browser sie sieht (meist Sekunden, da immer jemand das Board offen hat). Gleiche Regeln wie vorher (`assignTicket`, Routing, Abwesenheit → Parken), Admin-Mail geht ebenfalls dann raus. Ohne angemeldete Person bleibt die Meldung „Offen ohne Bearbeiter“ liegen.
- Das Portal liest weder Benutzer noch andere Tickets noch Einstellungen.
- Wer sich abmeldet, lässt keine Tickets/Benutzerlisten im Browserspeicher zurück (wichtig an gemeinsam genutzten PCs).

### Was bewusst unverändert bleibt

Ticket-Lebenszyklus-Regeln (`canWriteActiveTicket`, `canRemoveCompletedTicket`, Sperrliste), E-Mail-Politik (nur `ticket_created`, `staff_note`, `ticket_closed` an Melder), Automatik bei Abwesenheit/Rückkehr, Aussehen der App.

## 3. Rechte-Übersicht der neuen Regeln (`firestore.sicher.rules`)

| | anonym (Melder) | Techniker / Hauswirtschaft | Admin |
|---|---|---|---|
| Tickets, Archiv, Serienaufträge listen | nein | ja | ja |
| einzelnes Ticket per Nummer lesen | **ja** | ja | ja |
| Ticket anlegen | **ja**, nur Portal-Felder, Status Offen, ohne Zuweisung | ja | ja |
| Ticket ändern | nur **eine Notiz anhängen** | ja | ja |
| Archiv-Ticket wiedereröffnen | **ja**, nur mit Notiz, sonst unveränderte Kopie | ja | ja |
| aktives Ticket löschen | nein | nur als Teil von Abschluss/Umzug | ja |
| `app_data` (Einstellungen, Haken, Sperrliste, …) | nur `portal-public`, `deleted-ticket-ids` lesen | lesen/schreiben, **außer** Benutzerliste, Standorte, `portal-public` | alles |
| Ereignisse | nein | ja | ja |
| `users/{uid}` (Rollenprofile) | nein | eigenes lesen | alle lesen/schreiben |
| Konto ohne Profil oder `active:false` | – | keine Rechte | – |

Offene Restschwäche (innerhalb des Teams): Techniker/Hauswirtschaft können Einstellungen schreiben (nötig für Serienaufträge, Lernen, Haken). Rechte gewinnt man dadurch nicht, weil Rollen nur aus `users/{uid}` kommen.

## 4. Tests (alles lokal, nur erfundene Daten)

| Test | Befehl | Stand |
|---|---|---|
| TypeScript | `npm run lint` | grün |
| Build | `npm run build` | grün |
| Regeltests (Emulator, 36 Fälle: anonym, ohne Rolle, gesperrt, Techniker, Hauswirtschaft, Admin, Lebenszyklus, Wiedereröffnen, Fälschungsversuche) | `npm run test:rules` | 36/36 |
| Bisherige Lebenszyklus-Tests (gegen die **alten** Regeln, unverändert) | Emulator `firebase.test.json` starten, dann `npm run test:ticket-persistence` | 13/13 |
| Cloud Function `adminManageUser` (Emulator, 18 Fälle) | siehe unten | 18/18 |
| Browser-Ende-zu-Ende (Melder legt an, Status, Nachricht; falsches/richtiges Passwort; Techniker; Übernahme/Zuweisung; Abmelden; Admin) | siehe unten | 16/16 |
| Anonym-Prüfung (`scripts/pruefen-anonym.mjs`): gegen neue Regeln alles wie erwartet, gegen **alte** Regeln schlägt sie an (18 Abweichungen) – prüft also wirklich | `--emulator` | ok |

Emulator-Sitzung (Java liegt unter Homebrew, Pfad ggf. anpassen):

```bash
export JAVA_HOME=/opt/homebrew/Cellar/openjdk/27/libexec/openjdk.jdk/Contents/Home PATH=$JAVA_HOME/bin:$PATH
firebase emulators:start --config firebase.emulators.json --project drk-facility-dashboard   # Auth, Firestore, Functions
node scripts/seed-emulator.mjs --emulator
MIGRATION_TEST_PASSWORD=Test-1234 node scripts/migrate-auth.mjs konten --emulator
node scripts/test-user-admin.mjs
VITE_USE_EMULATORS=1 npx vite --port 5190 --strictPort --open false   # anderes Terminal
node scripts/e2e-emulator.mjs
```

Hinweis: Der Emulator lädt geänderte Regeln nicht von selbst neu, nach Änderung an `firestore.sicher.rules` neu starten. `MIGRATION_TEST_PASSWORD` gilt nur mit `--emulator`.

Nicht lokal prüfbar (Emulator kann es nicht): die Projekt-Konfiguration `anmeldung-aktivieren` (Auth-Admin-API), echte Cloud-Function-Auslieferung, echtes Hosting. Das wird beim Ausrollen Schritt für Schritt live geprüft (siehe 5).

## 5. Ausroll-Reihenfolge (Schritt für Schritt)

Grundregel: **Erst Konten, dann neuer Client, dann Regeln zu, zuletzt Passwörter weg.** So sperrt sich niemand aus und das Melder-Portal fällt nie aus.

> Wichtig: Ein Push auf `main` stößt über GitHub Actions sofort das Hosting-Deploy an (Lint, Build, Hosting; Regeln und Functions deployt die Pipeline **nicht**). Deshalb nicht vor Schritt 4 nach `main` mergen.

**Schritt 0 – Backup (lesend)**
```bash
node scripts/backup-live.mjs "$HOME/Documents/haustechnik-backup-$(date +%F).json"
```
Enthält bis zur Umstellung Klartext-Passwörter: nicht in den Repo-Ordner legen. (Ein erstes Backup vom 18.11.2026 liegt im Scratchpad der Sitzung unter `…/scratchpad/backup/firestore-backup-2026-11-18.json`; vor dem Start einen frischen ziehen.)

**Schritt 1 – Anmeldung im Projekt einschalten** (bisher AUS laut `--plan`)
```bash
node scripts/migrate-auth.mjs --plan
node scripts/migrate-auth.mjs anmeldung-aktivieren
```
Schaltet E-Mail/Passwort ein und sperrt die Selbstregistrierung (Konten legen nur noch Admins/Skripte an). Falls die Sperre nicht geht, meldet das Skript es und schaltet nur die Anmeldung ein. Wirkt auf den Live-Betrieb nicht.

**Schritt 2 – Konten, Rollenprofile, öffentliches Dokument anlegen** (Levent tippt Passwörter verdeckt im Terminal)
```bash
node scripts/migrate-auth.mjs konten
```
Fragt je Person ein Passwort (leere Eingabe = überspringen): **Carlo** (eigenes Passwort), **Levent**, **Heiko**, **Ali (neu, min. 6 Zeichen)**, **Torsten**, **Jessica**, **admin** (siehe offene Frage 1). Legt `users/{uid}`-Profile an, nimmt Levent in die Benutzerliste auf (Transaktion, nichts wird überschrieben) und erstellt `app_data/portal-public`. Bestehende Konten/Profile werden nie angefasst. Alte Clients bemerken nichts.

**Schritt 3 – Cloud Function ausliefern**
```bash
firebase deploy --only functions:adminManageUser --project drk-facility-dashboard
```
Berührt `sendBrevoMail`/`checkBrevoHealth` nicht.

**Schritt 4 – neuen Client ausrollen**: Branch nach `main` mergen und pushen (Actions: Lint, Build, Hosting). Danach live prüfen: Als Levent anmelden (Admin-Formular), Board lädt, Einstellungen → Benutzer zeigt die Liste, Melder-Portal in privatem Fenster: Meldung anlegen und per Nummer abrufen (Testticket danach löschen). Der Service Worker holt `index.html` immer frisch; offene Alt-Tabs laufen bis zum Neuladen weiter, sie funktionieren weiter, solange die Regeln noch offen sind.
Der neue Admin-Browser entfernt beim Schreiben der Benutzerliste die Passwortfelder von selbst. Alte Tabs können sich dann nicht mehr frisch anmelden, bleiben aber angemeldet.

**Schritt 5 – Einführung**: Startpasswörter an die Leute geben, Anmelden auf jedem Gerät einmal ausführen lassen. Kontrolle (zeigt je Person „zuletzt angemeldet“):
```bash
node scripts/migrate-auth.mjs --plan
```
Regeln erst schließen, wenn alle Aktiven mindestens einmal angemeldet waren (oder bewusst so entschieden).

**Schritt 6 – Regeln schließen.** Neue Regeln übernehmen, committen (damit der Rückweg ein `git revert` ist) und ausliefern:
```bash
cp firestore.sicher.rules firestore.rules
git add firestore.rules && git commit -m "feat: Firestore-Regeln geschlossen (nur Anmeldung + Melder-Wege)" && git push
firebase deploy --only firestore:rules --project drk-facility-dashboard
node scripts/pruefen-anonym.mjs
```
`pruefen-anonym.mjs` muss „Alles wie erwartet“ melden. Danach sofort von Hand: Melder-Ticket anlegen/per Nummer lesen/Nachricht senden; Mitarbeiter anmelden, Ticket bearbeiten und abschließen. Zeigt etwas Unerwartetes, sofort **Rückfall** (unten).

**Schritt 7 – Passwortfelder endgültig löschen** (falls noch vorhanden)
```bash
node scripts/migrate-auth.mjs passwoerter-entfernen --ja
```

**Schritt 8 – aufräumen**: `CLAUDE.md`/`SYSTEM_DOKUMENTATION.md` (Abschnitt Login), Memory-Notiz `builtin-accounts-login` aktualisieren (Recovery `admin/admin` gibt es nicht mehr). Backup-Datei nach Abschluss sicher löschen oder verschlüsseln.

### Rückfallplan

| Situation | Maßnahme |
|---|---|
| Nach Schritt 6 geht etwas Wichtiges nicht | Regeln zurück: `git revert HEAD && firebase deploy --only firestore:rules --project drk-facility-dashboard` (ca. 1 Minute). Die alten Regeln sind die offenen von vorher. |
| Neuer Client macht Probleme | Firebase Console → Hosting → Versionsverlauf → „Zurücksetzen“ auf die vorherige Version, oder Merge revertieren und pushen. Wichtig: Die Alt-Version meldet über Passwörter an. Haben Admins die Passwortfelder schon entfernt, vorher zurückspielen: `node scripts/restore-doc.mjs <backup.json> app_data/facility-management-users --ja` (zeigt ohne `--ja` nur an). |
| Jemand kommt nicht mehr rein | Admin setzt in Einstellungen → Benutzer ein neues Passwort (Cloud Function). Sind alle Admins ausgesperrt: Konto-Passwort in der Firebase Console (Authentication → Benutzer) zurücksetzen. Es gibt bewusst kein „Passwort vergessen“. |
| Cloud Function fehlt/kaputt | Anmelden geht trotzdem (Firebase Auth). Nur die Benutzerverwaltung zeigt „Dienst nicht erreichbar“. |
| `portal-public` fehlt | Melder-Formular zeigt keine Standorte. `node scripts/migrate-auth.mjs konten` legt es an, ein Admin-Browser pflegt es danach selbst. |

## 6. Risiken und bekannte Grenzen

0. **Ausnahme Ali (4-Zeichen-Passwort):** Firebase verlangt mindestens 6 Zeichen. Auf Wunsch von Levent behält Ali sein kurzes Passwort. Der Client füllt Passwörter unter 6 Zeichen beim Anmelden mit `#` auf (`toAuthPassword` in `utils/loginName.ts`), sein Konto wurde mit dem aufgefüllten Passwort angelegt. Ein 4-Zeichen-Passwort ist schwach; Empfehlung: bei Gelegenheit verlängern. Die Verwaltung (Cloud Function) verlangt für neue Passwörter weiter mind. 6 Zeichen.

1. **Ticketnummern sind erratbar** (5 Stellen, 30000–39999). Wer die Nummer kennt, kann das Ticket lesen (Titel, Beschreibung, Name, E-Mail, Fotos des Melders), eine Nachricht anhängen und ein abgeschlossenes Ticket wiedereröffnen. Das war schon bisher so, nur dass vorher *alle* Tickets für jeden lesbar waren. Besser wäre ein geheimes Token (siehe offene Frage 2).
2. **`sendBrevoMail` ist ohne Anmeldung aufrufbar** (Melder-Bestätigung geht aus dem Browser). Jeder könnte darüber Mails mit DRK-Absender verschicken. Nicht Teil dieses Umbaus; Abhilfe: Melder-Bestätigung serverseitig aus einem Firestore-Trigger senden.
3. **Zuweisung neuer Meldungen hängt an einem angemeldeten Browser** (siehe 2). Nachts/am Wochenende ohne offenes Board wartet die Meldung bis zur ersten Anmeldung. Alternative wäre ein Firestore-Trigger in Cloud Functions (größerer Umbau, die Zuweisungslogik liegt heute im Browser-Code).
4. **Lesekosten:** Jede Regelauswertung liest das Rollenprofil (`users/{uid}`) mit. Pro Listener-Start und pro Schreibvorgang ein zusätzliches Dokument. Bei der Tageslimit-Datenbank (siehe CLAUDE.md, 20.06.2026) im Blick behalten; sollte klein bleiben.
5. **Techniker/Hauswirtschaft schreiben Einstellungen** (s. o.), und Admin-Rechte der Regeln hängen an `users/{uid}`. Die alte Ausnahme „verifizierte Gmail-Adresse = Admin“ bleibt unverändert in den Regeln (Inhaberkonto), kann später entfernt werden.
6. Der `lastLoginAt`-Hinweis im Plan zeigt nur Anmeldungen am Projekt, nicht welches Gerät.
7. Alt-Clients (nicht neu geladene Tabs) funktionieren bis zum Schließen der Regeln normal, danach bekommen sie Berechtigungsfehler und brauchen ein Neuladen.

## 7. Offene Fragen an Levent

1. **Konto `admin`**: Es ist ein gemeinsames Konto mit schwachem Passwort. Neu anlegen (Skript fragt) oder weglassen (Carlo und Levent genügen)? Der Eintrag bleibt in der Benutzerliste (Tickets verweisen darauf), nur das Anmelde-Konto fehlt dann.
2. **Melder und Ticketnummer**: Dürfen Melder ihr Ticket weiter per Nummer sehen, kommentieren und wiedereröffnen (wie bisher, mit der Erratbarkeit aus Risiko 1)? Oder soll die Nummer in der Mail-Link-Form ein geheimes Zusatzstück bekommen (`?ticket=34567&t=…`, dann nur noch Zugriff mit Token)? Letzteres ist ein Folgeprojekt (alte Tickets/Links).
3. **Startpasswörter**: Sollen die Leute ihr Passwort selbst ändern können (kleiner Zusatz: „Passwort ändern“ im Menü)? Aktuell setzen das nur Admins.
4. **Automatische Zuweisung ohne Browser**: Reicht die Übernahme durch den ersten angemeldeten Browser, oder soll sie serverseitig laufen (Folgeprojekt, Risiko 3)?
5. **Zeitpunkt**: Regeln erst schließen, wenn alle einmal angemeldet waren. Wie lange Wartezeit (1–2 Arbeitstage)?
6. **Freigabe zum Live-Gehen**: Dieser Branch wurde bewusst **nicht** ausgerollt. Die Ausroll-Schritte oben bitte freigeben (jeder Schritt benötigt zudem das Eintippen der Passwörter durch Levent).

## 8. Geänderte/neue Dateien

- Regeln und Tests: `firestore.sicher.rules`, `tests/rules.test.mjs`, `scripts/test-rules.mjs`, `firebase.test.sicher.json`
- Client: `App.tsx` (Anmeldestatus, Listener nur für Angemeldete, Melder-Wege, Übernahme), `components/Portal.tsx`, `components/SettingsView.tsx`, `components/UserModal.tsx`, `firebase.ts` (Emulator nur mit `VITE_USE_EMULATORS=1`), `constants.ts`, `types.ts`, `utils/loginName.ts`, `utils/portalPublic.ts`, `utils/portalTicket.ts`
- Server: `functions/userAdmin.js` (+ Eintrag in `functions/sendEmails.js`)
- Skripte: `scripts/migrate-auth.mjs`, `scripts/backup-live.mjs`, `scripts/restore-doc.mjs`, `scripts/pruefen-anonym.mjs`, `scripts/lib/live.mjs`, `scripts/seed-emulator.mjs`, `scripts/e2e-emulator.mjs`, `scripts/test-user-admin.mjs`, `firebase.emulators.json`, `firebase.emulators.alt.json`
