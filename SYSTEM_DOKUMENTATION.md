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
14. [Drag & Drop / Kanban-Board](#14-drag--drop--kanban-board)
15. [Datumskalender (plattformübergreifend)](#15-datumskalender-plattformübergreifend)
16. [Umgebungsvariablen](#16-umgebungsvariablen)
17. [Deployment (GitHub Actions)](#17-deployment-github-actions)
18. [Änderungshistorie](#18-änderungshistorie)

---

## 1. Technischer Stack

| Schicht | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Datenbank | Firebase Firestore (Realtime Listener) |
| E-Mail | Brevo (ehemals Sendinblue) REST API v3 |
| Hosting | GitHub Pages via GitHub Actions |
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
│   ├── ErledigtTableView.tsx   # Ansicht abgeschlossener Tickets
│   ├── TechnicianView.tsx      # Mitarbeiter-Übersicht
│   ├── ReportsView.tsx         # Auswertungen / Statistiken
│   ├── RoutineSchedulesView.tsx# Serienauftrags-Verwaltung
│   ├── RoutineNachweisView.tsx # Nachweis-Ansicht für Routinen
│   ├── SettingsView.tsx        # Admin-Einstellungen
│   ├── NewTicketModal.tsx      # Modal: neues Ticket anlegen
│   ├── Header.tsx              # App-Header mit Suche und Login
│   ├── Sidebar.tsx             # Navigation links
│   ├── DashboardRoutineLinkBar.tsx # Schnelllink zu offenen Routinen
│   ├── ModernDashboard.tsx     # Dashboard-Haupt-Layout
│   └── ...
├── utils/
│   ├── routineHelpers.ts       # Wiederholungslogik für Serienaufträge
│   ├── displayNames.ts         # Kurzname-Formatierung (Vor + Nachname-Initial)
│   ├── routineUiPalette.ts     # Farb-Palette für Routine-Karten
│   └── rpHolidays.ts           # Rheinland-Pfalz Feiertage
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
- Techniker und Hauswirtschaft können den eigenen Techniker-Filter nicht ändern (`isServiceTeamUser`)

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

### Ticket-Felder (Auswahl)

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | string | Eindeutige ID (z.B. `TKT-1234`) |
| `title` | string | Betreff des Tickets |
| `description` | string | Detailbeschreibung |
| `status` | Status | Offen / In Arbeit / Überfällig / Abgeschlossen |
| `priority` | Priority | Hoch / Mittel / Niedrig |
| `area` | string | Standort (z.B. "Hauptgebäude") |
| `location` | string | Genaue Lokation (z.B. "Zimmer 12") |
| `technician` | string | Zugewiesener Bearbeiter (Name) |
| `dueDate` | string | Fälligkeitsdatum `DD.MM.YYYY` |
| `entryDate` | string | Erfassungsdatum |
| `reporter` | string | Name des Melders |
| `reporter_email` | string | E-Mail des Melders (für Benachrichtigungen) |
| `notes` | string[] | Verlauf / Kommentare mit Zeitstempel |
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
- Läuft automatisch täglich (`useEffect` in `App.tsx`)
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
| `erledigt` | `ErledigtTableView` | Abgeschlossene Tickets, Löschfunktion | Admin |
| `techniker` | `TechnicianView` | Mitarbeiter-Karten mit Ticket-Zahlen | Admin |
| `reports` | `ReportsView` | Statistiken und Auswertungen | Admin |
| `routines` | `RoutineSchedulesView` | Serienaufträge verwalten | Admin |
| `routine-nachweis` | `RoutineNachweisView` | Nachweis erledigter Routinen | Admin |
| `settings` | `SettingsView` | Standorte, Benutzer, SLA, Routing | Admin |

---

## 7. Kernfunktionen im Detail

### `handleUpdateTicket(updatedTicket: Ticket)` — App.tsx ~L1800

Zentrale Funktion für alle Ticket-Änderungen. Läuft in dieser Reihenfolge ab:

1. **Abwesenheitsprüfung**: Ist der zugewiesene Techniker abwesend? → Automatische Umleitung auf verfügbaren Ersatz (Skill-basiert)
2. **Abschluss-Zeitstempel**: Wird auf Abgeschlossen gesetzt → `completionDate/Time` wird gesetzt
3. **Fälligkeitsdatum bei Überfällig-Rücksetzung**: Wechsel von Überfällig → Offen/InArbeit → neues Datum
4. **Reaktive Due-Date-Berechnung**: Nur wenn `wunschTermin` oder `categoryId` sich ändert
5. **Prio-Anpassung bei Kategorie-Änderung**: Neue SLA-Priorität aus Matrix
6. **Abschluss-Flag**: `is_reopened = false` bei Abschluss
7. **E-Mail-Benachrichtigungen** (siehe Kapitel 11)
8. **Firestore-Synchronisation**: Ticket in richtige Collection schreiben

### `handleNewTicket(ticketData)` — App.tsx ~L2100

Erstellt ein neues Ticket aus dem Admin-Modal:

1. Generiert eindeutige ID (`TKT-XXXX`)
2. Wendet Routing-Regeln an (Keyword-Match → Auto-Zuweisung)
3. Berechnet Fälligkeitsdatum via SLA-Matrix
4. Speichert in Firebase `tickets`
5. Sendet E-Mail an Melder (`ticket_created`)
6. Sendet E-Mail an Admin/Admins (`admin_new_ticket`) wenn Portal-Ursprung

### `handleDeleteTicket(ticketId)` — App.tsx ~L2041

- Trägt Ticket-ID in Firestore `deleted-ticket-ids` Blockliste ein
- Löscht aus `tickets`, `completed_tickets` und `routine_tickets`
- Nur für Admins sichtbar

### `assignTicket(ticket, users, allTickets, routingRules)` — App.tsx ~L592

Auto-Zuweisung eines Bearbeiters:

1. Prüft Routing-Regeln (Keyword-Match in Titel + Beschreibung)
2. Filtert abwesende Benutzer heraus
3. Verteilt gleichmäßig (wer hat die wenigsten Tickets?)
4. Gibt Bearbeiternamen oder `null` zurück

---

## 8. SLA & Fälligkeitsdatum-Logik

### SLA-Matrix
- Konfigurierbar in Einstellungen (`appSettings.slaMatrix`)
- Verknüpft `categoryId` + `Priority` → `responseTimeHours`
- Funktion `computeReactiveDueDateWithoutWunsch(entryDate, categoryId, slaMatrix)`:
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
| `keyword` | Komma-getrennte Suchbegriffe (in Titel + Beschreibung) |
| `categoryId` | Kategorie die automatisch gesetzt wird |
| `priority` | Priorität die automatisch gesetzt wird |
| `assignees` | Liste bevorzugter Bearbeiter |

### Ablauf bei neuen Tickets
1. Volltext (Titel + Beschreibung) wird gegen alle Regeln geprüft
2. Erste Regel die zutrifft "gewinnt"
3. Kategorie, Priorität und bevorzugte Bearbeiter aus Regel übernommen
4. Bearbeiter aus `assignees` wird zugewiesen (gleichmäßige Verteilung, Abwesenheit beachtet)
5. `autoAssigned: true` wird gesetzt

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
- `getNextAssignee(schedule, users)` bestimmt die nächste Person
- Generierte Routine-Tickets landen in `routine_tickets` Collection
- Nicht erledigte Routinen tauchen im Kanban auf
- Erledigte Routinen werden per `RoutineDayCompletion` protokolliert

### Nachweis
- `RoutineNachweisView` zeigt Kalenderansicht der erledigten Routinen
- Pro Tag: wer hat was erledigt + Zeitstempel

---

## 11. E-Mail-Benachrichtigungen (Brevo)

### Technische Basis
- **API**: Brevo REST API v3 (`https://api.brevo.com/v3/smtp/email`)
- **Authentifizierung**: `VITE_BREVO_API_KEY` (Umgebungsvariable)
- **Absender**: konfigurierbar via `VITE_BREVO_SENDER_EMAIL` / `VITE_BREVO_SENDER_NAME`
- **Funktion**: `sendDrkBrevoMail(to, subject, payload)` → feuert async, blockiert UI nicht
- **Duplikat-Schutz**: Jede Kombination aus `(ticketId, kind)` wird nur 1× gesendet (localStorage-Cache)

---

### Übersicht aller E-Mail-Typen

| `kind` | Betreff | Empfänger | Auslöser |
|---|---|---|---|
| `ticket_created` | `Ihre Meldung wurde erfasst – Ticket XXXX` | Melder | Neues Ticket erstellt (Portal oder Admin) |
| `admin_new_ticket` | `Neue Meldung eingegangen – Ticket XXXX` | Admin-E-Mail | Neues Ticket aus dem Portal |
| `ticket_in_progress` | `Ihre Meldung wird bearbeitet – Ticket XXXX` | Melder | Status wechselt zu **In Arbeit** |
| `ticket_closed` | `Ihre Meldung wurde abgeschlossen – Ticket XXXX` | Melder | Status wechselt zu **Abgeschlossen** |
| `staff_note` | `Neuigkeit zu Ihrem Ticket XXXX` | Melder | Neue Notiz von Mitarbeiter (nicht vom Melder selbst) |
| `due_date_changed` | `Terminänderung zu Ihrer Meldung – Ticket XXXX` | Melder | Fälligkeitsdatum manuell geändert, Status ist **In Arbeit** oder **Überfällig** |

---

### Detailbeschreibung je E-Mail-Typ

#### `ticket_created` — Eingangsbestätigung
- **Wann**: Direkt nach Anlegen eines neuen Tickets (Portal oder Admin-Modal)
- **Enthält**: Ticket-Nummer, Betreff, Link zum Portal-Statusbereich
- **Bedingung**: `reporter_email` muss vorhanden sein

#### `admin_new_ticket` — Admin-Benachrichtigung
- **Wann**: Neues Ticket aus dem Portal eingegangen
- **Enthält**: Alle Ticket-Details (Melder, Standort, Beschreibung, Priorität, Kategorie)
- **Empfänger**: Konfigurierte Admin-E-Mail-Adresse
- **Bedingung**: Nur bei `origin === 'portal'`

#### `ticket_in_progress` — Bearbeitungsstart
- **Wann**: `handleUpdateTicket` erkennt Statuswechsel → `In Arbeit`
- **Enthält**: Bearbeiter, Standort, Priorität, voraussichtliches Fälligkeitsdatum
- **Bedingung**: `reporter_email` vorhanden, Status wechselt von einem anderen Status zu `In Arbeit`

#### `ticket_closed` — Abschlussbestätigung
- **Wann**: `handleUpdateTicket` erkennt Statuswechsel → `Abgeschlossen`
- **Enthält**: Ticket-Nummer, Hinweis auf Portal für Bewertung/Feedback
- **Bedingung**: `reporter_email` vorhanden

#### `staff_note` — Neue Mitarbeiter-Notiz
- **Wann**: Eine neue Notiz wurde zum Ticket hinzugefügt
- **Enthält**: Den Notiztext
- **Bedingung**: Notiz stammt **nicht** vom Melder selbst (erkannt durch `(Melder am ` oder `Ticket durch Melder wiedereröffnet` im Text)

#### `due_date_changed` — Terminänderung
- **Wann**: `dueDate` des Tickets hat sich geändert
- **Enthält**: Ticket-Nummer, Betreff, neues Fälligkeitsdatum
- **Bedingung**:
  - `reporter_email` muss vorhanden sein
  - Status muss `In Arbeit` **oder** `Überfällig` sein
  - Bei Status `Offen` wird **keine** Mail gesendet (dort wird noch am Datum nachjustiert)
  - Bei Status `Abgeschlossen` wird **keine** Mail gesendet

---

### E-Mail-Priorisierung in `handleUpdateTicket`

Wenn mehrere Bedingungen gleichzeitig zutreffen würden, gilt diese Reihenfolge (nur **eine** Mail pro Aufruf):

```
1. due_date_changed  (Terminänderung, Status In Arbeit/Überfällig)
2. ticket_closed     (Status → Abgeschlossen)
3. ticket_in_progress (Status → In Arbeit)
4. staff_note        (neue Notiz von Mitarbeiter)
```

---

## 12. Firebase Datenstruktur

### Collections

| Collection | Inhalt |
|---|---|
| `tickets` | Alle aktiven Tickets (Offen, In Arbeit, Überfällig) |
| `completed_tickets` | Abgeschlossene Tickets (archiviert) |
| `routine_tickets` | Aktive Routine-/Serienaufträge |
| `app_data` | App-Einstellungen, Benutzer, Standorte, SLA, Routing |

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
| `deleted-ticket-ids` | Blockliste gelöschter Ticket-IDs (verhindert Wiederauftauchen) |

### Realtime-Listener
Alle Collections werden via `onSnapshot` live synchronisiert — Änderungen eines Nutzers erscheinen sofort bei allen anderen eingeloggten Nutzern.

---

## 13. Portal (öffentliche Meldeseite)

### Zugang
- Keine Anmeldung nötig
- URL: Hauptdomain ohne Login-Parameter
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
- Verlauf: alle Notizen mit Zeitstempel (eigene Notizen und Mitarbeiter-Notizen)

### Wartungsmodus
- Konfigurierbar in Einstellungen
- Zeigt anpassbare Wartungsmeldung anstatt Formular
- Alle Admin-Funktionen bleiben erreichbar

---

## 14. Drag & Drop / Kanban-Board

### Spalten
- **Offen**: Alle Tickets mit Status `Offen`
- **In Arbeit**: Alle Tickets mit Status `In Arbeit`
- **Überfällig**: Alle Tickets mit Status `Überfällig`

### Sortierung innerhalb der Spalten
Alle drei Spalten sortieren nach:
1. Notfall-Tickets (`is_emergency = true`) immer oben
2. Dann nach Fälligkeitsdatum aufsteigend (`DD.MM.YYYY` → `YYYY-MM-DD` zum Vergleich)

### Drag-Verhalten
- Karten können nur von der **oberen Handbreite** (top 24px) gezogen werden
- Cursor wechselt zu `grab` nur in dieser Zone
- Im unteren Bereich der Karte: `default` Cursor
- Im Footer-Bereich: kein `pointer`, kein `grab`
- Beim Ziehen erscheint eine rote Drop-Linie zwischen den Karten
- Ablegen: Status ändert sich, Position in der Spalte wird gespeichert

### Klickverhalten
- Klick auf Karten-Body → öffnet Detailpanel (TicketDetailSidebar)
- Klick auf Footer-Button → öffnet ebenfalls Detailpanel
- Kein visueller Auswahlrahmen auf selektierter Karte

---

## 15. Datumskalender (plattformübergreifend)

### Problem
Native date inputs (`<input type="date">`) verhalten sich je nach Browser und OS unterschiedlich:
- macOS Safari/Chrome: Klick auf versteckten Input öffnet/schließt Picker nativ
- Windows Chrome/Edge: `showPicker()` API muss explizit aufgerufen werden

### Lösung
- Input liegt als `opacity: 0` über der gesamten Pille (`position: absolute; inset: 0`)
- **`pointer-events: auto`** — der Input fängt alle Klicks selbst ab (nicht der Wrapper)
- `onClick` auf dem Input ruft `showPicker()` als Fallback auf
- Browser regelt Öffnen/Schließen des Kalenders nativ
- Kein manuelles State-Tracking für Picker-Zustand nötig

```tsx
<input
  type="date"
  onClick={e => { try { e.currentTarget.showPicker(); } catch {} }}
  style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'auto' }}
/>
```

### Verwendungsorte
- `TicketCard.tsx` — Fälligkeitsdatum-Pille in der Kanban-Karte
- `TicketDetailSidebar.tsx` — Fälligkeitsdatum-Pille im Detailpanel

---

## 16. Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `VITE_BREVO_API_KEY` | Ja | Brevo API-Schlüssel für E-Mail-Versand |
| `VITE_BREVO_SENDER_EMAIL` | Nein | Absender-Adresse (Standard: `noreply@drk-ticket.de`) |
| `VITE_BREVO_SENDER_NAME` | Nein | Absendername (Standard: `DRK Serviceportal`) |

Für lokale Entwicklung: `.env.local` anlegen (wird nicht eingecheckt).  
Für Produktion: als GitHub Actions Secrets hinterlegen.

---

## 17. Deployment (GitHub Actions)

- Branch: `main`
- Jeder Push auf `main` triggert automatisch den Build und Deploy auf GitHub Pages
- Build: `npm run build` (Vite)
- Deploy: GitHub Pages aus `dist/` Verzeichnis

---

## 18. Änderungshistorie

| Datum | Änderung |
|---|---|
| Mai 2026 | **Datumskalender-Fix**: `pointer-events: auto` auf Input, `showPicker()` als Fallback — funktioniert auf Safari, Chrome, Windows |
| Mai 2026 | **E-Mail `due_date_changed`**: Terminänderungs-Benachrichtigung nur bei Status In Arbeit oder Überfällig (nicht bei Offen) |
| Mai 2026 | **Drag-Handle**: Karten nur im oberen 24px-Bereich ziehbar, dynamischer Cursor |
| Mai 2026 | **Hover-Effekt**: Ganzkarte reagiert auf Hover (nicht nur Footer) |
| Mai 2026 | **Klick auf Karte**: Body-Klick öffnet Detailpanel direkt |
| Mai 2026 | **Kein Auswahlrahmen**: Selektierte Karte zeigt kein blaues Outline |
| Mai 2026 | **Footer**: Kein Zeigefinger-Cursor im Footer-Bereich |
| Mai 2026 | **Dashboard-Design**: Alert-Karten nebeneinander, Routine-Link als Flex-Kind (`inline`-Prop) |
| Mai 2026 | **FilterBar**: Modernes Chip-Design, „Filter"-Label, „↺ Zurücksetzen"-Button, Pill-Form (border-radius: 20px) |
| Mai 2026 | **Kanban-Header**: Farbiger Punkt + Titel + Zähler + Trennlinie |
| Mai 2026 | **Cards auf Fläche**: Seitenhintergrund grau (`--bg-page`), Spalten weiß mit Schatten |
| Mai 2026 | **Offen-Spalte sortiert nach Datum**: Alle 3 Spalten einheitlich nach Fälligkeitsdatum sortiert |
| Mai 2026 | **Portal 3-Pillen-Zeile**: Bearbeiter / Fällig bis / Status als gleichmäßige Grid-Zeile |
| Mai 2026 | **Portal Textkorrekturen**: Placeholder neutral, „Verlauf" nicht in Großbuchstaben |
