// Prüft OHNE Anmeldung (nur der öffentliche Web-Schlüssel, wie ein Fremder), ob Firestore zu ist.
// Schreibt nichts: Schreib- und Löschversuche gehen auf nicht vorhandene Dokumente (…/probe-nicht-vorhanden) bzw. mit
// Vorbedingung „muss existieren“, sodass auch bei offenen Regeln nichts angelegt oder gelöscht wird.
//
//   node scripts/pruefen-anonym.mjs               gegen das Live-Projekt
//   node scripts/pruefen-anonym.mjs --emulator    gegen die lokalen Emulatoren (FIRESTORE_EMULATOR_HOST für abweichenden Port)
// Rückgabewert 0 = alles wie erwartet, 1 = mindestens eine Abweichung.
import { FS_BASE, WEB_API_KEY, EMULATOR } from './lib/live.mjs';

const key = EMULATOR ? '' : `key=${WEB_API_KEY}`;
const q = (extra = '') => [extra, key].filter(Boolean).join('&');
const url = (path, extra) => `${FS_BASE}/${path}${q(extra) ? '?' + q(extra) : ''}`;
let abweichungen = 0;
const check = (name, ok, detail) => { if (!ok) abweichungen++; console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ' – ' + detail : ''}`); };
const code = async r => { const t = await r.text(); try { return JSON.parse(t)?.error?.status || (r.ok ? 'OK' : `HTTP ${r.status}`); } catch { return r.ok ? 'OK' : `HTTP ${r.status}`; } };

console.log(`Anonyme Prüfung (${EMULATOR ? 'Emulator' : 'LIVE'})\n`);

// --- muss GESCHLOSSEN sein ---
for (const c of ['tickets', 'completed_tickets', 'routine_tickets', 'app_data', 'events', 'users', 'locations', 'assets']) {
  const r = await fetch(`${FS_BASE}:runQuery${key ? '?' + key : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: c }], limit: 1 } }) });
  const s = await code(r);
  check(`Liste/Abfrage ${c} abgelehnt`, s === 'PERMISSION_DENIED', s);
}
for (const p of ['app_data/facility-management-users', 'app_data/facility-management-settings', 'app_data/routine-completions-2026-11', 'events/probe-nicht-vorhanden', 'users/probe-nicht-vorhanden']) {
  const s = await code(await fetch(url(p)));
  check(`Lesen ${p} abgelehnt`, s === 'PERMISSION_DENIED', s);
}
for (const p of ['app_data/probe-nicht-vorhanden', 'events/probe-nicht-vorhanden', 'users/probe-nicht-vorhanden', 'tickets/probe-nicht-vorhanden', 'routine_tickets/probe-nicht-vorhanden', 'completed_tickets/probe-nicht-vorhanden']) {
  const s = await code(await fetch(url(p, 'currentDocument.exists=true&updateMask.fieldPaths=probe'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { probe: { stringValue: 'x' } } }) }));
  check(`Schreiben ${p} abgelehnt`, s === 'PERMISSION_DENIED', s);
}
// (Löschen von tickets/routine_tickets lässt sich an nicht vorhandenen Dokumenten nicht prüfen – das deckt der Regeltest ab.)
for (const p of ['app_data/probe-nicht-vorhanden', 'events/probe-nicht-vorhanden', 'completed_tickets/probe-nicht-vorhanden']) {
  const s = await code(await fetch(url(p), { method: 'DELETE' }));
  check(`Löschen ${p} abgelehnt`, s === 'PERMISSION_DENIED', s);
}

// --- muss GEÖFFNET sein (Melder-Portal) ---
for (const p of ['tickets/probe-nicht-vorhanden', 'completed_tickets/probe-nicht-vorhanden', 'routine_tickets/probe-nicht-vorhanden']) {
  const s = await code(await fetch(url(p)));
  check(`Melder: einzelnes Ticket lesen (${p.split('/')[0]}) erlaubt`, s === 'NOT_FOUND' || s === 'OK', s);
}
for (const p of ['app_data/portal-public', 'app_data/deleted-ticket-ids']) {
  const s = await code(await fetch(url(p)));
  check(`Melder: ${p} lesbar`, s === 'OK', s);
}
const pub = await (await fetch(url('app_data/portal-public'))).json();
const inhalt = JSON.stringify(pub);
check('portal-public enthält keine Passwörter/E-Mail-Adressen', !/password|passwort|@/i.test(inhalt));

console.log(abweichungen ? `\n${abweichungen} Abweichung(en)!` : '\nAlles wie erwartet: nach außen zu, nur die Melder-Wege offen.');
process.exit(abweichungen ? 1 : 0);
