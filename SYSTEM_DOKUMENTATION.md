# DRK Haustechnik Service — Systemdokumentation

> Letzte Aktualisierung: Mai 2026  
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
12. [Firebase Datenstruktur](#12-firebase-datenstruktur)
13. [Portal (öffentliche Meldeseite)](#13-portal-öffentliche-meldeseite)
14. [Kanban-Board & Ticket-Karten](#14-kanban-board--ticket-karten)
15. [In-App Benachrichtigungen (Toast-Banner)](#15-in-app-benachrichtigungen-toast-banner)
16. [Datumskalender (plattformübergreifend)](#16-datumskalender-plattformübergreifend)
17. [Umgebungsvariablen](#17-umgebungsvariablen)
18. [Deployment (GitHub Actions)](#18-deployment-github-actions)
19. [Änderungshistorie](#19-änderungshistorie)

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
| `status` | Status | Offen / In Arbeit / Überfällig / Abgeschlossen |
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

## 12. Firebase Datenstruktur

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

## 13. Portal (öffentliche Meldeseite)

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

### Ticket-Statusanzeige im Portal
- **3-Pillen-Zeile**: Bearbeiter | Fällig bis | Status
- Jede Pille zeigt farbigen Zustand (Überfällig = Rot, In Arbeit = Blau, etc.)
- Verlauf: alle Notizen mit Zeitstempel

### Wartungsmodus
- Konfigurierbar in Einstellungen
- Zeigt anpassbare Wartungsmeldung anstatt Formular

---

## 14. Kanban-Board & Ticket-Karten

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

## 15. In-App Benachrichtigungen (Toast-Banner)

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

## 16. Datumskalender (plattformübergreifend)

- Unsichtbarer `<input type="date">` liegt über der Datums-Pille
- `pointer-events: auto` → Input fängt Klicks direkt ab
- `showPicker()` als Fallback für Windows-Browser
- Browser steuert Öffnen/Schließen nativ — kein manuelles State-Tracking

---

## 17. Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `VITE_BREVO_API_KEY` | Ja | Brevo API-Schlüssel für E-Mail-Versand |
| `VITE_BREVO_SENDER_EMAIL` | Nein | Absender-Adresse (Standard: `noreply@drk-ticket.de`) |
| `VITE_BREVO_SENDER_NAME` | Nein | Absendername (Standard: `DRK Serviceportal`) |
| `BREVO_ADMIN_EMAIL` | Ja* | Empfänger der täglichen Keep-Alive Test-Mail |

*Nur als GitHub Secret benötigt, nicht im Frontend

---

## 18. Deployment (GitHub Actions)

### Deploy-Workflow (`deploy-firebase.yml`)
- Trigger: jeder Push auf `main` oder manuell
- Schritte: TypeScript-Lint → Vite-Build → Firebase Hosting Deploy
- Benötigte Secrets: `FIREBASE_SERVICE_ACCOUNT_DRK_FACILITY`, `VITE_BREVO_API_KEY`

### Brevo Keep-Alive (`brevo-keepalive.yml`)
- Trigger: täglich 07:00 UTC (09:00 Uhr MEZ) oder manuell
- Sendet Test-E-Mail via Brevo API um Account-Inaktivität zu verhindern
- Bei Fehler schlägt der Job fehl → sichtbar in GitHub Actions

---

## 19. Änderungshistorie

| Datum | Änderung |
|---|---|
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
