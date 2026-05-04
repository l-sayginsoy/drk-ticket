/**
 * Firebase Cloud Functions Einstieg.
 * - sendEmails: Legacy-Firestore-Pfade (no-op)
 * - mailToBrevo: serieller Brevo-Versand für die Web-App (HTML wie in App.tsx)
 */
Object.assign(exports, require('./sendEmails'));
Object.assign(exports, require('./mailToBrevo'));
