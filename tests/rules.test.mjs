// Regeltests für firestore.sicher.rules – laufen NUR gegen den lokalen Emulator mit erfundenen Daten.
//   npm run test:rules
import { test, before, after, beforeEach, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { persistTicket } from '../utils/ticketPersistence.ts';
import { buildPortalTicket } from '../utils/portalTicket.ts';

const rules = readFileSync('firestore.sicher.rules', 'utf8');
let env;

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-drk-rules', firestore: { rules, host: '127.0.0.1', port: 8788 } });
});
after(async () => { await env.cleanup(); });

const T = (id, o = {}) => ({ id, origin: 'manual', status: 'Offen', title: 'Testauftrag', dueDate: '16.09.2026', technician: 'Heiko Saupert', notes: [], ...o });
const done = t => ({ ...t, status: 'Abgeschlossen', completionDate: '21.09.2026', completionTime: '13:00', closedAt: '2026-09-21' });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/u-admin'), { role: 'admin', name: 'Carlo', active: true });
    await setDoc(doc(db, 'users/u-tech'), { role: 'techniker', name: 'Heiko Saupert', active: true });
    await setDoc(doc(db, 'users/u-hw'), { role: 'hauswirtschaft', name: 'Jessica Geibel', active: true });
    await setDoc(doc(db, 'users/u-off'), { role: 'techniker', name: 'Gesperrt', active: false });
    await setDoc(doc(db, 'app_data/facility-management-users'), { value: [{ id: 'user-1', name: 'admin', role: 'admin' }] });
    await setDoc(doc(db, 'app_data/facility-management-settings'), { value: { adminNotificationEmail: 'x@example.org' } });
    await setDoc(doc(db, 'app_data/portal-public'), { value: { appName: 'Test', ticketCategories: [], locations: ['A'] } });
    await setDoc(doc(db, 'app_data/deleted-ticket-ids'), { value: ['99999'] });
    await setDoc(doc(db, 'tickets/30001'), T('30001'));
    await setDoc(doc(db, 'tickets/30002'), T('30002', { notes: ['alt1', 'alt2'] }));
    await setDoc(doc(db, 'routine_tickets/R1'), T('R1', { origin: 'routine' }));
    await setDoc(doc(db, 'completed_tickets/C1'), done(T('C1', { notes: ['alt'], reporter: 'Melder' })));
    await setDoc(doc(db, 'events/E1'), { id: 'E1', date: '2026-12-01' });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const as = uid => env.authenticatedContext(uid, { email: `${uid}@haustechnik.local` }).firestore();
const ref = (db, p) => doc(db, p);

// ---------------------------------------------------------------------------------------------
describe('anonym (Melder-Portal): alles Interne bleibt zu', () => {
  test('keine Listen/Abfragen auf Tickets, Archiv, Serienaufträge, app_data, events, users', async () => {
    const db = anon();
    for (const c of ['tickets', 'completed_tickets', 'routine_tickets', 'app_data', 'events', 'users', 'locations', 'assets', 'maintenancePlans']) {
      await assertFails(getDocs(collection(db, c)));
    }
    await assertFails(getDocs(query(collection(db, 'tickets'), where('status', '==', 'Offen'))));
    await assertFails(getDocs(query(collection(db, 'tickets'), where('reporter_email', '==', 'a@b.de'))));
  });
  test('Benutzerliste, Einstellungen, Ereignisse, Rollenprofile nicht lesbar', async () => {
    const db = anon();
    await assertFails(getDoc(ref(db, 'app_data/facility-management-users')));
    await assertFails(getDoc(ref(db, 'app_data/facility-management-settings')));
    await assertFails(getDoc(ref(db, 'events/E1')));
    await assertFails(getDoc(ref(db, 'users/u-admin')));
    await assertFails(getDoc(ref(db, 'app_data/routine-completions-2026-11')));
  });
  test('keine Schreibzugriffe auf app_data, events, users, locations', async () => {
    const db = anon();
    await assertFails(setDoc(ref(db, 'app_data/facility-management-users'), { value: [] }));
    await assertFails(setDoc(ref(db, 'app_data/portal-public'), { value: {} }));
    await assertFails(setDoc(ref(db, 'app_data/neu'), { value: 1 }));
    await assertFails(setDoc(ref(db, 'events/E2'), { id: 'E2' }));
    await assertFails(setDoc(ref(db, 'users/u-evil'), { role: 'admin' }));
    await assertFails(setDoc(ref(db, 'locations/l'), { name: 'x' }));
    await assertFails(deleteDoc(ref(db, 'events/E1')));
  });
  test('Tickets: weder löschen noch beliebig ändern', async () => {
    const db = anon();
    await assertFails(deleteDoc(ref(db, 'tickets/30001')));
    await assertFails(deleteDoc(ref(db, 'completed_tickets/C1')));
    await assertFails(updateDoc(ref(db, 'tickets/30001'), { technician: 'Jemand' }));
    await assertFails(updateDoc(ref(db, 'tickets/30001'), { status: 'Abgeschlossen' }));
    await assertFails(setDoc(ref(db, 'routine_tickets/R2'), T('R2', { origin: 'routine' })));
    await assertFails(updateDoc(ref(db, 'routine_tickets/R1'), { title: 'x' }));
  });
  test('öffentlich lesbar: einzelnes Ticket per Nummer (get), portal-public, Sperrliste', async () => {
    const db = anon();
    await assertSucceeds(getDoc(ref(db, 'tickets/30001')));
    await assertSucceeds(getDoc(ref(db, 'completed_tickets/C1')));
    await assertSucceeds(getDoc(ref(db, 'routine_tickets/R1')));
    await assertSucceeds(getDoc(ref(db, 'tickets/gibt-es-nicht')));
    await assertSucceeds(getDoc(ref(db, 'app_data/portal-public')));
    await assertSucceeds(getDoc(ref(db, 'app_data/deleted-ticket-ids')));
  });
});

describe('anonym: Melder-Funktionen', () => {
  const eingabe = { title: 'Wasserhahn tropft', area: 'Schlosspark', location: 'Küche', reporter: 'Erika Muster', reporter_email: 'e@example.org', description: 'tropft seit gestern', categoryId: 'cat-1', wunschTermin: '24.12.2026', photos: ['data:image/jpeg;base64,AAAA'] };
  const neu = (id = '31000', patch = {}) => ({ ...buildPortalTicket(eingabe, { id, entryDate: '18.11.2026', entryTime: '12:00', dueDate: '20.11.2026', priority: 'Niedrig' }), ...patch });

  test('neues Ticket anlegen (echte Client-Funktion + persistTicket)', async () => {
    const db = anon();
    await assertSucceeds(persistTicket(db, neu(), 'create'));
    await assert_exists('tickets/31000', true);
  });
  test('neues Ticket mit Zuweisung, falschem Status, Zusatzfeldern oder fremden Notizen wird abgelehnt', async () => {
    const db = anon();
    await assertFails(persistTicket(db, neu('31001', { technician: 'Heiko Saupert' }), 'create'));
    await assertFails(persistTicket(db, neu('31002', { status: 'In Arbeit' }), 'create'));
    await assertFails(persistTicket(db, neu('31003', { status: 'Abgeschlossen' }), 'create'));
    await assertFails(persistTicket(db, neu('31004', { parkedForReturnOf: 'x' }), 'create'));
    await assertFails(persistTicket(db, neu('31005', { notes: ['gefälscht'] }), 'create'));
    await assertFails(persistTicket(db, neu('31006', { portalIntakePending: false }), 'create'));
    await assertFails(persistTicket(db, neu('31007', { photos: ['a', 'b', 'c', 'd'] }), 'create'));
    await assertFails(persistTicket(db, neu('31008', { origin: 'routine' }), 'create'));
  });
  test('Ticketnummer eines Archiv-, Routine- oder gesperrten Tickets kann nicht neu vergeben werden', async () => {
    const db = anon();
    await assertFails(setDoc(ref(db, 'tickets/C1'), neu('C1')));
    await assertFails(setDoc(ref(db, 'tickets/R1'), neu('R1')));
    await assertFails(setDoc(ref(db, 'tickets/30001'), neu('30001'))); // existiert schon → wäre Überschreiben (update-Regel)
    await assertFails(setDoc(ref(db, 'routine_tickets/R9'), neu('R9')));
  });
  test('Nachricht anhängen: genau eine Notiz mehr, sonst nichts', async () => {
    const db = anon();
    const orig = (await getDoc(ref(db, 'tickets/30002'))).data();
    const saved = await assertSucceeds(persistTicket(db, { ...orig, notes: [...orig.notes, 'Hallo (Melder am 18.11.2026, 12:00)'], hasNewNoteFromReporter: true, reporterNoteReadBy: [] }, 'update', orig));
    assert_eq(saved.notes.length, 3);
  });
  test('Nachricht: bestehende Notizen ändern/löschen, mehrere auf einmal, andere Felder → abgelehnt', async () => {
    const db = anon();
    const orig = (await getDoc(ref(db, 'tickets/30002'))).data();
    const note = 'x (Melder am 18.11.2026, 12:00)';
    await assertFails(updateDoc(ref(db, 'tickets/30002'), { notes: ['neu1', 'alt2', note], hasNewNoteFromReporter: true }));   // alte Notiz geändert
    await assertFails(updateDoc(ref(db, 'tickets/30002'), { notes: ['alt1'], hasNewNoteFromReporter: true }));                    // gelöscht
    await assertFails(updateDoc(ref(db, 'tickets/30002'), { notes: [...orig.notes, note, note], hasNewNoteFromReporter: true })); // zwei
    await assertFails(updateDoc(ref(db, 'tickets/30002'), { notes: [...orig.notes, note], hasNewNoteFromReporter: true, technician: 'N/A' }));
    await assertFails(updateDoc(ref(db, 'tickets/30002'), { notes: [...orig.notes, note], hasNewNoteFromReporter: true, status: 'Offen', priority: 'Hoch' }));
    await assertFails(updateDoc(ref(db, 'tickets/30002'), { notes: [...orig.notes, 5], hasNewNoteFromReporter: true }));
    await assertFails(updateDoc(ref(db, 'tickets/30002'), { notes: [...orig.notes, 'x'.repeat(3001)], hasNewNoteFromReporter: true }));
  });
  test('Wiedereröffnen eines abgeschlossenen Tickets mit Begründung (echter Client-Weg)', async () => {
    const db = anon();
    const archive = (await getDoc(ref(db, 'completed_tickets/C1'))).data();
    const saved = await assertSucceeds(persistTicket(db, { ...archive, status: 'In Arbeit', notes: [...archive.notes, 'Ticket durch Melder wiedereröffnet (am 18.11.2026, 12:00)'], hasNewNoteFromReporter: true, reporterNoteReadBy: [], is_reopened: true }, 'reopen', archive));
    assert_eq(saved.status, 'In Arbeit');
    await assert_exists('completed_tickets/C1', false);
    await assert_exists('tickets/C1', true);
  });
  test('Wiedereröffnen mit verändertem Titel/Techniker/ohne Notiz wird abgelehnt', async () => {
    const db = anon();
    const archive = (await getDoc(ref(db, 'completed_tickets/C1'))).data();
    const base = { ...archive, status: 'In Arbeit', notes: [...archive.notes, 'wieder auf (Melder am x)'], hasNewNoteFromReporter: true, reporterNoteReadBy: [], is_reopened: true };
    await assertFails(persistTicket(db, { ...base, title: 'Anderer Titel' }, 'reopen', archive));
    await assertFails(persistTicket(db, { ...base, technician: 'N/A' }, 'reopen', archive));
    await assertFails(persistTicket(db, { ...base, notes: archive.notes }, 'reopen', archive));
    await assertFails(persistTicket(db, { ...base, status: 'Offen' }, 'reopen', archive));
    await assert_exists('completed_tickets/C1', true);
  });
  test('Archiv kann nicht ohne Wiedereröffnung gelöscht werden', async () => {
    const db = anon();
    await assertFails(deleteDoc(ref(db, 'completed_tickets/C1')));
    await assertFails(setDoc(ref(db, 'completed_tickets/C1'), done(T('C1', { title: 'manipuliert' }))));
  });
});

// Hilfen (Prüfung mit abgeschalteten Regeln)
let _exists = {};
async function assert_exists(path, expected) {
  await env.withSecurityRulesDisabled(async ctx => {
    const s = await getDoc(doc(ctx.firestore(), path));
    if (s.exists() !== expected) throw new Error(`${path}: erwartet exists=${expected}`);
  });
}
async function abgelehnt(p) { try { await p; } catch { return; } throw new Error('hätte abgelehnt werden müssen'); }
function assert_eq(a, b) { if (a !== b) throw new Error(`erwartet ${b}, war ${a}`); }

// ---------------------------------------------------------------------------------------------
describe('angemeldet ohne Rolle / gesperrt: keine Rechte', () => {
  test('fremdes Konto ohne Profil (z. B. selbst angelegt) darf nichts', async () => {
    const db = as('u-fremd');
    await assertFails(getDocs(collection(db, 'tickets')));
    await assertFails(getDocs(collection(db, 'app_data')));
    await assertFails(getDoc(ref(db, 'app_data/facility-management-users')));
    await assertFails(setDoc(ref(db, 'app_data/x'), { value: 1 }));
    await assertFails(setDoc(ref(db, 'users/u-fremd'), { role: 'admin', active: true }));   // kann sich nicht selbst zum Admin machen
    await assertFails(updateDoc(ref(db, 'tickets/30001'), { technician: 'x' }));
    await assertFails(deleteDoc(ref(db, 'tickets/30001')));
  });
  test('gesperrtes Profil (active:false) verliert alle Rechte', async () => {
    const db = as('u-off');
    await assertFails(getDocs(collection(db, 'tickets')));
    await assertFails(getDoc(ref(db, 'app_data/facility-management-settings')));
    await assertFails(setDoc(ref(db, 'app_data/x'), { value: 1 }));
  });
  test('eigenes Profil lesen ja, fremdes nein', async () => {
    await assertSucceeds(getDoc(ref(as('u-tech'), 'users/u-tech')));
    await assertFails(getDoc(ref(as('u-tech'), 'users/u-admin')));
    await assertFails(getDocs(collection(as('u-tech'), 'users')));
  });
});

describe('Techniker und Hauswirtschaft', () => {
  for (const uid of ['u-tech', 'u-hw']) {
    test(`${uid}: Tickets/Archiv/Serienaufträge/app_data/events lesen, Einstellungen schreiben`, async () => {
      const db = as(uid);
      await assertSucceeds(getDocs(collection(db, 'tickets')));
      await assertSucceeds(getDocs(collection(db, 'routine_tickets')));
      await assertSucceeds(getDocs(query(collection(db, 'completed_tickets'), where('closedAt', '>=', '2026-01-01'))));
      await assertSucceeds(getDocs(collection(db, 'app_data')));
      await assertSucceeds(getDocs(collection(db, 'events')));
      await assertSucceeds(getDoc(ref(db, 'app_data/facility-management-users')));
      await assertSucceeds(setDoc(ref(db, 'app_data/facility-management-settings'), { value: { x: 1 }, updated_at: 'jetzt' }));
      await assertSucceeds(setDoc(ref(db, 'app_data/routine-completions-2026-11'), { value: {} }));
      await assertSucceeds(setDoc(ref(db, 'events/E3'), { id: 'E3' }));
    });
    test(`${uid}: Benutzerliste, Standorte, öffentliche Seite, Rollenprofile sind tabu`, async () => {
      const db = as(uid);
      await assertFails(setDoc(ref(db, 'app_data/facility-management-users'), { value: [] }));
      await assertFails(setDoc(ref(db, 'app_data/facility-management-locations'), { value: [] }));
      await assertFails(setDoc(ref(db, 'app_data/portal-public'), { value: {} }));
      await assertFails(setDoc(ref(db, 'users/u-tech'), { role: 'admin', active: true }));
      await assertFails(setDoc(ref(db, 'locations/l'), { name: 'x' }));
      await assertFails(setDoc(ref(db, 'assets/a'), { name: 'x' }));
    });
    test(`${uid}: Ticket anlegen, ändern, abschließen, wieder öffnen (Lebenszyklus)`, async () => {
      const db = as(uid);
      const t = T('40001');
      await assertSucceeds(persistTicket(db, t, 'create'));
      await assertSucceeds(persistTicket(db, { ...t, status: 'In Arbeit' }, 'update', t));
      const t2 = { ...t, status: 'In Arbeit' };
      const archived = await assertSucceeds(persistTicket(db, done(t2), 'complete', t2));
      await assert_exists('tickets/40001', false);
      await assert_exists('completed_tickets/40001', true);
      const reopened = await assertSucceeds(persistTicket(db, { ...archived, status: 'In Arbeit' }, 'reopen', archived));
      assert_eq(reopened.is_reopened, true);
      await assert_exists('completed_tickets/40001', false);
      await assert_exists('tickets/40001', true);
    });
    test(`${uid}: Serienauftrag-Ticket anlegen und abschließen`, async () => {
      const db = as(uid);
      const t = T('R5', { origin: 'routine' });
      await assertSucceeds(persistTicket(db, t, 'create'));
      await assertSucceeds(persistTicket(db, done(t), 'complete', t));
      await assert_exists('routine_tickets/R5', false);
    });
    test(`${uid}: Löschen aktiver Tickets nur im Rahmen von Abschluss/Umzug, nicht einfach so`, async () => {
      const db = as(uid);
      await assertFails(deleteDoc(ref(db, 'tickets/30001')));
      await assertFails(deleteDoc(ref(db, 'routine_tickets/R1')));
      await assertFails(deleteDoc(ref(db, 'completed_tickets/C1')));
    });
  }
});

describe('Admin', () => {
  test('Benutzerliste, Standorte, öffentliche Seite, Rollenprofile schreiben', async () => {
    const db = as('u-admin');
    await assertSucceeds(setDoc(ref(db, 'app_data/facility-management-users'), { value: [] }));
    await assertSucceeds(setDoc(ref(db, 'app_data/facility-management-locations'), { value: [] }));
    await assertSucceeds(setDoc(ref(db, 'app_data/portal-public'), { value: { appName: 'Neu' } }));
    await assertSucceeds(setDoc(ref(db, 'users/u-neu'), { role: 'techniker', active: true, name: 'Neu' }));
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(setDoc(ref(db, 'assets/a'), { name: 'x' }));
  });
  test('Ticket löschen über Sperrliste (Admin-Weg der App) – Archiv nur mit Eintrag in der Sperrliste', async () => {
    const db = as('u-admin');
    await assertFails(deleteDoc(ref(db, 'completed_tickets/C1')));   // ohne Sperrliste nicht
    const batch = writeBatch(db);
    batch.set(ref(db, 'app_data/deleted-ticket-ids'), { value: ['99999', 'C1', '30001'] });
    batch.delete(ref(db, 'completed_tickets/C1'));
    batch.delete(ref(db, 'tickets/30001'));
    await assertSucceeds(batch.commit());
    await assert_exists('completed_tickets/C1', false);
    await assert_exists('tickets/30001', false);
  });
  test('Admin darf aktive Tickets und Serienaufträge direkt löschen', async () => {
    const db = as('u-admin');
    await assertSucceeds(deleteDoc(ref(db, 'tickets/30001')));
    await assertSucceeds(deleteDoc(ref(db, 'routine_tickets/R1')));
  });
});

// ---------------------------------------------------------------------------------------------
describe('Ticket-Lebenszyklus (aus den bisherigen Regeln übernommen) – jetzt mit Anmeldung', () => {
  test('veraltete ÜBERFÄLLIG-Schreibung kann ein abgeschlossenes Ticket nicht wiederbeleben', async () => {
    const db = as('u-tech');
    const t = T('41000');
    await persistTicket(db, t, 'create');
    await persistTicket(db, done(t), 'complete', t);
    await assertFails(setDoc(ref(db, 'tickets/41000'), { ...t, status: 'Überfällig' }));
    await abgelehnt(persistTicket(db, { ...t, status: 'Überfällig' }, 'update', t)); // schon der Client lehnt ab (Konflikt)
    await assert_exists('tickets/41000', false);
  });
  test('altes Abschlussmuster (Archiv schreiben + aktives löschen, Batch) funktioniert', async () => {
    const db = as('u-tech');
    const t = T('41001');
    await setDoc(ref(db, 'tickets/41001'), t);
    const b = writeBatch(db);
    b.set(ref(db, 'completed_tickets/41001'), done(t));
    b.delete(ref(db, 'tickets/41001'));
    await assertSucceeds(b.commit());
  });
  test('Archiv wird nicht gelöscht, wenn niemand gezielt wiedereröffnet hat', async () => {
    const db = as('u-admin');
    const t = T('41002');
    await persistTicket(db, t, 'create');
    await persistTicket(db, done(t), 'complete', t);
    await assertFails(deleteDoc(ref(db, 'completed_tickets/41002')));
    await assertFails(setDoc(ref(db, 'completed_tickets/41002'), { ...done(t), status: 'Offen' }));
  });
  test('Ticketnummern von Archiv/Löschliste können nicht neu vergeben werden', async () => {
    const db = as('u-tech');
    await abgelehnt(persistTicket(db, T('C1'), 'create'));      // Client-Konflikt
    await abgelehnt(persistTicket(db, T('99999'), 'create'));
    await abgelehnt(persistTicket(db, T('30001'), 'create'));
    await assertFails(setDoc(ref(db, 'tickets/C1'), T('C1')));  // und auch die Regel allein (Umgehung des Clients)
  });
  test('zwei Geräte schließen gleichzeitig: genau ein Archiv', async () => {
    const t = T('41003');
    await persistTicket(as('u-tech'), t, 'create');
    const r = await Promise.allSettled([persistTicket(as('u-tech'), done(t), 'complete', t), persistTicket(as('u-admin'), done(t), 'complete', t)]);
    assert_eq(r.filter(x => x.status === 'fulfilled').length, 1);
  });
});
