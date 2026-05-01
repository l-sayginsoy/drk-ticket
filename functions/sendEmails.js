const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
        user: '[a959dd001@smtp-brevo.com]',
        pass: '[P3GaXvBIA92bScn5]'
    }
});

exports.sendTicketConfirmation = functions.firestore
    .document('app_data/{appId}/facility-management-tickets/{ticketId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        if (!data || !data.reporter_email) {
            return null;
        }

        const mailOptions = {
            from: 'noreply@drk-ticket.de',
            to: data.reporter_email,
            subject: `Ihre Meldung wurde erfasst – Ticket ${context.params.ticketId}`,
            text: `Vielen Dank für Ihre Meldung. Ihre Ticketnummer lautet ${context.params.ticketId}. Den Status Ihrer Meldung können Sie jederzeit unter https://drk-ticket.de abrufen.`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log('Confirmation email sent successfully');
        } catch (error) {
            console.error('Error sending confirmation email:', error);
        }
        return null;
    });

exports.sendNoteNotification = functions.firestore
    .document('app_data/{appId}/facility-management-tickets/{ticketId}')
    .onUpdate(async (change, context) => {
        const newValue = change.after.data();
        const previousValue = change.before.data();

        if (!newValue || !newValue.reporter_email) {
            return null;
        }

        const oldNotesLength = (previousValue && previousValue.notes) ? previousValue.notes.length : 0;
        const newNotesLength = (newValue && newValue.notes) ? newValue.notes.length : 0;

        if (newNotesLength > oldNotesLength) {
            const mailOptions = {
                from: 'noreply@drk-ticket.de',
                to: newValue.reporter_email,
                subject: `Neuigkeit zu Ihrem Ticket ${context.params.ticketId}`,
                text: `Es gibt eine Neuigkeit zu Ihrer Meldung. Bitte prüfen Sie den Status unter https://drk-ticket.de mit Ihrer Ticketnummer ${context.params.ticketId}.`
            };

            try {
                await transporter.sendMail(mailOptions);
                console.log('Note notification email sent successfully');
            } catch (error) {
                console.error('Error sending note notification email:', error);
            }
        }
        return null;
    });
