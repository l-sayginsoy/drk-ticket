const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const brevoApiKey = defineSecret('BREVO_API_KEY');

const CORS_ORIGINS = [
  'https://drk-facility-dashboard.web.app',
  'https://drk-facility-dashboard.firebaseapp.com',
  'https://www.drk-ticket.de',
  'https://drk-ticket.de',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

/**
 * Versendet dieselbe HTML-/Text-Mail wie die Web-App, aber serverseitig (Google-Egress-IP).
 * Umgeht Brevo „IP-Sicherheit“ und Browser-CORS beim direkten api.brevo.com-Aufruf.
 */
exports.mailToBrevo = onCall(
  {
    region: 'europe-west3',
    secrets: [brevoApiKey],
    cors: CORS_ORIGINS,
    invoker: 'public',
    enforceAppCheck: false,
  },
  async (request) => {
    const key = brevoApiKey.value();
    if (!key) {
      throw new HttpsError('failed-precondition', 'BREVO_API_KEY Secret fehlt (firebase functions:secrets:set).');
    }

    const { to, subject, textContent, htmlContent } = request.data || {};

    if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new HttpsError('invalid-argument', 'Ungültige E-Mail-Adresse.');
    }
    if (typeof subject !== 'string' || subject.length < 1 || subject.length > 220) {
      throw new HttpsError('invalid-argument', 'Betreff ungültig.');
    }
    if (typeof textContent !== 'string' || textContent.length < 1 || textContent.length > 120000) {
      throw new HttpsError('invalid-argument', 'textContent ungültig.');
    }
    if (typeof htmlContent !== 'string' || htmlContent.length < 1 || htmlContent.length > 900000) {
      throw new HttpsError('invalid-argument', 'htmlContent ungültig.');
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': key,
      },
      body: JSON.stringify({
        sender: { email: 'noreply@drk-ticket.de' },
        to: [{ email: to }],
        subject,
        textContent,
        htmlContent,
      }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      console.error('Brevo API', res.status, bodyText.slice(0, 800));
      throw new HttpsError('internal', `Brevo lehnt ab (${res.status}).`);
    }

    return { ok: true, raw: bodyText.slice(0, 200) };
  },
);
