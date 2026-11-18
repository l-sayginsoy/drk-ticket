/**
 * Anmeldename → technische Anmelde-Adresse für Firebase Auth.
 * Die Adresse ist nur ein Schlüssel (es gibt keine echte Mailbox, es werden nie Mails dorthin gesendet).
 * MUSS identisch sein mit `loginEmailFor` in functions/userAdmin.js und scripts/lib/live.mjs.
 *   „Heiko Saupert“ → heiko.saupert@haustechnik.local     „Carlo“ → carlo@haustechnik.local
 */
export const AUTH_EMAIL_DOMAIN = 'haustechnik.local';
export const MIN_PASSWORD_LENGTH = 6;
/** Diese beiden sind immer Administratoren (Regel von Levent). Vornamen, kleingeschrieben. */
export const ALWAYS_ADMIN_NAMES = ['carlo', 'levent'];

export const normalizeLoginName = (name: string): string =>
  name.trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');

export const loginEmailFor = (name: string): string => `${normalizeLoginName(name)}@${AUTH_EMAIL_DOMAIN}`;

export const isAlwaysAdmin = (name: string): boolean => ALWAYS_ADMIN_NAMES.includes(name.trim().toLowerCase());

/**
 * Firebase Auth verlangt mindestens 6 Zeichen. Ein bisheriges kürzeres Passwort (Ali: 4 Zeichen, auf Wunsch von Levent
 * unverändert) wird beim Anmelden mit „#“ auf 6 Zeichen aufgefüllt. Eingegeben wird weiter das kurze Passwort.
 * Muss identisch sein mit scripts/lib/live.mjs (toAuthPassword). Neue Passwörter über die Verwaltung haben weiterhin mind. 6 Zeichen.
 */
export const toAuthPassword = (pw: string): string => (pw.length < MIN_PASSWORD_LENGTH ? pw + '#'.repeat(MIN_PASSWORD_LENGTH - pw.length) : pw);
