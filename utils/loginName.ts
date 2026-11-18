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
