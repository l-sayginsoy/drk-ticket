const { onCall, HttpsError } = require('firebase-functions/v2/https');

const SENDER_EMAIL = 'noreply@drk-ticket.de';
const SENDER_NAME  = 'DRK Serviceportal';

/**
 * Sendet eine Transaktions-E-Mail über die Brevo REST-API.
 * Der API-Key bleibt serverseitig in process.env.BREVO_API_KEY (functions/.env).
 *
 * Aufruf vom Frontend:
 *   const fn = httpsCallable(functions, 'sendBrevoMail');
 *   await fn({ to, subject, htmlContent, textContent });
 */
exports.sendBrevoMail = onCall(
  { region: 'europe-west3', cors: true },
  async (request) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'BREVO_API_KEY nicht konfiguriert.');
    }

    const { to, subject, htmlContent, textContent } = request.data || {};
    if (!to || !subject) {
      throw new HttpsError('invalid-argument', 'to und subject sind Pflichtfelder.');
    }

    const body = JSON.stringify({
      sender:      { email: SENDER_EMAIL, name: SENDER_NAME },
      to:          [{ email: String(to) }],
      subject:     String(subject),
      htmlContent: String(htmlContent || ''),
      textContent: String(textContent || ''),
    });

    let res;
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body,
      });
    } catch (err) {
      throw new HttpsError('unavailable', `Netzwerkfehler: ${String(err)}`);
    }

    const rawText = await res.text();
    if (!res.ok) {
      let detail = rawText.slice(0, 400);
      try {
        const j = JSON.parse(rawText);
        if (j?.message) detail = j.message;
      } catch { /* ignore */ }
      console.error(`Brevo Fehler ${res.status}: ${detail}`);
      throw new HttpsError('internal', `Brevo HTTP ${res.status}: ${detail}`);
    }

    let messageId = '';
    try { messageId = JSON.parse(rawText)?.messageId || ''; } catch { /* ignore */ }
    console.info(`Brevo OK → ${to} | messageId: ${messageId}`);
    return { ok: true, messageId };
  }
);

/**
 * Prüft, ob der Brevo-API-Key gültig ist (kein Mailversand).
 * Wird vom Admin-Dashboard alle 30 Min aufgerufen.
 */
exports.checkBrevoHealth = onCall(
  { region: 'europe-west3', cors: true },
  async () => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      return { ok: false, status: 0, message: 'BREVO_API_KEY nicht konfiguriert.' };
    }
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        method:  'GET',
        headers: { 'api-key': apiKey, Accept: 'application/json' },
      });
      const text = await res.text();
      if (res.ok) return { ok: true, status: res.status, message: '' };
      let msg = text.slice(0, 400);
      try { const j = JSON.parse(text); if (j?.message) msg = j.message; } catch { /* ignore */ }
      return { ok: false, status: res.status, message: msg };
    } catch (err) {
      return { ok: false, status: 0, message: String(err) };
    }
  }
);
