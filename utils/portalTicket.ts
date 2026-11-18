import { Status, type Priority, type Ticket } from '../types';

/**
 * Ticket, wie das ANONYME Melder-Portal es anlegt. Es kennt weder Benutzer noch andere Tickets noch
 * Routing-Regeln, deshalb:
 *  - keine Zuweisung (technician 'N/A'), Status Offen
 *  - `portalIntakePending: true` → ein angemeldeter Mitarbeiter-Browser übernimmt Zuweisung, Priorität
 *    nach Routing-Regeln und die Admin-Benachrichtigung (siehe App.tsx `processPortalIntake`).
 * Die Feldliste muss zu `portalTicketKeys()` in firestore.sicher.rules passen (Regeltest prüft das).
 */
export type PortalTicketInput = Pick<Ticket,
  'title' | 'area' | 'location' | 'reporter' | 'description'> & Partial<Pick<Ticket,
  'reporter_email' | 'categoryId' | 'wunschTermin' | 'photos'>>;

export function buildPortalTicket(
  input: PortalTicketInput,
  extra: { id: string; entryDate: string; entryTime: string; dueDate: string; priority: Priority },
): Ticket {
  const t: Record<string, unknown> = {
    ticketType: 'reactive',
    title: input.title,
    area: input.area,
    location: input.location,
    reporter: input.reporter,
    description: input.description ?? '',
    categoryId: input.categoryId || '',
    photos: input.photos ?? [],
    notes: [],
    id: extra.id,
    entryDate: extra.entryDate,
    entryTime: extra.entryTime,
    status: Status.Offen,
    priority: extra.priority,
    technician: 'N/A',
    dueDate: extra.dueDate,
    hasNewNoteFromReporter: false,
    is_emergency: false,
    autoAssigned: false,
    isNew: true,
    portalIntakePending: true,
  };
  if (input.reporter_email?.trim()) t.reporter_email = input.reporter_email.trim();
  if (input.wunschTermin) t.wunschTermin = input.wunschTermin;
  return t as unknown as Ticket;
}
