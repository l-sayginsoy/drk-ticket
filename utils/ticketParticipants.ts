import { Ticket } from '../types';
import { normalizePersonName } from './displayNames';

/** Alle Personen, die an einem Ticket arbeiten. Der erste Eintrag bleibt verantwortlich. */
export function ticketParticipants(ticket: Ticket): string[] {
  const names = [ticket.technician, ...(ticket.coTechnicians || [])]
    .map(name => typeof name === 'string' ? name.trim() : '')
    .filter(name => name && name !== 'N/A');

  return names.filter((name, index) =>
    names.findIndex(other => normalizePersonName(other) === normalizePersonName(name)) === index
  );
}

/** Prüft Namen tolerant gegen Hauptbearbeiter und Mitwirkende. */
export function isTicketParticipant(ticket: Ticket, person: string | null | undefined): boolean {
  const target = normalizePersonName(person);
  return !!target && ticketParticipants(ticket).some(name => normalizePersonName(name) === target);
}
