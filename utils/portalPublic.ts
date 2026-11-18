import { Role, type AppSettings, type Location, type User } from '../types';

/** Das einzige Stück Einstellungen, das ohne Anmeldung lesbar ist (app_data/portal-public). */
export interface PortalPublic {
  appName: string;
  portalSubtitle?: string;
  portalMaintenance?: { enabled: boolean; message: string };
  ticketCategories: { id: string; name: string; default_priority?: string }[];
  /** Namen aktiver Standorte fürs Meldeformular */
  locations: string[];
  /** Namen aktiver Mitarbeitender (Service-Team) für die Auswahlliste im Anmeldeformular */
  staffLoginNames: string[];
}

export const buildPortalPublic = (s: AppSettings, locations: Location[], users: User[]): PortalPublic => ({
  appName: s.appName,
  portalSubtitle: s.portalSubtitle ?? '',
  portalMaintenance: s.portalMaintenance ? { enabled: !!s.portalMaintenance.enabled, message: s.portalMaintenance.message ?? '' } : { enabled: false, message: '' },
  ticketCategories: (s.ticketCategories || []).map(c => ({ id: c.id, name: c.name, ...(c.default_priority ? { default_priority: c.default_priority } : {}) })),
  locations: locations.filter(l => l.isActive).map(l => l.name),
  staffLoginNames: users.filter(u => u.isActive && (u.role === Role.Technician || u.role === Role.Housekeeping)).map(u => u.name),
});
