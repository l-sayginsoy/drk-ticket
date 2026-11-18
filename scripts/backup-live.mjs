// Lesendes Backup aller Firestore-Daten des Live-Projekts in EINE JSON-Datei (außerhalb des Repos ablegen!).
// Nur lesende Aufrufe. Die Datei enthält (bis zur Umstellung) Klartext-Passwörter → Rechte 600, nie committen.
//   node scripts/backup-live.mjs /pfad/zur/datei.json
import { writeFileSync, chmodSync } from 'node:fs';
import { FS_BASE, headers } from './lib/live.mjs';

const ziel = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!ziel) { console.error('Aufruf: node scripts/backup-live.mjs /pfad/zur/datei.json'); process.exit(1); }
const out = {};
for (const c of ['app_data', 'tickets', 'routine_tickets', 'completed_tickets', 'events', 'users', 'locations', 'assets', 'maintenancePlans']) {
  const docs = [];
  let token = '';
  do {
    const r = await fetch(`${FS_BASE}/${c}?pageSize=300${token ? '&pageToken=' + encodeURIComponent(token) : ''}`, { headers: await headers(false) });
    const j = await r.json();
    if (j.error) throw new Error(`${c}: ${j.error.message}`);
    docs.push(...(j.documents || []));
    token = j.nextPageToken || '';
  } while (token);
  out[c] = docs;
  console.log(`${c.padEnd(18)} ${docs.length}`);
}
writeFileSync(ziel, JSON.stringify(out));
chmodSync(ziel, 0o600);
console.log(`\nGeschrieben: ${ziel}`);
