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
