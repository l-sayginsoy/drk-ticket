
// FIX: Import useMemo hook from React.
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Location, Role, AppSettings, Priority, TicketCategory, SLARule, RoutingRule, Asset, MaintenancePlan, AvailabilityStatus, RoutineSchedule, WeekdayKey } from '../types';
import { DEFAULT_APP_SETTINGS } from '../constants';
import { getRoutinePool, localISODate } from '../utils/routineHelpers';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import UserModal from './UserModal';
import AreaModal from './AreaModal';
import SwitchToggle from './SwitchToggle';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';

const DOCUMENTATION_HTML = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Systemdokumentation – DRK Haustechnik Service</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 820px;
            margin: 40px auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        h1, h2, h3 {
            color: #222;
            line-height: 1.2;
            margin-top: 1.8em;
        }
        h1 {
            font-size: 2.2em;
            border-bottom: 3px solid #c0392b;
            padding-bottom: 0.5em;
            margin-bottom: 0.5em;
        }
        .subtitle {
            color: #888;
            font-size: 0.95em;
            margin-bottom: 2em;
        }
        h2 {
            font-size: 1.55em;
            border-bottom: 1px solid #ddd;
            padding-bottom: 0.3em;
            margin-bottom: 0.8em;
            color: #c0392b;
        }
        h3 {
            font-size: 1.15em;
            margin-bottom: 0.6em;
            color: #333;
        }
        p { margin-bottom: 1em; }
        ul, ol { padding-left: 22px; margin-bottom: 1em; }
        li { margin-bottom: 0.4em; }
        strong { font-weight: 600; }
        code {
            background-color: #eee;
            padding: 2px 5px;
            border-radius: 4px;
            font-family: "Courier New", Courier, monospace;
            font-size: 0.9em;
        }
        .intro {
            border-left: 4px solid #c0392b;
            padding: 12px 16px;
            background-color: #fff5f5;
            margin-bottom: 2em;
            border-radius: 0 6px 6px 0;
        }
        .neu-badge {
            display: inline-block;
            background: #c0392b;
            color: white;
            font-size: 0.7em;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            vertical-align: middle;
            margin-left: 6px;
            letter-spacing: 0.05em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1.2em;
            font-size: 0.92em;
        }
        th {
            background: #f0f0f0;
            text-align: left;
            padding: 7px 10px;
            border: 1px solid #ddd;
            font-weight: 600;
        }
        td {
            padding: 6px 10px;
            border: 1px solid #ddd;
        }
        tr:nth-child(even) td { background: #fafafa; }
        @media print {
            body { background-color: #fff; margin: 0; padding: 15px; }
            h1, h2, h3 { page-break-after: avoid; }
            .intro { background-color: #f5f5f5; border-color: #999; }
        }
    </style>
</head>
<body>

    <h1>Systemdokumentation</h1>
    <p class="subtitle">DRK Haustechnik Service &mdash; Stand: Juni 2026</p>

    <div class="intro">
        <p><strong>Philosophie der Anwendung</strong></p>
        <p>Das DRK Haustechnik Service Portal wurde entwickelt, um den gesamten Prozess der Störungsmeldung, Bearbeitung und Nachverfolgung zu digitalisieren und zu automatisieren. Alle Beteiligten – Melder, Techniker und Leitung – haben jederzeit Transparenz über den aktuellen Stand. Das System ist auf Firebase Firestore aufgebaut und läuft als Web-App im Browser, ohne Installation.</p>
    </div>

    <h2>Teil 1: Das Melder-Portal</h2>
    <p>Das Portal ist der öffentliche Zugangspunkt ohne Login. Bewohner, Mitarbeiter oder Besucher können hier Störungen melden und den Status ihrer Meldungen einsehen.</p>

    <h3>1.1. Neue Störung melden</h3>
    <ul>
        <li><strong>Standort & Raum:</strong> Auswahl aus vordefinierten Standorten, freie Eingabe des genauen Raums.</li>
        <li><strong>Betreff & Beschreibung:</strong> Kurze Zusammenfassung und detaillierte Beschreibung des Problems.</li>
        <li><strong>Foto-Upload (freiwillig):</strong> Bis zu 3 Fotos können hochgeladen werden. Alle Bilder werden vor dem Speichern automatisch komprimiert.</li>
        <li><strong>E-Mail-Adresse:</strong> Optional – ermöglicht automatische Statusbenachrichtigungen per E-Mail.</li>
        <li><strong>Wunsch-Termin:</strong> Der Melder kann eine bevorzugte Bearbeitungszeit angeben.</li>
        <li><strong>Kein Ausfüllen von Kategorie, Priorität oder Bearbeiter nötig</strong> – das System erledigt das automatisch im Hintergrund.</li>
    </ul>

    <h3>1.2. Status prüfen & kommunizieren</h3>
    <ul>
        <li>Statusabfrage per Name, E-Mail-Adresse oder Ticket-ID.</li>
        <li>Anzeige: aktueller Status, zugewiesener Bearbeiter, Fälligkeitsdatum, komplette Notiz-Historie.</li>
        <li>Melder kann eigene Notizen / Rückfragen zum Ticket hinzufügen – der Bearbeiter sieht eine Benachrichtigung.</li>
        <li>Abgeschlossene Tickets können vom Melder wiedereröffnet werden.</li>
    </ul>

    <h2>Teil 2: Die Automatisierungs-Engine</h2>
    <p>Sobald ein Ticket eingeht, arbeitet das System vollautomatisch im Hintergrund.</p>

    <h3>2.1. Beim Ticketeingang</h3>
    <ul>
        <li><strong>Automatische Kategorie & Priorität:</strong> Das System erkennt anhand von Betreff und Beschreibung die passende Kategorie und setzt die in der SLA-Matrix hinterlegte Standardpriorität.</li>
        <li><strong>SLA-basiertes Fälligkeitsdatum:</strong> Aus der Kombination Kategorie + Priorität wird die Reaktionszeit (in Stunden) aus der SLA-Matrix ermittelt und das Fälligkeitsdatum berechnet.</li>
        <li><strong>Automatisches Routing:</strong> Das System scannt Betreff und Beschreibung nach konfigurierten Keywords (z.B. "Heizung", "Strom"). Die passende Routing-Regel bestimmt die zuständigen Bearbeiter. Zugewiesen wird derjenige mit der geringsten aktuellen Auslastung. Abwesende Bearbeiter werden übersprungen. Gibt es keinen Treffer, bleibt die Zuweisung auf "N/A" für manuelle Vergabe.</li>
    </ul>

    <h3>2.2. Laufende Überwachung</h3>
    <ul>
        <li><strong>Überfälligkeits-Check:</strong> Täglich beim App-Start werden alle offenen Tickets geprüft. Ist das Fälligkeitsdatum überschritten, wechselt der Status automatisch auf "Überfällig".</li>
        <li><strong>Abwesenheits-Umverteilung:</strong> Wird ein Bearbeiter auf "Abwesend" gesetzt, werden seine kritischen oder bald fälligen Tickets automatisch an den am wenigsten ausgelasteten verfügbaren Kollegen umverteilt.</li>
        <li><strong>Serienaufträge:</strong> Wiederkehrende Aufgaben (täglich, wöchentlich, monatlich, jährlich) werden automatisch als Tickets generiert und dem konfigurierten Bearbeiter zugewiesen.</li>
    </ul>

    <h3>2.3. Stale Ticket Erinnerungen <span class="neu-badge">NEU</span></h3>
    <p>Das System erkennt automatisch Tickets, bei denen zu lange keine Aktivität stattgefunden hat, und erinnert die zuständigen Techniker per E-Mail.</p>
    <ul>
        <li><strong>Auslöser:</strong> Beim App-Start (Admin eingeloggt) werden alle offenen Tickets geprüft.</li>
        <li><strong>Schwellenwert:</strong> Tickets mit 5 oder mehr Tagen ohne Aktivität (keine neue Notiz, kein Statuswechsel) gelten als "stale".</li>
        <li><strong>Letzte Aktivität:</strong> Das System sucht zuerst nach dem Datum der letzten Notiz. Gibt es keine Notiz mit Datum, wird das Erfassungsdatum des Tickets verwendet.</li>
        <li><strong>Gruppierung:</strong> Pro Techniker wird eine einzige E-Mail verschickt, die alle betroffenen Tickets als übersichtliche Tabelle enthält (Ticket-Nr., Betreff, Standort, Priorität, Tage inaktiv).</li>
        <li><strong>Spam-Schutz:</strong> Nach dem Versand wird das Datum gespeichert. Frühestens nach 3 Tagen wird erneut erinnert.</li>
        <li><strong>Ausnahmen:</strong> Abgeschlossene und zurückgestellte Tickets werden ignoriert. Techniker ohne eingetragene E-Mail-Adresse werden übersprungen.</li>
    </ul>

    <h2>Teil 3: Die Hauptanwendung</h2>

    <h3>3.1. Rollen & Berechtigungen</h3>
    <table>
        <tr><th>Rolle</th><th>Zugriff</th></tr>
        <tr><td><strong>Admin</strong></td><td>Vollzugriff: alle Ansichten, Einstellungen, Reports, Benutzerverwaltung, Löschfunktion</td></tr>
        <tr><td><strong>Haustechniker</strong></td><td>Eigene Tickets einsehen & bearbeiten, Dashboard (eigene Ansicht), kein Zugriff auf Einstellungen/Reports</td></tr>
        <tr><td><strong>Hauswirtschaft</strong></td><td>Wie Haustechniker, eigener Bereich</td></tr>
    </table>

    <h3>3.2. Ansichten</h3>
    <ul>
        <li><strong>Dashboard (Kanban):</strong> Drei Spalten – Offen / In Arbeit / Überfällig. Sortierung nach Dringlichkeit (Notfall zuerst, dann Fälligkeitsdatum). Statusänderung per Drag & Drop.</li>
        <li><strong>Listenansicht:</strong> Tabellenansicht mit Volltextsuche, Filtern, Sortieren und Gruppieren nach Status / Bereich / Bearbeiter.</li>
        <li><strong>Abgeschlossen:</strong> Monatsweise Ansicht erledigter Tickets. CSV-Export möglich.</li>
        <li><strong>Team-Übersicht:</strong> Auslastung und KPIs pro Techniker.</li>
        <li><strong>Reports:</strong> Grafische Auswertungen – Ticketanzahl, Lösungsquote, Lösungszeit, Hotspots.</li>
        <li><strong>Serienaufträge:</strong> Verwaltung wiederkehrender Aufgaben und Nachweis-Ansicht.</li>
    </ul>

    <h3>3.3. Ticket bearbeiten</h3>
    <ul>
        <li>Klick auf ein Ticket öffnet die Detail-Seitenleiste.</li>
        <li>Alle Felder bearbeitbar: Status, Priorität, Bearbeiter, Fälligkeitsdatum, Notizen, Fotos.</li>
        <li><strong>Massenbearbeitung:</strong> Mehrere Tickets per Checkbox auswählen → Status ändern, Bearbeiter zuweisen oder löschen.</li>
        <li><strong>Notiz-Indikator:</strong> Orangener "Neue Nachricht"-Badge wenn der Melder eine ungelesene Rückmeldung hinterlassen hat.</li>
    </ul>

    <h3>3.4. App-Aktualisierung <span class="neu-badge">NEU</span></h3>
    <p>Oben rechts im Header befindet sich ein <strong>Aktualisierungs-Button (↻)</strong>. Ein Klick lädt die App komplett neu – hilfreich wenn die Anzeige hängt oder veraltete Daten angezeigt werden. Der Pfeil dreht sich kurz als visuelles Feedback, dann wird die Seite neu geladen.</p>

    <h2>Teil 4: E-Mail-Benachrichtigungen</h2>
    <p>Das System versendet automatisch E-Mails über den Dienst Brevo. Alle E-Mails werden im Hintergrund gesendet und blockieren die App nicht.</p>

    <table>
        <tr><th>Zeitpunkt</th><th>Empfänger</th><th>Inhalt</th></tr>
        <tr><td>Neues Ticket erstellt</td><td>Melder</td><td>Eingangsbestätigung mit Ticket-Nummer</td></tr>
        <tr><td>Neues Portal-Ticket</td><td>Admin</td><td>Benachrichtigung mit allen Ticket-Details</td></tr>
        <tr><td>Status → In Arbeit</td><td>Melder</td><td>Bearbeiter, Standort, voraussichtliches Fälligkeitsdatum</td></tr>
        <tr><td>Status → Abgeschlossen</td><td>Melder</td><td>Abschlussbestätigung</td></tr>
        <tr><td>Neue Notiz vom Mitarbeiter</td><td>Melder</td><td>Notiztext</td></tr>
        <tr><td>Fälligkeitsdatum geändert</td><td>Melder</td><td>Neues Datum (nur bei Status In Arbeit / Überfällig)</td></tr>
        <tr><td>Ticket 5+ Tage inaktiv <span class="neu-badge">NEU</span></td><td>Techniker</td><td>Tabelle aller inaktiven Tickets, gruppiert pro Techniker</td></tr>
    </table>

    <h2>Teil 5: Die Steuerzentrale (Einstellungen)</h2>

    <h3>5.1. Allgemein</h3>
    <ul>
        <li>App-Name, Portal-Untertitel, Wartungsmodus (mit eigener Meldung)</li>
        <li>Portal-Konfiguration: Statusanzeige ein/aus, Techniker-Login anzeigen</li>
    </ul>

    <h3>5.2. Prozesse & Logik</h3>
    <ul>
        <li><strong>Ticket-Kategorien:</strong> Name und Standardpriorität je Kategorie.</li>
        <li><strong>SLA-Matrix:</strong> Reaktionszeit in Stunden je Kategorie + Priorität-Kombination.</li>
        <li><strong>Routing-Regeln:</strong> Keywords → automatische Kategorie, Priorität und Bearbeiter-Pool.</li>
    </ul>

    <h3>5.3. Serientermine</h3>
    <ul>
        <li>Verwaltung aller wiederkehrenden Aufgaben mit Wiederholungstyp (täglich, wöchentlich, monatlich, jährlich).</li>
        <li>Zuweisung: fest an eine Person oder Rotation durch eine Gruppe.</li>
    </ul>

    <h3>5.4. Benutzerverwaltung <span class="neu-badge">AKTUALISIERT</span></h3>
    <ul>
        <li>Anlegen, Bearbeiten und Deaktivieren von Benutzern.</li>
        <li>Felder: Name, Rolle, Passwort, Avatar-Farbe, Kompetenzen (Skills).</li>
        <li><strong>Verfügbarkeit:</strong> "Verfügbar" oder "Abwesend" mit optionalem Rückkehrdatum. Wird der Status zurück auf "Verfügbar" gesetzt, wird das Datum automatisch geleert.</li>
        <li><strong>E-Mail-Adresse für Ticket-Erinnerungen:</strong> Wird für automatische Stale-Erinnerungen genutzt. Es können <strong>mehrere Adressen kommagetrennt</strong> eingetragen werden (z.B. für Vertretungsregelungen: <code>torsten@drk.de, ali-vertretung@drk.de</code>).</li>
        <li><strong>Status-Schalter (Aktiv/Inaktiv):</strong> Inaktive Benutzer können sich nicht anmelden und bekommen keine Tickets zugewiesen.</li>
    </ul>

    <h3>5.5. Standorte</h3>
    <ul>
        <li>Verwaltung aller Standorte, die im Portal zur Auswahl stehen.</li>
        <li>Standorte können aktiviert und deaktiviert werden.</li>
    </ul>

    <h3>5.6. Benachrichtigungen</h3>
    <ul>
        <li>Admin-E-Mail-Adresse für Eingangsbenachrichtigungen konfigurieren.</li>
        <li>Test-E-Mail versenden zum Prüfen der Brevo-Verbindung.</li>
        <li>Nachversand von Bestätigungs-E-Mails für ein bestimmtes Eingangsdatum.</li>
    </ul>

    <h2>Teil 6: Technische Grundlagen</h2>
    <table>
        <tr><th>Bereich</th><th>Technologie</th></tr>
        <tr><td>Frontend</td><td>React 18, TypeScript, Vite</td></tr>
        <tr><td>Datenbank</td><td>Firebase Firestore (Echtzeit-Listener für aktive Tickets)</td></tr>
        <tr><td>E-Mail</td><td>Brevo REST API v3</td></tr>
        <tr><td>Hosting</td><td>Firebase Hosting (Deployment via GitHub Actions)</td></tr>
        <tr><td>Performance</td><td>Code Splitting: Haupt-Bundle 441 KB (statt 1.570 KB)</td></tr>
    </table>

</body>
</html>
`;


interface SettingsViewProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    locations: Location[];
    setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
    assets: Asset[];
    setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
    maintenancePlans: MaintenancePlan[];
    setMaintenancePlans: React.Dispatch<React.SetStateAction<MaintenancePlan[]>>;
    appSettings: AppSettings;
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    /** Bestätigungsmails (Vorlage „Meldung erfasst”) für alle Tickets mit Melder-E-Mail zu diesem Eingangsdatum nachholen. */
    onResendConfirmationMailsForEntryDate?: (entryDateDE: string) => Promise<{ ok: number; fail: number }>;
    /** Sendet eine Test-E-Mail an die angegebene Adresse. */
    onSendTestEmail?: (to: string) => Promise<boolean>;
}

const SettingsView: React.FC<SettingsViewProps> = (props) => {
    const {
        users,
        setUsers,
        locations,
        setLocations,
        assets,
        setAssets,
        maintenancePlans,
        setMaintenancePlans,
        appSettings,
        setAppSettings,
        onResendConfirmationMailsForEntryDate,
        onSendTestEmail,
    } = props;
    type SettingsTab = 'allgemein' | 'prozesse' | 'serientermine' | 'benutzer' | 'standorte' | 'benachrichtigungen';
    const [activeTab, setActiveTab] = useState<SettingsTab>('allgemein');
    const [dragRoutineId, setDragRoutineId] = useState<string | null>(null);
    /** Neu angelegte Serientermine (noch nicht in appSettings); Speichern erfolgt in der jeweiligen Karte. */
    const [pendingNewRoutines, setPendingNewRoutines] = useState<RoutineSchedule[]>([]);
    /** Karten auf-/zuklappen: gespeicherte standardmäßig zu, neue standardmäßig auf. */
    const [routineCardExpanded, setRoutineCardExpanded] = useState<Record<string, boolean>>({});
    const [resendConfirmEntryDate, setResendConfirmEntryDate] = useState('11.05.2026');
    const [resendConfirmBusy, setResendConfirmBusy] = useState(false);
    
    // Modals
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
    const [isLocationModalOpen, setLocationModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);

    const iframeRef = useRef<HTMLIFrameElement>(null);

    const handleDownloadDocs = () => {
        if (iframeRef.current) {
            iframeRef.current.srcdoc = DOCUMENTATION_HTML;
            
            iframeRef.current.onload = () => {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.focus();
                    iframeRef.current.contentWindow.print();
                }
            };
        }
    };

    const allSkills = useMemo(() => {
        const skillSet = new Set<string>();
        users.forEach(u => u.skills.forEach(s => skillSet.add(s)));
        appSettings.routingRules.forEach(r => skillSet.add(r.skill));
        return Array.from(skillSet).sort();
    }, [users, appSettings.routingRules]);

    const weekdayOptions: Array<{ key: WeekdayKey; label: string }> = [
        { key: 'mo', label: 'Mo' },
        { key: 'di', label: 'Di' },
        { key: 'mi', label: 'Mi' },
        { key: 'do', label: 'Do' },
        { key: 'fr', label: 'Fr' },
        { key: 'sa', label: 'Sa' },
        { key: 'so', label: 'So' },
    ];

    const eligibleUsersByRole = (role: Role.Technician | Role.Housekeeping) =>
        users
            .filter(u => u.isActive && u.role === role)
            .map(u => u.name)
            .sort((a, b) => a.localeCompare(b, 'de'));

    const savedRoutineSchedules = appSettings.routineSchedules || [];

    const requestTab = (next: SettingsTab) => {
        if (activeTab === 'serientermine' && next !== 'serientermine' && pendingNewRoutines.length > 0) {
            if (
                !window.confirm(
                    'Es gibt neue Serientermine, die noch nicht übernommen wurden (Speichern in der Karte). Trotzdem wechseln? Diese Einträge gehen verloren.'
                )
            ) {
                return;
            }
            setPendingNewRoutines([]);
        }
        setActiveTab(next);
    };

    const reorderRoutineSchedules = (fromId: string, toId: string) => {
        if (fromId === toId) return;
        setAppSettings(prev => {
            const list = [...(prev.routineSchedules || [])];
            const fromIdx = list.findIndex((x: any) => x.id === fromId);
            const toIdx = list.findIndex((x: any) => x.id === toId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const [moved] = list.splice(fromIdx, 1);
            list.splice(toIdx, 0, moved);
            return { ...prev, routineSchedules: list };
        });
    };

    const commitPendingRoutine = (schedule: RoutineSchedule) => {
        setAppSettings(prev => ({
            ...prev,
            routineSchedules: [...(prev.routineSchedules || []), schedule],
        }));
        setPendingNewRoutines(prev => prev.filter(x => x.id !== schedule.id));
    };

    // --- User Management ---
    const handleOpenUserModal = (user: User | null) => {
        setEditingUser(user);
        setUserModalOpen(true);
    };

    const handleSaveUser = (userToSave: User) => {
        let savedUser = userToSave;
        if (userToSave.id) {
            setUsers(current => current.map(u => (u.id === userToSave.id ? { ...u, ...userToSave, password: userToSave.password ? userToSave.password : u.password } : u)));
        } else {
            const newUser: User = { ...userToSave, id: `user-${Date.now()}` };
            savedUser = newUser;
            setUsers(current => [...current, newUser]);
        }
        setUserModalOpen(false);
        setEditingUser(null);
    };
    
    const handleDeleteUser = (id: string) => {
        if (window.confirm('Sind Sie sicher, dass Sie diesen Benutzer löschen möchten?')) {
            setUsers(current => current.filter(user => user.id !== id));
        }
    };

    const handleToggleUserStatus = (userId: string) => {
        setUsers(current => current.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u));
    };
    
    // --- Location Management ---
    const handleOpenLocationModal = (location: Location | null) => {
        setEditingLocation(location);
        setLocationModalOpen(true);
    };
    const handleSaveLocation = (locationToSave: Location) => {
        if (locationToSave.id) {
            setLocations(current => current.map(l => (l.id === locationToSave.id ? { ...l, name: locationToSave.name } : l)));
        } else {
            if (locations.some(l => l.name.toLowerCase() === locationToSave.name.trim().toLowerCase())) {
                alert('Ein Standort mit diesem Namen existiert bereits.');
                return;
            }
            const newLocation: Location = {
                id: `loc-${Date.now()}`,
                name: locationToSave.name.trim(),
                isActive: true,
            };
            setLocations(current => [...current, newLocation]);
        }
        setLocationModalOpen(false);
        setEditingLocation(null);
    };
    const handleToggleLocationStatus = (locationId: string) => {
        setLocations(current => current.map(l => l.id === locationId ? { ...l, isActive: !l.isActive } : l));
    };
    const handleDeleteLocation = (locationId: string) => {
        const location = locations.find(l => l.id === locationId);
        if (location && window.confirm(`Sind Sie sicher, dass Sie den Standort "${location.name}" löschen möchten?`)) {
            setLocations(current => current.filter(l => l.id !== locationId));
        }
    };

    // --- Generic Handlers for AppSettings ---
    const handleAddSetting = <T extends { id: string }>(key: keyof AppSettings, newItem: Omit<T, 'id'>) => {
        setAppSettings(prev => ({
            ...prev,
            [key]: [...(prev[key] as unknown as T[]), { ...newItem, id: `${key}-${Date.now()}` }]
        }));
    };
    
    const handleUpdateSetting = <T extends { id: string }>(key: keyof AppSettings, updatedItem: T) => {
        setAppSettings(prev => ({
            ...prev,
            [key]: (prev[key] as unknown as T[]).map(item => item.id === updatedItem.id ? updatedItem : item)
        }));
    };

    const handleDeleteSetting = (key: keyof AppSettings, id: string) => {
        if (window.confirm('Sind Sie sicher, dass Sie diesen Eintrag löschen möchten?')) {
            setAppSettings(prev => ({
                ...prev,
                [key]: (prev[key] as any[]).filter(item => item.id !== id)
            }));
        }
    };
    
    // --- Render Functions for Tabs ---
    const renderAllgemeinTab = () => (
        <>
            <div className="settings-section">
                <div className="settings-section-header">
                    <h3 className="settings-section-title">Allgemein</h3>
                </div>
                <div className="settings-section-body">
                    <div className="form-group">
                        <label>App Name</label>
                        <p className="form-group-description">Der hier festgelegte Name wird im Portal angezeigt.</p>
                        <input
                            type="text"
                            value={appSettings.appName}
                            onChange={e => setAppSettings(prev => ({ ...prev, appName: e.target.value }))}
                            className="form-group-input"
                        />
                    </div>
                    <div className="form-group">
                        <label>Untertitel</label>
                        <p className="form-group-description">Unter dem App-Namen im Portal (z.B. „Meldungen schnell erfassen & verfolgen“).</p>
                        <input
                            type="text"
                            value={appSettings.portalSubtitle ?? ''}
                            onChange={e => setAppSettings(prev => ({ ...prev, portalSubtitle: e.target.value }))}
                            className="form-group-input"
                        />
                    </div>
                    <div className="form-group">
                        <label>Wartungsmodus</label>
                        <p className="form-group-description">Wenn aktiv, wird „Meldung erfassen“ im Portal gesperrt (Status prüfen bleibt möglich).</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                type="checkbox"
                                checked={!!appSettings.portalMaintenance?.enabled}
                                onChange={e =>
                                    setAppSettings(prev => ({
                                        ...prev,
                                        portalMaintenance: {
                                            enabled: e.target.checked,
                                            message:
                                                prev.portalMaintenance?.message ??
                                                'Das Portal befindet sich aktuell in Wartung. Bitte versuchen Sie es später erneut.',
                                        },
                                    }))
                                }
                            />
                            <span style={{ fontWeight: 600 }}>{appSettings.portalMaintenance?.enabled ? 'AN' : 'AUS'}</span>
                        </div>
                        <textarea
                            value={appSettings.portalMaintenance?.message ?? ''}
                            onChange={e =>
                                setAppSettings(prev => ({
                                    ...prev,
                                    portalMaintenance: {
                                        enabled: !!prev.portalMaintenance?.enabled,
                                        message: e.target.value,
                                    },
                                }))
                            }
                            className="form-group-input"
                            style={{ minHeight: 90, resize: 'vertical' }}
                            placeholder="Wartungstext (wird im Portal angezeigt)"
                        />
                    </div>
                    {onResendConfirmationMailsForEntryDate && (
                        <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8 }}>
                            <label>E-Mail: Bestätigungen nachholen</label>
                            <p className="form-group-description">
                                Sendet die gleiche Bestätigungsmail wie bei neuer Meldung an alle Tickets mit Melder-E-Mail zu
                                einem gewählten <strong>Eingangsdatum</strong> (z. B. nach einem Brevo-Ausfall).
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                                <input
                                    type="text"
                                    className="form-group-input"
                                    style={{ maxWidth: 160 }}
                                    value={resendConfirmEntryDate}
                                    onChange={(e) => setResendConfirmEntryDate(e.target.value)}
                                    placeholder="TT.MM.JJJJ"
                                    disabled={resendConfirmBusy}
                                />
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={resendConfirmBusy}
                                    onClick={async () => {
                                        setResendConfirmBusy(true);
                                        try {
                                            await onResendConfirmationMailsForEntryDate(resendConfirmEntryDate);
                                        } finally {
                                            setResendConfirmBusy(false);
                                        }
                                    }}
                                >
                                    {resendConfirmBusy ? 'Sende…' : 'Bestätigungen senden'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    const renderSerientermineTab = () => {
        const serientermineRows = [
            ...savedRoutineSchedules.map((schedule) => ({ schedule, isPending: false as const })),
            ...pendingNewRoutines.map((schedule) => ({ schedule, isPending: true as const })),
        ];
        return (
        <>
            <div className="settings-section">
                <div className="settings-section-header">
                    <h3 className="settings-section-title">Serientermine (wiederkehrende Aufgaben)</h3>
                </div>
                <div className="settings-section-body">
                    <p className="form-group-description">
                        Wiederkehrende Aufgaben für Service‑Team und Hauswirtschaft. Daraus werden automatisch präventive Tickets erzeugt. Neu angelegte Serientermine bitte{' '}
                        <strong>in der jeweiligen Karte mit „Speichern“</strong> übernehmen; bestehende Einträge werden sofort gespeichert.
                    </p>

                    {serientermineRows.length === 0 ? (
                        <div style={{ padding: '12px 14px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)' }}>
                            Noch keine Serientermine angelegt.
                        </div>
                    ) : (
                        serientermineRows.map(({ schedule, isPending }) => {
                            const commit = (u: RoutineSchedule) => {
                                if (isPending) {
                                    setPendingNewRoutines(prev => prev.map(x => (x.id === u.id ? u : x)));
                                } else {
                                    handleUpdateSetting<RoutineSchedule>('routineSchedules', u);
                                }
                            };
                            const eligible = eligibleUsersByRole(schedule.targetRole);
                            const selectedAssignees = (schedule.assignees || []).filter(n => eligible.includes(n));
                            const weekdays =
                                schedule.recurrence?.type === 'weekdays'
                                    ? (schedule.recurrence.weekdays as WeekdayKey[])
                                    : ([] as WeekdayKey[]);
                            const rotationPool = getRoutinePool(schedule, users);
                            const routineExpanded = isPending
                                ? routineCardExpanded[schedule.id] !== false
                                : routineCardExpanded[schedule.id] === true;

                            return (
                                <div
                                    key={schedule.id}
                                    style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--bg-tertiary)' }}
                                    onDragOver={(e) => {
                                        if (!dragRoutineId) return;
                                        e.preventDefault();
                                    }}
                                    onDrop={(e) => {
                                        if (!dragRoutineId) return;
                                        e.preventDefault();
                                        if (!isPending) {
                                            reorderRoutineSchedules(dragRoutineId, schedule.id);
                                        }
                                        setDragRoutineId(null);
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                            alignItems: 'center',
                                            marginBottom: routineExpanded ? 10 : 0,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                            <button
                                                type="button"
                                                aria-expanded={routineExpanded}
                                                title={routineExpanded ? 'Details zuklappen' : 'Details aufklappen'}
                                                onClick={() =>
                                                    setRoutineCardExpanded(prev => {
                                                        const isOpen = isPending
                                                            ? prev[schedule.id] !== false
                                                            : prev[schedule.id] === true;
                                                        return { ...prev, [schedule.id]: !isOpen };
                                                    })
                                                }
                                                style={{
                                                    flexShrink: 0,
                                                    width: 30,
                                                    height: 30,
                                                    borderRadius: 8,
                                                    border: '1px solid var(--border)',
                                                    background: 'var(--bg-secondary)',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                    lineHeight: 1,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {routineExpanded ? '▼' : '▶'}
                                            </button>
                                            {isPending ? (
                                                <span
                                                    title="Nach Speichern per Ziehen sortierbar"
                                                    style={{
                                                        width: 26,
                                                        height: 26,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        borderRadius: 8,
                                                        border: '1px dashed var(--border)',
                                                        color: 'var(--text-muted)',
                                                        fontSize: 10,
                                                        userSelect: 'none',
                                                    }}
                                                >
                                                    Neu
                                                </span>
                                            ) : (
                                                <span
                                                    draggable
                                                    onDragStart={(e) => {
                                                        setDragRoutineId(schedule.id);
                                                        e.dataTransfer.effectAllowed = 'move';
                                                    }}
                                                    onDragEnd={() => setDragRoutineId(null)}
                                                    title="Reihenfolge ändern (ziehen)"
                                                    style={{
                                                        width: 26,
                                                        height: 26,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        borderRadius: 8,
                                                        border: '1px solid var(--border)',
                                                        background: 'var(--bg-secondary)',
                                                        color: 'var(--text-muted)',
                                                        cursor: 'grab',
                                                        userSelect: 'none',
                                                        fontWeight: 900,
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    ⋮⋮
                                                </span>
                                            )}
                                            <input
                                                type="checkbox"
                                                checked={!!schedule.enabled}
                                                onChange={e => commit( { ...schedule, enabled: e.target.checked })}
                                                title="Aktiv/Inaktiv"
                                            />
                                            <strong
                                                style={{
                                                    fontSize: 14,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                                title={schedule.title || 'Serientermin'}
                                            >
                                                {schedule.title || 'Serientermin'}
                                            </strong>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                                                {schedule.lastGenerated ? `zuletzt: ${schedule.lastGenerated}` : 'noch nie erzeugt'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (isPending) {
                                                    if (window.confirm('Diesen neuen Serientermin verwerfen?')) {
                                                        setPendingNewRoutines(prev => prev.filter(x => x.id !== schedule.id));
                                                    }
                                                } else {
                                                    handleDeleteSetting('routineSchedules', schedule.id);
                                                }
                                            }}
                                            className="btn btn-danger-sm"
                                            title="Löschen"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>

                                    {routineExpanded && (
                                    <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                                        <div className="form-group">
                                            <label>Aufgabe</label>
                                            <input
                                                className="form-group-input"
                                                value={schedule.title}
                                                onChange={e => commit( { ...schedule, title: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Bereich</label>
                                            <select
                                                className="form-group-select"
                                                value={schedule.targetRole}
                                                onChange={e =>
                                                    commit( {
                                                        ...schedule,
                                                        targetRole: e.target.value as Role.Technician | Role.Housekeeping,
                                                        assignees: [],
                                                        assignment: { type: 'rotate' },
                                                        rotationCursor: 0,
                                                    })
                                                }
                                            >
                                                <option value={Role.Technician}>Haustechniker</option>
                                                <option value={Role.Housekeeping}>Hauswirtschaft</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Bereich (Pflichtfeld)</label>
                                            <input
                                                className="form-group-input"
                                                value={schedule.area}
                                                onChange={e =>
                                                    commit( {
                                                        ...schedule,
                                                        area: e.target.value,
                                                    })
                                                }
                                                placeholder="z.B. Alle Wohnbereiche / Küche / Wäscherei"
                                                required
                                            />
                                            {!String(schedule.area || '').trim() && (
                                                <p className="form-group-description" style={{ color: 'var(--accent-danger)' }}>
                                                    Bitte einen Bereich angeben.
                                                </p>
                                            )}
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label>Beschreibung</label>
                                            <textarea
                                                className="form-group-input"
                                                style={{ minHeight: 80, resize: 'vertical' }}
                                                value={schedule.description}
                                                onChange={e => commit( { ...schedule, description: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginTop: 12 }}>
                                        <label>Startdatum</label>
                                        <input
                                            type="date"
                                            className="form-group-input"
                                            style={{ maxWidth: 220 }}
                                            value={(schedule as any).startDate || ''}
                                            onChange={(e) =>
                                                commit( {
                                                    ...schedule,
                                                    startDate: e.target.value || null,
                                                })
                                            }
                                        />
                                        <p className="form-group-description" style={{ marginTop: 6 }}>
                                            Ab diesem Kalendertag gilt die Wiederholung (z. B. 05.10.2026). Für <strong>monatlich</strong> und <strong>jährlich</strong> erforderlich. Bei <strong>wöchentlich</strong> mit Datum: gleicher Wochentag ab diesem Tag. Ohne Datum bleibt die bisherige Wochen-Logik (nur Intervall).
                                        </p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                        <div className="form-group">
                                            <label>Wiederholung</label>
                                            <select
                                                className="form-group-select"
                                                value={schedule.recurrence?.type || 'weekdays'}
                                                onChange={e => {
                                                    const type = e.target.value;
                                                    const today = localISODate(new Date());
                                                    let next: any;
                                                    if (type === 'daily') next = { type: 'daily' };
                                                    else if (type === 'weekly') next = { type: 'weekly', intervalWeeks: 1 };
                                                    else if (type === 'weekdays')
                                                        next = { type: 'weekdays', intervalWeeks: 1, weekdays: ['mo', 'mi', 'fr'] as WeekdayKey[] };
                                                    else if (type === 'monthly') next = { type: 'monthly', intervalMonths: 1, dayOfMonth: 5 };
                                                    else next = { type: 'yearly', month: 10, day: 5 };
                                                    const patch: Partial<RoutineSchedule> = { recurrence: next };
                                                    if ((type === 'monthly' || type === 'yearly') && !(schedule as any).startDate) {
                                                        (patch as any).startDate = today;
                                                    }
                                                    commit( { ...schedule, ...patch } as RoutineSchedule);
                                                }}
                                            >
                                                <option value="daily">Täglich</option>
                                                <option value="weekly">Wöchentlich (Intervall Wochen)</option>
                                                <option value="weekdays">Bestimmte Wochentage</option>
                                                <option value="monthly">Monatlich</option>
                                                <option value="yearly">Jährlich</option>
                                            </select>

                                            {(schedule.recurrence?.type === 'weekly' || schedule.recurrence?.type === 'weekdays') && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Intervall</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        className="form-group-input"
                                                        style={{ width: 110 }}
                                                        value={schedule.recurrence?.intervalWeeks || 1}
                                                        onChange={e => {
                                                            const intervalWeeks = Math.max(1, parseInt(e.target.value || '1', 10));
                                                            const t = schedule.recurrence?.type;
                                                            if (t === 'weekdays') {
                                                                commit( {
                                                                    ...schedule,
                                                                    recurrence: { ...(schedule.recurrence as any), intervalWeeks },
                                                                } as any);
                                                            } else {
                                                                commit( {
                                                                    ...schedule,
                                                                    recurrence: { type: 'weekly', intervalWeeks },
                                                                } as any);
                                                            }
                                                        }}
                                                    />
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Woche(n)</span>
                                                </div>
                                            )}

                                            {schedule.recurrence?.type === 'monthly' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>alle</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            className="form-group-input"
                                                            style={{ width: 110 }}
                                                            value={(schedule.recurrence as any).intervalMonths || 1}
                                                            onChange={e => {
                                                                const intervalMonths = Math.max(1, parseInt(e.target.value || '1', 10));
                                                                commit( {
                                                                    ...schedule,
                                                                    recurrence: {
                                                                        type: 'monthly',
                                                                        intervalMonths,
                                                                        dayOfMonth: Math.max(1, Math.min(31, (schedule.recurrence as any).dayOfMonth || 1)),
                                                                    } as any,
                                                                });
                                                            }}
                                                        />
                                                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Monat(e)</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Tag im Monat</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={31}
                                                            className="form-group-input"
                                                            style={{ width: 110 }}
                                                            value={(schedule.recurrence as any).dayOfMonth || 1}
                                                            onChange={e => {
                                                                const dayOfMonth = Math.max(1, Math.min(31, parseInt(e.target.value || '1', 10)));
                                                                commit( {
                                                                    ...schedule,
                                                                    recurrence: {
                                                                        type: 'monthly',
                                                                        intervalMonths: Math.max(1, (schedule.recurrence as any).intervalMonths || 1),
                                                                        dayOfMonth,
                                                                    } as any,
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {schedule.recurrence?.type === 'yearly' && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, alignItems: 'center' }}>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>jedes Jahr am</span>
                                                    <select
                                                        className="form-group-select"
                                                        style={{ width: 130 }}
                                                        value={(schedule.recurrence as any).month || 1}
                                                        onChange={e => {
                                                            const month = Math.max(1, Math.min(12, parseInt(e.target.value, 10)));
                                                            commit( {
                                                                ...schedule,
                                                                recurrence: {
                                                                    type: 'yearly',
                                                                    month,
                                                                    day: Math.max(1, Math.min(31, (schedule.recurrence as any).day || 1)),
                                                                } as any,
                                                            });
                                                        }}
                                                    >
                                                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                                            <option key={m} value={m}>
                                                                {['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][m - 1]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={31}
                                                        className="form-group-input"
                                                        style={{ width: 72 }}
                                                        value={(schedule.recurrence as any).day || 1}
                                                        onChange={e => {
                                                            const day = Math.max(1, Math.min(31, parseInt(e.target.value || '1', 10)));
                                                            commit( {
                                                                ...schedule,
                                                                recurrence: {
                                                                    type: 'yearly',
                                                                    month: Math.max(1, Math.min(12, (schedule.recurrence as any).month || 1)),
                                                                    day,
                                                                } as any,
                                                            });
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {schedule.recurrence?.type === 'weekdays' && (
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                                                    {weekdayOptions.map(w => {
                                                        const checked = weekdays.includes(w.key);
                                                        return (
                                                            <label key={w.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', background: checked ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={e => {
                                                                        const next = e.target.checked
                                                                            ? Array.from(new Set([...weekdays, w.key]))
                                                                            : weekdays.filter(x => x !== w.key);
                                                                        commit( {
                                                                            ...schedule,
                                                                            recurrence: {
                                                                                type: 'weekdays',
                                                                                intervalWeeks:
                                                                                    schedule.recurrence?.type === 'weekdays'
                                                                                        ? schedule.recurrence.intervalWeeks || 1
                                                                                        : 1,
                                                                                weekdays: next,
                                                                            },
                                                                        } as RoutineSchedule);
                                                                    }}
                                                                />
                                                                <span style={{ fontSize: 12 }}>{w.label}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label>Zuordnung</label>
                                            <select
                                                className="form-group-select"
                                                value={schedule.assignment?.type || 'rotate'}
                                                onChange={e => {
                                                    const type = e.target.value as 'rotate' | 'fixed';
                                                    const next =
                                                        type === 'rotate'
                                                            ? ({ type: 'rotate' } as const)
                                                            : ({ type: 'fixed', userName: selectedAssignees[0] || '' } as const);
                                                    commit( { ...schedule, assignment: next as any, rotationCursor: 0 });
                                                }}
                                            >
                                                <option value="rotate">Automatisch rotieren</option>
                                                <option value="fixed">Feste Person</option>
                                            </select>

                                            {schedule.assignment?.type === 'fixed' && (
                                                <select
                                                    className="form-group-select"
                                                    style={{ marginTop: 8 }}
                                                    value={schedule.assignment.userName}
                                                    onChange={e =>
                                                        commit( {
                                                            ...schedule,
                                                            assignment: { type: 'fixed', userName: e.target.value } as any,
                                                        })
                                                    }
                                                >
                                                    {selectedAssignees.length === 0 ? (
                                                        <option value="">(Keine aktiven Nutzer)</option>
                                                    ) : (
                                                        selectedAssignees.map(n => <option key={n} value={n}>{n}</option>)
                                                    )}
                                                </select>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginTop: 12 }}>
                                        <label>Zuständige Mitarbeiter (für Rotation)</label>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {eligible.length === 0 ? (
                                                <span style={{ color: 'var(--text-muted)' }}>(Keine aktiven Nutzer in diesem Bereich)</span>
                                            ) : (
                                                eligible.map(name => {
                                                    const checked = (schedule.assignees || []).includes(name);
                                                    return (
                                                        <label
                                                            key={name}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                padding: '6px 10px',
                                                                borderRadius: 999,
                                                                border: '1px solid var(--border)',
                                                                background: checked ? 'var(--bg-secondary)' : 'transparent',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={e => {
                                                                    const current = schedule.assignees || [];
                                                                    const next = e.target.checked
                                                                        ? Array.from(new Set([...current, name]))
                                                                        : current.filter(n => n !== name);
                                                                    commit( { ...schedule, assignees: next, rotationCursor: 0 });
                                                                }}
                                                            />
                                                            <span style={{ fontSize: 12 }}>{name}</span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {schedule.assignment?.type === 'rotate' && rotationPool.length > 0 && (
                                        <div className="form-group" style={{ marginTop: 12 }}>
                                            <label>Als Nächstes in der Rotation</label>
                                            <select
                                                className="form-group-select"
                                                style={{ maxWidth: 400 }}
                                                value={String(Math.max(0, Number(schedule.rotationCursor || 0)) % rotationPool.length)}
                                                onChange={(e) => {
                                                    const idx = parseInt(e.target.value, 10);
                                                    commit( {
                                                        ...schedule,
                                                        rotationCursor: Number.isFinite(idx) ? idx : 0,
                                                    });
                                                }}
                                            >
                                                {rotationPool.map((name, i) => (
                                                    <option key={name} value={String(i)}>
                                                        {name}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="form-group-description" style={{ marginTop: 6 }}>
                                                Wer beim nächsten fälligen Serientermin zuerst das Ticket erhält. Später jederzeit wieder änderbar; danach läuft die Verteilung im gleichen Kreis weiter.
                                            </p>
                                        </div>
                                    )}

                                    {isPending && (
                                        <div
                                            style={{
                                                marginTop: 14,
                                                paddingTop: 12,
                                                borderTop: '1px solid var(--border)',
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                                gap: 8,
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <button type="button" className="btn btn-primary" onClick={() => commitPendingRoutine(schedule)}>
                                                Speichern
                                            </button>
                                        </div>
                                    )}
                                    </>
                                    )}

                                </div>
                            );
                        })
                    )}

                    <button
                        onClick={() => {
                            const id = `routine-${Date.now()}`;
                            const defaultRole: Role.Technician | Role.Housekeeping = Role.Technician;
                            const newItem: RoutineSchedule & { recurrence?: any } = {
                                id,
                                title: 'Neue Aufgabe',
                                description: '',
                                area: '',
                                location: '',
                                targetRole: defaultRole,
                                assignees: [],
                                assignment: { type: 'rotate' },
                                enabled: true,
                                lastGenerated: null,
                                rotationCursor: 0,
                                startDate: localISODate(new Date()),
                                recurrence: { type: 'weekdays', intervalWeeks: 1, weekdays: ['mo', 'mi', 'fr'] as WeekdayKey[] },
                            };
                            setPendingNewRoutines(prev => [...prev, newItem]);
                        }}
                        className="btn btn-secondary btn-full-width"
                    >
                        <PlusIcon /> Serientermin hinzufügen
                    </button>
                </div>
            </div>
        </>
        );
    };
    const KeywordTagInput: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => {
        const [input, setInput] = useState('');
        const tags = value.split(',').map(t => t.trim()).filter(Boolean);
        const addTag = (raw: string) => {
            const t = raw.replace(/,/g, '').trim();
            if (!t || tags.includes(t)) { setInput(''); return; }
            onChange([...tags, t].join(','));
            setInput('');
        };
        const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag).join(','));
        return (
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center',
                border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.6rem',
                background: 'var(--bg-primary)', minHeight: 38, cursor: 'text',
            }}>
                {tags.map(tag => (
                    <span key={tag} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                        borderRadius: 999, padding: '1px 8px 1px 10px', fontSize: '0.78rem',
                        color: 'var(--text-primary)', whiteSpace: 'nowrap',
                    }}>
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1,
                            display: 'flex', alignItems: 'center',
                        }}>×</button>
                    </span>
                ))}
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
                        if (e.key === 'Backspace' && !input && tags.length > 0) removeTag(tags[tags.length - 1]);
                    }}
                    onBlur={() => { if (input.trim()) addTag(input); }}
                    placeholder={tags.length === 0 ? 'Keyword eingeben + Enter' : ''}
                    style={{
                        border: 'none', outline: 'none', background: 'transparent',
                        fontSize: '0.85rem', color: 'var(--text-primary)', minWidth: 120, flex: 1,
                    }}
                />
            </div>
        );
    };

    const renderProzesseTab = () => (
        <>
            <div className="settings-section">
                <div className="settings-section-header"><h3 className="settings-section-title">Ticket-Kategorien</h3></div>
                <div className="settings-section-body">
                    <p className="form-group-description">Kategorien steuern die Standard-Priorität und die SLA-Fälligkeiten.</p>
                    {appSettings.ticketCategories.map(cat => (
                        <div key={cat.id} className="list-item">
                            <input type="text" value={cat.name} onChange={e => handleUpdateSetting('ticketCategories', {...cat, name: e.target.value})} className="form-group-input" />
                            <select value={cat.default_priority ?? Priority.Mittel} onChange={e => handleUpdateSetting('ticketCategories', {...cat, default_priority: e.target.value as Priority})} className="form-group-select" style={{ maxWidth: 110 }}>
                                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <button onClick={() => handleDeleteSetting('ticketCategories', cat.id)} className="btn btn-danger-sm"><TrashIcon/></button>
                        </div>
                    ))}
                    <button onClick={() => handleAddSetting<TicketCategory>('ticketCategories', { name: 'Neue Kategorie', default_priority: Priority.Mittel })} className="btn btn-secondary btn-full-width"><PlusIcon /> Neue Kategorie hinzufügen</button>
                </div>
            </div>

            <div className="settings-section">
                <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 className="settings-section-title">Automatisches Ticket-Routing</h3>
                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => {
                        if (window.confirm('Alle bestehenden Routing-Regeln durch die 11 Standard-Regeln ersetzen?')) {
                            setAppSettings(prev => ({ ...prev, routingRules: DEFAULT_APP_SETTINGS.routingRules }));
                        }
                    }}>Standard laden</button>
                </div>
                <div className="settings-section-body">
                    <p className="form-group-description">
                        Keywords eingeben und mit <strong>Enter</strong> bestätigen. Mitarbeiter direkt anklicken zum Zuordnen.
                    </p>
                    {appSettings.routingRules.map(rule => {
                        const allTechs = users.filter(u => u.isActive && (u.role === Role.Technician || u.role === Role.Housekeeping));
                        const assignees = rule.assignees || [];
                        const removeAssignee = (name: string) => handleUpdateSetting<RoutingRule>('routingRules', {...rule, assignees: assignees.filter(n => n !== name)});
                        const addAssignee = (name: string) => { if (name) handleUpdateSetting<RoutingRule>('routingRules', {...rule, assignees: [...assignees, name]}); };
                        const unassigned = allTechs.filter(u => !assignees.includes(u.name));
                        return (
                        <div key={rule.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px 120px auto', gap: '0.75rem', alignItems: 'start' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 500 }}>Keywords</div>
                                    <KeywordTagInput value={rule.keyword} onChange={val => handleUpdateSetting<RoutingRule>('routingRules', {...rule, keyword: val})} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 500 }}>Kategorie</div>
                                    <select value={rule.categoryId || ''} onChange={e => handleUpdateSetting<RoutingRule>('routingRules', {...rule, categoryId: e.target.value || undefined})} className="form-group-select">
                                        <option value="">— keine —</option>
                                        {appSettings.ticketCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 500 }}>Priorität</div>
                                    <select value={rule.priority || ''} onChange={e => handleUpdateSetting<RoutingRule>('routingRules', {...rule, priority: e.target.value as Priority || undefined})} className="form-group-select">
                                        <option value="">— auto —</option>
                                        {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <button onClick={() => handleDeleteSetting('routingRules', rule.id)} className="btn btn-danger-sm" style={{ marginTop: '1.4rem' }}><TrashIcon /></button>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>Zuständige Mitarbeiter</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                                    {assignees.map(name => {
                                        const u = users.find(u => u.name === name);
                                        const available = !u || u.availability.status === AvailabilityStatus.Available;
                                        return (
                                            <span key={name} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                fontSize: '0.78rem', fontWeight: 600, borderRadius: 6, padding: '3px 8px 3px 12px',
                                                background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.4)',
                                                color: available ? '#2563eb' : 'var(--text-muted)',
                                            }}>
                                                {name.split(' ')[0]} {name.split(' ').slice(-1)[0]}
                                                {!available && ' · abwesend'}
                                                <button type="button" onClick={() => removeAssignee(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: '1rem', lineHeight: 1, opacity: 0.7 }}>×</button>
                                            </span>
                                        );
                                    })}
                                    {unassigned.length > 0 && (
                                        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                                            <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: 1, marginTop: '-1px' }}>+</span>
                                            <select value="" onChange={e => addAssignee(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                                                <option value=""></option>
                                                {unassigned.map(u => <option key={u.name} value={u.name}>{u.name.split(' ')[0]} {u.name.split(' ').slice(-1)[0]}{u.availability.status !== AvailabilityStatus.Available ? ' (abwesend)' : ''}</option>)}
                                            </select>
                                        </label>
                                    )}
                                    {assignees.length === 0 && unassigned.length === 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Keine aktiven Mitarbeiter.</span>}
                                </div>
                            </div>
                        </div>
                        );
                    })}
                    <button onClick={() => handleAddSetting<RoutingRule>('routingRules', { keyword: '', skill: '' })} className="btn btn-secondary btn-full-width"><PlusIcon /> Neue Routing-Regel hinzufügen</button>
                    <datalist id="skills-datalist">
                        {allSkills.map(s => <option key={s} value={s} />)}
                    </datalist>
                </div>
            </div>
        </>
    );

    const renderBenutzerTab = () => {
        const roleLabel: Record<string, string> = { admin: 'Admin', techniker: 'Haustechniker', hauswirtschaft: 'Hauswirtschaft' };
        const roleColor: Record<string, string> = { admin: '#c0392b', techniker: '#2563eb', hauswirtschaft: '#059669' };
        const getInitials = (name: string) => name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
        return (
            <div id="user-management">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{users.length} Benutzer</span>
                    <button className="btn btn-primary" onClick={() => handleOpenUserModal(null)}><PlusIcon />Hinzufügen</button>
                </div>

                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 120px 60px 110px 40px', gap: '0.75rem', padding: '0 1rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                    {['Name', 'Rolle', 'Status', 'Aktiv', '', ''].map((h, i) => (
                        <span key={i} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                    ))}
                </div>

                {/* Rows */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginTop: '0.5rem' }}>
                    {users.map((user, idx) => {
                        const color = roleColor[user.role] ?? '#888888';
                        const avatarColor = user.color ?? color;
                        const available = user.availability.status === AvailabilityStatus.Available;
                        return (
                            <div key={user.id} style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 150px 120px 60px 110px 40px',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.65rem 1rem',
                                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                                opacity: user.isActive ? 1 : 0.45,
                            }}>
                                {/* Name + Avatar + color dot */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%', background: avatarColor, flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 700, fontSize: '0.7rem',
                                    }}>{getInitials(user.name)}</div>
                                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                                    {/* Inline color picker dot */}
                                    <label
                                        title="Farbe ändern"
                                        style={{ position: 'relative', width: 14, height: 14, borderRadius: '50%', background: avatarColor, flexShrink: 0, cursor: 'pointer', border: '1.5px solid rgba(0,0,0,0.15)', display: 'inline-block' }}
                                    >
                                        <input
                                            type="color"
                                            value={avatarColor}
                                            onChange={e => setUsers(current => current.map(u => u.id === user.id ? { ...u, color: e.target.value } : u))}
                                            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }}
                                        />
                                    </label>
                                </div>

                                {/* Rolle */}
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                                    background: color + '15', color, border: `1px solid ${color}30`,
                                    display: 'inline-block', width: 'fit-content',
                                }}>{roleLabel[user.role] ?? user.role}</span>

                                {/* Verfügbarkeit */}
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                                    background: available ? 'rgba(5,150,105,0.1)' : 'rgba(220,53,69,0.1)',
                                    color: available ? '#059669' : '#c0392b',
                                    border: `1px solid ${available ? 'rgba(5,150,105,0.3)' : 'rgba(220,53,69,0.3)'}`,
                                    display: 'inline-block', width: 'fit-content',
                                }}>{available ? 'Verfügbar' : 'Abwesend'}</span>

                                {/* Toggle */}
                                <div><SwitchToggle id={`user-status-${user.id}`} isChecked={user.isActive} onChange={() => handleToggleUserStatus(user.id)} /></div>

                                {/* Bearbeiten */}
                                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => handleOpenUserModal(user)}>Bearbeiten</button>

                                {/* Löschen */}
                                {user.role !== Role.Admin ? (
                                    <button className="btn btn-danger-sm" onClick={() => handleDeleteUser(user.id)} title="Löschen"><TrashIcon /></button>
                                ) : (
                                    <button className="btn btn-danger-sm" disabled style={{ opacity: 0.25, cursor: 'not-allowed' }}><TrashIcon /></button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderStandorteTab = () => (
        <div id="location-management">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{locations.length} Standorte</span>
                <button className="btn btn-primary" onClick={() => handleOpenLocationModal(null)}><PlusIcon />Hinzufügen</button>
            </div>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {locations.map((location, idx) => (
                    <div key={location.id} style={{
                        display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                        alignItems: 'center', gap: '0.75rem',
                        padding: '0.7rem 1rem',
                        borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                        opacity: location.isActive ? 1 : 0.45,
                    }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{location.name}</span>
                        <SwitchToggle id={`location-status-${location.id}`} isChecked={location.isActive} onChange={() => handleToggleLocationStatus(location.id)} />
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={() => handleOpenLocationModal(location)}>Bearbeiten</button>
                        <button className="btn btn-danger-sm" onClick={() => handleDeleteLocation(location.id)} title="Löschen"><TrashIcon /></button>
                    </div>
                ))}
            </div>
        </div>
    );



    const BenachrichtigungenTab: React.FC<{ appSettings: AppSettings; setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>> }> = ({ appSettings, setAppSettings }) => {
        const [draftEmail, setDraftEmail] = useState(appSettings.adminNotificationEmail ?? '');
        const isDirty = draftEmail !== (appSettings.adminNotificationEmail ?? '');
        const [saved, setSaved] = useState(false);
        const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');

        const handleSave = () => {
            setAppSettings(prev => ({ ...prev, adminNotificationEmail: draftEmail }));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        };

        const handleTestMail = async () => {
            const target = appSettings.adminNotificationEmail ?? '';
            if (!target) return;
            setTestStatus('sending');
            try {
                const ok = await onSendTestEmail?.(target);
                setTestStatus(ok ? 'ok' : 'fail');
            } catch {
                setTestStatus('fail');
            }
            setTimeout(() => setTestStatus('idle'), 4000);
        };

        const testLabel = testStatus === 'sending' ? 'Wird gesendet…'
            : testStatus === 'ok' ? '✓ Test-Mail gesendet'
            : testStatus === 'fail' ? '✗ Fehler beim Senden'
            : 'Test-Mail senden';
        const testColor = testStatus === 'ok' ? 'var(--accent-success)' : testStatus === 'fail' ? '#DC2626' : undefined;

        return (
            <div className="settings-section">
                <div className="settings-section-header">
                    <h3 className="settings-section-title">Benachrichtigungen</h3>
                </div>
                <div className="settings-section-body">
                    <div className="form-group">
                        <label>Admin-E-Mail für neue Meldungen</label>
                        <p className="form-group-description">
                            Bei jedem neu eingegangenen Ticket wird automatisch eine E-Mail mit allen Ticket-Infos an diese Adresse gesendet. Leer lassen um die Benachrichtigung zu deaktivieren.
                        </p>
                        <input
                            type="email"
                            placeholder="admin@beispiel.de"
                            value={draftEmail}
                            onChange={e => { setDraftEmail(e.target.value); setSaved(false); }}
                            className="form-group-input"
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            disabled={!isDirty}
                            onClick={handleSave}
                            style={{ opacity: isDirty ? 1 : 0.5 }}
                        >
                            Speichern
                        </button>
                        {saved && <span style={{ fontSize: '0.85rem', color: 'var(--accent-success)' }}>Gespeichert</span>}
                        {onSendTestEmail && (
                            <button
                                className="btn btn-secondary"
                                disabled={!appSettings.adminNotificationEmail || testStatus === 'sending'}
                                onClick={handleTestMail}
                                style={{ opacity: appSettings.adminNotificationEmail ? 1 : 0.4, color: testColor }}
                            >
                                <i className="ti ti-mail-forward" style={{ fontSize: 15, marginRight: 4 }} />
                                {testLabel}
                            </button>
                        )}
                    </div>
                    {testStatus === 'ok' && (
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Test-Mail wurde an <strong>{appSettings.adminNotificationEmail}</strong> gesendet. Bitte Posteingang prüfen.
                        </p>
                    )}
                    {testStatus === 'fail' && (
                        <p style={{ fontSize: '0.82rem', color: '#DC2626', marginTop: '0.5rem' }}>
                            Versand fehlgeschlagen – E-Mail-Adresse oder Brevo-Konfiguration prüfen.
                        </p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="settings-view">
            <style>{`
                /* General Styles */
                .settings-view { padding-top: 1.5rem; max-width: 1200px; margin: 0 auto; }
                .settings-tabs { display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem; flex-wrap: wrap; }
                .tab-btn { background: none; border: none; padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 500; cursor: pointer; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: var(--transition-smooth); }
                .tab-btn.active { color: var(--text-primary); border-bottom-color: var(--accent-primary); }
                .tab-content { animation: fadeIn 0.3s ease; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                /* Section Styles */
                .settings-section { background-color: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 2rem; }
                .settings-section-header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); }
                .settings-section-title { font-size: 1.2rem; font-weight: 700; letter-spacing: 0.02em; color: var(--text-primary); }
                .settings-section-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }

                /* Form & List Styles */
                .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
                 .form-group-description { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem; }
                .form-group-input, .form-group-select { width: 100%; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-primary); font-size: 0.95rem; color: var(--text-primary); transition: var(--transition-smooth); }
                .form-group-input:focus, .form-group-select:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1); }
                .list-item { display: flex; gap: 0.5rem; align-items: center; }
                
                /* Grids for complex settings */
                .sla-grid-header, .routing-grid-header { display: grid; grid-template-columns: 2fr 2fr 1fr auto; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); font-weight: 500; margin-bottom: 0.5rem; padding: 0 0.5rem; }
                .routing-grid-header { grid-template-columns: 3fr 2fr auto; }
                .sla-grid-row, .routing-grid-row { display: grid; grid-template-columns: 2fr 2fr 1fr auto; gap: 0.5rem; align-items: center; }
                .routing-grid-row { grid-template-columns: 3fr 2fr auto; }

                /* Buttons */
                .btn { padding: 0.5rem 1rem; border-radius: 8px; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: var(--transition-smooth); display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: 1px solid transparent; }
                .btn-primary { background-color: var(--accent-primary); color: white; }
                .btn-secondary { background-color: var(--bg-tertiary); border-color: var(--border); color: var(--text-secondary); }
                .btn-secondary:hover { background-color: var(--border); color: var(--text-primary); }
                .btn-full-width { width: 100%; }
                .btn-danger { color: var(--accent-danger); background: none; border: none; }
                 .btn-danger:hover:not(:disabled) { background-color: rgba(220, 53, 69, 0.1); }
                .btn-danger-sm { background: none; border: none; color: var(--text-muted); padding: 0.5rem; }
                .btn-danger-sm:hover { color: var(--accent-danger); background: rgba(220, 53, 69, 0.1); border-radius: 50%; }
                
                /* Table Styles for User/Area list */
                .content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .content-title { font-size: 1.35rem; font-weight: 700; letter-spacing: 0.02em; color: var(--text-primary); }
                .settings-table { width: 100%; border-collapse: collapse; }
                .settings-table th, .settings-table td { text-align: left; padding: 1rem; border-bottom: 1px solid var(--border); }
                .settings-table th { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; }
                .status-badge { padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; color: white; }
                .status-badge.active { background-color: var(--accent-success); }
                .status-badge.inactive { background-color: var(--text-muted); }
                .actions-cell { display: flex; gap: 0.5rem; justify-content: flex-end; }
                .skills-container { display: flex; flex-wrap: wrap; gap: 0.25rem; }
                .skill-tag { background-color: var(--bg-tertiary); color: var(--text-secondary); padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 500; }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button
                    onClick={handleDownloadDocs}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem', gap: '0.4rem' }}
                >
                    <DocumentArrowDownIcon />
                    Dokumentation (PDF)
                </button>
            </div>

            <div className="settings-tabs">
                <button className={`tab-btn ${activeTab === 'allgemein' ? 'active' : ''}`} onClick={() => requestTab('allgemein')}>Allgemein</button>
                <button className={`tab-btn ${activeTab === 'prozesse' ? 'active' : ''}`} onClick={() => requestTab('prozesse')}>Prozesse & Logik</button>
                <button className={`tab-btn ${activeTab === 'serientermine' ? 'active' : ''}`} onClick={() => requestTab('serientermine')}>Serientermine</button>
                <button className={`tab-btn ${activeTab === 'benutzer' ? 'active' : ''}`} onClick={() => requestTab('benutzer')}>Benutzer</button>
                <button className={`tab-btn ${activeTab === 'standorte' ? 'active' : ''}`} onClick={() => requestTab('standorte')}>Standorte</button>
                <button className={`tab-btn ${activeTab === 'benachrichtigungen' ? 'active' : ''}`} onClick={() => requestTab('benachrichtigungen')}>Benachrichtigungen</button>
            </div>
            <div className="tab-content">
                {activeTab === 'allgemein' && renderAllgemeinTab()}
                {activeTab === 'prozesse' && renderProzesseTab()}
                {activeTab === 'serientermine' && renderSerientermineTab()}
                {activeTab === 'benutzer' && renderBenutzerTab()}
                {activeTab === 'standorte' && renderStandorteTab()}
                {activeTab === 'benachrichtigungen' && (
                    <BenachrichtigungenTab appSettings={appSettings} setAppSettings={setAppSettings} />
                )}
            </div>
            {isUserModalOpen && <UserModal user={editingUser} allSkills={allSkills} onClose={() => setUserModalOpen(false)} onSave={handleSaveUser} />}
            {isLocationModalOpen && <AreaModal area={editingLocation} onClose={() => setLocationModalOpen(false)} onSave={handleSaveLocation} />}
        
            <iframe
                ref={iframeRef}
                style={{
                    position: 'absolute',
                    width: 0,
                    height: 0,
                    border: 0,
                }}
                title="Druck-Dokumentation"
            ></iframe>
        </div>
    );
};

export default SettingsView;
