// Spielt EIN Dokument aus einem Backup (backup-live.mjs) zurück – Rückfallplan, z. B. für app_data/facility-management-users.
//   node scripts/restore-doc.mjs /pfad/zur/backup.json app_data/facility-management-users --ja
// Ohne --ja wird nur angezeigt, was zurückgespielt würde (ohne Inhalte/Passwörter zu zeigen).
import { readFileSync } from 'node:fs';
import { FS_BASE, PROJECT, DB, headers } from './lib/live.mjs';

const [datei, pfad] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!datei || !pfad) { console.error('Aufruf: node scripts/restore-doc.mjs backup.json collection/dokument [--ja]'); process.exit(1); }
const backup = JSON.parse(readFileSync(datei, 'utf8'));
const [coll, ...rest] = pfad.split('/');
const name = `projects/${PROJECT}/databases/${DB}/documents/${pfad}`;
const doc = (backup[coll] || []).find(d => d.name.endsWith(`/${coll}/${rest.join('/')}`));
if (!doc) { console.error(`Im Backup nicht gefunden: ${pfad}`); process.exit(1); }
console.log(`Gefunden im Backup: ${pfad} (${Object.keys(doc.fields || {}).join(', ')})`);
if (!process.argv.includes('--ja')) { console.log('Mit --ja zurückspielen (überschreibt das aktuelle Dokument).'); process.exit(0); }
const r = await fetch(`${FS_BASE}/${pfad}`, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ fields: doc.fields }) });
if (!r.ok) { console.error(`Fehler: ${r.status} ${(await r.text()).slice(0, 200)}`); process.exit(1); }
console.log('Zurückgespielt.');
process.exit(0);
