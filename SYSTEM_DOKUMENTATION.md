# DRK Haustechnik Service — Systemdokumentation

> Letzte Aktualisierung: 22. September 2026  
> Diese Datei wird bei jeder Änderung am System gepflegt und erweitert.

---

## Inhaltsverzeichnis

1. [Technischer Stack](#1-technischer-stack)
2. [Projektstruktur](#2-projektstruktur)
3. [Rollen & Berechtigungen](#3-rollen--berechtigungen)
4. [Ticket-Lebenszyklus](#4-ticket-lebenszyklus)
5. [Status-Modell](#5-status-modell)
6. [Ansichten (Views)](#6-ansichten-views)
7. [Kernfunktionen im Detail](#7-kernfunktionen-im-detail)
8. [SLA & Fälligkeitsdatum-Logik](#8-sla--fälligkeitsdatum-logik)
9. [Routing-Regeln & Auto-Zuweisung](#9-routing-regeln--auto-zuweisung)
10. [Serienaufträge (Routinen)](#10-serienaufträge-routinen)
11. [E-Mail-Benachrichtigungen (Brevo)](#11-e-mail-benachrichtigungen-brevo)
12. [Stale Ticket Erinnerungen](#12-stale-ticket-erinnerungen)
13. [Firebase Datenstruktur](#13-firebase-datenstruktur)
14. [Portal (öffentliche Meldeseite)](#14-portal-öffentliche-meldeseite)
15. [Kanban-Board & Ticket-Karten](#15-kanban-board--ticket-karten)
16. [In-App Benachrichtigungen (Toast-Banner)](#16-in-app-benachrichtigungen-toast-banner)
17. [Datumskalender (plattformübergreifend)](#17-datumskalender-plattformübergreifend)
18. [App-Refresh (Header)](#18-app-refresh-header)
19. [Benutzerverwaltung](#19-benutzerverwaltung)
20. [Code Splitting & Performance](#20-code-splitting--performance)
21. [Umgebungsvariablen](#21-umgebungsvariablen)
22. [Deployment (GitHub Actions)](#22-deployment-github-actions)
23. [Interner Staff-Chat](#23-interner-staff-chat)
24. [Zurückstellen (Parken)](#24-zurückstellen-parken)
25. [Änderungshistorie](#25-änderungshistorie)

---

## 1. Technischer Stack

| Schicht | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Datenbank | Firebase Firestore (Realtime Listener für aktive Tickets) |
| E-Mail | Brevo (ehemals Sendinblue) REST API v3 |
| Hosting | Firebase Hosting via GitHub Actions |
| Styling | Inline-CSS + CSS-Variablen (kein CSS-Framework) |
| Icons | Tabler Icons (`ti ti-*`) |

---

## 2. Projektstruktur

```
/
├── App.tsx                     # Hauptkomponente, alle State-Handler, E-Mail-Logik
├── firebase.ts                 # Firebase-Initialisierung
├── types.ts                    # Alle TypeScript-Typen und Enums
├── constants.ts                # PRIORITIES, STATUS_COLORS, etc.
├── components/
│   ├── Portal.tsx              # Öffentliche Meldeseite für Bewohner/Melder
│   ├── KanbanBoard.tsx         # Kanban-Board-Wrapper (3 Spalten)
│   ├── KanbanColumn.tsx        # Einzelne Kanban-Spalte mit Drag-Zonen
│   ├── TicketCard.tsx          # Ticket-Karte im Kanban/Listen-Modus
│   ├── TicketDetailSidebar.tsx # Detailansicht / Bearbeitungspanel
│   ├── FilterBar.tsx           # Filter-Chips, Gruppen-Umschalter
│   ├── TicketTableView.tsx     # Tabellenansicht (gruppiert / ungroupiert)
│   ├── ErledigtTableView.tsx   # Ansicht abgeschlossener Tickets (monatsweise)
│   ├── TechnicianView.tsx      # Mitarbeiter-Übersicht
│   ├── ReportsView.tsx         # Auswertungen / Statistiken
│   ├── RoutineSchedulesView.tsx# Serienauftrags-Verwaltung
│   ├── RoutineNachweisView.tsx # Nachweis-Ansicht für Routinen
│   ├── SettingsView.tsx        # Admin-Einstellungen
│   ├── NewTicketModal.tsx      # Modal: neues Ticket anlegen
│   ├── ToastContainer.tsx      # In-App Toast-Benachrichtigungen (Banner unten)
│   ├── Header.tsx              # App-Header mit Suche und Login
│   ├── Sidebar.tsx             # Navigation links
│   ├── DashboardRoutineLinkBar.tsx # Schnelllink zu offenen Routinen
│   └── ModernDashboard.tsx     # Dashboard-Haupt-Layout
├── utils/
│   ├── routineHelpers.ts       # Wiederholungslogik für Serienaufträge
│   ├── displayNames.ts         # Kurzname-Formatierung (Vor + Nachname-Initial)
│   ├── staffChat.ts            # Interner Chat: Lesestatus (readBy) pro Person
│   ├── brevoHealth.ts          # Brevo API-Key Prüfung + Status-Events
│   ├── routineUiPalette.ts     # Farb-Palette für Routine-Karten
│   └── rpHolidays.ts           # Rheinland-Pfalz Feiertage
└── .github/workflows/
    ├── deploy-firebase.yml     # Deploy bei Push auf main
    └── brevo-keepalive.yml     # Täglicher Keep-Alive Job (07:00 UTC)
```

---

## 3. Rollen & Berechtigungen

| Rolle | Enum-Wert | Beschreibung |
|---|---|---|
| Admin | `Role.Admin` | Vollzugriff: Tickets erstellen, bearbeiten, löschen, Einstellungen, Berichte |
| Techniker | `Role.Technician` | Eigene Tickets sehen/bearbeiten, kein Löschen, kein Einstellungszugriff |
| Hauswirtschaft | `Role.Housekeeping` | Wie Techniker, eigener Bereich |

### Zugangskontrolle
- Login per Passwort (in Firebase `app_data` gespeichert, kein Auth-Provider)
- `currentUser` State in `App.tsx` steuert alle UI-Einschränkungen
- Techniker sehen nur Tickets die ihnen zugewiesen sind (Filter wird automatisch gesetzt)
- Techniker und Hauswirtschaft können den eigenen Techniker-Filter nicht ändern

---

## 4. Ticket-Lebenszyklus

```
Erstellt (Portal / Admin)
       ↓
   [Offen]  ←──────────────────────────────────────┐
       ↓  (Bearbeiter zugewiesen)                   │
  [In Arbeit]  ←──────────────────┐                │
       ↓  (Frist überschritten)   │ (wieder öffnen) │
  [Überfällig]                    └─────────────────┘
       ↓  (Abgeschlossen)
  [Abgeschlossen] → verschoben nach completed_tickets
```

### Ticket-Typen
- **`reactive`**: Reaktives Ticket (Störungsmeldung, Reparatur) — hat SLA-gesteuerte Fälligkeitsdaten
- **`routine`**: Serienauftrag (täglich, wöchentlich, monatlich) — wird automatisch generiert

### Wichtige Ticket-Felder

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | string | Eindeutige ID (z.B. `38619`) |
| `title` | string | Betreff des Tickets |
| `description` | string | Detailbeschreibung |
| `status` | Status | Offen / In Arbeit / Überfällig / Abgeschlossen / Zurückgestellt |
| `priority` | Priority | Hoch / Mittel / Niedrig |
| `area` | string | Standort (z.B. "Hauptgebäude") |
| `location` | string | Genaue Lokation (z.B. "Zimmer 12") |
| `technician` | string | Zugewiesener Bearbeiter (Name) oder `'N/A'` |
| `dueDate` | string | Fälligkeitsdatum `DD.MM.YYYY` |
| `closedAt` | string | Abschlussdatum `YYYY-MM-DD` (für Firebase-Abfragen) |
| `entryDate` | string | Erfassungsdatum |
| `reporter` | string | Name des Melders |
| `reporter_email` | string | E-Mail des Melders (für Benachrichtigungen) |
| `notes` | string[] | Verlauf / Kommentare mit Zeitstempel |
| `hasNewNoteFromReporter` | boolean | Ungelesene Nachricht vom Melder vorhanden |
| `is_emergency` | boolean | Notfall-Markierung (erscheint immer oben) |
| `is_reopened` | boolean | Wurde Ticket nach Abschluss wieder geöffnet |
| `autoAssigned` | boolean | Wurde Bearbeiter automatisch zugewiesen |
| `wunschTermin` | string | Wunschtermin des Melders (`DD.MM.YYYY`) |
| `categoryId` | string | Kategorie-ID für SLA-Zuordnung |
| `origin` | `'portal'` \| `'manual'` | Woher das Ticket kommt |
| `ticketType` | `'reactive'` \| `'routine'` | Ticket-Typ |
| `completionDate/Time` | string | Zeitstempel der Fertigstellung |
| `reminderSentAt` | string | `YYYY-MM-DD` — Datum des letzten Stale-Erinnerungs-E-Mails (verhindert Spam) |
| `parkReminderInterval` | number | Wochen zwischen Zurückgestellt-Erinnerungen (1/2/3/4) |
| `parkReminderNextDate` | string | `YYYY-MM-DD` nächste Zurückgestellt-Erinnerung |
| `parkedAt` | string | `YYYY-MM-DD` — Zeitpunkt des Zurückstellens |
| `isNew` | boolean | `true` bis das Ticket erstmals von einem Mitarbeiter geöffnet wurde |
| `staffMessages` | StaffMessage[] | Interner Mitarbeiter-Chat (siehe Kapitel 23), unsichtbar für Melder |

---

## 5. Status-Modell

| Status | Farbe | Bedeutung |
|---|---|---|
| `Offen` | Grau | Noch nicht in Bearbeitung |
| `In Arbeit` | Blau | Bearbeiter zugewiesen, aktiv in Arbeit |
| `Überfällig` | Rot | Fälligkeitsdatum überschritten |
| `Abgeschlossen` | Grün | Fertig, in `completed_tickets` |

### Überfällig-Erkennung
- Läuft automatisch täglich beim App-Start
- Prüft alle aktiven Tickets: `dueDate < heute` → Status wird auf `Überfällig` gesetzt
- Beim Wiedereröffnen eines Überfällig-Tickets:
  - → `Offen`: neues Fälligkeitsdatum = heute + 3 Tage
  - → `In Arbeit`: neues Fälligkeitsdatum = heute + 2 Tage

---

## 6. Ansichten (Views)

| View-Key | Komponente | Beschreibung | Sichtbar für |
|---|---|---|---|
| `dashboard` | `ModernDashboard` → `KanbanBoard` | Kanban 3-Spalten (Offen/In Arbeit/Überfällig) | Admin |
| `tech-dashboard` | `ModernDashboard` → `KanbanBoard` | Kanban gefiltert auf eigene Tickets | Techniker/Hauswirtschaft |
| `tickets` | `TicketTableView` | Tabellenansicht alle aktiven Tickets | Admin |
| `erledigt` | `ErledigtTableView` | Abgeschlossene Tickets, monatsweise geladen | Admin |
| `techniker` | `TechnicianView` | Mitarbeiter-Karten mit Ticket-Zahlen | Admin |
| `reports` | `ReportsView` | Statistiken und Auswertungen | Admin |
| `routines` | `RoutineSchedulesView` | Serienaufträge verwalten | Admin |
| `routine-nachweis` | `RoutineNachweisView` | Nachweis erledigter Routinen | Admin |
| `settings` | `SettingsView` | Standorte, Benutzer, SLA, Routing | Admin |

---

## 7. Kernfunktionen im Detail

### `handleUpdateTicket(updatedTicket: Ticket)` — App.tsx

Zentrale Funktion für alle Ticket-Änderungen. Läuft in dieser Reihenfolge ab:

1. **Abwesenheitsprüfung**: Ist der zugewiesene Techniker abwesend? → Automatische Umleitung auf verfügbaren Ersatz
2. **Abschluss-Zeitstempel**: Wird auf Abgeschlossen gesetzt → `completionDate/Time` + `closedAt` werden gesetzt
3. **Fälligkeitsdatum bei Überfällig-Rücksetzung**: Wechsel von Überfällig → Offen/InArbeit → neues Datum
4. **Reaktive Due-Date-Berechnung**: Nur wenn `wunschTermin` oder `categoryId` sich ändert
5. **Prio-Anpassung bei Kategorie-Änderung**: Neue SLA-Priorität aus Matrix
6. **Abschluss-Flag**: `is_reopened = false` bei Abschluss
7. **E-Mail-Benachrichtigungen** (siehe Kapitel 11)
8. **Firestore-Synchronisation**: Ticket in richtige Collection schreiben

### `handleAddNewTicket(ticketData)` — App.tsx

Erstellt ein neues Ticket (Portal oder Admin-Modal):

1. Erkennt Kategorie automatisch via Routing-Regeln (Keyword-Match)
2. Bestimmt Priorität: Routing-Regel → Kategorie-Default → App-Default
3. Weist Bearbeiter zu via `assignTicket()` wenn kein Bearbeiter vorgegeben
4. Berechnet Fälligkeitsdatum via SLA-Matrix
5. Speichert in Firebase `tickets`
6. Sendet E-Mail an Melder (`ticket_created`)
7. Sendet E-Mail an Admin (`admin_new_ticket`) wenn Portal-Ursprung

### `handleDeleteTicket(ticketId)` — App.tsx

- Trägt Ticket-ID in Firestore `deleted-ticket-ids` Blockliste ein
- Löscht aus `tickets`, `completed_tickets` und `routine_tickets`
- Nur für Admins sichtbar

### `assignTicket(ticket, users, allTickets, routingRules)` — App.tsx

Auto-Zuweisung eines Bearbeiters:

1. Prüft alle Routing-Regeln auf **Wort-genauen** Keyword-Match (kein Substring-Match)
2. Kein Keyword-Match → `N/A` zurückgeben (kein zufälliger Fallback)
3. Bei Match: nur die in der Regel konfigurierten `assignees` als Kandidaten
4. Abwesende Mitarbeiter werden herausgefiltert
5. Wer die wenigsten aktiven Tickets hat, bekommt das neue zugewiesen

### `loadCompletedTicketsForMonth(month, year)` — App.tsx

Lädt abgeschlossene Tickets für einen bestimmten Monat aus Firebase:

1. Führt ggf. einmalige Migration durch: setzt `closedAt` aus `completionDate` bei alten Tickets
2. Fragt Firebase mit `closedAt >= YYYY-MM-01` und `closedAt < YYYY-(M+1)-01` ab
3. Filtert gelöschte Ticket-IDs heraus
4. Setzt `completedTickets` State

---

## 8. SLA & Fälligkeitsdatum-Logik

### SLA-Matrix
- Konfigurierbar in Einstellungen (`appSettings.slaMatrix`)
- Verknüpft `categoryId` + `Priority` → `responseTimeHours`
- `computeReactiveDueDateWithoutWunsch(entryDate, categoryId, slaMatrix)`:
  - Sucht strengste (kürzeste) SLA-Regel für die Kategorie
  - Rechnet Stunden auf Tage um, addiert auf Erfassungsdatum

### Wunschtermin
- Melder kann im Portal einen Wunschtermin angeben
- Hat Vorrang vor SLA-Berechnung
- Wird in `dueDate` übernommen solange kein anderer Trigger greift

### Fälligkeitsdatum-Änderungen (reaktive Tickets)
Das `dueDate` darf sich **nur** ändern wenn:

| Auslöser | Verhalten |
|---|---|
| Benutzer ändert manuell | Direkt übernommen |
| `wunschTermin` ändert sich | Neu berechnet (Wunsch oder SLA-Fallback) |
| `categoryId` ändert sich | Neu berechnet via SLA |
| Ticket war Überfällig → Status-Wechsel | Datum zurückgesetzt (Offen +3 Tage, InArbeit +2 Tage) |

Alle anderen Änderungen (Status, Techniker, Prio, Notizen) lassen `dueDate` **unberührt**.

---

## 9. Routing-Regeln & Auto-Zuweisung

Konfigurierbar in **Einstellungen → Routing-Regeln**.

### Felder einer Routing-Regel

| Feld | Bedeutung |
|---|---|
| `keyword` | Komma-getrennte Suchbegriffe (müssen als ganzes Wort vorkommen) |
| `categoryId` | Kategorie die automatisch gesetzt wird |
| `priority` | Priorität die automatisch gesetzt wird |
| `assignees` | Liste der Bearbeiter die für dieses Keyword zuständig sind |

### Ablauf bei neuen Tickets
1. Volltext (Titel + Beschreibung) wird gegen alle Regeln geprüft
2. Keyword-Matching ist **wortgenau** — `"TV"` matcht `"TV kaputt"` aber nicht `"Aktivierung"`
3. Erste Regel die zutrifft "gewinnt"
4. Kein Keyword-Match → kein automatisches Zuweisen (`N/A`)
5. Regel ohne `assignees` → kein automatisches Zuweisen (`N/A`)
6. Bearbeiter aus `assignees` wird zugewiesen (wer hat die wenigsten Tickets?)
7. `autoAssigned: true` wird gesetzt

### Wichtige Regeln
- **Kein zufälliger Fallback**: Wenn kein Keyword passt, wird niemand automatisch zugewiesen
- **Abwesenheit wird geprüft**: Abwesende Bearbeiter werden übersprungen
- **Gilt für alle Ticket-Typen**: Portal-Tickets (reactive) und manuelle Tickets laufen gleichermaßen durch die Routing-Logik

---

## 10. Serienaufträge (Routinen)

### Wiederholungstypen (`RoutineRecurrence`)

| Typ | Beschreibung |
|---|---|
| `daily` | Täglich |
| `weekly` | Wöchentlich (jede N-te Woche) |
| `weekdays` | Bestimmte Wochentage, alle N Wochen |
| `monthly` | Monatlich an festem Tag |
| `yearly` | Jährlich an Monat + Tag |

### Zuweisung (`RoutineAssignment`)

| Typ | Beschreibung |
|---|---|
| `fixed` | Immer dieselbe Person (`userName`) |
| `rotate` | Rotation durch `assignees`-Liste, Cursor in `rotationCursor` |

### Generierung
- Läuft beim App-Start und täglich
- `isNominalRoutineDay(schedule, today)` prüft ob heute ein Fälligkeitstag ist
- Generierte Routine-Tickets landen in `routine_tickets` Collection
- Nicht erledigte Routinen tauchen im Kanban auf
- Erledigte Routinen werden per `RoutineDayCompletion` protokolliert

---

## 11. E-Mail-Benachrichtigungen (Brevo)

### Technische Basis
- **API**: Brevo REST API v3 (`https://api.brevo.com/v3/smtp/email`)
- **Authentifizierung**: `VITE_BREVO_API_KEY` (Umgebungsvariable / GitHub Secret)
- **Absender**: konfigurierbar via `VITE_BREVO_SENDER_EMAIL` / `VITE_BREVO_SENDER_NAME`
- **Funktion**: `sendDrkBrevoMail(to, subject, payload)` → feuert async, blockiert UI nicht
- **Duplikat-Schutz**: Jede Kombination aus `(ticketId, kind)` wird nur 1× gesendet (localStorage-Cache)

### Brevo Keep-Alive
- GitHub Actions Cron-Job läuft täglich um **07:00 UTC (09:00 Uhr MEZ)**
- Sendet automatisch eine Test-E-Mail an `BREVO_ADMIN_EMAIL`
- Verhindert dass Brevo den Account wegen Inaktivität pausiert
- Workflow: `.github/workflows/brevo-keepalive.yml`
- Manuell auslösbar unter GitHub → Actions → Brevo Keep-Alive → Run workflow

---

### Übersicht aller E-Mail-Typen

| `kind` | Betreff | Empfänger | Auslöser |
|---|---|---|---|
| `ticket_created` | `Ihre Meldung wurde erfasst – Ticket XXXX` | Melder | Neues Ticket erstellt (Portal oder Admin) |
| `admin_new_ticket` | `Neue Meldung eingegangen – Ticket XXXX` | Admin-E-Mail | Neues Ticket aus dem Portal |
| `ticket_in_progress` | `Ihre Meldung wird bearbeitet – Ticket XXXX` | Melder | Status wechselt zu **In Arbeit** |
| `ticket_closed` | `Ihre Meldung wurde abgeschlossen – Ticket XXXX` | Melder | Status wechselt zu **Abgeschlossen** |
| `staff_note` | `Neuigkeit zu Ihrem Ticket XXXX` | Melder | Neue Notiz von Mitarbeiter (nicht vom Melder selbst) |
| `due_date_changed` | `Terminänderung zu Ihrer Meldung – Ticket XXXX` | Melder | Fälligkeitsdatum manuell geändert bei Status In Arbeit oder Überfällig |
| `custom` (Stale-Reminder) | `Erinnerung: N Tickets warten auf Bearbeitung` | Techniker | Automatisch beim App-Start wenn Tickets 5+ Tage keine Aktivität hatten |

---

### Detailbeschreibung je E-Mail-Typ

#### `ticket_created` — Eingangsbestätigung
- **Wann**: Direkt nach Anlegen eines neuen Tickets
- **Enthält**: Ticket-Nummer, Betreff, Link zum Portal-Statusbereich
- **Bedingung**: `reporter_email` muss vorhanden sein

#### `admin_new_ticket` — Admin-Benachrichtigung
- **Wann**: Neues Ticket aus dem Portal eingegangen
- **Enthält**: Ticket-Nr., Betreff, Melder, Standort, Raum/Bereich, Priorität, Eingangsdatum, Beschreibung
- **Empfänger**: Konfigurierte Admin-E-Mail-Adresse
- **Bedingung**: Nur bei `origin === 'portal'`

#### `ticket_in_progress` — Bearbeitungsstart
- **Wann**: Statuswechsel → `In Arbeit`
- **Enthält**: Bearbeiter, Standort, Priorität, voraussichtliches Fälligkeitsdatum

#### `ticket_closed` — Abschlussbestätigung
- **Wann**: Statuswechsel → `Abgeschlossen`
- **Enthält**: Ticket-Nummer, Hinweis auf Portal

#### `staff_note` — Neue Mitarbeiter-Notiz
- **Wann**: Neue Notiz wurde zum Ticket hinzugefügt
- **Enthält**: Den Notiztext
- **Bedingung**: Notiz stammt nicht vom Melder selbst

#### `due_date_changed` — Terminänderung
- **Wann**: `dueDate` hat sich geändert, Status ist `In Arbeit` oder `Überfällig`
- **Enthält**: Ticket-Nummer, Betreff, neues Fälligkeitsdatum
- **Nicht gesendet bei**: Status `Offen` (wird noch nachjustiert) oder `Abgeschlossen`

### E-Mail-Priorisierung (nur eine Mail pro Ticket-Update)

```
1. due_date_changed   → Terminänderung
2. ticket_closed      → Status Abgeschlossen
3. ticket_in_progress → Status In Arbeit
4. staff_note         → neue Mitarbeiter-Notiz
```

---

## 12. Stale Ticket Erinnerungen

### Zweck
Techniker sollen automatisch per E-Mail erinnert werden, wenn ein ihnen zugewiesenes Ticket über mehrere Tage keine Aktivität (keine Notiz, keine Statusänderung) hatte. So wird sichergestellt, dass kein Ticket vergessen wird.

### Wie es funktioniert
Die Logik läuft **einmalig beim App-Start** (sobald ein Admin eingeloggt ist und die App initialisiert ist). Sie läuft als `useEffect` in `App.tsx` mit `[isInitialized]` als Abhängigkeit.

### Schwellenwerte (in App.tsx konfigurierbar)

| Konstante | Wert | Bedeutung |
|---|---|---|
| `STALE_DAYS` | `5` | Tage ohne Aktivität, ab denen ein Ticket als „stale" gilt |
| `REMINDER_COOLDOWN_DAYS` | `3` | Mindestabstand zwischen zwei Erinnerungen für dasselbe Ticket |

### Welche Tickets werden berücksichtigt?

Ein Ticket gilt als stale (und löst eine Erinnerung aus) wenn **alle** folgenden Bedingungen zutreffen:

1. Status ist **nicht** `Abgeschlossen` und **nicht** `Zurückgestellt`
2. Ticket hat einen zugewiesenen Bearbeiter (nicht `N/A` oder leer)
3. Letzte Aktivität liegt **mindestens 5 Tage** zurück
4. Kein früheres Reminder-E-Mail in den letzten 3 Tagen (`reminderSentAt`)

### Letzte Aktivität — Berechnung
Die Funktion `getLastActivity(ticket)` bestimmt das Datum der letzten Aktion:

1. **Notizen prüfen**: Die letzte Notiz im `notes`-Array wird nach dem deutschen Datumsformat `DD.MM.YYYY` oder `DD.MM.YY` durchsucht. Wenn ein Datum gefunden wird, gilt dieses als letzter Aktivitätszeitpunkt.
2. **Fallback**: Wenn keine Notiz mit Datum vorhanden ist, wird das `entryDate` (Erfassungsdatum) des Tickets verwendet.

### E-Mail-Versand
- Tickets werden **nach Techniker gruppiert** → pro Techniker **eine einzige E-Mail** mit allen betroffenen Tickets als Tabelle
- Die E-Mail enthält: Ticket-Nummer, Betreff, Standort, Priorität, Anzahl inaktiver Tage
- Versand über Brevo (`sendDrkBrevoMailAsync`) mit `kind: 'custom'`
- Die Option `{ silent: true }` verhindert Fehler-Toast bei Netzwerkproblemen

### Mehrere E-Mail-Adressen
- Das `email`-Feld eines Benutzers unterstützt **kommagetrennte Adressen**: `torsten@drk.de, ali-weiterleitung@drk.de`
- Alle eingetragenen Adressen erhalten dieselbe Erinnerungs-E-Mail
- Sonderfall Ali: Da Ali keine eigene E-Mail hat, wird Torstens Adresse in Alis `email`-Feld eingetragen

### Spam-Schutz (`reminderSentAt`)
- Nach erfolgreichem Versand wird `reminderSentAt = YYYY-MM-DD (heute)` auf jedem erinnerten Ticket in Firestore gesetzt
- Beim nächsten App-Start wird das Feld geprüft: Ist die letzte Erinnerung weniger als 3 Tage her → kein erneuter Versand
- Bei erfolglosem Versand wird `reminderSentAt` **nicht** gesetzt → nächster Versuch beim nächsten App-Start

### Ausnahmen / wird nicht erinnert
- Abgeschlossene Tickets (`Status.Abgeschlossen`)
- Zurückgestellte Tickets (`Status.Zurueckgestellt`) — diese haben eigene Park-Reminder
- Tickets ohne zugewiesenen Bearbeiter (`N/A`)
- Techniker ohne eingetragene E-Mail-Adresse → Ticket wird übersprungen (kein Fehler)

### Einrichtung (einmalig durch Admin)
1. Einstellungen → Team → Benutzer bearbeiten
2. Feld **„E-Mail (für Ticket-Erinnerungen)"** ausfüllen
3. Mehrere Adressen mit Komma trennen: `name@drk.de, zweitname@drk.de`
4. Speichern

---

## 13. Firebase Datenstruktur

### Collections

| Collection | Lademodus | Inhalt |
|---|---|---|
| `tickets` | Live `onSnapshot` | Alle aktiven Tickets (Offen, In Arbeit, Überfällig) |
| `completed_tickets` | `getDocs` monatsweise | Abgeschlossene Tickets |
| `routine_tickets` | Live `onSnapshot` | Aktive Serienaufträge |
| `app_data` | Live `onSnapshot` | Einstellungen, Benutzer, Standorte, SLA, Routing |

### Abgeschlossene Tickets — Monatsweise Abfrage
- Kein dauerhafter Live-Listener (spart Firebase-Reads)
- Beim Öffnen der "Erledigte Tickets"-Ansicht → aktueller Monat wird geladen
- Monat und Jahr über Dropdown wählbar → neue Abfrage
- Abfragefeld: `closedAt` (Format `YYYY-MM-DD`)
- Beim Abschließen eines Tickets wird `closedAt` automatisch gesetzt
- Einmalige Migration: alte Tickets ohne `closedAt` bekommen es beim ersten Laden aus `completionDate` abgeleitet

### `app_data` Dokumente

| Dokument-ID | Inhalt |
|---|---|
| `settings` | `AppSettings` (Name, Portal-Konfig, SLA-Matrix, Routing-Regeln, Kategorien) |
| `users` | Array aller Benutzer inkl. Passwort, Rolle, Abwesenheit |
| `locations` | Array der Standorte |
| `assets` | Inventar/Assets |
| `maintenance_plans` | Wartungspläne |
| `routine_schedules` | Serienauftrags-Definitionen |
| `routine_completions` | Protokoll erledigter Routinen |
| `deleted-ticket-ids` | Blockliste gelöschter Ticket-IDs |

---

## 14. Portal (öffentliche Meldeseite)

### Zugang
- Keine Anmeldung nötig
- Admins und Techniker werden automatisch weitergeleitet wenn eingeloggt

### Funktionen

| Funktion | Beschreibung |
|---|---|
| Neue Meldung | Formular: Standort, Lokation, Betreff, Beschreibung, Foto, E-Mail, Wunschtermin |
| Status prüfen | Melder kann per Name oder E-Mail den Status seiner Meldungen einsehen |
| Ticket wieder öffnen | Abgeschlossenes Ticket kann vom Melder wiedereröffnet werden |
| Nachrichten schreiben | Melder kann Notizen/Nachrichten zu eigenem Ticket hinzufügen |

### Autocomplete für Name + E-Mail (Stand 08.09.2026)

An gemeinsam genutzten PCs an den Stützpunkten tippen viele verschiedene Mitarbeiter Tickets.
Um die Eingabe zu erleichtern, merkt sich der Browser auf jedem Gerät die bisher eingetragenen Melder.

**Verhalten:**
- Felder „Gemeldet von" und „E-Mail" starten **leer** (kein automatisches Vorausfüllen).
- Sobald mindestens 2 Zeichen im Name-Feld stehen, erscheint ein **Dropdown** mit passenden Vorschlägen
  (Name + E-Mail-Adresse darunter).
- Klick auf einen Vorschlag → **beide Felder** werden ausgefüllt.
- Tippt man danach weiter im Name-Feld, wird die E-Mail **sofort wieder geleert** — Garantie: die
  E-Mail-Adresse kann nur über einen vollständig ausgewählten Vorschlag ins Formular kommen.
- Die E-Mail kann nach der Auswahl manuell überschrieben werden.

**Liste:**
- Speicherort: `localStorage` (`REPORTER_PROFILE_KEY`), nur im Browser des jeweiligen Geräts.
- Nach jedem erfolgreichen Einreichen wird der Melder in die Liste aufgenommen (max. 100 Einträge,
  neueste zuerst, Duplikate werden aktualisiert).
- Die Liste wächst automatisch — nach ein paar Wochen kennt jeder PC die häufigsten Melder.

### Ticket-Statusanzeige im Portal
- **3-Pillen-Zeile**: Bearbeiter | Fällig bis | Status
- Jede Pille zeigt farbigen Zustand (Überfällig = Rot, In Arbeit = Blau, etc.)
- Verlauf: alle Notizen mit Zeitstempel

### Wartungsmodus
- Konfigurierbar in Einstellungen
- Zeigt anpassbare Wartungsmeldung anstatt Formular

---

## 15. Kanban-Board & Ticket-Karten

### Spalten & Sortierung
- **Offen** / **In Arbeit** / **Überfällig** — je eine Spalte
- Sortierung in allen Spalten: Notfall-Tickets zuerst, dann nach Fälligkeitsdatum aufsteigend

### Drag & Drop
- Karten nur von der **oberen Handbreite** (top 24px) ziehbar
- Cursor wechselt zu `grab` nur in dieser Zone
- Beim Ziehen erscheint eine rote Drop-Linie zwischen den Karten
- Ablegen: Status ändert sich, Position in der Spalte wird gespeichert

### Klickverhalten
- Klick auf Karten-Body → öffnet Detailpanel
- Klick auf Footer → öffnet ebenfalls Detailpanel

### Hover-Effekt
- Karte hebt sich 3px an + stärkerer Schatten → zeigt klar welche Karte aktiv ist

### Konversations-Indikator im Footer

| Anzeige | Bedeutung |
|---|---|
| Nichts | Keine Notizen vorhanden |
| 💬 **3** (grau) | Konversation hat stattgefunden (Anzahl Notizen) |
| 💬 **Neue Nachricht** (orange) | Ungelesene Nachricht vom Melder — sofort handeln |

- Orangener Punkt oben rechts neben der Ticket-Nummer zeigt ebenfalls ungelesene Melder-Nachricht an
- Beim Öffnen der Detailansicht: `hasNewNoteFromReporter` wird auf `false` gesetzt

### Datumskalender (plattformübergreifend)
- Unsichtbarer `<input type="date">` liegt über der Datums-Pille (`opacity: 0`, `pointer-events: auto`)
- `showPicker()` wird als Fallback beim Klick aufgerufen
- Funktioniert auf macOS Safari, Chrome und Windows zuverlässig

---

## 16. In-App Benachrichtigungen (Toast-Banner)

### Position & Verhalten
- Erscheint **unten in der Mitte** des Bildschirms
- Verschwindet automatisch nach **8 Sekunden** (Fortschrittsbalken sichtbar)
- Kann manuell per ✕ geschlossen werden
- Mehrere Toasts stapeln sich übereinander

### Toast-Typen

| Typ | Farbe | Auslöser |
|---|---|---|
| `new-ticket` | Rot | Neues Ticket eingegangen (nur für Admins) |
| `assigned` | Blau | Ticket wurde dem eingeloggten Techniker zugewiesen |

### Inhalt bei neuer Meldung
```
🔔 Neue Meldung eingegangen
38619: Kartoffelschäler · Küche · Zugewiesen: Heiko
```

### Browser-Benachrichtigungen
- Zusätzlich zu Toasts werden Browser-Notifications gesendet (wenn Berechtigung erteilt)
- Berechtigung wird beim ersten Login angefragt

---

## 17. Datumskalender (plattformübergreifend)

- Unsichtbarer `<input type="date">` liegt über der Datums-Pille
- `pointer-events: auto` → Input fängt Klicks direkt ab
- `showPicker()` als Fallback für Windows-Browser
- Browser steuert Öffnen/Schließen nativ — kein manuelles State-Tracking

---

## 18. App-Refresh (Header)

### Zweck
Die App kann sich in seltenen Fällen aufhängen (veraltete Daten, hängender Listener, PWA-Cache). Der Refresh-Button gibt Benutzern eine einfache Möglichkeit, die App komplett neu zu laden — ohne Browser-Adressleiste oder Tastaturkürzel kennen zu müssen.

### Position & Aussehen
- **Immer sichtbar** oben rechts im Header, auf jeder Seite der App
- Design: kleiner Icon-Button (↻ Kreispfeil) mit gleichem Stil wie andere Header-Elemente
- Hover: Hintergrund + Rahmen heben sich hervor

### Verhalten beim Klick
1. Das Pfeil-Icon dreht sich einmal (400ms CSS-Animation) — visuelles Feedback
2. Nach 400ms: `window.location.reload()` → komplette Seite wird neu vom Server geladen
3. Alle Daten werden frisch aus Firebase geladen, kein Cache-Problem mehr

### Technische Details
- Implementiert in `components/Header.tsx`
- State `isRefreshing` steuert die CSS-Klasse `.spinning` für die Rotation
- `window.location.reload()` ohne Parameter → lädt aktuelle URL neu (kein Hard-Reload nötig, Firebase lädt immer frisch)

---

## 19. Benutzerverwaltung

### Benutzer-Felder

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | string | Eindeutige ID |
| `name` | string | Vollständiger Name (wird für Ticket-Zuweisung verwendet) |
| `role` | Role | `admin` / `techniker` / `hauswirtschaft` |
| `password` | string | Klartext-Passwort (in Firebase `app_data/users`) |
| `isActive` | boolean | Inaktive Benutzer werden nicht angezeigt |
| `skills` | string[] | Kompetenzen (kommagetrennt eingeben) |
| `availability.status` | AvailabilityStatus | `Verfügbar` / `Abwesend` |
| `availability.leaveUntil` | string \| null | Abwesenheitsende `YYYY-MM-DD`; automatisch `null` wenn Status = Verfügbar |
| `color` | string | Hex-Farbe des Avatar-Kreises (z.B. `#E91E8C`) |
| `email` | string | E-Mail-Adresse(n) für Ticket-Erinnerungen — mehrere mit Komma trennen |

### Verfügbarkeit
- Wird auf `Abwesend` gesetzt + Datum eingetragen → Benutzer bekommt keine neuen Tickets automatisch zugewiesen
- Routing-Logik und `assignTicket()` überspringen abwesende Mitarbeiter
- **Wenn Verfügbarkeit zurück auf „Verfügbar"** gesetzt wird: das `leaveUntil`-Datum wird automatisch geleert (sowohl in der Anzeige als auch beim Speichern nach Firebase)

### E-Mail-Feld
- Sichtbar in **Einstellungen → Team → Benutzer bearbeiten**
- Freitext, kein striktes Einzel-Mail-Format — kommagetrennte Mehrfach-Adressen möglich
- Wird ausschließlich für automatische Stale-Erinnerungen genutzt (kein Pflichtfeld)
- Beispiel: `torsten@kv-vorderpfalz.drk.de, ali-weiterleitung@kv-vorderpfalz.drk.de`

### Avatar-Farbe
- Wird über **Bearbeiten** geändert (Feld im UserModal). Der frühere kleine Inline-Farbpunkt rechts neben dem Namen in der Liste wurde entfernt (17.06.2026).

### Login & Passwörter ⚠️
- Login prüft das **Klartext-Passwort** im `users`-Datensatz (`facility-management-users`); **Name case-insensitive**, Passwort exakt (`components/Portal.tsx`).
- Fest angelegte Konten: `admin` (Rolle admin), `Heiko Saupert`/`Heiko1`, `Ali Najafi`/`Ali1`, `Torsten Isselhard`/`Torsten1`.
- Ein Init-Effekt in `App.tsx` (~Z.1578) **normalisiert die Namen** dieser Konten (Tickets referenzieren die vollen Namen — **nicht aufweichen**) und **setzt das Passwort nur, wenn keines vorhanden ist**.
- **Eigene Passwörter bleiben erhalten** (seit 17.06.2026). `admin`/`admin` funktioniert nur, solange das Admin-Passwortfeld leer ist (Fallback).
- **Recovery bei vergessenem Passwort:** Passwortfeld des Kontos in Firestore (`facility-management-users`) leeren → beim nächsten Laden greift wieder der Default. Es gibt **kein** eingebautes „Passwort vergessen?" (bewusste Entscheidung — kleines internes Tool).
- **Empfehlung:** privates Admin-Passwort vergeben und sicher notieren, da `admin/admin` teamweit bekannt ist.

---

## 20. Code Splitting & Performance

### Bundle-Aufteilung (Vite `manualChunks`)
Konfiguriert in `vite.config.ts`. Der initiale JavaScript-Bundle wurde von **1.570 KB auf 441 KB** reduziert (−72%).

| Chunk-Name | Inhalt | Größe (gzip) |
|---|---|---|
| `vendor-react` | React, ReactDOM, Scheduler | ~46 KB |
| `vendor-firebase` | Firebase App, Firestore, Functions | ~110 KB |
| `vendor-framer` | Framer Motion (Animationen) | ~40 KB |
| `vendor-pdf` | jsPDF, html2canvas, DOMPurify, StackBlur | ~190 KB |
| `main` | App-eigener Code | ~103 KB |
| `index.es` | Vite-Einstiegspunkt | ~50 KB |

### Warum ist das wichtig?
- Browser lädt beim ersten Besuch alle Chunks parallel
- Bei App-Updates muss nur der geänderte Chunk neu geladen werden (nicht alles)
- `vendor-pdf` wird nur geladen wenn PDF-Funktionen genutzt werden — spart initiale Ladezeit

---

## 21. Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `VITE_BREVO_API_KEY` | Ja | Brevo API-Schlüssel für E-Mail-Versand |
| `VITE_BREVO_SENDER_EMAIL` | Nein | Absender-Adresse (Standard: `noreply@drk-ticket.de`) |
| `VITE_BREVO_SENDER_NAME` | Nein | Absendername (Standard: `DRK Serviceportal`) |
| `BREVO_ADMIN_EMAIL` | Ja* | Empfänger der täglichen Keep-Alive Test-Mail |

*Nur als GitHub Secret benötigt, nicht im Frontend

---

## 22. Deployment (GitHub Actions)

### Deploy-Workflow (`deploy-firebase.yml`)
- Trigger: jeder Push auf `main` oder manuell
- Schritte: TypeScript-Lint → Vite-Build → Firebase Hosting Deploy
- Benötigte Secrets: `FIREBASE_SERVICE_ACCOUNT_DRK_FACILITY`, `VITE_BREVO_API_KEY`

### Brevo Keep-Alive (`brevo-keepalive.yml`)
- Trigger: täglich 07:00 UTC (09:00 Uhr MEZ) oder manuell
- Sendet Test-E-Mail via Brevo API um Account-Inaktivität zu verhindern
- Bei Fehler schlägt der Job fehl → sichtbar in GitHub Actions

---

## 23. Interner Staff-Chat

### Zweck
Mitarbeiter (Admin, Techniker, Hauswirtschaft) können sich **pro Ticket** intern Nachrichten schreiben — z. B. Absprachen zur Bearbeitung. Diese Nachrichten sind **nur für Mitarbeiter sichtbar** und erscheinen **nie** im Portal beim Melder. So wird der „Verlauf" (geht an den Melder) klar vom internen Austausch getrennt.

### Abgrenzung zum „Verlauf"

| | Interner Chat | Verlauf (`notes`) |
|---|---|---|
| Sichtbar für Melder | ❌ Nein | ✅ Ja (Portal) |
| E-Mail an Melder | ❌ Nein | ✅ Ja (`staff_note`) |
| Speicherort | `Ticket.staffMessages` | `Ticket.notes` |
| Lesestatus | pro Person (`readBy`) | — |

### Datenmodell (`StaffMessage`)

| Feld | Typ | Bedeutung |
|---|---|---|
| `text` | string | Nachrichtentext |
| `author` | string | User-Name des Absenders |
| `timestamp` | string | ISO-Zeitstempel |
| `readBy` | string[] | User-Namen, die gelesen haben (Absender zählt sofort als gelesen) |

### Bewusst KEINE E-Mails
Der interne Chat verschickt **absichtlich keine E-Mails**. Der Hinweis auf neue Nachrichten erfolgt ausschließlich in der App:
- **Toast + Browser-Benachrichtigung** beim Empfang einer fremden Nachricht
- **Farbiges Chat-Symbol / Pille** auf der Ticket-Karte

> Hinweis: Eine frühere Variante verschickte Brevo-Mails und nutzte ein einzelnes `hasNewStaffMessage`-Flag. Das wurde **bewusst** durch das `readBy`-Modell ersetzt (kein Mail-Spam, Lesestatus pro Person). Bitte nicht wieder auf Mail-Versand / `hasNewStaffMessage` umstellen.

### Lesestatus pro Person (`readBy`)
- Beim Senden trägt sich der Absender automatisch in `readBy` ein.
- Beim Öffnen der Ticket-Detailansicht werden alle fremden Nachrichten für die angemeldete Person als gelesen markiert (`markStaffMessagesRead` in `utils/staffChat.ts`).
- `getStaffChatState(ticket, me)` liefert den Zustand aus Sicht der Person:

| Zustand | Bedeutung | Karten-Pille |
|---|---|---|
| `none` | Keine Nachrichten | (keine) |
| `unread` | Ungelesene fremde Nachricht | Indigo „Chat" + Punkt neben Ticket-Nr. |
| `awaiting` | Ich war zuletzt dran, warte auf Antwort | Umrandete „Chat"-Pille |
| `quiet` | Chat vorhanden, nichts offen | Graue „Chat"-Pille |

### UI
- **Zwei getrennte Kanäle** in der Detailansicht: oben der lila **„Interner Chat"** (einklappbar, Zähler, „nur das Team"), darunter die bernstein **„Konversation mit dem Melder"** (= `notes`/Verlauf). Eigene farbige Kopfbänder machen sofort klar, was intern bleibt und was an den Melder geht.
- **Sprechblasen im WhatsApp-Stil**: jede Nachricht in der **Farbe ihres Absenders** (getönte Blase + Avatar + Name aus `User.color`); eigene gefüllt rechts, fremde links. Enter = senden, Shift+Enter = neue Zeile.
- **Feste Höhe + Auto-Scroll**: beide Bereiche scrollen intern (Chat max. 300 px, Melder max. 260 px); die neueste Nachricht steht unten und ist beim Öffnen sichtbar, für ältere nach oben scrollen.

### Dateien
- `utils/staffChat.ts` — `getStaffChatState`, `markStaffMessagesRead`
- `components/TicketDetailSidebar.tsx` — Chat-UI + Lesebestätigung
- `components/TicketCard.tsx` — Karten-Indikator (Punkt + Pille)
- `App.tsx` — Toast/Browser-Benachrichtigung beim Empfang (kein Mail-Versand)

---

## 24. Zurückstellen (Parken)

Ein Ticket kann **zurückgestellt** werden (Status `Zurückgestellt`), wenn es vorübergehend nicht bearbeitet werden kann (z. B. Bearbeiter im Urlaub, Wartezeit auf Material).

### Wege zum Zurückstellen
- **Detailansicht** → Button „Zurückstellen" → Dialog: Erinnerung in 1 / 2 / 3 / 4 Wochen **oder** „Ohne Erinnerung zurückstellen".
- **Karten-Status-Dropdown** → „Zurückgestellt" direkt wählbar (Ein-Klick). `parkedAt` wird dabei automatisch auf heute gesetzt.

### Verhalten
- Zurückgestellte Tickets werden von der **Überfällig-Erkennung übersprungen** — sie kippen nicht auf „Überfällig", solange sie geparkt sind.
- Sie lösen **keine** Stale-Erinnerungen aus (siehe [Kapitel 12](#12-stale-ticket-erinnerungen)), sondern haben eigene Park-Erinnerungen.
- Gesetzte Felder: `parkedAt`, `parkReminderInterval` (entfällt bei „ohne Erinnerung"), `parkReminderNextDate`. Datumsanzeige im deutschen Format `DD.MM.YYYY`.
- **„Wieder in Arbeit"** hebt das Zurückstellen auf.

---

## 25. Änderungshistorie

### 21.09.2026 – Abschluss gegen verspätete Schreibvorgänge abgesichert

- Ursache im Code: aktive Tickets wurden mit unbedingtem `setDoc` gespeichert; getrennte Archivierung/Löschung ließ andere Geräte entfernte Aufträge erneut anlegen. Zusätzlich wurden zufällige Ticketnummern ohne Kollisionsprüfung vergeben.
- `utils/ticketPersistence.ts`: Transaktionen prüfen aktuellen Serverstand und Archiv, übernehmen nur tatsächlich geänderte Felder und verschieben Abschluss/Wiederöffnung atomar. Automatische Updates dürfen keine fehlenden aktiven Dokumente neu anlegen. `lifecycleRevision` schützt vor alten Änderungen aus einem früheren Öffnungszyklus.
- Neue Nummern werden gegen aktive Tickets, Routinen, Archiv und Löschliste geprüft. Erfolgsmeldungen und Melder-E-Mails folgen erst nach bestätigtem Speichern. Portal, Veranstaltungen und Serienerzeugung warten deshalb auf die bestätigte Ticketnummer.
- Sammelabschluss nutzt denselben geprüften Speicherweg; keine Schreibaktionen mehr innerhalb seiner React-State-Updater.
- `firestore.rules`: serverseitiger Schutz gegen das Wiederanlegen aktiver Tickets mit vorhandener Archivkopie. Alte Abschlussabläufe bleiben zulässig; absichtliches Wiederöffnen erfolgt atomar. Einzelnes Löschen des Archivs ist nur bei Wiederöffnung oder gesetzter Löschmarkierung erlaubt. Bestehendes Berechtigungs-/Loginmodell bleibt erhalten.
- Tickets 37177 und 31811 ausschließlich gelesen: beide am 21.09.2026 bereits wieder im Archiv, keine aktive Kopie. Die historischen Verursacher sind aus diesen aktuellen Dokumenten nicht beweisbar. Keine produktiven Ticketdaten verändert.
- Verifikation: 13 Integrationstests im lokalen Firestore-Enterprise-Emulator (konkurrierende Clients, alte App-Schreibvorgänge, Nummernkollisionen, abgelehnter Archivschreibvorgang, Wiederöffnung, Löschung und Erhalt neuer Nachrichten), TypeScript-Prüfung und Produktionsbuild sowie serverseitige Regelkompilierung im Dry-Run.
- Tests: `firebase emulators:start --only firestore --project demo-drk-ticket-regression --config firebase.test.json`, anschließend `npm run test:ticket-persistence`. Java 21+ und Firebase CLI erforderlich. Tests löschen ausschließlich die lokale Demo-Testdatenbank.
- Rollout: Hosting über vorhandenen GitHub-Workflow; Regeln zusätzlich mit `firebase deploy --only firestore:rules --project drk-facility-dashboard`. Geöffnete Apps neu laden, damit die atomare Wiederöffnung verwendet wird. Regeln verhindern die Wiederbelebung auch aus alten Clients; keine vollständige Überarbeitung der bestehenden Zugriffssicherheit.


| Datum | Änderung |
|---|---|
| 21.06.2026 | **Rückkehr löst keine automatische Umverteilung mehr aus** (`App.tsx` ~Z.1799): Nutzer-Wunsch — kommt ein abwesender Mitarbeiter zurück, werden ihm Aufträge **manuell** zugewiesen. Die frühere Rückkehr-Lastverteilung (zog bei Rückkehr offene Tickets noch abwesender Kollegen automatisch an den Rückkehrer) wurde **entfernt**. **Unverändert** bleiben: Abwesenheits-Umverteilung an Kollegen (Schritt 1), der Schutz zurückgestellter/abgeschlossener Tickets (`canRedistribute`), und die „wartet auf Rückkehr"-Automatik (`parkedForReturnOf` — bewusst Abwesenden zugewiesene Tickets kommen bei Rückkehr zurück). Vor Umsetzung mit dem Nutzer abgeklärt (beide Sonderfälle bestätigt). Verifikation: `tsc` grün, bewusst kein Live-Test (Umverteilung mutiert echte Tickets). |
| 21.06.2026 | **Vergessene Serienaufträge: falsche „19 vergessen"-Meldung nach Tageswechsel behoben** (`App.tsx` `missedRoutinesSinceStart`): Nach dem Wechsel auf den 21.06. meldete der Warnblock **19 abgehakte (also erledigte) Serienaufträge fälschlich als „vergessen"**. Ursache: Routine-Tickets bekommen ihr `dueDate` per **SLA-Regel ab Erstelltag** (`handleAddNewTicket` ~Z.2700) — meist **1 Tag nach dem Plantag** (Wochenplan). Der Board-Haken schreibt den Erledigt-Eintrag aber auf den **Tag des Abhakens** (`handleRoutineDayComplete` ~Z.2217, `localISODate(new Date())`), also den Plantag. Der Warnblock verglich `completion.date >= dueDate` → ein am Plantag (z. B. Fr 19.06) gesetzter Haken fiel gegen `dueDate` 20.06 als `19.06 >= 20.06 = false` durch → erledigter Auftrag wurde als „vergessen" gezählt. Auffällig wurde es erst, als am 21.06 ein ganzer Schwung 20.06-Tickets gleichzeitig überfällig kippte. **Fix:** Abgleich jetzt gegen den **Plantag des Tickets (`entryDate`)** statt gegen `dueDate` (`c.date >= entryIso`). Deckt den Haken korrekt ab und blendet keine fremde Vorwochen-Erledigung ein (`date < entryDate` zählt nicht). Verifiziert via HMR auf den geladenen Live-Daten: Warnblock **19 → 0**. **Wichtig: nicht wieder gegen `dueDate` prüfen** — das SLA-`dueDate` weicht systematisch vom Plantag ab. (Kein Zusammenhang mit der SERIEN-Menü-Umgruppierung — die fasste nur `Sidebar.tsx` an.) |
| 21.06.2026 | **Scroll-Haken in der Abgeschlossen-Ansicht behoben** (`components/ErledigtTableView.tsx`, `index.css`, `App.tsx`): Ein vorangegangener Versuch, der Tabelle einen eigenen vertikalen Scrollbereich zu geben (`overflow:auto` + `max-height: calc(100vh - 13rem)` + `position:sticky` auf `th`), erzeugte zwei verschachtelte Scroller (Tabellen-Container innerhalb des scrollenden `main`). Das führte zu typischem *scroll chaining*: beim Erreichen der Containerkante stockte der Scroll kurz, bevor der äußere Bereich übernahm — das spürte sich wie „hängt" an. Gelöst durch Zurücknahme: die Tabelle hat **keinen eigenen vertikalen Scroll** mehr (`overflow-x: auto` für schmale Fenster bleibt als Notfall-Schutz), der `sticky`-Kopf ist entfernt. **Vertikal scrollt ausschließlich `main`** (ein Scrollbereich, flüssig). Gleichzeitig verbessert: der Auto-Hide-Balken auf `main` ist jetzt **9px**, kräftiger (`rgba(0,0,0,0.4)`), abgerundet (`border-radius:10px`, `border:2px solid transparent` für optische Schmalheit), Dark-Mode-unterstützt, und bleibt nach dem Scrollen **1,2 s** statt 0,9 s sichtbar. Firefox-Unterstützung via `scrollbar-color`. |
| 21.06.2026 | **Abgeschlossen-Tabelle: Auto-Hide-Scrollbalken** (`components/ErledigtTableView.tsx`): Vorangegangener Versuch scheiterte an der globalen `display:none`-Regel (alle Balken ausgeblendet) und der falsch gewählten Achse (nur `overflow-x`, nie sichtbar auf breitem Monitor). Endgültige Lösung: kein eigener Container-Scroll — der verbesserte `main`-Balken erscheint beim Scrollen und bleibt kurz sichtbar, danach verschwindet er. Gilt für alle Ansichten gleichzeitig. |
| 20.06.2026 | **Eigene Menü-Sektion „SERIEN"** (`components/Sidebar.tsx`): Serienaufträge + Serien-Nachweis aus „Übersicht" herausgelöst in einen eigenen Abschnitt „SERIEN". Trennt geplante/wiederkehrende Arbeit von den reaktiven Ad-hoc-Ticket-Ansichten (Dashboard/Liste/Zurückgestellt/Abgeschlossen). Nur Gruppierung (`NavSection` um `'serien'` erweitert, `SECTION_HEADING.serien='Serien'`, die zwei Items auf `section:'serien'`); keine Funktions-/Routing-Änderung. |
| 20.06.2026 | **Menü-Icons korrigiert** (`components/Sidebar.tsx`): „Neues Ticket" → `ti-clipboard-plus` (Klemmbrett + Plus = neuer **Auftrag**; ein „Ticket" ist hier ein Wartungsauftrag, kein Eintritts-/Bon-Ticket — das zwischenzeitliche `ti-ticket` als Eintrittskarte war falsch). „Abgeschlossen" → `ti-circle-check` (Haken im Kreis statt Uhr, die eher „Verlauf/wartend" suggerierte). Ungenutztes `TicketPlusIcon` entfernt. |
| 20.06.2026 | **Sidebar-Fußzeile: drei Icons bündig & gleich groß** (`components/Sidebar.tsx`): Die drei Icons unten (Aktualisieren 🔄, E-Mail-Link ↗, Theme-Mond 🌙) standen unterschiedlich (E-Mail-Link 13px statt 15px und ~6px weiter rechts). Jetzt alle **15px** (Mond-Größe) und an derselben rechten Kante ausgerichtet: Refresh-Button-Padding `4px→0.4rem` (wie `.theme-toggle`), E-Mail-Link-Icon `fontSize 13→15` + `paddingRight:0.4rem`. Per DOM-Messung bündig (~205px) und gleich hoch. |
| 20.06.2026 | **Glocken-Knopf optisch an die Filterleiste angepasst** (`components/MessageInbox.tsx`): Der vollflächig rote Knopf wirkte zu laut neben den zurückhaltenden Filter-Bedienelementen. Jetzt heller Knopf in **derselben Formensprache** (`var(--bg-tertiary)`, `1px solid var(--border)`, `border-radius:9px`, Höhe 36 — wie `.custom-select`); **Rot nur noch als Akzent** (Glocken-Icon + Zähler `#DC2626`), keine Vollfläche mehr. Umsetzung jetzt über eigene Klasse `.msg-inbox-btn`, die `.custom-select` 1:1 spiegelt (per DOM-Messung **identisch**: 36px, gleicher Hintergrund/Rand/Ecken); störender Browser-**Fokus-Ring entfernt** (`:focus{outline:none}`, nur `:focus-visible` zeigt dezenten Ring). **Dropdown-Icons solide eingefärbt** (Chat `#6366f1`, Melder `#F97316`, weißes Icon) — genau wie die Karten-Pillen (`mini-pill--staff-unread`/`--msg-unread`), statt zuvor zart getönt. |
| 20.06.2026 | **Glocke zählt Chat + Melder getrennt; Banner-Phantom behoben** (`components/MessageInbox.tsx`, `App.tsx`): (1) Hatte ein Ticket gleichzeitig einen ungelesenen Chat **und** eine Melder-Nachricht, zeigte die Glocke nur „1 neu" mit Chat-Icon — die Melder-Nachricht wirkte verschluckt. Jetzt ist jede Nachricht ein **eigener Eintrag** (Chat blau / Melder orange), der Zähler nennt die **echte Anzahl** (Ticket mit beidem = 2). (2) Der Admin-Banner „X neue Meldung wartet auf Bearbeiter-Zuweisung" zählte über `is_reopened` auch **wiedereröffnete, aber bereits zugewiesene** Tickets → „wartet auf Zuweisung" ohne sichtbares unzugewiesenes Ticket. `newMeldungenCount` zählt jetzt nur Tickets **ohne** Bearbeiter (`unassigned && (Offen || is_reopened)`). |
| 20.06.2026 | **Neue-Nachrichten-Signal überarbeitet: Benachrichtigungs-Glocke statt verstreuter Signale** (`components/MessageInbox.tsx` NEU, `FilterBar.tsx`, `App.tsx`, `Sidebar.tsx`): Bisher meldeten zwei „X neu"-Pillen oben (Chat blau / Melder orange) **plus** ein Chat-Sprechblasen-Icon im orangen „Zurückgestellt"-Badge der Sidebar neue Nachrichten. Problem: Das Signal zeigte nicht, **WO** (welches Ticket) die Nachricht liegt — und zurückgestellte Tickets sind vom Board ausgeblendet, daher wirkte „neuer Chat" wie ein Phantom (war aber ein echter ungelesener Chat auf einem geparkten Ticket; Chat-Logik in `utils/staffChat.ts` geprüft und korrekt). Neu: eine **Benachrichtigungs-Glocke** (`MessageInbox`) oben in der Filterleiste mit aufklappbarer **Liste** aller Tickets mit neuer Aktivität — je Zeile Ticket-Nr., Titel, Art (Chat = blaues Icon, Melder = oranges Icon) und „zurückgestellt"-Etikett; **Klick öffnet das Ticket direkt** (`onOpenTicket` → `setSelectedTicket`). Dropdown als Portal am `<body>` (wird nicht von `overflow:hidden`-Containern abgeschnitten). Datengrundlage unverändert (`messageActivityTickets`). Das **Sidebar-Badge „Zurückgestellt" zeigt wieder NUR die orange Anzahl** — kein Chat-Icon/Signal mehr; `parkedChatActive`/`parkedReporterActive` entfernt. **Glocken-Knopf** in Signalfarbe **rot** (`#DC2626`, Nutzer-Wunsch „rot ist besser"; teilt sich den Farbton mit Überfällig, ist als Glocke aber eindeutig; die Listen-Icons bleiben blau=Chat / orange=Melder). **Techniker/Hauswirtschaft sehen in der Glocke nur ihre eigenen (zugewiesenen) Tickets**, Admin sieht alle (`messageActivityTickets`-Filter in `App.tsx`). |
| 20.06.2026 | **Firestore-Lesekosten drastisch gesenkt (Quota-Fix)** (`App.tsx`): Hintergrund — die App lief in „Free daily read units exceeded", weil sie bei **jedem Laden** und **jedem Monatswechsel** die **komplette, unbegrenzt wachsende `completed_tickets`-Sammlung mehrfach voll las** (Dashboard zeigte ~44k–62k Reads/Tag, davon nur ~29k „Echtzeit"). Ursache waren zwei alte Einmal-Migrationen, die zur Prüfung die ganze Historie einlasen: (1) `fetchData` mit `Promise.all([getDocs(tickets), getDocs(completed_tickets), getDocs(routine_tickets)])` + Verschiebe-/Ghost-Cleanup-Logik; (2) `loadCompletedTicketsForMonth` Schritt 1 (`closedAt`-Backfill). Beide sind längst durchgelaufen (neue Tickets bekommen `closedAt` beim Schließen, completed/routine landen direkt in ihren Sammlungen). **Fix:** beide hinter einen **Einmal-Schalter** gelegt — app_data-Dokument `data-migrations-v1` (`APP_DATA_KEY_MIGRATIONS_DONE`) + Ref `migrationsDoneRef`. Solange nicht gesetzt, laufen die Migrationen **einmal** und setzen danach das Flag; bei allen weiteren Ladevorgängen werden die Voll-Scans **übersprungen**. Der initiale Monats-Load wurde in den `finally`-Block von `fetchData` verschoben, damit der Schalter vorher feststeht. Aktive/offene Tickets kommen weiterhin live über die `onSnapshot`-Listener (klein). **Recovery:** app_data-Dokument `data-migrations-v1` in Firestore löschen → Migrationen laufen einmalig erneut. Hinweis: Die App-DB ist die AI-Studio-Datenbank `ai-studio-e01f0d33-…` (Label „GEMEINSAMES KI-KONTINGENT") mit hartem Tageslimit, NICHT über Blaze abgedeckt — daher der harte Block trotz Blaze-Plan |
| 18.06.2026 | **Serienauftrag: Info-E-Mail bei Erledigung** (`types.ts`, `RoutineEditorModal.tsx`, `App.tsx`): Pro Serienauftrag kann jetzt eine **`notifyEmail`** (mehrere mit Komma) hinterlegt werden (Feld „Info-E-Mail bei Erledigung" im Editor). Sobald der Auftrag für den Tag **vollständig** abgehakt ist (ohne Unteraufgaben: der Kreis; mit Checkliste: die letzte Unteraufgabe), geht still eine Brevo-Mail an diese Adresse(n) – Inhalt: Auftrag, Datum, Bereich, „Erledigt von". Dedupe pro Auftrag+Tag über `appSettings.routineNotifySent` (Key `scheduleId|YYYY-MM-DD`); beim Zurücknehmen des Hakens wird der Marker gelöscht → erneute Erledigung benachrichtigt wieder. Logik in `handleRoutineDayComplete` + `handleToggleRoutineSubtask` (Helfer `maybeBuildRoutineDoneNotify`); der Nachweis-Korrektur-Tool löst bewusst KEINE Mail aus |
| 18.06.2026 | **Serienaufträge-Liste optisch beruhigt** (`RoutineSchedulesView.tsx`): Drag-Griff (umrandeter ⋮⋮-Kasten) **entfernt** (Reihenfolge-per-Ziehen entfällt); Gruppen-Überschriften als ruhige **graue Bänder** (linker grauer Akzentbalken, graues Label + Zähler-Chip); **kompaktere Zeilen** (Padding 1rem→0.55rem); Namen in „Zuständig" in **normaler Textfarbe** statt Grün; „Rotation:"-Zeile kleiner/leiser; Spaltenbreiten ausgewogen (Aufgabe 30%, damit lange Namen einzeilig passen) |
| 18.06.2026 | **Prioritäts-Pillen einheitlich breit** (`ErledigtTableView.tsx`, `ZurückgestelltView.tsx`, `TicketTableView.tsx`): `.priority-pill` bekommt `min-width: 72px` + `box-sizing: border-box`, damit Hoch/Mittel/Niedrig in allen Tabellen-Ansichten (Abgeschlossen, Zurückgestellt, Listenansicht) gleich breit sind statt sich an die Textlänge anzupassen. Kanban-Karten (`TicketCard` `.pill`) bewusst unangetastet (eigenes Layout) |
| 18.06.2026 | **E-Mail-Link öffnet Ticket SOFORT + findet alle Tickets** (`components/Portal.tsx`): Bisher zeigte der Status-Link aus der E-Mail oft „Ticket wurde nicht gefunden", obwohl die Nummer stimmte; erst nach „zurück + Status prüfen" ging es. Zwei Ursachen behoben: (1) **Abgeschlossene Tickets** werden nicht live ins Portal geladen → wurden bei der Suche nie gefunden. (2) Der Deep-Link rastete „nicht gefunden" **dauerhaft** ein, wenn das Ticket beim ersten Laden noch nicht im Speicher war. Neu: zentraler Resolver `resolveTicketById` — erst im Speicher (sofort), sonst **direkt aus Firestore** (`tickets` / `routine_tickets` / `completed_tickets`, alle `allow read: if true`). Funktioniert ohne Warten auf die Realtime-Listener und findet auch abgeschlossene Tickets. Manuelle „Status prüfen"-Eingabe nutzt denselben Resolver. Bug am Rande gefixt: das alte cancel-on-cleanup-Muster wurde von React-StrictMode abgebrochen → Spinner hing; jetzt Ref-Guard (`deepLinkStarted`), einmalige saubere Auflösung |
| 18.06.2026 | **Vergessene Serienaufträge: Board-Haken zählt jetzt** (`App.tsx` `missedRoutinesSinceStart`): Der rote Warnblock („X Serienaufträge wurden vergessen") blieb stehen, obwohl die Aufgabe im Serienaufträge-Board abgehakt war — weil Block (Ticket-`Status.Ueberfaellig`) und Board-Haken (`routineDayCompletions`, Zeitplan+Tag) zwei getrennte Datentöpfe sind. Jetzt blendet der Block jeden Auftrag aus, für den ein Erledigt-Eintrag desselben Zeitplans am Fälligkeitstag **oder später** (verspätet abgehakt) existiert. Keine Status-Mutation, reine Anzeige-Logik |
| 17.06.2026 | **SICHERHEIT – Login/Passwörter** (`App.tsx` ~Z.1578): Der Init-Effekt setzte bei jedem Laden Name **und** Passwort der fest angelegten Konten (admin/Heiko/Ali/Torsten) zwangsweise auf Defaults zurück → ein selbst vergebenes Admin-Passwort ging beim Reload verloren (Lockout). Jetzt: **Name** wird weiter normalisiert (Tickets referenzieren ihn), **Passwort** nur gesetzt, wenn keines vorhanden ist. `admin/admin` ist nur noch Fallback, sobald das Passwortfeld leer ist. **Recovery bei vergessenem Passwort:** Passwortfeld in Firestore (`facility-management-users`) leeren → Default greift wieder. Kein eingebautes „Passwort vergessen?" (bewusste Entscheidung) |
| 17.06.2026 | **Serienaufträge-Board – „Heute"-Spalte zeigt letzten Termin** (`RoutineSchedulesView.tsx`): Aufgaben, die heute nicht fällig sind (z. B. Dienstags-Routine an einem Mittwoch), zeigten nur „—" und wirkten unerledigt. Jetzt wird der **letzte fällige Termin (≤ heute)** mit demselben Kreis-+-Haken-+-Name-System angezeigt (Datum im Tooltip); nicht erledigt = „—". Heute fällige Aufgaben unverändert (klickbarer Kreis) |
| 17.06.2026 | **Serien-Nachweis aufgeräumt** (`RoutineNachweisView.tsx`): redundanter „Verlauf"-Streifen im aufgeklappten Auftrag entfernt; stattdessen **Jahresübersicht** (12 Monatskärtchen, Fälligkeitstage farbcodiert) + **Farb-Legende** (erledigt/teilweise/verpasst/geplant) |
| 17.06.2026 | **Einstellungen: „Serientermine"-Tab entfernt** (`SettingsView.tsx`): redundant, da Erstellen/Bearbeiten jetzt in der Serienaufträge-Ansicht läuft. Tab, Editor, Drag-Sortierung, Pending-Logik und nur dort genutzte Helfer/Imports entfernt |
| 17.06.2026 | **Benutzer-Liste: Farbpunkt neben Namen entfernt** (`SettingsView.tsx`): der kleine Inline-Farbwähler rechts vom Namen ist raus; Avatar-Farbe weiterhin im Bearbeiten-Dialog änderbar |
| 16.06.2026 | **Serienauftrag-Unteraufgaben (Checkliste) + Nachweis-Umbau**: Routinen können eine Checkliste haben (`RoutineSchedule.subtasks`), jeder Punkt einzeln abhakbar (Wer/Wann) – Datenmodell `RoutineDayCompletion.subtaskId`, zentrale Logik `routineHelpers.routineDayStatus()`. Pflege im `RoutineEditorModal`. Abhaken im **Serien-Nachweis** (jetzt kompakte **Akkordeon-Liste** statt 12-Monats-Kalenderwand: Zeile → aufklappen → Checkliste + Verlaufs-Streifen) **und** im Serienaufträge-Board („X/N"-Button in „Heute" → Checklisten-Popover) |
| 16.06.2026 | **Serienaufträge: Erstellen & Bearbeiten direkt in der Ansicht** (`RoutineSchedulesView.tsx`, neues `RoutineEditorModal.tsx`): „Neuer Serienauftrag"-Button + Klick auf Zeile öffnet Editor-Modal mit allen Feldern (Titel, Bereich, Beschreibung, Rolle, Wiederholung inkl. Wochentage/Intervall/monatlich/jährlich, Startdatum, Zuweisung Rotation/Fest, Pool, Aktiv, Löschen). App-Handler `handleSaveRoutineSchedule`/`handleDeleteRoutineSchedule`. Einstellungen → Serientermine dadurch optional/redundant |
| 16.06.2026 | **Serienaufträge nach Rhythmus gruppiert** (`RoutineSchedulesView.tsx`): Abschnitts-Überschriften (Täglich/Wöchentlich/Alle 2 Wochen/…/Jährlich) mit rotem Akzentbalken, Band-Hintergrund und Anzahl-Chip |
| 15.06.2026 | **Serien-Nachweis ausgebaut** (`RoutineNachweisView.tsx`): (1) Hover-Tooltip zeigt WER (+ wann) erledigt hat bzw. wer zuständig ist/war; (2) „verpasst" erst ab Einführungs-Datum (`missedSinceYmd`); (3) Tag anklicken → nachträglich abklicken/korrigieren (Person wählen / Rückgängig, via `handleSetRoutineCompletion`); (4) Pro-Person-Auswertung „Erledigt nach Person"; (5) „Drucken / als PDF" mit Druck-Stylesheet |
| 15.06.2026 | **Selbst-lernendes Routing** (`App.tsx`, `SettingsView.tsx`): lernt aus manuellen Zuweisungen Schlagwort→Person (`appSettings.learnedRouting`). Manuelle Regeln haben Vorrang; greift keine, wird Gelerntes genutzt — ab 2 gleichen Zuweisungen und nur an Verfügbare, sonst 'N/A' (warten). Übersicht/Korrektur unter Einstellungen → Prozesse & Logik |
| 15.06.2026 | **SICHERHEIT – Umverteilung** (`App.tsx`): Zentrale Regel `canRedistribute()` → nur `Offen \| In Arbeit \| Überfällig` dürfen bei Abwesenheit/Rückkehr automatisch umverteilt werden. **Abgeschlossen & Zurückgestellt werden NIEMALS automatisch angefasst.** In allen 4 Umverteilungs-Wegen angewendet (vorher: Zurückgestellt ungeschützt, Abgeschlossen-Schutz verstreut) |
| 15.06.2026 | **Vergessene Serienaufträge – prominenter Warnblock** (`App.tsx`): fester roter Block ganz oben mit Liste der vergessenen Aufträge (Name · Standort · „fällig war <Datum>" · Bearbeiter), klickbar, „Alle ansehen"-Button. Ersetzt den kleinen Banner. Datengrundlage `missedRoutinesSinceStart` |
| 15.06.2026 | **Scrollbalken ausgeblendet** (`index.css`): auf `main`, `.sidebar` UND `.nav-menu` (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`). Der 8px-Balken nahm Breite weg und verschob das Layout, sobald er bei kleinerem Fenster erschien. Scrollen per Wheel/Trackpad bleibt. Echter Sidebar-Scroller ist `.nav-menu`, nicht `.sidebar` |
| 15.06.2026 | **Serienauftrag-Banner lesbar** (`DashboardRoutineLinkBar.tsx`): dunkler Text auf hellem Grün (vorher Grün-auf-Grün), Aufgabennamen mit hellgrauen Trennpunkten |
| 15.06.2026 | **Filter-Leiste moderner** (`FilterBar.tsx`): weiße Controls mit Schatten statt grauer Pillen, eckiger (radius 9px), Chips umschließen Inhalt, aktiver Filter = dunkles Badge, „Filter"-Label mit Icon |
| 15.06.2026 | **Board-Breite** (`App.tsx`, `.kanban-workbench`): max-width 1300 → **2400px**, füllt 24"+-Monitore. Behebt „Board verschiebt sich beim Sidebar-Einklappen" (zentriertes Board driftete zur Mitte). Banner-Zeile auf gleiche Breite. Deckel bewusst hoch halten |
| Juni 2026 | **Board-Redesign**: `TicketCard.tsx` — linker Balken = Priorität (rot/orange/grün), keine Pill-Zeile, Footer: Avatar-Chip · Datum-Chip · Icons (`ti-messages` + `ti-mail`), ⋯-Statusmenü. `KanbanColumn.tsx` — farbige Spaltenköpfe (grau/blau/rosa), Spalten-Hintergrund `#E9EBEF` |
| Juni 2026 | **Sidebar-Redesign**: `Sidebar.tsx` — dunkles Design `#353B48`, DRK-Logo auf weißem Container |
| Juni 2026 | **CI auf Node 24**: GitHub-Actions in `deploy-firebase.yml` auf Node-24-Runtime gehoben (`actions/checkout@v6`, `actions/setup-node@v6`, `google-github-actions/auth@v3`) wegen Node-20-Abkündigung (GitHub erzwingt Node 24 ab Juni 2026). Nur Workflow-YAML, kein App-Code. `brevo-keepalive.yml` nutzt keine JS-Actions → unverändert |
| September 2026 | **Veranstaltungen-Modul**: neue `events/`-Collection, `EventsView` + `EventEditorModal`, je Aufgabe ein Ticket mit Dedup-Schutz (`ticketId`), Sidebar-Menüpunkt |
| September 2026 | **Serienaufträge – Rotations-Bugs**: Pool-Reihenfolge aus `schedule.assignees` (nicht mehr alphabetisch), Cursor-Advance beim Board-Abhaken, `getRoutineAssigneeDisplayName`-Sonderfall entfernt |
| September 2026 | **Heute-Spalte**: `todayYmd` per `setInterval(60s)` live aktualisiert; 200-Tage-Lookback für nicht-fällige Tage entfernt (zeigt `—`) |
| September 2026 | **Mobile-Optimierung**: Sidebar als `position:fixed` Overlay auf < 768px, Hamburger-Button, Ticket-Detail vollflächig auf Handy |
| September 2026 | **Portal Autocomplete**: Melder-Name/-E-Mail per `localStorage` auf dem Gerät gemerkt; Dropdown ab 2 Zeichen; E-Mail nur über Vorschlag-Auswahl — beim Tippen immer geleert |
| Juni 2026 | **Chat: feste Höhe + Auto-Scroll** (WhatsApp-Stil): Chat & Melder-Verlauf scrollen intern, neueste Nachricht unten, ältere durch Hochscrollen sichtbar |
| Juni 2026 | **Chat-Redesign**: interner Chat & Melder-Verlauf als zwei farblich getrennte Kanäle; jede Nachricht in der Farbe ihres Absenders (eigene gefüllt rechts), Avatar + Name |
| Juni 2026 | **Interner Staff-Chat**: ticketbezogene Mitarbeiter-Nachrichten, Lesestatus pro Person (`readBy`), bewusst keine E-Mails — siehe Kapitel 23 |
| Juni 2026 | **Zurückstellen verbessert**: Ein-Klick übers Karten-Dropdown, „ohne Erinnerung"-Option, geparkte Tickets von der Überfällig-Erkennung ausgenommen — siehe Kapitel 24 |
| Juni 2026 | **Dokumentation vollständig aktualisiert**: alle neuen Features seit Mai 2026 eingearbeitet |
| Juni 2026 | **App-Refresh-Button**: Header ↻ Icon-Button lädt App neu, mit Dreh-Animation |
| Juni 2026 | **Stale Ticket Erinnerungen**: automatische E-Mail an Techniker bei 5+ Tagen Inaktivität |
| Juni 2026 | **Mehrere E-Mail-Adressen**: `email`-Feld im Benutzerprofil unterstützt kommagetrennte Adressen |
| Juni 2026 | **`reminderSentAt` Feld**: Spam-Schutz für Erinnerungs-E-Mails (3 Tage Cooldown) |
| Juni 2026 | **Verfügbarkeit-Fix**: „Abwesend bis"-Datum wird automatisch geleert wenn Status auf Verfügbar wechselt |
| Juni 2026 | **Code Splitting**: Vite `manualChunks` — Haupt-Bundle von 1.570 KB auf 441 KB reduziert |
| Juni 2026 | **Benutzer E-Mail-Feld**: neues Feld in UserModal für Ticket-Erinnerungs-E-Mails |
| Mai 2026 | **Dokumentation aktualisiert**: alle Änderungen seit Erstversion eingearbeitet |
| Mai 2026 | **E-Mail: Kategorie entfernt** aus Admin-Benachrichtigungs-Mail |
| Mai 2026 | **Konversations-Indikator**: grauer Zähler + oranges "Neue Nachricht" im Karten-Footer |
| Mai 2026 | **Toast-Banner unten**: Position unten mittig, Zuweisung sichtbar, Auto-Dismiss 8s |
| Mai 2026 | **Routing-Fix**: Kein zufälliger Fallback mehr, Wort-genaues Keyword-Matching |
| Mai 2026 | **Routing-Fix**: Portal/reactive Tickets durchlaufen jetzt auch Routing-Logik |
| Mai 2026 | **Brevo Keep-Alive**: Täglicher GitHub Actions Cron verhindert Account-Pause |
| Mai 2026 | **Abgeschlossene Tickets monatsweise**: kein Live-Listener mehr, `getDocs` mit `closedAt` Filter |
| Mai 2026 | **`closedAt` Feld**: wird beim Abschließen gesetzt, Migration für Altdaten |
| Mai 2026 | **Datumskalender-Fix**: `pointer-events: auto`, `showPicker()` Fallback — Safari/Chrome/Windows |
| Mai 2026 | **E-Mail `due_date_changed`**: nur bei Status In Arbeit oder Überfällig |
| Mai 2026 | **Drag-Handle**: Karten nur im oberen 24px-Bereich ziehbar |
| Mai 2026 | **Hover-Effekt**: Anheben + Schatten auf ganzer Karte |
| Mai 2026 | **Klick auf Karte**: Body-Klick öffnet Detailpanel direkt |
| Mai 2026 | **FilterBar**: Chip-Design, „Filter"-Label, „↺ Zurücksetzen"-Button |
| Mai 2026 | **Kanban-Header**: Farbiger Punkt + Titel + Zähler + Trennlinie |
| Mai 2026 | **Cards auf Fläche**: Seitenhintergrund grau, Spalten weiß mit Schatten |
| Mai 2026 | **Portal 3-Pillen-Zeile**: Bearbeiter / Fällig bis / Status |


### 21.09.2026 – Dashboard-Gestaltung nach Nutzerfreigabe
- Karten: größerer Betreff, mehr Abstand im oberen Bereich, neutraler Rand statt linkem Prioritätsstreifen. Grauer Footer inklusive Bearbeiter, Chat/Mail sowie vollständige Prioritäts-/Fälligkeits-/Statuszeile unverändert.
- Kanban-Spalten und Überschriften Offen / In Arbeit / Überfällig bleiben unverändert.
- Anthrazitfarbene Navigation mit weißer Logofläche und lokal begrenzten Farbvariablen.
- Dashboard/Techniker-Dashboard: kompakte Serienerinnerung zeigt heutige offene und überfällige Aufträge zusammen, inklusive Aufgabennamen. Überfällige verschwinden auch ohne heutige Termine nicht. Öffnet weiterhin die Serienaufträge zur Bearbeitung. Der bisherige große Warnblock bleibt in anderen Ansichten erhalten.
- Keine Änderungen an Persistenz, Statuslogik oder produktiven Tickets.

### 21.09.2026 – Korrektur der Kopfzeile und lokalen Vorschau
- Durchgehende weiße Kopfzeile mit DRK-Logo über der anthrazitfarbenen Navigation und zentraler Ticketsuche; ersetzt den separaten weißen Logokasten.
- Suche an vorhandenen Filter-State angebunden, Dashboard/Listen/Abgeschlossen verwenden denselben Suchwert. Kein doppeltes Suchfeld in der Seitenüberschrift.
- Lokale Gestaltungsvorschau enthält nun auch die echten Header- und Filter-Komponenten; Beispieldaten bleiben von Firebase getrennt.

### 21.09.2026 – Weniger Kopfbereich, dezente Kartentrennung
- Redundante Seitenüberschrift in allen Hauptansichten entfernt; die Navigation zeigt die aktive Ansicht. Leere Desktop-Hamburger-Zeile entfällt ebenfalls.
- Senkrechte Trennlinie zwischen Logo und App-Name entfernt.
- Feine eingerückte Linie trennt Karteninhalt von Metadaten. Grauer Footer, Prioritätsfarben und Statusbedienung unverändert.

### 21.09.2026 – Kartenaufbau gemäß Entwurf korrigiert
- Nur grauer Footer bleibt im bisherigen Aufbau. Darüber Standort mit Symbol, Priorität links (bisherige Farbe/Punkt), Fälligkeit rechts mit Kalender und verständlichem Fristtext.
- Redundante Statusspalte in Karten entfällt; Status bleibt in Spalten, Listen und Detailansicht erhalten.
- Fristüberschreitung wird in Kalendertagen berechnet; abgeschlossene/zurückgestellte Karten erhalten keinen aktiven Überfällig-Hinweis.

### 21.09.2026 – Dashboard-Filterleiste an Entwurf angepasst
- Standort, Bearbeiter (rollenabhängig), Priorität, Weitere Filter und Zurücksetzen in kompakter Zeile mit weißen Controls und dezenten Icons. Separates Filter-Label entfernt.
- Status, Typ, Melder unter Weitere Filter; Anzahl aktiver Zusatzfilter sichtbar. Escape schließt das Panel. Zurücksetzen setzt ausdrücklich auch Typ zurück.

### 22.09.2026 – Einheitliche Karten mit direktem Statuswechsel
- Einheitliche Kartenhöhe, zwei reservierte Betreffzeilen mit vollständigem Titel im Tooltip; lange Standorte einzeilig gekürzt.
- Metazeile ohne Feldüberschriften: bisherige Prioritätsfarben, dezenter direkt bedienbarer Status, Fristtext „Heute fällig“, „Überfällig seit …“ oder „Fällig am …“.
- Bestehender Statushandler wieder angeschlossen; automatische Überfälligkeit nicht manuell auswählbar. Tastaturfokus und zugängliche Feldnamen ergänzt.
- Grauer Footer unverändert; kein Fortschrittsbalken.

### 22.09.2026 – Einheitliches Datum und Veranstaltungsfortschritt
- Kartenbetreff einzeilig mit Ellipse und vollständigem Tooltip; einheitliche Höhe angepasst.
- Datum immer DD.MM.YYYY, darunter heute / seit N Tagen / in N Tagen; bei überschrittener aktiver Frist rot. Kein doppelter Überfällig-Text.
- Veranstaltungsübersicht zeigt dezenten Fortschrittsbalken mit erledigten/verknüpften Aufgaben und Prozent. Bestehende Aufgabenstatus-Auswertung bleibt Grundlage, Aufgaben ohne Ticket zählen nicht als erledigt. Kein Balken bei null Aufgaben, keine zusätzliche Höhe für Ticketkarten.

### 22.09.2026 – Ausrichtung der Kartenmetadaten
- Priorität, Status und Datum stehen auf derselben oberen Textlinie in stabilen Spalten. Datumszusatz linksbündig darunter; Kalender auf Höhe des Datums statt zwischen zwei Zeilen.
- Kartenhöhe und grauer Footer unverändert.
- Kanban-Spalten mit min-width: 0 verhindern, dass lange einzeilige Titel die Spaltenbreite verändern.

### 22.09.2026 – Melder und Eingang getrennt
- Meldername mit Personensymbol auf erster Zeile, darunter links am Namen ausgerichtet „Eingang: DD.MM. · HH:MM Uhr“. Vollständige Angaben im Tooltip.
- Innenabstände angepasst; Kartenhöhe, einzeiliger Betreff und Footer bleiben erhalten.

### 22.09.2026 – Detailansicht: klare Melder- und Eingangsdaten
- Meldername und E-Mail separat; Eingangsdatum und Uhrzeit als beschriftete, ausgerichtete Felder statt Punktkette. Karten-Eingang verwendet „um“ zwischen Datum und Uhrzeit.
- Dezente Trenner, ruhigere Chatköpfe mit weiterhin getrennten Kanälen, einheitliche Ecken und Feldabstände. Nachrichten-/Bearbeitungslogik unverändert.

### 22.09.2026 – Kompakte, einheitliche Ticket-Metadaten
- Name, Datum und Uhrzeit auf Karten und im Detail wieder in einer Zeile, getrennt durch dezente vertikale Linien; ohne Eingang/um und zusätzliche Kästchen. Lange Namen mit vollständigem Tooltip.
- Detailfelder Priorität/Fälligkeit/Status auf einheitliche 26px Höhe reduziert; Chatkopf und Innenabstände abgestimmt. Bedienlogik unverändert.

### 22.09.2026 – Einheitliche Ticketlisten
- Listenansicht, Abgeschlossen und Zurückgestellt teilen TicketTableFormats.css: 26px hohe, flache Status-/Prioritätsfelder wie im Detail, einheitliche Typografie und Abstände.
- Ticketnummer dezent unter dem Betreff neben dem Melder; Nummernsortierung über # im Betreffkopf erhalten. Auswahl, Hinweise, Fachspalten und Aktionen unverändert.

### 22.09.2026 – Karten-Metadaten zentriert
- Priorität, Status und Datum in drei gleichmäßig verteilten Bereichen horizontal und vertikal zentriert; Datumshinweis mittig unter dem Datum. Bedienung unverändert.

### 22.09.2026 – Nachrichteneingabe im Vordergrund
- Teamchat und Melderantwort nutzen die volle Breite; Eingabe mindestens 104px, mobil 128px bei 16px Schrift. Mikrofon und dezenter Senden-Button darunter, mobile Touchflächen 44px. Versandlogik unverändert.
- Kartenmetadaten wieder auf gemeinsamer erster Textlinie bei gleichmäßiger horizontaler Verteilung.

### 22.09.2026 – Kompakte, mitwachsende Nachrichteneingabe
- Beide Nachrichtenfelder beginnen bei zwei Zeilen und wachsen mit Text bis 240px; danach scrollbar. Höhe wird auch nach Leeren, Sprachänderungen und Fenstergrößenwechsel angepasst.
- Karten-Hover und aktive Auswahl mit dezenter blauer Tönung und Rahmen, inklusive Dark Mode; bestehender Schatten bleibt.

### 22.09.2026 – Lesbarer App-Name
- Der Schriftzug „DRK Serviceportal“ im Kopfbereich ist auf 19px vergrößert und minimal enger gesetzt, ohne die Suche zu verdrängen.

### 22.09.2026 – Vollständige Ticketbearbeitung für Admins
- Admins können nun auch ältere, Serien- und Veranstaltungs-Tickets über „Ticket bearbeiten“ öffnen. Der Bearbeitungsmodus bündelt Betreff, Melder und E-Mail-Adresse in einem klaren Block; Standort, Bereich und Beschreibung folgen darunter.
- Priorität, Fälligkeit, Status, Bearbeiter und Kategorie bleiben direkt auswählbar. Beim Speichern wird eine leere E-Mail-Adresse als „nicht angegeben“ gespeichert; Chats, Checklisten und Ticket-Herkunft bleiben unverändert.
### 22.09.2026 – Arbeitszeit direkt am Ticket buchen

- Im Ticket gibt es zwischen Zuordnung und Chat einen kompakten, dauerhaft sichtbaren Bereich **Arbeitszeit**. Das vermeidet auf dem Handy einen zusätzlichen Schritt.
- **10, 15, 30 oder 60 Minuten** werden mit einem Tipp sofort addiert. Mehrere Klicks ergänzen sich, etwa 30 + 15 = 45 Minuten. Freie Eingabe und Tätigkeitsnotiz entfallen bewusst, damit die Bedienung schnell und eindeutig bleibt.
- Im Ticket wird nur die Gesamtdauer gezeigt, nicht jede einzelne Teilbuchung. Die letzte eigene Buchung kann dezent zurückgenommen und bei Bedarf korrekt neu gebucht werden; Administratoren können die letzte Buchung ebenfalls zurücknehmen.
- Die Gesamtdauer bleibt auch bei abgeschlossenen Tickets erhalten. Zusätzlich wird `costs.laborHours` aus der Summe synchronisiert, damit Berichte die gebuchte Arbeitszeit später direkt verwenden können.
- Bewusst kein laufender Timer: Die feste Auswahl ist auf Mobilgeräten schneller, klarer und weniger fehleranfällig.
- Beim Abschließen ohne gebuchte Zeit erscheint eine deutliche Warnung mit **Zeit eintragen** und **Trotzdem abschließen**. „Zeit eintragen“ öffnet das Ticket direkt am Zeitbereich; Sammelabschlüsse warnen ebenfalls, wenn ausgewählte Tickets keine Zeit enthalten.

### 23.09.2026 – Gemeinsame Ticketbearbeitung und faire Zeitanteile

- Ein Auftrag bleibt immer **ein Ticket**. Der bisherige Bearbeiter bleibt als verantwortliche Person gesetzt; über das kleine Plus im Bearbeiterfeld können ein oder mehrere Mitwirkende ergänzt und bei Bedarf wieder entfernt werden.
- Mitwirkende sehen denselben Auftrag in ihrer Übersicht, in zurückgestellten Tickets, bei Nachrichten und über den Bearbeiterfilter. Der Auftrag wird nicht kopiert und der Hauptbearbeiter bleibt für die Zuordnung erkennbar.
- Jede Zeitbuchung enthält bereits den Namen der buchenden Person. Die Auswertung „Arbeitszeit nach Mitarbeiter“ berechnet daraus den prozentualen Anteil der tatsächlich gebuchten Minuten, etwa 30 Minuten von Heiko und 15 Minuten von Anton = 66,7 % / 33,3 %. So wird ein gemeinsamer Auftrag in der Zeitstatistik nicht doppelt gezählt.
- Das Hinzufügen-Symbol ist ein klarer, kompakter Button direkt neben dem Bearbeiterfeld; die eigentlichen Mitwirkenden erscheinen erst nach Auswahl als kleine Namenschips.

### 23.09.2026 – Teamansicht: Auslastung auf einen Blick

- Die Teamansicht beginnt jetzt mit einem kompakten Überblick für verfügbare Teammitglieder, aktive Tickets und überfällige Aufträge. Die Überfällig-Kennzahl bleibt anklickbar und öffnet die passende Liste.
- Jede Person erhält eine ruhige, direkt anklickbare Karte mit Verfügbarkeit, Rolle, Anzahl aktiver und kritischer Aufträge, Teamlast sowie erledigten Aufträgen der letzten 30 Tage. Überfällige Arbeit wird klar, aber nicht dominant hervorgehoben.
- Der separate Ranglistenblock entfällt, weil die identische Information bereits auf jeder Teamkarte steht. Es gibt bewusst keine automatische Umverteilung: Die Ansicht macht die Lage transparent, die Entscheidung bleibt beim Team bzw. Administrator.

### 23.09.2026 – Mitwirkende auf Ticketkarten sichtbar

- Hat ein Ticket zusätzliche Mitwirkende, zeigt der Karten-Footer die Personen als überlappende, farbige Namenskürzel. Das gilt gleichermaßen im Admin-Dashboard und in den persönlichen Ansichten.
- Der Hauptbearbeiter bleibt zuerst sichtbar; bis zu zwei Mitwirkende werden direkt angezeigt, weitere als dezentes `+N`. Der Tooltip nennt alle beteiligten Personen.

### 23.09.2026 – Ticket schließen klar getrennt

- Das Schließen-X im Ticketkopf hat nun eine eigene 38px-Fläche und wird durch einen feinen vertikalen Trenner von Bearbeiten und Notfall getrennt. Dadurch ist die häufige Schließen-Aktion leichter zu treffen und kann nicht versehentlich mit den benachbarten Symbolen verwechselt werden.

### 23.09.2026 – Arbeitszeit im Bericht sichtbar

- Berichte zeigen für abgeschlossene Aufträge jetzt die gesamte gebuchte Arbeitszeit und den Durchschnitt pro Ticket.
- Die neue, kompakte Liste **Zeitaufwand pro Auftrag** nennt je Ticket die Gesamtzeit sowie die Zeitanteile der beteiligten Mitarbeitenden. Gemeinsame Aufträge werden dadurch nur einmal gezählt; die Verteilung bleibt nachvollziehbar.
- Die Liste zeigt höchstens acht Aufträge, damit die Berichtsansicht übersichtlich bleibt. Ohne Zeitbuchungen wird klar angezeigt, dass noch keine Arbeitszeit vorliegt.
- Zusätzlich zeigt **Arbeitszeit nach Standort / Bereich** für Kreisverband, Schlosspark, Sozialdienst usw. die gebuchten Stunden und den prozentualen Anteil an der gesamten Arbeitszeit des gewählten Zeitraums.

### 23.09.2026 – Fehlende abgeschlossene Tickets eindeutig anzeigen

- Wenn Firebase abgeschlossene Tickets vorübergehend nicht laden kann, bleibt die bisherige Liste unverändert. Die App löscht die lokale Ansicht nicht mehr als Fehlerreaktion.
- Statt einer irreführenden leeren Tabelle erscheint ein klarer Hinweis mit einer Wiederholen-Schaltfläche. Bei einem ausgeschöpften Firebase-Leselimit wird ausdrücklich erklärt, dass die Tickets weiterhin gespeichert sind.

### 23.09.2026 – Veranstaltungsfortschritt aus Ticket-Checklisten

- Der Fortschritt einer Veranstaltung wird nun aus den tatsächlich abgehakten Punkten der zugehörigen Tickets berechnet, nicht erst nach dem vollständigen Abschließen eines Tickets.
- Auf der Veranstaltungskarte wird beispielsweise `3 von 9 Punkten erledigt · 33 %` angezeigt. Je Aufgabe zeigen die Chips den Stand als `1/2`; teilweise erledigte Aufgaben erhalten eine dezente gelbe Kennzeichnung.
- Im Stift-Editor sind dieselben bereits im Ticket erledigten Punkte mit einem grünen Häkchen und einer Fortschrittsangabe sichtbar. Dort bleibt die Checkbox-Anzeige rein informativ; das tatsächliche Abhaken findet weiterhin sicher im Ticket statt.

### 23.09.2026 – Einheitliche Status- und Prioritätsfelder

- Status, Priorität, Fälligkeit und zugehörige Übersichten verwenden nun durchgehend die gleiche kompakte Form mit 7px-Rundung statt stark gerundeter Pills.
- Das gilt in Listen, Ticketkarten, Ticketdetails, dem Melderportal, Veranstaltungen, Team, zurückgestellten und abgeschlossenen Aufträgen sowie dem Seriennachweis. Farben und Bedienung bleiben unverändert.

### 23.09.2026 – Veranstaltungen: Aufgaben direkt öffnen und zeitlich einordnen

- Jede Veranstaltungsaufgabe ist klar als Link zum zugehörigen Ticket erkennbar und lässt sich direkt öffnen. Ist ein älteres abgeschlossenes Ticket nicht bereits geladen, wird es gezielt aus dem gespeicherten Bestand abgerufen.
- Kommende Veranstaltungen bleiben hervorgehoben. Vergangene Veranstaltungen werden mit neutralem Rahmen und ruhigerer Darstellung sichtbar zurückgenommen; vollständig erledigte Veranstaltungen erhalten zusätzlich einen grünen Hinweisrahmen.

### 23.09.2026 – Nachtrag: Layout und einheitliche Bedienfelder

- Die Teamkarten stehen auf Desktop-Bildschirmen in einer ruhigen zweispaltigen Anordnung. Auf schmalen Bildschirmen wechseln sie automatisch in eine einzelne Spalte, damit Kennzahlen und Beschriftungen genügend Platz behalten.
- Die Statusübersicht in der Filterleiste sowie die Status-, Prioritäts- und Fälligkeitsfelder in Karten, Listen, Details, Team, Berichten, Veranstaltungen und Portal verwenden dieselbe kompakte Form mit 7px-Rundung. Dadurch wirken sie wie zusammengehörige Bedienfelder statt wie unterschiedlich stark gerundete Pills.
- Die Berichtsfilter, Zeitraumauswahl und Kennzahlen-Chips folgen jetzt ebenfalls dieser Form. Die Auswertung bleibt dadurch optisch mit Tickets und Teamansicht abgestimmt, ohne Informationen oder Funktionen zu verändern.

### 23.09.2026 – Veröffentlichung: Fehlerhinweise für Veranstaltungsaufträge

- Kann ein Veranstaltungsauftrag nicht mehr gefunden oder vorübergehend nicht geladen werden, erscheint nun eine eindeutige rote Fehlermeldung in der App. Der Hinweis hat einen eigenen Typ in der zentralen Hinweisleiste und verhindert keine Veröffentlichung mehr.

### 23.09.2026 – Veranstaltungen: Ladefehler eindeutig anzeigen

- Die Veranstaltungsansicht zeigt bei einem Firebase-Ladefehler einen verständlichen Hinweis, statt eine leere Liste wie fehlende Daten wirken zu lassen. Die bereits gespeicherten Veranstaltungen werden durch einen solchen Fehler nicht verändert oder gelöscht.

### 23.09.2026 – Seitenleiste: Aktualisieren immer verfügbar

- Die Aktualisieren-Schaltfläche in der Seitenleiste bleibt nun auch sichtbar, wenn die erste Firebase-Synchronisierung noch nicht erfolgreich war. Damit lässt sich die App jederzeit neu laden und die Datenabfrage erneut starten.
