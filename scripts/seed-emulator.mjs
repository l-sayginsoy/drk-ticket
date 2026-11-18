// Füllt die LOKALEN Emulatoren mit erfundenen Beispieldaten (nie Live). Aufruf: node scripts/seed-emulator.mjs --emulator
import { writeDoc, EMULATOR } from './lib/live.mjs';
if (!EMULATOR) { console.error('Nur mit --emulator (lokale Emulatoren).'); process.exit(1); }
const avail = { status: 'Verfügbar', leaveUntil: null };
const users = [
  { id: 'user-1', name: 'admin', role: 'admin', password: 'altes-passwort', isActive: true, skills: ['all'], availability: avail },
  { id: 'user-2', name: 'Heiko Saupert', role: 'techniker', password: 'Heiko1', isActive: true, skills: ['Sanitär'], availability: avail },
  { id: 'user-3', name: 'Ali Najafi', role: 'techniker', password: 'Ali1', isActive: true, skills: ['HLK'], availability: avail },
  { id: 'user-1778241535562', name: 'Jessica Geibel', role: 'hauswirtschaft', password: 'Jessica1', isActive: true, skills: [], availability: avail },
  { id: 'user-6', name: 'Carlo', role: 'admin', password: 'Carlo12', isActive: true, skills: [], availability: avail },
];
const settings = {
  appName: 'Test-Serviceportal', portalSubtitle: 'Störung melden', portalMaintenance: { enabled: false, message: '' },
  ticketCategories: [{ id: 'cat-1', name: 'Haustechnik', default_priority: 'Mittel' }, { id: 'cat-2', name: 'Hauswirtschaft', default_priority: 'Niedrig' }],
  routingRules: [{ id: 'r1', keyword: 'wasserhahn,rohrbruch', categoryId: 'cat-1', priority: 'Hoch', assignees: ['Heiko Saupert'] }],
  slaMatrix: [], dueDateRules: { Hoch: 1, Mittel: 3, Niedrig: 7 }, defaultPriority: 'Mittel', adminNotificationEmail: '',
  routineSchedules: [], routineDayCompletions: [], portalConfig: { showStatus: true, showTechnicianLogin: true, showAdminLogin: true },
};
const locations = [{ id: 'loc-1', name: 'Schlosspark', isActive: true }, { id: 'loc-2', name: 'Küche', isActive: true }];
const w = (p, d) => writeDoc(p, d, null);
await w('app_data/facility-management-users', { value: users, updated_at: 'seed' });
await w('app_data/facility-management-settings', { value: settings, updated_at: 'seed' });
await w('app_data/facility-management-locations', { value: locations, updated_at: 'seed' });
await w('app_data/data-migrations-v1', { value: { done: true }, updated_at: 'seed' });
await w('app_data/deleted-ticket-ids', { value: [], updated_at: 'seed' });
await w('tickets/30001', { id: '30001', ticketType: 'reactive', title: 'Heizung kalt', description: 'Raum 12', area: 'Schlosspark', location: 'Raum 12', reporter: 'Erika Muster', reporter_email: '', status: 'Offen', priority: 'Mittel', technician: 'Heiko Saupert', entryDate: '17.11.2026', entryTime: '09:00', dueDate: '20.11.2026', notes: [], photos: [], hasNewNoteFromReporter: false });
await w('completed_tickets/30002', { id: '30002', ticketType: 'reactive', title: 'Lampe defekt', description: 'Flur', area: 'Küche', location: 'Flur', reporter: 'Max Beispiel', status: 'Abgeschlossen', priority: 'Niedrig', technician: 'Ali Najafi', entryDate: '01.11.2026', dueDate: '05.11.2026', closedAt: '2026-11-04', completionDate: '04.11.2026', completionTime: '10:00', notes: [], photos: [] });
console.log('Emulator-Beispieldaten angelegt.');
process.exit(0);
