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
Serienaufträge (Routinen) · Brevo-E-Mails · Stale-Erinnerungen · **Interner Staff-Chat**
(nur Team, **keine E-Mail**, Farbe pro Absender, scrollbar) · **Zurückstellen/Parken** · Melder-Portal.

## Zuletzt abgeschlossen (Stand: Juni 2026)
Folgende Punkte wurden in der letzten Session fertiggestellt, committed und deployed:

- **Interner Staff-Chat** (`utils/staffChat.ts`): `readBy`-Modell pro Person, **kein E-Mail-Versand**,
  WhatsApp-Bubbles mit Absenderfarbe, zwei Kanäle (Team-Chat / Melder-Verlauf), Auto-Scroll.
  > Wichtig: `hasNewStaffMessage`-Flag und Mail-Versand für Chat NICHT wieder einbauen.
- **Zurückstellen/Parken**: direkt per Dropdown, „Ohne Erinnerung" Option (`handleParkConfirm`)
- **Board-Redesign** (`TicketCard.tsx`, `KanbanColumn.tsx`):
  - Farbige Spaltenköpfe (grau/blau/rosa), graue Spalte `#E9EBEF` → Tiefe, weiße Karten
  - Linker Kartenbalken = Priorität (Hoch rot, Mittel orange, Niedrig grün)
  - Keine Pill-Zeile mehr; Footer: Avatar-Chip · Datum-Chip · Icons (`ti-messages` + `ti-mail`)
  - ⋯-Menü oben rechts für Statuswechsel (Overlay-`<select>`)
- **Sidebar** (`components/Sidebar.tsx`): Dunkles Design `#353B48`, DRK-Logo auf weißem Container

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
