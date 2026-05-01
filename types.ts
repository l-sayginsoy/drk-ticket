export enum Status {
  Offen = 'Offen',
  InArbeit = 'In Arbeit',
  Ueberfaellig = 'Überfällig',
  Abgeschlossen = 'Abgeschlossen',
}

export enum Priority {
  Hoch = 'Hoch',
  Mittel = 'Mittel',
  Niedrig = 'Niedrig',
}

export enum Role {
  Admin = 'admin',
  Technician = 'techniker',
}

export enum AvailabilityStatus {
  Available = 'Verfügbar',
  OnLeave = 'Abwesend',
}

export interface User {
  id: string;
  name: string;
  role: Role;
  password?: string;
  isActive: boolean;
  skills: string[];
  availability: {
    status: AvailabilityStatus;
    leaveUntil: string | null; // YYYY-MM-DD
  };
}

export interface Location {
  id: string;
  name: string;
  isActive: boolean;
}

export interface TicketCategory {
  id: string;
  name: string;
  default_priority?: Priority;
}

export interface SLARule {
  id: string;
  categoryId: string;
  priority: Priority;
  responseTimeHours: number;
}

export interface RoutingRule {
  id: string;
  keyword: string; // Comma-separated
  skill: string;
}

export interface AppSettings {
  appName: string;
  defaultPriority: Priority;
  portalConfig: {
    showStatus: boolean;
    showTechnicianLogin: boolean;
    showAdminLogin: boolean;
  };
  dueDateRules: Record<Priority, number>; // Legacy, will be superseded by SLA matrix
  ticketCategories: TicketCategory[];
  slaMatrix: SLARule[];
  routingRules: RoutingRule[];
}

export interface MaintenancePlan {
  id: string;
  assetId: string;
  taskDescription: string;
  intervalDays: number;
  requiredSkill: string;
  ticketPriority: Priority;
  lastGenerated: string; // YYYY-MM-DD
}

export interface MaintenanceEvent {
  eventId: string;
  ticketId: string;
  date: string; // YYYY-MM-DD
  description: string;
  type: 'repair' | 'maintenance';
  costs: {
    laborHours: number;
    materials: number;
  };
}

export interface Asset {
  id: string;
  name: string;
  locationId: string;
  details: {
    type: string;
    manufacturer: string;
    model: string;
    installDate: string; // YYYY-MM-DD
    qrCode?: string;
  };
  maintenancePlanId?: string;
  maintenanceHistory: MaintenanceEvent[];
}

export type GroupableKey = 'status' | 'technician' | 'priority' | 'area';

export type TicketType = 'reactive' | 'preventive';

export interface Ticket {
  id: string;
  ticketType: TicketType;
  title: string;
  area: string; // Corresponds to Location name
  location: string;
  reporter: string;
  reporter_email?: string;
  entryDate: string; // DD.MM.YYYY
  dueDate: string; // DD.MM.YYYY
  status: Status;
  technician: string;
  priority: Priority;
  categoryId?: string;
  assetId?: string;
  completionDate?: string; // DD.MM.YYYY
  wunschTermin?: string; // DD.MM.YYYY
  photos?: string[];
  description?: string;
  notes?: string[];
  hasNewNoteFromReporter?: boolean;
  is_emergency?: boolean;
  is_reopened?: boolean;
  costs?: {
    laborHours: number;
    materials: number;
  };
}