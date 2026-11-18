// Test der Cloud Function adminManageUser gegen die LOKALEN Emulatoren (Auth 9099, Functions 5001, Firestore 8080).
// Voraussetzung: Emulatoren laufen, seed-emulator + migrate-auth konten --emulator (Passwort der Testkonten: Test-1234).
process.argv.push('--emulator');
const { getDocRaw } = await import('./lib/live.mjs');
const FN = 'http://127.0.0.1:5001/drk-facility-dashboard/europe-west3/adminManageUser';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test';
const PW = 'Test-1234';
let fehler = 0;
const check = (name, cond, extra = '') => { if (!cond) fehler++; console.log(`${cond ? '✔' : '✘'} ${name}${extra ? ' – ' + extra : ''}`); };

const login = async (email, password) => {
  const r = await fetch(AUTH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json();
  return r.ok ? j.idToken : null;
};
const call = async (token, data) => {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ data }) });
  const j = await r.json();
  return j.error ? { ok: false, status: j.error.status, message: j.error.message } : { ok: true, ...j.result };
};

const carlo = await login('carlo@haustechnik.local', PW);
const heiko = await login('heiko.saupert@haustechnik.local', PW);
check('Anmeldung mit den Testkonten', !!carlo && !!heiko);

let r = await call(null, { action: 'create', userId: 'u-x', name: 'Max Neu', role: 'techniker', password: 'abcdef' });
check('ohne Anmeldung abgelehnt', !r.ok && r.status === 'UNAUTHENTICATED', r.status);
r = await call(heiko, { action: 'create', userId: 'u-x', name: 'Max Neu', role: 'techniker', password: 'abcdef' });
check('Techniker darf keine Benutzer verwalten', !r.ok && r.status === 'PERMISSION_DENIED', r.status);
r = await call(carlo, { action: 'create', userId: 'u-x', name: 'Max Neu', role: 'techniker', password: 'kurz' });
check('Passwort unter 6 Zeichen abgelehnt', !r.ok && r.status === 'INVALID_ARGUMENT', r.status);
r = await call(carlo, { action: 'create', userId: 'u-x', name: 'Max Neu', role: 'techniker', password: 'abcdef' });
check('Admin legt Benutzer an', r.ok, r.message);
check('neues Konto kann sich anmelden', !!(await login('max.neu@haustechnik.local', 'abcdef')));
const prof = (await (await fetch('http://127.0.0.1:8080/v1/projects/drk-facility-dashboard/databases/ai-studio-e01f0d33-f3e7-4c71-8027-b8f472b6f9ef/documents/users?pageSize=50', { headers: { Authorization: 'Bearer owner' } })).json()).documents.map(d => Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, Object.values(v)[0]]))).find(p => p.userId === 'u-x');
check('Rollenprofil angelegt, Passwort steht nirgends', prof && prof.role === 'techniker' && !JSON.stringify(prof).includes('abcdef'), JSON.stringify(prof && { role: prof.role, name: prof.name }));
r = await call(carlo, { action: 'create', userId: 'u-y', name: 'Max Neu', role: 'techniker', password: 'abcdef' });
check('gleicher Anmeldename wird nicht doppelt vergeben', !r.ok && r.status === 'ALREADY_EXISTS', r.status);

r = await call(carlo, { action: 'setPassword', userId: 'u-x', password: 'neues-Passwort' });
check('Admin setzt neues Passwort', r.ok, r.message);
check('altes Passwort geht nicht mehr, neues geht', !(await login('max.neu@haustechnik.local', 'abcdef')) && !!(await login('max.neu@haustechnik.local', 'neues-Passwort')));

r = await call(carlo, { action: 'update', userId: 'u-x', role: 'hauswirtschaft', name: 'Max Neumann' });
check('Rolle und Name ändern (Anmeldeadresse folgt dem Namen)', r.ok && !!(await login('max.neumann@haustechnik.local', 'neues-Passwort')), r.message);
r = await call(carlo, { action: 'update', userId: 'u-x', active: false });
check('Konto sperren', r.ok && !(await login('max.neumann@haustechnik.local', 'neues-Passwort')), r.message);
r = await call(carlo, { action: 'update', userId: 'u-x', active: true });
check('Konto wieder aktivieren', r.ok && !!(await login('max.neumann@haustechnik.local', 'neues-Passwort')), r.message);

// Carlo und Levent sind geschützt
const carloId = (await getDocRaw('app_data/facility-management-users')).data.value.find(u => u.name === 'Carlo').id;
const leventId = (await getDocRaw('app_data/facility-management-users')).data.value.find(u => u.name === 'Levent').id;
r = await call(carlo, { action: 'update', userId: carloId, role: 'techniker' });
check('Carlo bleibt immer Administrator', !r.ok && r.status === 'FAILED_PRECONDITION', r.status);
r = await call(carlo, { action: 'update', userId: leventId, active: false });
check('Levent kann nicht gesperrt werden', !r.ok && r.status === 'FAILED_PRECONDITION', r.status);
r = await call(carlo, { action: 'delete', userId: leventId });
check('Levent kann nicht gelöscht werden', !r.ok && r.status === 'FAILED_PRECONDITION', r.status);

r = await call(carlo, { action: 'delete', userId: 'u-x' });
check('Benutzer löschen (Konto und Profil)', r.ok && !(await login('max.neumann@haustechnik.local', 'neues-Passwort')), r.message);
r = await call(carlo, { action: 'setPassword', userId: 'gibt-es-nicht', password: 'abcdef' });
check('unbekannte Person → not-found', !r.ok && r.status === 'NOT_FOUND', r.status);

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.');
process.exit(fehler ? 1 : 0);
