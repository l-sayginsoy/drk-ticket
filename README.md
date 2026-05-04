<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e01f0d33-f3e7-4c71-8027-b8f472b6f9ef

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
# drk-ticket
## Cursor Arbeitsregel für diese App

Dies ist die interne DRK Haustechnik Service / Facility Ticket App.

Wichtig:
Bestehendes Design, bestehende Funktionen und bestehende Firebase Verbindung dürfen nicht zerstört werden.

Die App hat bereits:
- Login / Admin Bereich
- Ticket Dashboard
- Firebase Verbindung
- GitHub Anbindung
- Online Deployment

Cursor soll bei Änderungen immer zuerst die vorhandene Struktur prüfen und dann gezielt ändern.

Keine großen Layoutänderungen ohne Rückfrage.
Keine bestehenden Komponenten unnötig ersetzen.
Keine Firebase Konfiguration löschen oder neu erfinden.
Keine funktionierenden Dateien komplett überschreiben, wenn eine kleine Änderung reicht.

Design:
Modern, klar, mobilfreundlich, bestehende Optik beibehalten.

Arbeitsweise:
Vor größeren Änderungen kurz sagen, welche Dateien betroffen sind.
Nach Änderungen kurz prüfen, ob Build und lokale Vorschau funktionieren.
Wichtig für Cursor:
Bitte zuerst den gesamten Code analysieren und kurz zusammenfassen, wie die App aktuell aufgebaut ist, bevor Änderungen gemacht werden.

Bei neuen Anforderungen:
Bitte immer erst einen Vorschlag machen, bevor größere Änderungen umgesetzt werden.