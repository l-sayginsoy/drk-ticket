import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { Status, type Ticket } from '../types';

export type TicketWrite = 'create' | 'update' | 'complete' | 'reopen' | 'completed';

export class TicketConflictError extends Error {
  constructor(public current: Ticket | null) {
    super('Der Auftrag wurde inzwischen geändert. Bitte den aktuellen Stand prüfen.');
  }
}

const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  return ak.length === bk.length && ak.every(k => Object.prototype.hasOwnProperty.call(b, k) && equal(a[k], b[k]));
};

/** Change only the edited fields; never replace newer messages with a stale copy. */
export function mergeTicketChange(current: Ticket, original: Ticket, desired: Ticket): Ticket {
  for (const key of ['status', 'dueDate', 'closedAt', 'completionDate', 'completionTime', 'lifecycleRevision']) {
    if (!equal(current[key], original[key])) throw new TicketConflictError(current);
  }
  const merged = { ...current };
  for (const key of new Set([...Object.keys(original), ...Object.keys(desired)])) {
    if (equal(original[key], desired[key])) continue;
    if (!equal(current[key], original[key]) && !equal(current[key], desired[key])) {
      throw new TicketConflictError(current);
    }
    if (desired[key] === undefined) delete merged[key];
    else merged[key] = desired[key];
  }
  return merged;
}

/** Reads and collection moves belong to the SAME transaction (including retries).
 * Explicit create/reopen are the only paths allowed to create active documents.
 * Standard document transactions are required for this app's realtime listeners.
 */
export async function persistTicket(db: Firestore, desired: Ticket, mode: TicketWrite, original?: Ticket, normalize: (t: Ticket) => Ticket = t => t): Promise<Ticket> {
  return runTransaction(db, async tx => {
    const activeRef = doc(db, desired.origin === 'routine' ? 'routine_tickets' : 'tickets', desired.id);
    const otherRef = doc(db, desired.origin === 'routine' ? 'tickets' : 'routine_tickets', desired.id);
    const completedRef = doc(db, 'completed_tickets', desired.id);
    const [active, other, completed] = await Promise.all([
      tx.get(activeRef), tx.get(otherRef), tx.get(completedRef),
    ]);
    const activeTicket = active.exists() ? normalize(active.data() as Ticket) : null;
    const completedTicket = completed.exists() ? normalize(completed.data() as Ticket) : null;
    const current = completedTicket ?? activeTicket ?? (other.exists() ? other.data() as Ticket : null);
    if (mode === 'create') {
      const deleted = await tx.get(doc(db, 'app_data', 'deleted-ticket-ids'));
      if (deleted.exists() && (deleted.data().value || []).includes(desired.id)) throw new TicketConflictError(null);
      if (current) throw new TicketConflictError(current);
      tx.set(activeRef, JSON.parse(JSON.stringify(desired)));
      return desired;
    }
    const expectsCompleted = mode === 'reopen' || mode === 'completed';
    const source = expectsCompleted ? completedTicket : activeTicket;
    if (!source || !original || (!expectsCompleted && completedTicket) ||
        (expectsCompleted && source.status !== Status.Abgeschlossen) ||
        (!expectsCompleted && source.status === Status.Abgeschlossen)) {
      throw new TicketConflictError(current);
    }
    let saved = mergeTicketChange(source, original, desired);
    if (mode === 'complete' || mode === 'completed') {
      if (saved.status !== Status.Abgeschlossen) throw new TicketConflictError(current);
      saved = { ...saved, closedAt: saved.closedAt || new Date().toISOString().slice(0, 10), is_reopened: false };
      tx.set(completedRef, JSON.parse(JSON.stringify(saved)));
      tx.delete(activeRef);
      tx.delete(otherRef);
    } else {
      if (saved.status === Status.Abgeschlossen) throw new TicketConflictError(current);
      if (mode === 'reopen') {
        saved = { ...saved, is_reopened: true, lifecycleRevision: (source.lifecycleRevision || 0) + 1 };
        delete saved.closedAt;
        delete saved.completionDate;
        delete saved.completionTime;
        tx.delete(completedRef);
        tx.delete(otherRef);
      }
      tx.set(activeRef, JSON.parse(JSON.stringify(saved)));
    }
    return saved;
  });
}
