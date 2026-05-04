const functions = require('firebase-functions');

/**
 * Früher: Klartext-E-Mails per Brevo-SMTP (alter Wortlaut, kein HTML-Layout).
 * Neu: HTML-Transaktionsmails baut und versendet nur die Web-App (App.tsx → Brevo REST).
 *
 * Diese Firestore-Trigger NICHT erneut Mails schicken lassen — sonst sehen Nutzer
 * weiter die „alte“ Klartext-Mail oder doppelte Nachrichten.
 *
 * Nach Änderung einmal deployen:
 *   firebase deploy --only functions --project drk-facility-dashboard
 */
exports.sendTicketConfirmation = functions.firestore
  .document('app_data/{appId}/facility-management-tickets/{ticketId}')
  .onCreate(async () => {
    console.log(
      '[sendTicketConfirmation] skipped — HTML mail is sent by the web app (Brevo REST, App.tsx).',
    );
    return null;
  });

exports.sendNoteNotification = functions.firestore
  .document('app_data/{appId}/facility-management-tickets/{ticketId}')
  .onUpdate(async (change) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();
    if (!newValue?.reporter_email) return null;

    const oldNotesLength = previousValue?.notes?.length ?? 0;
    const newNotesLength = newValue?.notes?.length ?? 0;

    if (newNotesLength > oldNotesLength) {
      console.log(
        '[sendNoteNotification] skipped (new note) — HTML mail is sent by the web app (Brevo REST, App.tsx).',
      );
    }
    return null;
  });
