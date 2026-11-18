// Gemeinsame Hilfen für die Skripte gegen das Live-Projekt (oder den lokalen Emulator mit --emulator).
// Zugriff mit dem Inhaber-Token der Firebase-CLI (wie scripts in /DRK/App/Admin-Einrichtung). Es werden nirgends Passwörter gespeichert.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

export const PROJECT = 'drk-facility-dashboard';
export const DB = 'ai-studio-e01f0d33-f3e7-4c71-8027-b8f472b6f9ef';
export const WEB_API_KEY = JSON.parse(readFileSync(new URL('../../firebase-applet-config.json', import.meta.url), 'utf8')).apiKey;

export const EMULATOR = process.argv.includes('--emulator');
const FS_EMU = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH_EMU = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
export const FS_BASE = EMULATOR
  ? `http://${FS_EMU}/v1/projects/${PROJECT}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents`;
export const AUTH_BASE = EMULATOR ? `http://${AUTH_EMU}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com';

// --- Anmeldename → Adresse (identisch mit utils/loginName.ts) ---
export const normalizeLoginName = n => n.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
export const loginEmailFor = n => `${normalizeLoginName(n)}@haustechnik.local`;
export const ALWAYS_ADMIN = ['carlo', 'levent'];

let token = null;
async function ownerToken() {
  if (EMULATOR) return 'owner';
  if (token) return token;
  const cli = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'));
  const r = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: cli.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  })).json();
  if (!r.access_token) throw new Error('Firebase-CLI nicht angemeldet (firebase login).');
  return (token = r.access_token);
}
export async function headers(json = true) {
  return { Authorization: `Bearer ${await ownerToken()}`, 'x-goog-user-project': PROJECT, ...(json ? { 'Content-Type': 'application/json' } : {}) };
}

// --- Firestore-REST-Werte ---
export const fromFs = v => {
  if (v == null) return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  return v;
};
export const toFs = v =>
  v === null || v === undefined ? { nullValue: null }
  : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : Array.isArray(v) ? { arrayValue: { values: v.map(toFs) } }
  : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } }
  : { stringValue: String(v) };
export const fieldsOf = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toFs(v)]));

export async function getDocRaw(path) {
  const r = await fetch(`${FS_BASE}/${path}`, { headers: await headers(false) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Lesen ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return { updateTime: d.updateTime, data: Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFs(v)])) };
}
/** Schreibt ein Dokument. mode: 'neu' (nur wenn es nicht existiert) | { updateTime } (nur wenn unverändert) */
export async function writeDoc(path, data, mode, mask) {
  const q = [];
  if (mode === 'neu') q.push('currentDocument.exists=false');
  else if (mode?.updateTime) q.push(`currentDocument.updateTime=${encodeURIComponent(mode.updateTime)}`);
  for (const m of mask || []) q.push(`updateMask.fieldPaths=${m}`);
  const r = await fetch(`${FS_BASE}/${path}${q.length ? '?' + q.join('&') : ''}`, {
    method: 'PATCH', headers: await headers(), body: JSON.stringify({ fields: fieldsOf(data) }),
  });
  if (r.status === 409 || (r.status === 400 && (await r.clone().text()).includes('ALREADY_EXISTS'))) return 'vorhanden';
  if (r.status === 412 || (r.status === 400 && (await r.clone().text()).includes('FAILED_PRECONDITION'))) return 'geaendert';
  if (!r.ok) throw new Error(`Schreiben ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return 'geschrieben';
}

// --- Firebase Auth (Admin-Schnittstelle der Identity Toolkit) ---
export async function lookupByEmail(email) {
  const r = await fetch(`${AUTH_BASE}/v1/projects/${PROJECT}/accounts:lookup`, { method: 'POST', headers: await headers(), body: JSON.stringify({ email: [email] }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`Konto-Suche: ${j.error?.message || r.status}`);
  return j.users?.[0] || null;
}
export async function createAccount(email, password, displayName) {
  const r = await fetch(`${AUTH_BASE}/v1/projects/${PROJECT}/accounts`, { method: 'POST', headers: await headers(), body: JSON.stringify({ email, password, displayName, emailVerified: false }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`Konto anlegen: ${j.error?.message || r.status}`);
  return j.localId;
}

// --- Passwort verdeckt abfragen (nur im Terminal) ---
export function askHidden(text) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Passwörter werden nur verdeckt im Terminal abgefragt (kein Terminal erkannt).'));
    process.stdout.write(text);
    const stdin = process.stdin;
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    let eingabe = '';
    const onData = ch => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); return resolve(eingabe); }
        if (c === '\u0003') process.exit(1);
        if (c === '\u007f') { if (eingabe) { eingabe = eingabe.slice(0, -1); process.stdout.write('\b \b'); } } else { eingabe += c; process.stdout.write('*'); }
      }
    };
    stdin.on('data', onData);
  });
}
export function askLine(text) {
  return new Promise(resolve => {
    process.stdout.write(text);
    process.stdin.resume(); process.stdin.setEncoding('utf8');
    process.stdin.once('data', d => { process.stdin.pause(); resolve(String(d).trim()); });
  });
}
