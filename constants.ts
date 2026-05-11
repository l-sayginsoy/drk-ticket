import { Ticket, Status, Priority, User, Role, Location, AppSettings, AvailabilityStatus, Asset, MaintenancePlan } from './types';

export const MOCK_TICKETS: Ticket[] = [
  {
    id: '31001',
    ticketType: 'reactive',
    title: 'DRINGEND: Heizungsausfall im Wohnhaus A',
    area: 'Kreisverband',
    location: 'Wohnhaus A, Gesamtes Gebäude',
    reporter: 'Fr. Dr. Richter',
    entryDate: '06.02.2026',
    dueDate: '06.02.2026',
    status: Status.Ueberfaellig,
    technician: 'N/A',
    priority: Priority.Hoch,
    categoryId: 'cat-gebaeudetechnik',
    assetId: 'asset-heizung-a',
    is_emergency: true,
    description: "Kompletter Heizungsausfall im Wohnhaus A. Bewohner frieren. Benötigen sofortige Entsendung eines Bearbeiters. Höchste Priorität!",
    notes: ["Sofortige Eskalation an alle verfügbaren Bearbeiter. (Admin am 06.02.2026, 08:15)"]
  },
  {
    id: '31002',
    ticketType: 'reactive',
    title: 'Wasserhahn in der Hauptküche tropft stark',
    area: 'Küche',
    location: 'Spülbereich 1',
    reporter: 'Peter Koch',
    entryDate: '05.02.2026',
    dueDate: '12.02.2026',
    status: Status.InArbeit,
    technician: 'Heiko Saupert',
    priority: Priority.Mittel,
    is_emergency: false,
    categoryId: 'cat-komfort',
    description: "Der Wasserhahn am Hauptwaschbecken schließt nicht mehr richtig und es geht permanent Wasser verloren.",
    notes: []
  },
  {
    id: '31003',
    ticketType: 'reactive',
    title: 'Handlauf im Flur vor Zimmer 205 ist locker',
    area: 'An den Seen',
    location: 'Flur, 2. OG West',
    reporter: 'Schwester Maria',
    entryDate: '06.02.2026',
    dueDate: '10.02.2026',
    status: Status.Offen,
    technician: 'N/A',
    priority: Priority.Hoch,
    categoryId: 'cat-sicherheit',
    description: "Sturzgefahr für Bewohner. Bitte umgehend befestigen.",
    notes: []
  },
  {
    id: '31004',
    ticketType: 'reactive',
    title: 'WLAN in der Verwaltung ausgefallen',
    area: 'Verwaltung',
    location: 'Gesamter Verwaltungstrakt',
    reporter: 'Anna Schmidt',
    entryDate: '07.02.2026',
    dueDate: '08.02.2026',
    status: Status.Offen,
    technician: 'Torsten Isselhard',
    priority: Priority.Mittel,
    categoryId: 'cat-it',
    description: "Seit heute Morgen kein Zugriff auf das WLAN möglich. Router wurde bereits neu gestartet, ohne Erfolg.",
    notes: []
  },
  {
    id: '31005',
    ticketType: 'reactive',
    title: 'Abfluss von Industriewaschmaschine verstopft',
    area: 'Wäscherei',
    location: 'Maschine 3',
    reporter: 'Fatima Yilmaz',
    entryDate: '03.02.2026',
    dueDate: '05.02.2026',
    status: Status.Ueberfaellig,
    technician: 'Ali Najafi',
    priority: Priority.Hoch,
    categoryId: 'cat-gebaeudetechnik',
    description: "Wasser läuft beim Abpumpen über. Betrieb in der Wäscherei ist stark beeinträchtigt.",
    notes: ["Ali prüft das heute. (Admin am 04.02.2026, 09:00)"]
  },
  {
    id: '31006',
    ticketType: 'reactive',
    title: 'Deckenleuchte über Tisch 4 flackert',
    area: 'Cafeteria',
    location: 'Sitzbereich',
    reporter: 'Gast',
    entryDate: '07.02.2026',
    dueDate: '14.02.2026',
    status: Status.Offen,
    technician: 'N/A',
    priority: Priority.Niedrig,
    categoryId: 'cat-komfort',
    description: "",
    notes: []
  },
  {
    id: '31007',
    ticketType: 'reactive',
    title: 'Pflegebett lässt sich nicht mehr verstellen',
    area: 'An den Seen',
    location: 'Zimmer 312, Bett 1',
    reporter: 'Pfleger Tom',
    entryDate: '06.02.2026',
    dueDate: '09.02.2026',
    status: Status.InArbeit,
    technician: 'Heiko Saupert',
    priority: Priority.Hoch,
    categoryId: 'cat-sicherheit',
    description: "Die elektrische Höhenverstellung des Pflegebettes reagiert nicht mehr.",
    notes: []
  },
  {
    id: '31008',
    ticketType: 'reactive',
    title: 'Holzlatte an Parkbank gebrochen',
    area: 'Außenbereich',
    location: 'Nähe Haupteingang',
    reporter: 'H. Gärtner',
    entryDate: '01.02.2026',
    dueDate: '15.02.2026',
    status: Status.InArbeit,
    technician: 'Ali Najafi',
    priority: Priority.Niedrig,
    categoryId: 'cat-komfort',
    description: "",
    notes: []
  },
  {
    id: '31009',
    ticketType: 'reactive',
    title: 'Drucker im Büro der Sozialstation druckt nicht',
    area: 'Sozialstation',
    location: 'Büro EG',
    reporter: 'Frau Meier',
    entryDate: '04.02.2026',
    dueDate: '08.02.2026',
    status: Status.InArbeit,
    technician: 'Torsten Isselhard',
    priority: Priority.Mittel,
    categoryId: 'cat-it',
    description: "Fehlermeldung 'Papierstau', obwohl kein Papier feststeckt.",
    notes: []
  },
  {
    id: '31010',
    ticketType: 'reactive',
    title: 'Turnusmäßige Prüfung Feuerlöscher',
    area: 'Brandschutz',
    location: 'Alle Flure',
    reporter: 'System',
    entryDate: '28.01.2026',
    dueDate: '28.02.2026',
    status: Status.InArbeit,
    technician: 'Heiko Saupert',
    priority: Priority.Niedrig,
    categoryId: 'cat-sicherheit',
    description: "Monatliche Sichtprüfung aller Feuerlöscher im Untergeschoss.",
    notes: []
  },
  {
    id: '31011',
    ticketType: 'reactive',
    title: 'Steckdose an der Bühne hat Wackelkontakt',
    area: 'Kleiner Saal',
    location: 'Bühne links',
    reporter: 'Veranstaltungsteam',
    entryDate: '02.02.2026',
    dueDate: '06.02.2026',
    status: Status.Ueberfaellig,
    technician: 'Torsten Isselhard',
    priority: Priority.Mittel,
    categoryId: 'cat-sicherheit',
    description: "Strom fällt bei Benutzung aus. Bitte prüfen.",
    notes: []
  },
  {
    id: '31012',
    ticketType: 'reactive',
    title: 'Fenster zum Terrassenzugang klemmt',
    area: 'Terrasse',
    location: 'Übergang Cafeteria',
    reporter: 'Servicekraft',
    entryDate: '07.02.2026',
    dueDate: '13.02.2026',
    status: Status.Offen,
    technician: 'N/A',
    priority: Priority.Niedrig,
    categoryId: 'cat-komfort',
    description: "Fenster lässt sich nur mit sehr hohem Kraftaufwand öffnen und schließen.",
    notes: []
  },
  {
    id: '31013',
    ticketType: 'reactive',
    title: 'Klimaanlage im Schulungsraum zu kalt',
    area: 'Ausbildung',
    location: 'Schulungsraum 2',
    reporter: 'Dozent Herr Weiss',
    entryDate: '05.02.2026',
    dueDate: '11.02.2026',
    status: Status.InArbeit,
    technician: 'Ali Najafi',
    priority: Priority.Mittel,
    categoryId: 'cat-gebaeudetechnik',
    assetId: 'asset-klima-server',
    description: "Die Temperatur lässt sich am Thermostat nicht regeln, es ist dauerhaft zu kühl.",
    notes: []
  },
  {
    id: '31014',
    ticketType: 'reactive',
    title: 'Wand im Aufenthaltsraum neu streichen',
    area: 'An den Seen',
    location: 'Aufenthaltsraum 3. OG',
    reporter: 'Stationsleitung',
    entryDate: '20.01.2026',
    dueDate: '03.02.2026',
    status: Status.Abgeschlossen,
    technician: 'Heiko Saupert',
    priority: Priority.Niedrig,
    categoryId: 'cat-komfort',
    completionDate: '04.02.2026',
    completionTime: '16:30',
    notes: ["Farbe wurde geliefert. (HS am 01.02.2026, 14:00)", "Arbeiten abgeschlossen. (HS am 04.02.2026, 16:30)"]
  },
  {
    id: '31015',
    ticketType: 'reactive',
    title: 'Schwesternrufanlage in Zimmer 101 defekt',
    area: 'Schlosspark',
    location: 'Zimmer 101',
    reporter: 'Pflegepersonal',
    entryDate: '28.01.2026',
    dueDate: '30.01.2026',
    status: Status.Abgeschlossen,
    technician: 'Torsten Isselhard',
    priority: Priority.Hoch,
    categoryId: 'cat-sicherheit',
    completionDate: '29.01.2026',
    completionTime: '09:45',
    notes: ["Ersatzteil bestellt. (TI am 28.01.2026, 11:00)", "Anlage funktioniert wieder einwandfrei. (TI am 29.01.2026, 09:45)"]
  }
];

export const MOCK_USERS: User[] = [
    { id: 'user-1', name: 'admin', role: Role.Admin, password: 'admin', isActive: true, skills: ['all'], availability: { status: AvailabilityStatus.Available, leaveUntil: null } },
    { id: 'user-2', name: 'Heiko Saupert', role: Role.Technician, password: 'Heiko1', isActive: true, skills: ['Sanitär', 'Allgemein', 'Schließanlagen'], availability: { status: AvailabilityStatus.Available, leaveUntil: null } },
    { id: 'user-3', name: 'Ali Najafi', role: Role.Technician, password: 'Ali1', isActive: true, skills: ['HLK', 'Klima'], availability: { status: AvailabilityStatus.Available, leaveUntil: null } },
    { id: 'user-4', name: 'Torsten Isselhard', role: Role.Technician, password: 'Torsten1', isActive: true, skills: ['Elektrik', 'IT', 'Schwesternruf'], availability: { status: AvailabilityStatus.Available, leaveUntil: null } },
];

export const TECHNICIANS_DATA: User[] = MOCK_USERS.filter(
  u => u.role === Role.Technician || u.role === Role.Housekeeping
);

export const LOCATION_NAMES = ["Schlosspark", "Ebertpark", "Rheinufer", "An den Seen", "Küche", "Cafeteria", "Wäscherei", "Reinigung", "Untergeschoss", "Verwaltung", "Ausbildung", "Kleiner Saal", "Außenbereich", "Terrasse", "Kreisverband", "Sozialstation", "Brandschutz", "Sicherheit", "Sonstiges"];
export const LOCATIONS_FOR_FILTER = ['Alle', ...LOCATION_NAMES];
export const MOCK_LOCATIONS: Location[] = LOCATION_NAMES.map((name, index) => ({
    id: `loc-${index + 1}`,
    name,
    isActive: true,
}));

export const MOCK_ASSETS: Asset[] = [
    { 
        id: 'asset-heizung-a', name: 'Heizungsanlage Wohnhaus A', locationId: 'loc-15',
        details: { type: 'Heizkessel', manufacturer: 'Viessmann', model: 'Vitodens 300-W', installDate: '2020-09-01' },
        maintenancePlanId: 'plan-heizung-a', maintenanceHistory: []
    },
    { 
        id: 'asset-aufzug-1', name: 'Aufzug 1 (Hauptgebäude)', locationId: 'loc-1',
        details: { type: 'Personenaufzug', manufacturer: 'Schindler', model: '5500', installDate: '2018-03-15' },
        maintenancePlanId: 'plan-aufzug-1', maintenanceHistory: []
    },
    { 
        id: 'asset-klima-server', name: 'Klimaanlage Serverraum', locationId: 'loc-10',
        details: { type: 'Split-Klimagerät', manufacturer: 'Daikin', model: 'FTXM-R', installDate: '2021-05-20' },
        maintenancePlanId: 'plan-klima-server', maintenanceHistory: []
    }
];

export const MOCK_MAINTENANCE_PLANS: MaintenancePlan[] = [
    { 
        id: 'plan-heizung-a', assetId: 'asset-heizung-a', 
        taskDescription: 'Jährliche Wartung der Heizungsanlage: Brenner reinigen, Druck prüfen, Emissionen messen.', 
        intervalDays: 365, requiredSkill: 'HLK', ticketPriority: Priority.Mittel, lastGenerated: '2025-09-10'
    },
    { 
        id: 'plan-aufzug-1', assetId: 'asset-aufzug-1', 
        taskDescription: 'TÜV-Prüfung und Wartung Aufzug 1.', 
        intervalDays: 180, requiredSkill: 'Aufzugstechnik', ticketPriority: Priority.Hoch, lastGenerated: '2025-11-01'
    },
    {
        id: 'plan-klima-server', assetId: 'asset-klima-server',
        taskDescription: 'Halbjährliche Wartung Klimaanlage: Filter reinigen, Kühlmittelstand prüfen.',
        intervalDays: 180, requiredSkill: 'Klima', ticketPriority: Priority.Hoch, lastGenerated: '2025-10-15'
    }
];

export const PRIORITIES = ['Alle', 'Hoch', 'Mittel', 'Niedrig'];
export const STATUSES = ['Alle', 'Offen', 'In Arbeit', 'Überfällig', 'Abgeschlossen'];

export const DEFAULT_APP_SETTINGS: AppSettings = {
    appName: "DRK Serviceportal",
    portalSubtitle: "Meldungen schnell erfassen & verfolgen",
    portalMaintenance: {
        enabled: false,
        message: "Das Portal befindet sich aktuell in Wartung. Bitte versuchen Sie es später erneut.",
    },
    defaultPriority: Priority.Mittel,
    dueDateRules: {
        [Priority.Hoch]: 2,
        [Priority.Mittel]: 5,
        [Priority.Niedrig]: 10,
    },
    portalConfig: {
        showStatus: true,
        showTechnicianLogin: true,
        showAdminLogin: true,
    },
    ticketCategories: [
        { id: 'cat-sicherheit', name: 'Sicherheit', default_priority: Priority.Hoch },
        { id: 'cat-komfort', name: 'Komfort', default_priority: Priority.Niedrig },
        { id: 'cat-it', name: 'IT-Infrastruktur', default_priority: Priority.Mittel },
        { id: 'cat-gebaeudetechnik', name: 'Gebäudetechnik', default_priority: Priority.Mittel },
    ],
    slaMatrix: [
        { id: 'sla-1', categoryId: 'cat-sicherheit', priority: Priority.Hoch, responseTimeHours: 4 },
        { id: 'sla-2', categoryId: 'cat-sicherheit', priority: Priority.Mittel, responseTimeHours: 24 },
        { id: 'sla-3', categoryId: 'cat-komfort', priority: Priority.Hoch, responseTimeHours: 24 },
        { id: 'sla-4', categoryId: 'cat-it', priority: Priority.Hoch, responseTimeHours: 8 },
    ],
    routingRules: [
        { id: 'route-1', keyword: 'Heizung,Lüftung,Klima', skill: 'HLK' },
        { id: 'route-2', keyword: 'Wasser,Abfluss,Rohr', skill: 'Sanitär' },
        { id: 'route-3', keyword: 'Strom,Licht,Sicherung,Steckdose', skill: 'Elektrik' },
        { id: 'route-4', keyword: 'WLAN,Netzwerk,Drucker', skill: 'IT' },
    ],
    routineSchedules: [],
    routineDayCompletions: [],
};

export const statusColorMap: Record<Status, string> = {
  [Status.Offen]: '--text-muted',
  [Status.InArbeit]: '--accent-inprogress',
  [Status.Ueberfaellig]: '--accent-danger',
  [Status.Abgeschlossen]: '--accent-success',
};

export const statusBgColorMap: Record<Status, string> = {
  [Status.Offen]: 'rgba(108, 117, 125, 0.1)',
  [Status.InArbeit]: 'rgba(0, 123, 255, 0.1)',
  [Status.Ueberfaellig]: 'rgba(220, 53, 69, 0.1)',
  [Status.Abgeschlossen]: 'rgba(40, 167, 69, 0.1)',
};

export const statusBorderColorMap: Record<Status, string> = {
  [Status.Offen]: 'rgba(108, 117, 125, 0.3)',
  [Status.InArbeit]: 'rgba(0, 123, 255, 0.3)',
  [Status.Ueberfaellig]: 'rgba(220, 53, 69, 0.3)',
  [Status.Abgeschlossen]: 'rgba(40, 167, 69, 0.3)',
};