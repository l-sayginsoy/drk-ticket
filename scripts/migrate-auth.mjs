// Umstellung von Klartext-Passwörtern auf Firebase-Anmeldung – Migrationsschritte (siehe SICHERHEIT_UMBAU.md).
//
//   node scripts/migrate-auth.mjs --plan                      nur ansehen, schreibt nichts, fragt keine Passwörter
//   node scripts/migrate-auth.mjs anmeldung-aktivieren        E-Mail-Anmeldung im Projekt einschalten, Selbstregistrierung sperren
//   node scripts/migrate-auth.mjs konten                      Konten + Rollenprofile + öffentliche Portal-Daten anlegen (Passwörter verdeckt)
//   node scripts/migrate-auth.mjs passwoerter-entfernen --ja  Klartext-Passwörter aus der Benutzerliste löschen (ERST nach dem Ausrollen!)
//
// Zusatz: --emulator → alles gegen lokale Emulatoren (Firestore 8080, Auth 9099) statt Live.
// Bestehende Konten/Profile werden NIE überschrieben. Passwörter nur verdeckt vom Terminal; leere Eingabe = Person überspringen.
import { EMULATOR, PROJECT, AUTH_BASE, headers, getDocRaw, writeDoc, transactUpdate, lookupByEmail, createAccount, askHidden, askLine, loginEmailFor, normalizeLoginName, ALWAYS_ADMIN } from './lib/live.mjs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flag = f => process.argv.includes(f);
const phase = args[0] || (flag('--plan') ? 'plan' : null);
const jetzt = () => new Date().toISOString();
const log = (...a) => console.log(...a);

const USERS_DOC = 'app_data/facility-management-users';
const SETTINGS_DOC = 'app_data/facility-management-settings';
const LOCATIONS_DOC = 'app_data/facility-management-locations';
const PUBLIC_DOC = 'app_data/portal-public';

/** Levent ist immer Administrator, steht aber bisher nicht in der Benutzerliste. */
const LEVENT = { id: 'user-levent', name: 'Levent', role: 'admin', isActive: true, skills: [], availability: { status: 'Verfügbar', leaveUntil: null }, color: '#2563EB' };

async function lade() {
  const u = await getDocRaw(USERS_DOC);
  if (!u) throw new Error('Benutzerliste nicht gefunden.');
  const list = Array.isArray(u.data.value) ? u.data.value : [];
  return { doc: u, list };
}
const rolleFuer = p => (ALWAYS_ADMIN.includes(p.name.trim().toLowerCase()) ? 'admin' : p.role);

function portalPublic(settings, locations, users) {
  const s = settings || {};
  return {
    appName: s.appName || 'Serviceportal',
    portalSubtitle: s.portalSubtitle || '',
    portalMaintenance: { enabled: !!s.portalMaintenance?.enabled, message: s.portalMaintenance?.message || '' },
    ticketCategories: (s.ticketCategories || []).map(c => ({ id: c.id, name: c.name, ...(c.default_priority ? { default_priority: c.default_priority } : {}) })),
    locations: (locations || []).filter(l => l.isActive).map(l => l.name),
    staffLoginNames: users.filter(u => u.isActive && (u.role === 'techniker' || u.role === 'hauswirtschaft')).map(u => u.name),
  };
}

async function plan() {
  const { doc, list } = await lade();
  log(`Plan (${EMULATOR ? 'Emulator' : 'Projekt ' + PROJECT}) – es wird nichts geschrieben.\n`);
  const personen = [...list];
  const hatLevent = list.some(u => u.name.trim().toLowerCase() === 'levent');
  if (!hatLevent) personen.push(LEVENT);
  for (const p of personen) {
    const email = loginEmailFor(p.name);
    const konto = await lookupByEmail(email);
    const profil = konto ? await getDocRaw(`users/${konto.localId}`) : null;
    log(`${p.name.padEnd(20)} ${email.padEnd(40)} Rolle ${rolleFuer(p).padEnd(14)} Konto: ${konto ? 'vorhanden, zuletzt angemeldet: ' + (konto.lastLoginAt ? new Date(Number(konto.lastLoginAt)).toLocaleString('de-DE') : 'noch nie') : 'wird angelegt'}  Profil: ${profil ? 'vorhanden' : 'wird angelegt'}  Passwortfeld in Liste: ${p.password ? 'ja (' + p.password.length + ' Zeichen)' : 'nein'}${p.password && p.password.length < 6 ? '  ⚠ zu kurz für Firebase (min. 6) → neues Passwort nötig' : ''}${p === LEVENT ? '  (wird in die Benutzerliste aufgenommen)' : ''}`);
  }
  const pub = await getDocRaw(PUBLIC_DOC);
  log(`\n${PUBLIC_DOC}: ${pub ? 'vorhanden' : 'wird angelegt (Name, Kategorien, Standorte, Namen fürs Anmeldeformular)'}`);
  const cfg = await fetch(`${AUTH_BASE}/admin/v2/projects/${PROJECT}/config`, { headers: await headers(false) }).then(r => r.json()).catch(() => ({}));
  log(`E-Mail-Anmeldung im Projekt: ${cfg.signIn?.email?.enabled ? 'AN' : 'AUS (Schritt „anmeldung-aktivieren“)'}; Selbstregistrierung: ${cfg.client?.permissions?.disabledUserSignup ? 'gesperrt' : 'offen (wird gesperrt)'}`);
  log(`Benutzerliste zuletzt geändert: ${doc.updateTime}`);
}

async function anmeldungAktivieren() {
  if (EMULATOR) { log('Im Emulator nicht nötig (E-Mail-Anmeldung ist dort immer an).'); return; }
  const patch = async (mask, body) => {
    const r = await fetch(`${AUTH_BASE}/admin/v2/projects/${PROJECT}/config?updateMask=${mask}`, { method: 'PATCH', headers: await headers(), body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
  };
  // 1) E-Mail/Passwort-Anmeldung einschalten + Selbstregistrierung sperren (Konten legen nur Admins an)
  let r = await patch('signIn.email,client.permissions.disabledUserSignup', { signIn: { email: { enabled: true, passwordRequired: true } }, client: { permissions: { disabledUserSignup: true } } });
  if (!r.ok) {
    log(`Selbstregistrierung ließ sich nicht sperren (${r.j.error?.message || r.status}) – schalte nur die Anmeldung ein.`);
    r = await patch('signIn.email', { signIn: { email: { enabled: true, passwordRequired: true } } });
    if (!r.ok) throw new Error(`Konfiguration: ${r.j.error?.message || r.status}`);
  }
  log(`E-Mail/Passwort-Anmeldung: ${r.j.signIn?.email?.enabled ? 'AN' : '?'}; Selbstregistrierung gesperrt: ${r.j.client?.permissions?.disabledUserSignup ? 'ja' : 'nein/unbekannt'}`);
}

async function konten() {
  const { doc, list } = await lade();
  const personen = [...list];
  let neuInListe = false;
  if (!list.some(u => u.name.trim().toLowerCase() === 'levent')) { personen.push(LEVENT); neuInListe = true; }

  const testPw = EMULATOR ? process.env.MIGRATION_TEST_PASSWORD : null;   // nur für Emulator-Tests
  log('Passwörter werden nur hier abgefragt und nirgends gespeichert. Leere Eingabe = diese Person überspringen.\n');
  const ergebnis = [];
  for (const p of personen) {
    const email = loginEmailFor(p.name);
    const rolle = rolleFuer(p);
    let konto = await lookupByEmail(email);
    let uid = konto?.localId, neu = false;
    if (!uid) {
      let pw = testPw;
      if (!pw) {
        const eigen = ALWAYS_ADMIN.includes(p.name.trim().toLowerCase());
        pw = await askHidden(`Passwort für ${p.name} (${rolle}${eigen ? ', eigenes Passwort' : ', Startpasswort'}), mind. 6 Zeichen, leer = überspringen: `);
        if (pw) { const pw2 = await askHidden('  Wiederholen: '); if (pw !== pw2) { log('  Stimmt nicht überein – übersprungen.'); pw = ''; } }
      }
      if (!pw) { ergebnis.push([p.name, 'übersprungen']); continue; }
      if (pw.length < 6 || pw !== pw.trim()) { ergebnis.push([p.name, 'Passwort zu kurz (min. 6) oder Leerzeichen am Rand – übersprungen']); continue; }
      uid = await createAccount(email, pw, p.name); neu = true;
    }
    const profil = await writeDoc(`users/${uid}`, { role: rolle, name: p.name, userId: p.id, active: p.isActive !== false, loginEmail: email, createdAt: jetzt(), createdBy: 'migration' }, 'neu');
    ergebnis.push([p.name, `${neu ? 'Konto neu' : 'Konto vorhanden'}, Profil ${profil}`]);
  }
  if (neuInListe) {
    const res = await transactUpdate(USERS_DOC, (d) => {
      const l = Array.isArray(d.value) ? d.value : [];
      if (l.some(u => u.name.trim().toLowerCase() === 'levent')) return null;
      return { value: [...l, LEVENT], updated_at: jetzt() };
    });
    ergebnis.push(['Levent', `in Benutzerliste aufgenommen: ${res}`]);
  }
  const settings = (await getDocRaw(SETTINGS_DOC))?.data.value;
  const locs = (await getDocRaw(LOCATIONS_DOC))?.data.value;
  const pub = await writeDoc(PUBLIC_DOC, { value: portalPublic(settings, locs, list), updated_at: jetzt() }, 'neu');
  ergebnis.push([PUBLIC_DOC, pub]);
  log('\nErgebnis:'); for (const [a, b] of ergebnis) log(`  ${String(a).padEnd(24)} ${b}`);
  log('\nDanach: neuen Client deployen, dann Regeln, dann „passwoerter-entfernen“ (siehe SICHERHEIT_UMBAU.md).');
}

async function passwoerterEntfernen() {
  if (!flag('--ja')) { log('Dieser Schritt löscht die Klartext-Passwörter aus der Benutzerliste. Nur nach dem Ausrollen (neuer Client + neue Regeln) und mit --ja.'); return; }
  let betroffen = 0;
  const res = await transactUpdate(USERS_DOC, (d) => {
    const l = Array.isArray(d.value) ? d.value : [];
    betroffen = l.filter(u => 'password' in u).length;
    if (!betroffen) return null;
    return { value: l.map(({ password, ...rest }) => rest), updated_at: jetzt() };
  });
  if (res === 'unveraendert') log('Keine Passwortfelder mehr vorhanden.');
  else log(res === 'geschrieben' ? `Passwortfelder entfernt bei ${betroffen} Personen.` : 'Nicht geschrieben – die Liste wurde inzwischen geändert, bitte erneut starten.');
}

try {
  if (phase === 'plan') await plan();
  else if (phase === 'anmeldung-aktivieren') await anmeldungAktivieren();
  else if (phase === 'konten') await konten();
  else if (phase === 'passwoerter-entfernen') await passwoerterEntfernen();
  else { console.error('Aufruf: --plan | anmeldung-aktivieren | konten | passwoerter-entfernen --ja   (optional --emulator)'); process.exit(1); }
} catch (e) { console.error('FEHLER:', e.message); process.exit(1); }
process.exit(0);
