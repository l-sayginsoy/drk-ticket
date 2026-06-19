import { Ticket } from '../types';

/** Zustand des internen Chats aus Sicht der angemeldeten Person. */
export type StaffChatState = 'none' | 'unread' | 'awaiting' | 'quiet';

/**
 * - 'none'     : keine Nachrichten
 * - 'unread'   : jemand hat mir geschrieben/geantwortet, von mir noch ungelesen
 * - 'awaiting' : ich war zuletzt dran und warte auf Antwort
 * - 'quiet'    : Chat vorhanden, nichts offen
 */
export const getStaffChatState = (ticket: Ticket, me?: string | null): StaffChatState => {
  const msgs = ticket.staffMessages ?? [];
  if (msgs.length === 0) return 'none';
  if (me) {
    const unreadForMe = msgs.some((m) => m.author !== me && !(m.readBy ?? []).includes(me));
    if (unreadForMe) return 'unread';
    if (msgs[msgs.length - 1].author === me) return 'awaiting';
  }
  return 'quiet';
};

/**
 * Markiert alle fremden Nachrichten als von `me` gelesen. Gibt das aktualisierte
 * Ticket zurück – oder null, wenn nichts zu ändern war (verhindert Render-Schleifen).
 */
export const markStaffMessagesRead = (ticket: Ticket, me: string): Ticket | null => {
  const msgs = ticket.staffMessages ?? [];
  let changed = false;
  const updated = msgs.map((m) => {
    if (m.author !== me && !(m.readBy ?? []).includes(me)) {
      changed = true;
      return { ...m, readBy: [...(m.readBy ?? []), me] };
    }
    return m;
  });
  return changed ? { ...ticket, staffMessages: updated } : null;
};

/**
 * Neue Melder-Nachricht aus Sicht von `me`? `hasNewNoteFromReporter` ist ein
 * globales Flag (gesetzt, wenn der Melder schreibt); `reporterNoteReadBy` merkt
 * sich PRO PERSON, wer sie schon gesehen hat. So verschwindet das Orange nur für
 * den, der das Ticket selbst geöffnet hat – nicht für alle, sobald irgendwer
 * (z. B. zum Chatten) reinschaut.
 */
export const hasUnreadReporterNote = (ticket: Ticket, me?: string | null): boolean => {
  if (!ticket.hasNewNoteFromReporter) return false;
  if (!me) return true;
  return !(ticket.reporterNoteReadBy ?? []).includes(me);
};

/**
 * Markiert die aktuelle Melder-Nachricht als von `me` gelesen (fügt `me` zu
 * `reporterNoteReadBy` hinzu). Gibt das aktualisierte Ticket zurück – oder null,
 * wenn nichts zu ändern war (verhindert Render-Schleifen).
 */
export const markReporterNoteRead = (ticket: Ticket, me: string): Ticket | null => {
  if (!ticket.hasNewNoteFromReporter) return null;
  const readBy = ticket.reporterNoteReadBy ?? [];
  if (readBy.includes(me)) return null;
  return { ...ticket, reporterNoteReadBy: [...readBy, me] };
};
