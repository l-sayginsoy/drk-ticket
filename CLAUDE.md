# DRK Haustechnik Service – Projektleitfaden für Claude

> Diese Datei wird beim Start **automatisch gelesen**. Sie ist der schnelle Überblick.
> Ausführliche Details aller Funktionen stehen in [SYSTEM_DOKUMENTATION.md](SYSTEM_DOKUMENTATION.md) –
> diese bei Bedarf zuerst lesen (Kapitel 1–25, mit Änderungshistorie am Ende).

## Was ist das?
Ticket-/Auftragsverwaltung für die Haustechnik (DRK Kreisverband). Melder/Bewohner erfassen
Störungen im **Portal**, Mitarbeiter (Admin / Techniker / Hauswirtschaft) bearbeiten sie über ein
**Kanban-Board** und die **Ticket-Detailansicht**.

## Stack
- React 18 + TypeScript + Vite
- Firebase Firestore (Realtime-Listener) + Firebase Hosting
- E-Mail über Brevo REST API
- Deploy: **Push auf `main` → GitHub Actions (Lint → Build → Firebase Hosting)**

## Wichtigste Dateien
| Datei | Inhalt |
|---|---|
| `App.tsx` | Zentrale Logik, State-Handler, E-Mail-Versand |
| `types.ts` | Alle TypeScript-Typen |
| `components/TicketDetailSidebar.tsx` | Ticket-Detail inkl. **internem Chat** + **Melder-Verlauf** |
| `components/TicketCard.tsx` / `KanbanBoard.tsx` | Kanban-Karten & Board |
| `utils/staffChat.ts` | Interner Chat: Lesestatus (`readBy`) pro Person |
| `SYSTEM_DOKUMENTATION.md` | **Vollständige Doku aller Funktionen** |

## Kernfunktionen (Kurzliste – Details in SYSTEM_DOKUMENTATION.md)
Tickets & Status · Kanban-Board · SLA/Fälligkeitsdatum · Auto-Zuweisung (Routing-Regeln) ·
**Selbst-lernendes Routing** (lernt Schlagwort→Person aus manuellen Zuweisungen, ab 2×; manuelle
Regeln haben Vorrang; Übersicht in Einstellungen → Prozesse & Logik; `App.tsx` `learnedRoutingPick`/
`learnFromAssignment`, Daten in `appSettings.learnedRouting`) ·
Serienaufträge (Routinen) · Brevo-E-Mails · Stale-Erinnerungen · **Interner Staff-Chat**
(nur Team, **keine E-Mail**, Farbe pro Absender, scrollbar) · **Zurückstellen/Parken** · Melder-Portal.

## Zuletzt abgeschlossen

### Session 21.06.2026 – „19 vergessene Serienaufträge" (Fehlalarm) + Scroll-Haken (committed & deployed)
- **KRITISCH / Nutzer-Panik – falsche „19 Serienaufträge wurden vergessen"-Meldung:** Nach dem Tageswechsel
  auf den 21.06 zeigte der rote Warnblock 19 **abgehakte, also erledigte** Serienaufträge als „vergessen".
  Der Nutzer vermutete, die SERIEN-Menü-Umgruppierung vom 20.06 habe es kaputtgemacht, und wollte einen
  Tages-Revert. **Vor dem Anfassen geprüft (`git show --stat`): die Menü-/Icon-Commits fassten NUR
  `Sidebar.tsx` an — die Routine-Logik (`App.tsx`) war unberührt.** Ein Revert hätte nichts gefixt, nur
  die Scroll-/Menü-Arbeit weggerissen. **Echte Ursache (Stichtags-Effekt):** Routine-Tickets bekommen ihr
  `dueDate` per **SLA-Regel ab Erstelltag** (`handleAddNewTicket` ~Z.2700) — meist **1 Tag nach dem
  Plantag**. Der Board-Haken speichert das Erledigt-Datum auf den **Tag des Abhakens** (Plantag,
  `handleRoutineDayComplete` ~Z.2217 `localISODate(new Date())`). `missedRoutinesSinceStart` verglich aber
  `completion.date >= dueDate` → ein am Plantag (Fr 19.06) gesetzter Haken fiel gegen `dueDate` 20.06 als
  `19.06 >= 20.06 = false` durch. Auffällig erst, als am 21.06 ein Schwung 20.06-Tickets gleichzeitig
  überfällig kippte. **Fix (`App.tsx` `missedRoutinesSinceStart`):** Abgleich jetzt gegen den **Plantag
  `entryDate`** des Tickets (`c.date >= entryIso`) statt gegen `dueDate`. **Verifiziert via HMR auf den
  geladenen Live-Daten (keine neuen Reads): Warnblock 19 → 0**, kein Sidebar-Badge mehr.
  > **NICHT wieder gegen `dueDate` prüfen** — das SLA-`dueDate` weicht systematisch vom Plantag ab.
  > Echt vergessene Aufträge (ohne Board-Haken) erscheinen weiterhin korrekt.
- **Scroll-Haken in „Abgeschlossen" behoben** (`ErledigtTableView.tsx`, `index.css`, `App.tsx`): Ein erster
  Versuch gab der Tabelle einen **eigenen** vertikalen Scrollbereich (`max-height`+`overflow:auto`+`sticky`-
  Kopf) → **zwei verschachtelte Scroller** im scrollenden `main` → „stockt, hängt, dann weiter"
  (*scroll chaining*). Zurückgenommen: nur **ein** Scrollbereich (die Seite/`main`). Der Auto-Hide-Balken
  auf `main` ist jetzt deutlicher (9px, `rgba(0,0,0,0.4)`, abgerundet, Dark-Mode) und bleibt 1,2 s statt
  0,9 s sichtbar, dann blendet er aus. Gilt für alle Ansichten.
  > **NICHT wieder einbauen:** eigener vertikaler Scroll-Container in der Tabelle (`max-height`+`overflow`)
  > samt `sticky`-Kopf — das war die Haken-Ursache.
- **Versehentlich mitcommittet & korrigiert:** `git add -A` zog `.DS_Store` + das ganze `.claude/`-Verzeichnis
  (inkl. eingebettetem Worktree-Repo) ins Repo. Wieder entfernt (`git rm --cached`) + in `.gitignore`.

### Session 20.06.2026 (2) – Neue-Nachrichten-Glocke statt verstreuter Signale (committed & deployed)
- **Problem (Nutzer-Feedback):** Das Chat-/Melder-Signal war verstreut und verwirrend: zwei „X neu"-Pillen
  oben (Chat blau / Melder orange) **plus** ein Chat-Sprechblasen-Icon im orangen „Zurückgestellt"-Badge
  der Sidebar. Es zeigte nicht, **WO** die Nachricht liegt; da zurückgestellte Tickets vom Board
  ausgeblendet sind, wirkte „neuer Chat" wie ein Phantom. **Chat-Logik geprüft (`utils/staffChat.ts`):
  korrekt** — es war ein echter ungelesener Chat auf einem geparkten (versteckten) Ticket, kein Bug.
- **Lösung (wie große Systeme: Benachrichtigungs-Inbox):** neue Komponente `components/MessageInbox.tsx`
  — eine **Glocke** oben in der Filterleiste (`FilterBar.tsx`) mit aufklappbarer **Liste** aller Tickets
  mit neuer Aktivität (Chat und/oder Melder). Je Zeile: Ticket-Nr., Titel, Art (Chat = blaues Icon,
  Melder = oranges Icon), „zurückgestellt"-Etikett. **Klick öffnet das Ticket direkt** (`onOpenTicket`
  → `setSelectedTicket`). Dropdown als **Portal am `<body>`** (kein Abschneiden durch `overflow`).
  Datengrundlage unverändert (`messageActivityTickets` in `App.tsx`).
- **Sidebar „Zurückgestellt" zeigt wieder NUR die orange Anzahl** (Nutzer-Wunsch: gewohnte Farbe).
  `parkedChatActive`/`parkedReporterActive` (+ die zwei „neu"-Pillen in `FilterBar`) **entfernt**.
- **Nachgeschärft (Nutzer-Wunsch):** (1) **Techniker/Hauswirtschaft sehen in der Glocke nur ihre eigenen
  zugewiesenen Tickets**, Admin alle (Rollen-Filter in `messageActivityTickets`, `App.tsx`). (2) **Glocken-
  Knopf rot** (`#DC2626`, `BELL_COLOR` in `MessageInbox.tsx`) statt blau — Nutzer-Wunsch „rot ist besser"
  (teilt sich den Farbton mit Überfällig, ist als Glocke aber eindeutig). **Listen-Icons** bleiben blau=Chat / orange=Melder.
- **Zwei Folge-Fixes (Nutzer-Test):** (1) Glocke listet Chat & Melder als **getrennte Einträge** und zählt
  die **echte Anzahl** (Ticket mit Chat **und** Melder = „2 neu", vorher „1 neu" + nur Chat-Icon). (2)
  Admin-Banner „… wartet auf Bearbeiter-Zuweisung" zählte über `is_reopened` auch wiedereröffnete, aber
  **bereits zugewiesene** Tickets (Phantom „wo?"). `newMeldungenCount` (`App.tsx`) zählt jetzt nur noch
  **unzugewiesene** (`unassigned && (Offen || is_reopened)`). Verifiziert: Banner als Admin verschwunden.
- **Glocken-Optik (Nutzer-Wunsch):** vollflächig roter Knopf war zu laut neben den dezenten Filtern.
  Jetzt **heller Knopf in derselben Formensprache** wie `.custom-select` (`var(--bg-tertiary)`, feiner
  Rand, radius 9px); **Rot (`#DC2626`/`BELL_COLOR`) nur noch als Akzent** (Glocken-Icon + Zahl). NICHT
  wieder vollflächig rot machen.
- **Feinschliff (Nutzer-Test):** Knopf über eigene Klasse `.msg-inbox-btn`, die `.custom-select` 1:1
  spiegelt → per Messung **pixelidentisch** (36px, gleicher Hintergrund/Rand/Ecken); Browser-**Fokus-Ring
  entfernt** (war der sichtbare Unterschied). **Dropdown-Icons solide** (Chat `#6366f1`, Melder `#F97316`,
  weißes Icon) wie die Karten-Pillen, statt zart getönt. NICHT wieder die getönten Kreise einbauen.
- **Verifikation:** `tsc` + Build grün; Vorschau (als Admin) rendert sauber, Badge = reine Anzahl,
  Glocke korrekt ausgeblendet (kein Ungelesenes für Admin). Live-Demo der Glocke heute nicht möglich
  (Firestore-Tageslimit erneut erschöpft + Admin ohne Ungelesenes); zeigt sich als Torsten.
  > **NICHT wieder einbauen:** das Chat-Sprechblasen-Icon im Sidebar-Badge und die zwei „X neu"-Pillen.
  > Neue Nachrichten laufen jetzt **ausschließlich** über die `MessageInbox`-Glocke. Vgl. [[staff-chat-design]].

### Session 20.06.2026 – Firestore-Quota-Fix: Lesekosten drastisch gesenkt (committed & deployed)
- **Problem:** „Free daily read units per project exceeded" — die App lief ins harte Tageslimit. Wichtig:
  Das Projekt ist **schon auf Blaze**, aber die App-Datenbank ist die **AI-Studio-DB**
  `ai-studio-e01f0d33-…` (Konsolen-Label **„GEMEINSAMES KI-KONTINGENT"**) mit eigenem **harten
  Free-Tageslimit**, das Blaze **nicht** abdeckt → daher der Block trotz Blaze. (DB-ID steht in
  `firebase-applet-config.json` → `firestoreDatabaseId`.) Die anderen `ai-studio-…`-DBs sind leere
  Überbleibsel — **nicht** die Ursache, Löschen bringt nichts. **`ai-studio-e01f0d33-…` NIE löschen.**
- **Ursache im Code:** Bei **jedem Laden** + **jedem Monatswechsel** wurde die unbegrenzt wachsende
  `completed_tickets`-Sammlung **mehrfach voll gelesen** (Dashboard: ~44k–62k Reads/Tag, nur ~29k davon
  „Echtzeit"). Zwei alte Einmal-Migrationen scannten dafür die ganze Historie: (1) `fetchData`
  `Promise.all([getDocs(tickets/completed_tickets/routine_tickets)])` + Verschiebe-/Ghost-Cleanup,
  (2) `loadCompletedTicketsForMonth` Schritt 1 (`closedAt`-Backfill).
- **Fix (`App.tsx`):** beide hinter einen **Einmal-Schalter** gelegt — app_data-Dokument
  `data-migrations-v1` (`APP_DATA_KEY_MIGRATIONS_DONE`) + Ref `migrationsDoneRef`. Solange nicht gesetzt,
  laufen die Migrationen **einmal** und setzen danach das Flag; danach werden die Voll-Scans bei jedem
  Laden **übersprungen**. Initialer Monats-Load in den `finally`-Block von `fetchData` verschoben, damit
  der Schalter vorher feststeht. Offene/aktive Tickets kommen weiter live über `onSnapshot` (klein).
- **Verifikation:** bewusst **kein** Live-Preview-Test (Vorschau = echte Firestore → würde Reads
  verbrennen + Schalter vorzeitig setzen). `tsc --noEmit` ist sauber; echter Nachweis = Reads-Kurve im
  Firebase-Dashboard fällt über den Folgetag deutlich.
  > **Recovery:** app_data-Dokument `data-migrations-v1` in Firestore löschen → Migrationen laufen
  > einmalig erneut. Die alten Voll-Scans (jeden Lauf die ganze `completed_tickets` lesen) **nicht**
  > wieder einbauen.

### Session 19.06.2026 (2) – E-Mail-Flut gestoppt + Zurückgestellt-Signal ins Badge (committed & deployed)
- **E-Mail-Politik an den Melder bewusst minimal** (`App.tsx` `commitTicketUpdate`): **ENTFERNT** wurden
  `ticket_in_progress` (Mail bei Statuswechsel „In Arbeit") und `due_date_changed` (Mail bei
  Terminänderung) — das waren die Floods beim Umverteilen/Hin-und-Herschieben. Siehe Hard-Rule unten.
- **Sidebar „Zurückgestellt"**: Das separate Aktivitäts-Badge sprengte die Breite (langes Wort +
  Anzahl-Badge + extra Badge). Jetzt sitzt ein kleines `ti-message-circle`-Icon **direkt im vorhandenen
  Anzahl-Badge**, wenn dort neue Nachrichten/Chat liegen (`parkedChatActive`/`parkedReporterActive` aus
  `App.tsx` → Sidebar). Kein zusätzlicher Platzbedarf. Top-Filter-Badges sind reine Zähler (kein Klick).

### Session 19.06.2026 – Zuweisung an Abwesende → „Wartet auf Rückkehr" (committed & deployed)
**Konzept (bewusst einfach, KEIN Schalter):** Ein erster Versuch mit einem dauerhaften
`assigneeLocked`-Schalter („Nur <Name> – bei Abwesenheit parken") wurde komplett zurückgenommen
(verwirrte, weil er auch bei Anwesenheit angezeigt wurde). Jetzt rein zustandsgetrieben:
- **Bearbeiter-Dropdowns** (`TicketCard`, `TicketDetailSidebar`): Abwesende sind auswählbar, nur mit
  „(Abwesend)" markiert (kein `disabled` mehr).
- **Zuweisung an einen Abwesenden** (`commitTicketUpdate` + `handleAddNewTicket`): Ticket →
  `Status.Zurückgestellt` + Feld `parkedForReturnOf=<Name>` + `parkedAt`. In `ZurückgestelltView`
  oranges Label „Wartet auf Rückkehr von <Name>".
- **Rückkehr** (eigener `useEffect`, Deps `[tickets, users]`, ist-zustand-basiert → robust auch nach
  Reload): `parkedForReturnOf`-Person wieder verfügbar → Ticket automatisch wieder `Offen`, Marker weg.
- **Umweisen** eines geparkten Tickets an eine andere/verfügbare Person → reaktiviert (Marker weg).
  Manuelles Entparken (beide Wege) löscht den Marker.
- Es gibt **nur** das Feld `parkedForReturnOf` (kein `assigneeLocked`). Die alte **Auto-Umleitung weg vom
  Abwesenden** in `commitTicketUpdate`/`handleAddNewTicket` ist **entfernt** — sie verhinderte die
  bewusste Zuweisung. **Nicht wieder einbauen.**
> **Harte Umverteilungs-Regel bleibt intakt:** Das Auto-Zurückholen fasst NUR Tickets mit
> `parkedForReturnOf`-Marker an, nie manuell zurückgestellte. Den Marker-Check nicht entfernen.

### Session 18.06.2026 (2) – Serienauftrag-Info-Mail, Serienaufträge-Optik, einheitliche Prioritäts-Pillen (committed & deployed)
- **Serienauftrag: Info-E-Mail bei Erledigung** (`types.ts` `notifyEmail`, `RoutineEditorModal.tsx`, `App.tsx`):
  pro Serienauftrag eine (oder mehrere, kommagetrennt) E-Mail hinterlegbar. Sobald der Auftrag für den
  Tag **vollständig** abgehakt ist (Checkliste: letzte Unteraufgabe), geht eine stille Brevo-Mail raus.
  Dedupe über `appSettings.routineNotifySent` (`scheduleId|YYYY-MM-DD`), beim Zurücknehmen Marker gelöscht.
  Versand in `handleRoutineDayComplete` + `handleToggleRoutineSubtask` (`maybeBuildRoutineDoneNotify`).
  Das Nachweis-Korrektur-Tool (`handleSetRoutineCompletion`) löst bewusst KEINE Mail aus (Backfill).
- **Serienaufträge-Liste beruhigt** (`RoutineSchedulesView.tsx`): Drag-Griff entfernt, Gruppen als graue
  Bänder (grauer Balken + Label + Zähler), kompakte Zeilen, „Zuständig"-Namen in normaler Textfarbe
  (vorher grün), Spaltenbreiten ausgewogen (Aufgabe 30 %).
- **Prioritäts-Pillen einheitlich** (`ErledigtTableView`, `ZurückgestelltView`, `TicketTableView`):
  `.priority-pill { min-width: 72px; box-sizing: border-box }` → Hoch/Mittel/Niedrig gleich breit.
  Kanban-Karten-Pillen (`TicketCard` `.pill`) absichtlich nicht angefasst.

### Session 18.06.2026 – E-Mail-Link öffnet Ticket sofort, Serienauftrag-Warnblock respektiert Board-Haken (committed & deployed)
- **E-Mail-Status-Link öffnet das Ticket SOFORT** (`components/Portal.tsx`): Der Link aus der Mail
  zeigte oft „Ticket wurde nicht gefunden", obwohl die Nummer stimmte — erst „zurück + Status prüfen"
  ging. Zwei Ursachen: (1) **abgeschlossene Tickets** werden nicht live ins Portal geladen → nie
  gefunden; (2) der Deep-Link rastete „nicht gefunden" **dauerhaft** ein, wenn das Ticket beim ersten
  Laden noch nicht im Speicher war. Neu: Resolver `resolveTicketById` — erst Speicher (sofort), sonst
  **direkt aus Firestore** (`tickets`/`routine_tickets`/`completed_tickets`, alle `allow read: if true`).
  Kein `dataReady`-Warten mehr, findet auch abgeschlossene Tickets. „Status prüfen" nutzt denselben
  Resolver.
  > **Achtung React-StrictMode:** das alte cancel-on-cleanup-Flag wurde im Dev-Doppel-Mount abgebrochen
  > → Spinner hing ewig. Jetzt Ref-Guard `deepLinkStarted` (einmalige Auflösung), **kein** cancel-Flag.
  > Nicht wieder einbauen.
- **Serienauftrag-Warnblock respektiert jetzt den Board-Haken** (`App.tsx` `missedRoutinesSinceStart`):
  Der rote Block blieb stehen, obwohl die Aufgabe im Serienaufträge-Board abgehakt war — weil Block
  (Ticket-`Status.Ueberfaellig`) und Board-Haken (`routineDayCompletions`, Zeitplan+Tag) **zwei
  getrennte Datentöpfe** sind. Jetzt wird ein Auftrag ausgeblendet, wenn ein Erledigt-Eintrag desselben
  Zeitplans am Fälligkeitstag **oder später** existiert. Reine Anzeige-Logik, keine Status-Mutation.

### Session 17.06.2026 – Login-Fix, Board-Heute-Spalte, Einstellungen aufgeräumt (committed & deployed)
- **SICHERHEIT – Login/Passwörter** (`App.tsx` ~Z.1578): Der Init-Effekt setzte bei jedem Laden Name
  **und** Passwort der fest angelegten Konten (admin/Heiko/Ali/Torsten) zwangsweise auf Defaults zurück
  → ein selbst vergebenes Admin-Passwort ging beim Reload verloren (Lockout). Jetzt: **Name** wird weiter
  normalisiert (Tickets referenzieren ihn — nicht aufweichen), **Passwort** nur gesetzt, wenn keines
  vorhanden ist. `admin/admin` ist nur noch Fallback, solange das Passwortfeld leer ist.
  > **Recovery bei vergessenem Passwort:** Passwortfeld des Kontos in Firestore (`facility-management-users`)
  > leeren → beim nächsten Laden greift wieder der Default. Es gibt bewusst **kein** „Passwort vergessen?".
  > Login: Name case-insensitive, Passwort exakt (`components/Portal.tsx`).
- **Serienaufträge-Board – „Heute"-Spalte zeigt letzten Termin** (`RoutineSchedulesView.tsx`): Aufgaben,
  die heute nicht fällig sind (z. B. Di-Routine an einem Mi), zeigten nur „—" und wirkten unerledigt.
  Jetzt: **letzter fälliger Termin (≤ heute)** mit demselben Kreis-+-Haken-+-Name-System (Datum im Tooltip);
  nicht erledigt = „—". Heute fällige Aufgaben unverändert (klickbarer Kreis).
  > Nutzer-Wunsch: keine „zuletzt <Datum>"-Zeile in der Zelle — exakt wie die anderen aussehen.
- **Serien-Nachweis aufgeräumt** (`RoutineNachweisView.tsx`): redundanter „Verlauf"-Streifen entfernt;
  es bleibt **Jahresübersicht** (12 Monatskärtchen, farbcodierte Fälligkeitstage) + **Farb-Legende**.
- **Einstellungen: „Serientermine"-Tab entfernt** (`SettingsView.tsx`): redundant — Erstellen/Bearbeiten
  läuft jetzt in der Serienaufträge-Ansicht. Tab + Editor + Drag-Sortierung + Pending-Logik + tote
  Helfer/Imports raus.
- **Benutzer-Liste: Farbpunkt neben Namen entfernt** (`SettingsView.tsx`): der kleine Inline-Farbwähler
  rechts vom Namen ist weg; Avatar-Farbe weiterhin über **Bearbeiten** änderbar.

### Session 15.06.2026 – Layout/UI-Feinschliff (committed & deployed)
- **Board-Breite** (`App.tsx`, `.kanban-workbench`): max-width **2400px** (vorher 1300→1600→2000→2400).
  Füllt 24"+-Monitore, wächst mit dem Fenster, deckelt erst auf sehr breiten Displays. Die
  Dashboard-Banner-Zeile ist auf dieselbe max-width 2400 + zentriert gesetzt → bündige Kanten zum Board.
  > **Deckel hoch halten!** Sonst driftet das zentrierte Board (`margin:auto`) beim Sidebar-Einklappen
  > zur Mitte (Nutzer: „das Dashboard verschiebt sich"). Bei 2400 füllt es bei üblicher Fensterbreite
  > in beiden Sidebar-Zuständen → rechte Kante bleibt fix, Board wächst nur nach links mit.
  > Nutzer-Display ist ~3008px breit und mag **keine leere Fläche rechts**.
- **Filter-Leiste moderner** (`components/FilterBar.tsx`): weiße Controls mit dezentem Schatten statt
  grauer Pillen, eckiger (radius 9px), Chips umschließen ihren Inhalt (kein `min-width` mehr),
  aktiver Filter = dunkles Badge, „Filter"-Label mit `ti-adjustments-horizontal` Icon.
- **Serienauftrag-Banner** (`components/DashboardRoutineLinkBar.tsx`): dunkler Text auf hellem Grün
  (vorher Grün-auf-Grün, kaum lesbar), Aufgabennamen mit hellgrauen Trennpunkten (`•`).
- **Scrollbalken ausgeblendet** (`index.css`): auf `main`, `.sidebar` UND `.nav-menu`
  (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`). Grund: der 8px-Balken nahm Breite weg
  und verschob das Layout, sobald er bei kleinerem Fenster erschien. Scrollen per Wheel/Trackpad bleibt.
  > **Achtung:** Der echte Sidebar-Scroller ist `.nav-menu`, NICHT `.sidebar` — beide Regeln nötig.
  > Layout immer auch bei **kleinem** Fenster testen (1280×800) — der Fehler zeigt sich nur dann.

### Frühere Session – Staff-Chat & Board-Redesign
- **Interner Staff-Chat** (`utils/staffChat.ts`): `readBy`-Modell pro Person, **kein E-Mail-Versand**,
  WhatsApp-Bubbles mit Absenderfarbe, zwei Kanäle (Team-Chat / Melder-Verlauf), Auto-Scroll.
  > Wichtig: `hasNewStaffMessage`-Flag und Mail-Versand für Chat NICHT wieder einbauen.
- **Zurückstellen/Parken**: direkt per Dropdown, „Ohne Erinnerung" Option (`handleParkConfirm`)
- **Board-Redesign** (`TicketCard.tsx`, `KanbanColumn.tsx`):
  - Farbige Spaltenköpfe (grau/blau/rosa), graue Spalte `#E9EBEF` → Tiefe, weiße Karten
  - Linker Kartenbalken = Priorität (Hoch rot, Mittel orange, Niedrig grün)
  - Karten haben jetzt eine 3-Spalten-Meta-Zeile (Priorität · Fällig bis · Status mit Farb-Dots),
    Footer = Bearbeiter-Chip + Chat-/Mail-Icons
  - ⋯-Menü oben rechts für Statuswechsel (Overlay-`<select>`)
- **Sidebar** (`components/Sidebar.tsx`): Dunkles Design `#353B48`, DRK-Logo auf weißem Container

## Serienaufträge – Ist-Zustand & offene Aufgabe (Stand 15.06.2026)

**Wunsch des Nutzers:** „Wenn ein Serienauftrag nicht abgeklickt wurde, muss er **stehen bleiben** –
wie ‚Überfällig' im oberen Menü, mit **Warnhinweis** (‚wurde vergessen / nicht gemacht')."

**Was heute schon existiert (teilweise umgesetzt):**
- Serienauftrag-Tickets (`origin === 'routine'`) werden im Kanban-Dashboard **ausgeblendet**
  (`App.tsx`, `filteredTickets` ~Z. 2657) – sie erscheinen nur in der Listenansicht.
- `missedRoutinesSinceStart` (`App.tsx` ~Z. 2617): Routine-Tickets mit `Status.Ueberfaellig` und
  Fälligkeit ≥ `ROUTINE_WARN_START` (`2026-06-16`).
- **Roter Dashboard-Banner**: „X Serienaufträge wurden nicht abgeschlossen — Bitte prüfen"
  (`App.tsx` ~Z. 3358), klickbar → Serienaufträge-Ansicht.
- **Sidebar-Badge** `missedRoutinesCount` am Menüpunkt „Serienaufträge".
- **Serien-Nachweis-Ansicht** (`components/RoutineNachweisView.tsx`): „! X verpasst" pro Routine.

**Umgesetzt am 15.06.2026 (Nutzer-Entscheidung: „großer Warnblock ganz oben"):**
- Der kleine Banner ist jetzt ein **prominenter roter Warnblock** ganz oben (`App.tsx` ~Z. 3358),
  der **stehen bleibt bis erledigt**: Kopfzeile „X Serienaufträge wurden **vergessen**" +
  „Alle ansehen"-Button → Serienaufträge-Ansicht. Darunter eine **Liste** jedes vergessenen
  Auftrags (Name · Standort · „fällig war <Datum>" · Bearbeiter), jede Zeile klickbar
  (öffnet das Ticket via `setSelectedTicket`). Ab 7 Einträgen: „und N weitere … alle ansehen".
- Datengrundlage unverändert (`missedRoutinesSinceStart`). Block `max-width: 2400` zentriert,
  bündig zum Board. Wird auf allen Ansichten gezeigt (nicht nur Dashboard), damit er nicht untergeht.
- Verworfen wurden: eigene 4. Kanban-Spalte und „mit in Überfällig-Spalte" (Nutzer wollte Warnblock).

## ⚠️ Harte Regel: E-Mail-Versand (Flut vermeiden)
Der Nutzer will **keine E-Mail-Flut**. An den **Melder** gehen NUR diese drei automatischen Mails:
1. **`ticket_created`** – Eingangsbestätigung bei Ticket-Erstellung (`handleAddNewTicket`).
2. **`staff_note`** – wenn ein **Mitarbeiter** eine Notiz in der Melder-Konversation schreibt
   (`commitTicketUpdate`; nur wenn die Notiz NICHT vom Melder stammt).
3. **`ticket_closed`** – wenn das Ticket auf `Abgeschlossen` gesetzt wird (`commitTicketUpdate`).
> **NICHT wieder einbauen:** `ticket_in_progress` (Mail bei „In Arbeit") und `due_date_changed`
> (Mail bei Terminänderung) wurden bewusst **entfernt** — sie fluteten beim Umverteilen/Statuswechsel.
> **Umverteilen/Verschieben/Statuswechsel löst KEINE Melder-Mail aus.** Der **interne Chat** verschickt
> NIE eine Mail. Willst du, dass der Melder etwas erfährt → als Mitarbeiter eine **Notiz** schreiben.
> Opt-in-Mails (nur wenn Adresse hinterlegt) bleiben: `admin_new_ticket` (Admin-Mail bei neuem Ticket,
> `adminNotificationEmail`), Stale-Erinnerung an Techniker, Serienauftrag-Erledigt-Mail (`notifyEmail`).

## ⚠️ Harte Regel: Automatische Umverteilung (Abwesenheit/Rückkehr)
Bei Abwesend-/Rückkehr-/Aktiv-Schalten eines Mitarbeiters werden Tickets automatisch umverteilt.
**Nur `Offen`, `In Arbeit`, `Überfällig` dürfen jemals automatisch umverteilt werden.**
**`Abgeschlossen` und `Zurückgestellt` werden NIEMALS automatisch angefasst** – die wurden bewusst
manuell verteilt bzw. abgeschlossen und bleiben exakt so, bis ein Mensch sie wieder aufmacht (oder der
Melder sie aufschließt). Durchgesetzt über die **einzige** zentrale Funktion `canRedistribute(ticket)`
(`App.tsx` ~Z. 547). Sie wird in allen 4 Umverteilungs-Wegen benutzt (Abwesenheits-Effekt,
Rückkehr-Effekt, `handleUserUpdated`, `handleManualRedistribution`).
> **Diese Regel nie aufweichen.** Keine neue Umverteilungs-Logik ohne `canRedistribute()`-Filter.
> Offen: Die *Regeln innerhalb* der erlaubten Status (z.B. „nur kritische", Rückkehr zieht offene
> Tickets anderer Abwesender) sollen laut Nutzer noch geprüft/feinjustiert werden.

## ⚠️ Harte Regel: Login & Passwörter (fest angelegte Konten)
Login prüft **Klartext-Passwörter** im `users`-Doc (`facility-management-users`); Name case-insensitive,
Passwort exakt (`components/Portal.tsx`). Der Init-Effekt in `App.tsx` (~Z.1578) **normalisiert die Namen**
der Konten admin/Heiko/Ali/Torsten (Tickets referenzieren die vollen Namen — **nicht aufweichen**), setzt
das **Passwort aber NUR, wenn keines vorhanden ist**. Selbst vergebene Passwörter müssen erhalten bleiben.
> **Diese Regel nie aufweichen** — den Passwort-Zwangs-Reset NICHT wieder einbauen, sonst Admin-Lockout.
> **Recovery:** Passwortfeld des Kontos in Firestore leeren → Default greift wieder (admin → `admin`).
> Kein „Passwort vergessen?"-Feature (bewusste Entscheidung). Details: SYSTEM_DOKUMENTATION.md Kap. 19.

## Arbeitsweise & Konventionen (wichtig)
- **Vorschau = Live-Prod**: Der Dev-Server (Port 5173) hängt an der **echten** Firestore.
  Beim Testen **keine echten Tickets verändern**.
- **Doku pflegen**: Bei jeder Änderung `SYSTEM_DOKUMENTATION.md` aktualisieren – inkl. der
  **Änderungshistorie** ganz unten (Datum + was geändert wurde). So bleibt „was zuletzt gemacht wurde" sichtbar.
- **Granular committen**: Jede abgeschlossene Änderung als eigener Commit mit klarer Nachricht
  (`feat:` / `fix:`). So ist jeder Schritt einzeln nachvollziehbar **und rücknehmbar**.

## „Einen Schritt zurück" (Rollback)
Jeder Commit ist ein Sicherungspunkt.
- Letzte Schritte ansehen: `git log --oneline -20`
- Letzten Schritt sicher rückgängig machen (erzeugt einen Gegen-Commit): `git revert HEAD`
  danach `git push origin main` → der vorherige Stand wird automatisch deployt.
- Einen bestimmten älteren Schritt zurücknehmen: `git revert <hash>`

Der Nutzer sagt dafür meist einfach **„geh einen Schritt zurück"** – dann den jüngsten
`feat:`/`fix:`-Commit per `git revert` zurücknehmen und deployen.
