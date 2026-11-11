import { Firestore, FieldPath, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';
import { RoutineDayCompletion } from '../types';

/**
 * Serienauftrag-Haken liegen NICHT mehr im gemeinsamen Einstellungs-Dokument (dort hat jedes Gerät
 * beim Speichern seinen evtl. veralteten Stand zurückgeschrieben und fremde Haken gelöscht).
 * Jetzt: ein app_data-Dokument pro Monat; jeder Haken ist ein eigenes Feld und wird einzeln
 * gesetzt/entfernt → gleichzeitige Haken verschiedener Geräte können sich nicht mehr überschreiben.
 */
export const ROUTINE_COMPLETIONS_DOC_PREFIX = 'routine-completions-';
export const ROUTINE_COMPLETIONS_MIGRATION_DOC = 'routine-completions-migrated-v1';

export const completionKey = (c: Pick<RoutineDayCompletion, 'scheduleId' | 'date' | 'subtaskId'>) =>
  `${c.scheduleId}__${c.date}__${c.subtaskId || '_'}`;

const monthDocId = (ymd: string) => `${ROUTINE_COMPLETIONS_DOC_PREFIX}${ymd.slice(0, 7)}`;

const clean = (c: RoutineDayCompletion): RoutineDayCompletion => JSON.parse(JSON.stringify(c));

export function flattenCompletionDocs(docs: Record<string, Record<string, RoutineDayCompletion> | undefined>): RoutineDayCompletion[] {
  const out: RoutineDayCompletion[] = [];
  Object.values(docs).forEach((m) => {
    if (m && typeof m === 'object') Object.values(m).forEach((c) => { if (c && c.scheduleId && c.date) out.push(c); });
  });
  return out;
}

export async function writeCompletions(db: Firestore, entries: RoutineDayCompletion[]): Promise<void> {
  const byMonth = new Map<string, RoutineDayCompletion[]>();
  entries.forEach((c) => {
    const id = monthDocId(c.date);
    byMonth.set(id, [...(byMonth.get(id) || []), c]);
  });
  const now = new Date().toISOString();
  await Promise.all([...byMonth.entries()].map(async ([id, list]) => {
    const ref = doc(db, 'app_data', id);
    const args: unknown[] = [];
    list.forEach((c) => args.push(new FieldPath('value', completionKey(c)), clean(c)));
    try {
      // updateDoc ersetzt genau diese Felder (ohne Reste alter Einträge), lässt alle anderen stehen.
      await (updateDoc as any)(ref, new FieldPath('updated_at'), now, ...args);
    } catch {
      // Monatsdokument existiert noch nicht → anlegen (merge: andere Felder bleiben erhalten).
      const value: Record<string, RoutineDayCompletion> = {};
      list.forEach((c) => { value[completionKey(c)] = clean(c); });
      await setDoc(ref, { value, updated_at: now }, { merge: true });
    }
  }));
}

export async function removeCompletions(db: Firestore, entries: Pick<RoutineDayCompletion, 'scheduleId' | 'date' | 'subtaskId'>[]): Promise<void> {
  const byMonth = new Map<string, string[]>();
  entries.forEach((c) => {
    const id = monthDocId(c.date);
    byMonth.set(id, [...(byMonth.get(id) || []), completionKey(c)]);
  });
  const now = new Date().toISOString();
  await Promise.all([...byMonth.entries()].map(([id, keys]) => {
    const args: unknown[] = [];
    keys.forEach((k) => args.push(new FieldPath('value', k), deleteField()));
    return (updateDoc as any)(doc(db, 'app_data', id), new FieldPath('updated_at'), now, ...args).catch(() => {});
  }));
}
