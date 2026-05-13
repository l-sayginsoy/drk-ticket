
// FIX: Import useMemo hook from React.
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Location, Role, AppSettings, Priority, TicketCategory, SLARule, RoutingRule, Asset, MaintenancePlan, AvailabilityStatus, RoutineSchedule, WeekdayKey } from '../types';
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
    <title>Systemdokumentation: Intelligentes Facility Management Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        h1, h2, h3 {
            color: #222;
            line-height: 1.2;
            margin-top: 1.5em;
        }
        h1 {
            font-size: 2.5em;
            border-bottom: 2px solid #ccc;
            padding-bottom: 0.5em;
            margin-bottom: 1em;
        }
        h2 {
            font-size: 1.75em;
            border-bottom: 1px solid #ddd;
            padding-bottom: 0.3em;
            margin-bottom: 1em;
        }
        h3 {
            font-size: 1.25em;
            margin-bottom: 0.8em;
        }
        p {
            margin-bottom: 1em;
        }
        ul, ol {
            padding-left: 20px;
            margin-bottom: 1em;
        }
        li {
            margin-bottom: 0.5em;
        }
        strong {
            font-weight: 600;
        }
        code {
            background-color: #eee;
            padding: 2px 5px;
            border-radius: 4px;
            font-family: "Courier New", Courier, monospace;
        }
        .intro {
            font-style: italic;
            color: #555;
            border-left: 4px solid #0d6efd;
            padding-left: 15px;
            background-color: #f0f6ff;
            padding-top: 10px;
            padding-bottom: 10px;
        }
        @media print {
            body {
                background-color: #fff;
                margin: 0;
                padding: 0;
            }
            h1, h2, h3 {
                page-break-after: avoid;
            }
            .intro {
                background-color: #f2f2f2;
                border-color: #ddd;
            }
        }
    </style>
</head>
<body>

    <h1>Systemdokumentation: Intelligentes Facility Management Dashboard</h1>

    <div class="intro">
        <p><strong>Einleitung: Die Philosophie der Anwendung</strong></p>
        <p>Das Ziel dieser Anwendung ist die fundamentale Effizienzsteigerung im Facility Management. Durch eine Kombination aus benutzerfreundlichem Design und einer leistungsstarken Automatisierungs-Engine werden manuelle Arbeitsschritte drastisch reduziert, Fehlerquellen minimiert und eine durchgehende Transparenz für alle Beteiligten – vom Melder über den Bearbeiter bis zum Management – geschaffen. Die App ist als autarke, browserbasierte Lösung konzipiert, die ihre Daten im Local Storage speichert und somit ohne komplexes Server-Backend auskommt.</p>
    </div>

    <h2>Teil 1: Das Melder-Portal – Die Schnittstelle nach Außen</h2>
    <p>Das Portal ist der öffentliche Zugangspunkt zur Anwendung. Es ist bewusst minimalistisch und geführt gestaltet, um Meldungen so einfach und präzise wie möglich zu machen.</p>

    <h3>1.1. Ticket-Erstellung (Der geführte Prozess)</h3>
    <p>Ein Nutzer kann ohne Anmeldung eine neue Störung melden. Der Prozess ist so aufgebaut, dass das System im Hintergrund bereits die Weichen für eine schnelle Bearbeitung stellt.</p>
    <ul>
        <li><strong>Felder & Eingaben:</strong>
            <ul>
                <li>Bereich: Eine vordefinierte Liste von Standorten (z.B. "Küche", "Verwaltung").</li>
                <li>Ort/Detail: Ein Freitextfeld zur Spezifizierung des Ortes (z.B. "Raum 102", "Maschine 3").</li>
                <li>Betreff & Beschreibung: Felder zur genauen Beschreibung des Problems.</li>
            </ul>
        </li>
        <li><strong>Intelligente Vereinfachung:</strong>
            <ul>
                <li>Der Melder muss <strong>keine Kategorie</strong>, <strong>keine Priorität</strong> und <strong>keinen Bearbeiter</strong> auswählen.</li>
                <li><strong>Logik dahinter:</strong> Um den Meldevorgang so einfach wie möglich zu gestalten, wurde das Feld "Kategorie" entfernt. Das System ordnet das Ticket im Hintergrund automatisch einer Standard-Kategorie zu. Die Priorität und Bearbeiterzuweisung erfolgen ebenfalls vollautomatisch basierend auf intelligenten Regeln, was menschliche Fehleinschätzungen vermeidet und den Melder entlastet.</li>
                <li><strong>Abwesenheitsschutz:</strong> Das System stellt sicher, dass niemals ein abwesender Bearbeiter für ein neues Ticket ausgewählt wird.</li>
            </ul>
        </li>
        <li><strong>Foto-Upload (Freiwillig):</strong>
            <ul>
                <li>Es können bis zu <strong>3 Fotos</strong> zu einer Meldung hinzugefügt werden.</li>
                <li><strong>Wichtig:</strong> Der Foto-Upload ist <strong>immer freiwillig</strong>, auch in Bereichen wie "Sicherheit" oder "Brandschutz". Es gibt keine Verpflichtung, ein Foto hinzuzufügen.</li>
                <li>Alle hochgeladenen Bilder werden vor dem Speichern <strong>automatisch komprimiert</strong>, um den Speicherplatz im Browser zu schonen und die Performance zu gewährleisten.</li>
            </ul>
        </li>
        <li><strong>Wunsch-Termin:</strong> Ermöglicht dem Melder, eine Präferenz anzugeben.</li>
    </ul>

    <h3>1.2. Status-Prüfung (Transparenz für den Melder)</h3>
    <p>Melder können den Fortschritt ihrer Meldung jederzeit einsehen.</p>
    <ul>
        <li><strong>Suche:</strong> Die Suche erfolgt über die eindeutige <strong>Ticket-ID</strong>, die nach erfolgreicher Erstellung angezeigt wird.</li>
        <li><strong>Angezeigte Informationen:</strong>
            <ul>
                <li>Aktueller Status (z.B. "Offen", "In Arbeit").</li>
                <li>Zugewiesener Bearbeiter (falls bereits erfolgt).</li>
                <li><strong>Letzte öffentliche Notizen/Updates:</strong> Eine chronologische Ansicht der letzten Kommentare, die vom Bearbeiter oder Admin hinzugefügt wurden.</li>
            </ul>
        </li>
        <li><strong>Rückkanal:</strong>
            <ul>
                <li>Der Melder kann einem bestehenden Ticket eine <strong>neue Notiz</strong> hinzufügen.</li>
                <li>Diese Aktion setzt intern das Flag <code>hasNewNoteFromReporter</code> auf <code>true</code>, was in der Hauptanwendung durch einen visuellen Indikator signalisiert wird und den Bearbeiter über die neue Information in Kenntnis setzt.</li>
            </ul>
        </li>
    </ul>

    <h2>Teil 2: Das Herzstück – Die intelligente Automatisierungs-Engine</h2>
    <p>Sobald ein Ticket erstellt wird, beginnt die Automatisierungs-Engine im Hintergrund zu arbeiten. Ziel ist es, jedes Ticket ohne manuellen Eingriff optimal vorzubereiten und zu steuern.</p>

    <h3>2.1. Bei Ticketeingang (Sekunde Null)</h3>
    <ul>
        <li><strong>Automatische Priorisierung:</strong>
            <ul>
                <li>Das System ordnet das Ticket im Hintergrund automatisch einer <strong>Standard-Kategorie</strong> zu.</li>
                <li>Jeder Kategorie ist in den Einstellungen eine <strong>Standard-Priorität</strong> zugewiesen (z.B. "Sicherheit" -> "Hoch"). Diese wird automatisch für das neue Ticket gesetzt.</li>
            </ul>
        </li>
        <li><strong>SLA-basiertes Fälligkeitsdatum:</strong>
            <ul>
                <li>Anhand der Kombination aus <strong>Kategorie und Priorität</strong> wird in der <strong>SLA-Matrix</strong> (in den Einstellungen definiert) die festgelegte Reaktionszeit in Stunden ermittelt.</li>
                <li>Das System berechnet daraus präzise das Fälligkeitsdatum und trägt es in das Ticket ein.</li>
            </ul>
        </li>
        <li><strong>Automatisches Routing & Bearbeiter-Zuweisung:</strong>
            <ol>
                <li>Die Engine scannt <strong>Betreff und Beschreibung</strong> des Tickets nach vordefinierten <strong>Keywords</strong> (z.B. "Heizung", "Wasserhahn", "Strom").</li>
                <li>Findet die passende <strong>Routing-Regel</strong> und den damit verknüpften <strong>Skill</strong> (z.B. "HLK", "Sanitär", "Elektrik").</li>
                <li>Das System filtert alle Benutzer nach aktiven und verfügbaren Bearbeitern, die über diesen Skill verfügen.</li>
                <li>Es berechnet die aktuelle <strong>Auslastung</strong> jedes passenden Bearbeiters (Anzahl der ihm zugewiesenen, nicht abgeschlossenen Tickets).</li>
                <li>Das Ticket wird automatisch dem qualifizierten Bearbeiter mit der <strong>geringsten Auslastung</strong> zugewiesen.</li>
                <li><strong>Fallback:</strong> Wenn kein passender Bearbeiter gefunden wird, bleibt die Zuweisung auf "N/A", damit ein Admin manuell zuweisen kann.</li>
            </ol>
        </li>
    </ul>

    <h3>2.2. Laufende Systemüberwachung</h3>
    <p>Die App führt kontinuierlich (simulierte tägliche) Checks durch, um den Ticket-Lebenszyklus zu verwalten.</p>
    <ul>
        <li><strong>Überfälligkeits-Logik:</strong> Ein automatischer Prozess prüft täglich alle nicht abgeschlossenen Tickets. Wenn das Fälligkeitsdatum überschritten ist, wird der Status automatisch auf <strong>"Überfällig"</strong> gesetzt.</li>
        <li><strong>Wartungsplan-Generator:</strong> Das System prüft täglich die hinterlegten Wartungspläne. Ist ein Plan basierend auf seinem Intervall und dem Datum der letzten Ausführung fällig, wird automatisch ein neues, <strong>präventives Wartungsticket</strong> mit allen vordefinierten Informationen (Aufgabe, Priorität etc.) erstellt.</li>
        <li><strong>Automatische Umverteilung bei Abwesenheit:</strong>
            <ul>
                <li><strong>Trigger:</strong> Sobald ein Admin oder das System den Verfügbarkeits-Status eines Bearbeiters auf <strong>"Abwesend"</strong> (z.B. Krankheit, Urlaub) setzt.</li>
                <li><strong>Logik:</strong> Das System scannt sofort alle offenen Tickets dieses Bearbeiters. Tickets, die während der Abwesenheit fällig wären oder als kritisch (hohe Priorität) eingestuft sind, werden identifiziert.</li>
                <li><strong>Aktion:</strong> Diese Tickets werden automatisch an denjenigen verfügbaren Kollegen umverteilt, der aktuell die <strong>geringste Auslastung</strong> (wenigste offene Tickets) hat. Dies stellt sicher, dass keine Aufgaben liegen bleiben.</li>
            </ul>
        </li>
    </ul>

    <h2>Teil 3: Die Hauptanwendung – Das Cockpit für Bearbeiter & Admins</h2>
    <p>Dies ist die passwortgeschützte Hauptansicht zur Verwaltung und Bearbeitung aller Tickets.</p>

    <h3>3.1. Rollen & Berechtigungen</h3>
    <ul>
        <li><strong>Admin:</strong> Hat Vollzugriff. Sieht alle Tickets und alle Ansichten (Dashboard, Reports etc.) und kann die "Steuerzentrale" (Settings) zur Konfiguration der Automatisierung verwalten.</li>
        <li><strong>Service-Team:</strong> Hat eingeschränkten Zugriff. Sieht standardmäßig nur die ihm zugewiesenen Tickets in den Ansichten "Aktuelle Tickets" und "Abgeschlossen". Hat keinen Zugriff auf Dashboard, Reports, Team-Übersicht und Settings.</li>
    </ul>

    <h3>3.2. Benutzer-Status vs. Verfügbarkeit</h3>
    <p>In der Benutzerverwaltung gibt es zwei wichtige Unterscheidungen:</p>
    <ul>
        <li><strong>Status-Schalter (Aktiv/Inaktiv):</strong> Dieser Schalter in der Liste ("Status") deaktiviert das Benutzerkonto dauerhaft (z.B. bei Austritt). Inaktive Nutzer können sich nicht anmelden und erhalten keine neuen Tickets.</li>
        <li><strong>Verfügbarkeit (Anwesend/Abwesend):</strong> Dies regelt temporäre Abwesenheiten (Urlaub, Krankheit). Setzt man einen Nutzer auf "Abwesend", greift die oben beschriebene automatische Umverteilung.</li>
    </ul>

    <h3>3.2. Die Ansichten im Detail</h3>
    <ul>
        <li><strong>Dashboard (Kanban-Ansicht):</strong>
            <ul>
                <li>Eine visuelle Übersicht aller aktiven Tickets, aufgeteilt in Spalten nach Status ("Offen", "In Arbeit", "Überfällig").</li>
                <li>Tickets werden innerhalb der Spalten automatisch nach Dringlichkeit (Notfall > Überfällig > Priorität) sortiert.</li>
                <li>Ermöglicht eine schnelle Statusänderung per <strong>Drag & Drop</strong> eines Tickets von einer Spalte in die andere.</li>
            </ul>
        </li>
        <li><strong>Ticket-Liste (Tabellenansicht):</strong>
            <ul>
                <li>Eine detaillierte Listenansicht, die sich hervorragend für die gezielte Analyse eignet.</li>
                <li><strong>Funktionen:</strong> Volltextsuche, Filtern nach allen Kriterien, Sortieren jeder Spalte und <strong>Gruppieren</strong> von Tickets nach Status, Bereich oder Bearbeiter.</li>
            </ul>
        </li>
        <li><strong>Team-Übersicht:</strong>
            <ul>
                <li>Ein reines Admin-Tool zur Performance-Analyse.</li>
                <li>Zeigt eine Übersicht aller Team-Mitglieder mit KPIs wie: aktuelle Auslastung, Performance-Trend und prozentualer Anteil an der Gesamtauslastung.</li>
            </ul>
        </li>
        <li><strong>Reports-Ansicht:</strong>
            <ul>
                <li>Die "Management-Ebene" mit grafischen Auswertungen.</li>
                <li>Zeigt filterbare KPIs wie Gesamtzahl der Tickets, Lösungsquote, durchschnittliche Lösungszeit und Hotspots (Bereiche mit den meisten Tickets).</li>
            </ul>
        </li>
    </ul>

    <h3>3.3. Ticket-Management</h3>
    <ul>
        <li><strong>Detail-Seitenleiste:</strong>
            <ul>
                <li>Öffnet sich bei Klick auf ein Ticket und ist der zentrale Ort für die Bearbeitung.</li>
                <li>Ermöglicht das Ändern aller relevanten Felder (Status, Priorität, Bearbeiter etc.).</li>
                <li>Zeigt alle Stammdaten, die Beschreibung, Fotos und die <strong>vollständige Notiz-Historie</strong>.</li>
                <li>Ermöglicht das Hinzufügen neuer, interner Notizen.</li>
            </ul>
        </li>
        <li><strong>Massenbearbeitung (Bulk Actions):</strong>
            <ul>
                <li>In der Tabellenansicht können mehrere Tickets per Checkbox ausgewählt werden.</li>
                <li>Eine Aktionsleiste erscheint, die es ermöglicht, für alle ausgewählten Tickets gleichzeitig den <strong>Status zu ändern</strong>, einen <strong>Bearbeiter zuzuweisen</strong> oder sie zu <strong>löschen</strong>.</li>
            </ul>
        </li>
    </ul>

    <h2>Teil 4: Die Steuerzentrale – Der Admin-Bereich (Settings)</h2>
    <p>Hier wird das "Gehirn" der Anwendung konfiguriert. Alle Automatisierungsregeln und Stammdaten werden hier verwaltet.</p>

    <h3>4.1. Prozess-Steuerung</h3>
    <ul>
        <li><strong>Ticket-Kategorien:</strong> Admins können die Kategorien definieren und ihnen eine Standard-Priorität zuweisen. Diese werden im Hintergrund für die automatische Priorisierung und SLA-Berechnung genutzt.</li>
        <li><strong>SLA-Matrix:</strong> Hier wird die Logik für Fälligkeiten festgelegt, indem für eine Kombination aus Kategorie und Priorität eine Reaktionszeit in Stunden definiert wird.</li>
        <li><strong>Routing-Regeln:</strong> Definition der Keyword-Skill-Zuweisungen für die automatische Bearbeiter-Zuweisung.</li>
    </ul>

    <h3>4.2. Stammdaten-Verwaltung</h3>
    <ul>
        <li><strong>Benutzer & Teams:</strong> Anlegen, Bearbeiten und Deaktivieren von Benutzern. Zuweisung von Rollen (Admin/Bearbeiter) und Skills.</li>
        <li><strong>Standorte & Anlagen:</strong> Verwaltung der Orte, die im Melde-Portal zur Auswahl stehen.</li>
    </ul>

    <h2>Teil 5: Globale Funktionen</h2>
    <ul>
        <li><strong>UI/UX:</strong> Die gesamte Anwendung unterstützt einen <strong>Light- & Dark-Mode</strong> und ist <strong>responsiv</strong> für mobile Geräte.</li>
        <li><strong>Datenhaltung:</strong> Nutzung des <strong>Local Storage</strong> im Browser zur Speicherung aller Daten, was die App ohne Server-Backend lauffähig macht.</li>
        <li><strong>Export-Funktionen:</strong>
            <ul>
                <li>Export der aktuellen Ticket-Ansicht als <strong>CSV-Datei</strong> oder als druckfertiges <strong>PDF-Dokument</strong>.</li>
            </ul>
        </li>
    </ul>

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
    /** Bestätigungsmails (Vorlage „Meldung erfasst“) für alle Tickets mit Melder-E-Mail zu diesem Eingangsdatum nachholen. */
    onResendConfirmationMailsForEntryDate?: (entryDateDE: string) => Promise<{ ok: number; fail: number }>;
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
                                                <option value={Role.Technician}>Service‑Team</option>
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
    const renderProzesseTab = () => (
        <>

            {/* Allgemein ist eigener Tab */}
            <div className="settings-section">
                <div className="settings-section-header"><h3 className="settings-section-title">Ticket-Kategorien</h3></div>
                <div className="settings-section-body">
                    {appSettings.ticketCategories.map(cat => (
                        <div key={cat.id} className="list-item">
                            <input type="text" value={cat.name} onChange={e => handleUpdateSetting('ticketCategories', {...cat, name: e.target.value})} className="form-group-input" />
                            <button onClick={() => handleDeleteSetting('ticketCategories', cat.id)} className="btn btn-danger-sm"><TrashIcon/></button>
                        </div>
                    ))}
                    <button onClick={() => handleAddSetting<TicketCategory>('ticketCategories', { name: 'Neue Kategorie'})} className="btn btn-secondary btn-full-width"><PlusIcon /> Neue Kategorie hinzufügen</button>
                </div>
            </div>

            <div className="settings-section">
                <div className="settings-section-header"><h3 className="settings-section-title">SLA-Matrix (Fälligkeiten)</h3></div>
                <div className="settings-section-body">
                    <div className="sla-grid-header">
                        <span>Kategorie</span><span>Priorität</span><span>Reaktionszeit (Stunden)</span><span></span>
                    </div>
                    {appSettings.slaMatrix.map(rule => (
                        <div key={rule.id} className="sla-grid-row">
                            <select value={rule.categoryId} onChange={e => handleUpdateSetting<SLARule>('slaMatrix', {...rule, categoryId: e.target.value})} className="form-group-select">
                                {appSettings.ticketCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select value={rule.priority} onChange={e => handleUpdateSetting<SLARule>('slaMatrix', {...rule, priority: e.target.value as Priority})} className="form-group-select">
                                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="number" value={rule.responseTimeHours} min="1" onChange={e => handleUpdateSetting<SLARule>('slaMatrix', {...rule, responseTimeHours: parseInt(e.target.value,10)})} className="form-group-input" />
                            <button onClick={() => handleDeleteSetting('slaMatrix', rule.id)} className="btn btn-danger-sm"><TrashIcon /></button>
                        </div>
                    ))}
                    <button onClick={() => handleAddSetting<SLARule>('slaMatrix', { categoryId: appSettings.ticketCategories[0]?.id || '', priority: Priority.Mittel, responseTimeHours: 24 })} className="btn btn-secondary btn-full-width"><PlusIcon /> Neue SLA-Regel hinzufügen</button>
                </div>
            </div>

            <div className="settings-section">
                <div className="settings-section-header"><h3 className="settings-section-title">Automatisches Ticket-Routing</h3></div>
                <div className="settings-section-body">
                    <div className="routing-grid-header">
                        <span>Wenn Text enthält (Keywords, Komma-getrennt)</span><span>...dann Skill zuweisen</span><span></span>
                    </div>
                    {appSettings.routingRules.map(rule => (
                        <div key={rule.id} className="routing-grid-row">
                            <input type="text" value={rule.keyword} onChange={e => handleUpdateSetting<RoutingRule>('routingRules', {...rule, keyword: e.target.value})} className="form-group-input" />
                             <input type="text" value={rule.skill} list="skills-datalist" onChange={e => handleUpdateSetting<RoutingRule>('routingRules', {...rule, skill: e.target.value})} className="form-group-input" />
                            <button onClick={() => handleDeleteSetting('routingRules', rule.id)} className="btn btn-danger-sm"><TrashIcon /></button>
                        </div>
                    ))}
                    <button onClick={() => handleAddSetting<RoutingRule>('routingRules', { keyword: 'Beispiel', skill: 'Allgemein'})} className="btn btn-secondary btn-full-width"><PlusIcon /> Neue Routing-Regel hinzufügen</button>
                    <datalist id="skills-datalist">
                        {allSkills.map(s => <option key={s} value={s} />)}
                    </datalist>
                </div>
            </div>
        </>
    );

    const renderBenutzerTab = () => (
        <div id="user-management">
            <div className="content-header">
               <h2 className="content-title">Benutzerliste</h2>
               <button className="btn btn-primary" onClick={() => handleOpenUserModal(null)}><PlusIcon />Benutzer hinzufügen</button>
            </div>
            <table className="settings-table">
                <thead><tr><th>Name</th><th>Rolle</th><th>Skills</th><th>Verfügbarkeit</th><th>Status</th><th></th></tr></thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td>{user.name}</td>
                            <td>{user.role}</td>
                            <td><div className="skills-container">{user.skills.map(s => <span key={s} className="skill-tag">{s}</span>)}</div></td>
                            <td>{user.availability.status}</td>
                            <td>
                                <SwitchToggle
                                    id={`user-status-${user.id}`}
                                    isChecked={user.isActive}
                                    onChange={() => handleToggleUserStatus(user.id)}
                                />
                            </td>
                            <td className="actions-cell">
                                <button className="btn btn-secondary" onClick={() => handleOpenUserModal(user)}>Bearbeiten</button>
                                {user.role !== Role.Admin ? (
                                    <button className="btn btn-danger" onClick={() => handleDeleteUser(user.id)} title="Löschen"><TrashIcon /></button>
                                ) : (
                                    <button className="btn btn-danger" disabled style={{ cursor: 'not-allowed', opacity: 0.5 }} title="Admin kann nicht gelöscht werden"><TrashIcon /></button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderStandorteTab = () => (
        <div id="location-management">
            <div className="content-header">
                <h2 className="content-title">Standortliste</h2>
                <button className="btn btn-primary" onClick={() => handleOpenLocationModal(null)}><PlusIcon />Standort hinzufügen</button>
            </div>
            <table className="settings-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {locations.map(location => (
                        <tr key={location.id}>
                            <td>{location.name}</td>
                             <td>
                                <SwitchToggle
                                    id={`location-status-${location.id}`}
                                    isChecked={location.isActive}
                                    onChange={() => handleToggleLocationStatus(location.id)}
                                />
                            </td>
                            <td className="actions-cell">
                                <button className="btn btn-secondary" onClick={() => handleOpenLocationModal(location)}>Bearbeiten</button>
                                <button className="btn btn-danger" onClick={() => handleDeleteLocation(location.id)} title="Löschen"><TrashIcon /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );



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
            <div className="settings-section">
                <div className="settings-section-header">
                    <h3 className="settings-section-title">Dokumentation</h3>
                </div>
                <div className="settings-section-body">
                    <p className="form-group-description">
                        Laden Sie die vollständige Systemdokumentation als PDF-Datei herunter, um sie offline zu lesen oder zu archivieren.
                    </p>
                    <button 
                        onClick={handleDownloadDocs} 
                        className="btn btn-secondary" 
                        style={{ justifyContent: 'flex-start', gap: '0.75rem', width: 'fit-content' }}
                    >
                        <DocumentArrowDownIcon />
                        Systemdokumentation als PDF herunterladen
                    </button>
                </div>
            </div>

            <div className="settings-tabs">
                <button className={`tab-btn ${activeTab === 'allgemein' ? 'active' : ''}`} onClick={() => requestTab('allgemein')}>Allgemein</button>
                <button className={`tab-btn ${activeTab === 'prozesse' ? 'active' : ''}`} onClick={() => requestTab('prozesse')}>Prozesse & Logik</button>
                <button className={`tab-btn ${activeTab === 'serientermine' ? 'active' : ''}`} onClick={() => requestTab('serientermine')}>Serientermine</button>
                <button className={`tab-btn ${activeTab === 'benutzer' ? 'active' : ''}`} onClick={() => requestTab('benutzer')}>Benutzer & Teams</button>
                <button className={`tab-btn ${activeTab === 'standorte' ? 'active' : ''}`} onClick={() => requestTab('standorte')}>Standorte & Anlagen</button>
                <button className={`tab-btn ${activeTab === 'benachrichtigungen' ? 'active' : ''}`} onClick={() => requestTab('benachrichtigungen')}>Benachrichtigungen</button>
            </div>
            <div className="tab-content">
                {activeTab === 'allgemein' && renderAllgemeinTab()}
                {activeTab === 'prozesse' && renderProzesseTab()}
                {activeTab === 'serientermine' && renderSerientermineTab()}
                {activeTab === 'benutzer' && renderBenutzerTab()}
                {activeTab === 'standorte' && renderStandorteTab()}
                {activeTab === 'benachrichtigungen' && (
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
                                    value={appSettings.adminNotificationEmail ?? ''}
                                    onChange={e => setAppSettings(prev => ({ ...prev, adminNotificationEmail: e.target.value }))}
                                    className="form-group-input"
                                />
                            </div>
                        </div>
                    </div>
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
