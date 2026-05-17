import React, { useMemo, useState, useRef, useEffect } from 'react';
import { LayoutDashboardIcon } from './icons/LayoutDashboardIcon';
import { SlidersIcon } from './icons/SlidersIcon';
import { Avatar } from './Avatar';
import ThemeToggle from './ThemeToggle';
import { ChevronsLeftRightIcon } from './icons/ChevronsLeftRightIcon';
import { Role, Ticket, Status, AppSettings } from '../types';
import { DocumentPlusIcon } from './icons/DocumentPlusIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { BarChartIcon } from './icons/BarChartIcon';
import { CalendarIcon } from './icons/CalendarIcon';


interface SidebarProps {
    appSettings: AppSettings;
    isCollapsed: boolean;
    setCollapsed: (isCollapsed: boolean) => void;
    theme: string;
    setTheme: (theme: string) => void;
    currentView: string;
    setCurrentView: (view: string) => void;
    onLogout: () => void;
    userRole: Role | null;
    /** Kurzname in der Fußzeile (Vorname bzw. ein Wort wie angelegt) */
    userName: string | null;
    /** Voller gespeicherter Name für Initialen/Tooltip */
    userNameFull?: string | null;
    tickets: Ticket[];
    onNewTicketClick: () => void;
    onExportPDF: () => void;
    onExportCSV: () => void;
    isSyncing?: boolean;
    lastSyncTime?: Date | null;
    /** Admin: Status für Transaktionsmails (Brevo) */
    brevoMailOk?: boolean | null;
    brevoMailLastChecked?: Date | null;
}


const Sidebar: React.FC<SidebarProps> = ({
    appSettings,
    isCollapsed,
    setCollapsed,
    theme,
    setTheme,
    currentView,
    setCurrentView,
    onLogout,
    userRole,
    userName,
    userNameFull,
    tickets,
    onNewTicketClick,
    onExportPDF,
    onExportCSV,
    isSyncing,
    lastSyncTime,
    brevoMailOk,
    brevoMailLastChecked,
}) => {
    
    const [isExportOpen, setExportOpen] = useState(false);
    const [scrollThumb, setScrollThumb] = useState<{ visible: boolean; top: number }>({ visible: false, top: 0 });
    const sidebarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = sidebarRef.current;
        if (!el) return;
        const THUMB_H = 40;
        let timer: ReturnType<typeof setTimeout>;
        const onScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = el;
            const maxScroll = scrollHeight - clientHeight;
            if (maxScroll <= 0) return;
            const ratio = scrollTop / maxScroll;
            const top = Math.max(0, Math.min(clientHeight - THUMB_H, ratio * (clientHeight - THUMB_H)));
            setScrollThumb({ visible: true, top });
            clearTimeout(timer);
            timer = setTimeout(() => setScrollThumb(s => ({ ...s, visible: false })), 900);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => { el.removeEventListener('scroll', onScroll); clearTimeout(timer); };
    }, []);
    const newNotesCount = useMemo(() => {
        return tickets.filter(t => t.hasNewNoteFromReporter && t.status !== Status.Abgeschlossen).length;
    }, [tickets]);

    const newMeldungenCount = useMemo(() => {
        return tickets.filter(t => t.status === Status.Offen && (t.technician === 'N/A' || !t.technician)).length;
    }, [tickets]);
    
    /** Drei Blöcke wie in der Nav-Skizze: Übersicht → Verwaltung → Aktionen (Menü-Labels unverändert). */
    type NavSection = 'uebersicht' | 'verwaltung' | 'aktionen';

    type NavItemDef =
        | { type: 'view'; viewName: string; icon: React.ReactNode; label: string; requiredRoles: Role[]; section: NavSection }
        | { type: 'action'; action: string; icon: React.ReactNode; label: string; requiredRoles: Role[]; section: NavSection; onClick: () => void };

    const navItems: NavItemDef[] = [
        // Admin — Übersicht
        { type: 'view', viewName: 'dashboard', icon: <LayoutDashboardIcon />, label: 'Dashboard', requiredRoles: [Role.Admin], section: 'uebersicht' },
        { type: 'view', viewName: 'tickets', icon: <i className="ti ti-menu-2" aria-hidden />, label: 'Listenansicht', requiredRoles: [Role.Admin], section: 'uebersicht' },
        { type: 'view', viewName: 'erledigt', icon: <i className="ti ti-clock" aria-hidden />, label: 'Abgeschlossen', requiredRoles: [Role.Admin], section: 'uebersicht' },
        { type: 'view', viewName: 'routines', icon: <i className="ti ti-repeat" aria-hidden />, label: 'Serienaufträge', requiredRoles: [Role.Admin], section: 'uebersicht' },
        { type: 'view', viewName: 'routine-nachweis', icon: <CalendarIcon />, label: 'Serien‑Nachweis', requiredRoles: [Role.Admin], section: 'uebersicht' },
        // Admin — Verwaltung
        { type: 'view', viewName: 'techniker', icon: <i className="ti ti-users" aria-hidden />, label: 'Team', requiredRoles: [Role.Admin], section: 'verwaltung' },
        { type: 'view', viewName: 'reports', icon: <BarChartIcon />, label: 'Reports', requiredRoles: [Role.Admin], section: 'verwaltung' },
        { type: 'view', viewName: 'settings', icon: <SlidersIcon />, label: 'Einstellungen', requiredRoles: [Role.Admin], section: 'verwaltung' },

        // Bearbeiter — Übersicht
        { type: 'view', viewName: 'tech-dashboard', icon: <LayoutDashboardIcon />, label: 'Dashboard', requiredRoles: [Role.Technician, Role.Housekeeping], section: 'uebersicht' },
        { type: 'view', viewName: 'tickets', icon: <i className="ti ti-menu-2" aria-hidden />, label: 'Listenansicht', requiredRoles: [Role.Technician, Role.Housekeeping], section: 'uebersicht' },
        { type: 'view', viewName: 'routines', icon: <i className="ti ti-repeat" aria-hidden />, label: 'Serienaufträge', requiredRoles: [Role.Technician, Role.Housekeeping], section: 'uebersicht' },
        { type: 'view', viewName: 'routine-nachweis', icon: <CalendarIcon />, label: 'Serien‑Nachweis', requiredRoles: [Role.Technician, Role.Housekeeping], section: 'uebersicht' },

        // Aktionen (alle Rollen)
        { type: 'action', action: 'newTicket', icon: <DocumentPlusIcon />, label: 'Neues Ticket', requiredRoles: [Role.Admin, Role.Technician, Role.Housekeeping], section: 'aktionen', onClick: onNewTicketClick },
    ];

    const SECTION_HEADING: Record<NavSection, string> = {
        uebersicht: 'Übersicht',
        verwaltung: 'Verwaltung',
        aktionen: 'Aktionen',
    };

    const visibleNavItems = navItems.filter((item) => userRole && item.requiredRoles.includes(userRole));

    const navGroups: { section: NavSection; items: NavItemDef[] }[] = [];
    for (const item of visibleNavItems) {
        const tail = navGroups[navGroups.length - 1];
        if (tail && tail.section === item.section) {
            tail.items.push(item);
        } else {
            navGroups.push({ section: item.section, items: [item] });
        }
    }

    const NavItem: React.FC<{ viewName: string; icon: React.ReactNode; label: string }> = ({ viewName, icon, label }) => (
        <button 
            className={`nav-item ${currentView === viewName ? 'active' : ''}`}
            onClick={() => setCurrentView(viewName)}
            title={isCollapsed ? label : ''}
        >
            {icon}
            <span className="nav-label">{label}</span>
            {viewName === 'tickets' && newNotesCount > 0 && (
                <span className="nav-badge">{newNotesCount}</span>
            )}
            {viewName === 'dashboard' && userRole === Role.Admin && newMeldungenCount > 0 && (
                <span className="nav-badge">{newMeldungenCount}</span>
            )}
            <span className="nav-tooltip">{label}</span>
        </button>
    );

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <style>{`
                .sidebar {
                    width: 240px;
                    background: var(--bg-secondary);
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    transition: width 0.3s ease, background-color 0.3s ease, padding 0.3s ease;
                    flex-shrink: 0;
                    height: 100%;
                    position: relative;
                }
                .sidebar-body-wrap {
                    position: relative;
                    flex: 1;
                    height: 100%;
                }
                .sidebar-body {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow-y: auto;
                    padding: 0.75rem;
                    scrollbar-width: none;
                }
                .sidebar-body::-webkit-scrollbar { display: none; }
                .sidebar-scroll-thumb {
                    position: absolute;
                    right: 2px;
                    top: 0;
                    width: 5px;
                    height: 40px;
                    border-radius: 6px;
                    background: rgba(0,0,0,0.18);
                    pointer-events: none;
                    transition: opacity 1s ease;
                }
                [data-theme="dark"] .sidebar-scroll-thumb {
                    background: rgba(255,255,255,0.22);
                }
                .sidebar.collapsed {
                    width: 70px;
                }
                .sidebar.collapsed .sidebar-body {
                    padding: 0.75rem 0.5rem;
                }
                .sidebar-header {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 0;
                    margin-top: 0;
                    margin-bottom: 0.5rem;
                    transition: padding 0.3s ease, margin-bottom 0.3s ease, height 0.3s ease;
                    height: auto;
                    min-height: 70px;
                }
                 .sidebar.collapsed .sidebar-header {
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0;
                    margin-top: 0;
                    margin-bottom: 0.5rem;
                    height: auto;
                    justify-content: center;
                }
                .sidebar-logo-container {
                     width: 100%;
                     display: flex;
                     justify-content: flex-start;
                     align-items: center;
                     padding: 0.75rem 1rem;
                     min-height: 70px;
                     background: transparent;
                     margin-bottom: 1rem;
                }
                 .sidebar.collapsed .sidebar-logo-container {
                    min-height: 50px;
                    padding: 0.5rem 0;
                    margin-bottom: 0.75rem;
                    background: transparent;
                    justify-content: center;
                }
                .sidebar-logo {
                    width: auto;
                    max-width: 100%;
                    height: 40px;
                    object-fit: contain;
                    display: block;
                }
                .sidebar-icon-logo-wrapper {
                    width: 36px;
                    height: 36px;
                    overflow: hidden;
                    display: flex;
                    justify-content: flex-start;
                    align-items: center;
                }
                .sidebar-icon-logo {
                    height: 36px;
                    width: auto;
                    max-width: none;
                    object-fit: contain;
                    display: block;
                }
                .sidebar-sync {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    background: transparent;
                    border: none;
                    outline: none;
                    box-shadow: none;
                    padding: 0.5rem 1rem 0.75rem;
                    border-radius: 0;
                    margin: 0;
                    width: 100%;
                    flex-shrink: 0;
                }
                .sidebar.collapsed .sidebar-sync {
                    justify-content: center;
                    padding: 0.5rem 0.25rem 0.65rem;
                }
                .sidebar-sync-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: var(--accent-success);
                }
                .sidebar-sync-dot.syncing {
                    background-color: var(--accent-warning);
                    animation: sidebarPulse 1.5s infinite;
                }
                @keyframes sidebarPulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.4; }
                    100% { opacity: 1; }
                }
                
                .sidebar-toggle-container {
                    display: flex;
                    justify-content: flex-end;
                    padding: 0;
                    margin-top: -0.45rem;
                    margin-bottom: 0.5rem;
                }
                .sidebar.collapsed .sidebar-toggle-container {
                    justify-content: center;
                    margin-top: -0.45rem;
                    margin-bottom: 0.5rem;
                    padding: 0;
                }
                
                .nav-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.2rem;
                    margin-top: 0;
                    padding-top: 0;
                }
                .nav-menu > .nav-group:not(:first-child) .nav-group-heading {
                    margin-top: 0.85rem;
                    padding-top: 0;
                }
                .sidebar.collapsed .nav-menu > .nav-group:not(:first-child) {
                    margin-top: 0.65rem;
                    padding-top: 0;
                }
                .nav-group-heading {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 0.55rem;
                    margin-bottom: 0.45rem;
                    padding-left: 1rem;
                    padding-right: 1rem;
                }
                .sidebar.collapsed .nav-group-heading {
                    display: none;
                }
                .nav-group-title {
                    flex-shrink: 0;
                    font-size: 0.65rem;
                    font-weight: 700;
                    letter-spacing: 0.07em;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    line-height: 1.2;
                }
                .nav-group-rule {
                    flex: 1 1 auto;
                    min-width: 0;
                    height: 1px;
                    margin: 0;
                    border: none;
                    background: var(--border);
                    align-self: center;
                    opacity: 0.95;
                }
                .nav-menu {
                    flex-grow: 1;
                    overflow: visible;
                    margin-top: 0;
                }
                .sidebar.collapsed .nav-menu {
                    overflow: visible; /* Allow popovers to show */
                }
                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.65rem 1rem;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    text-decoration: none;
                    margin: 0.05rem 0;
                    transition: background-color 0.2s ease, color 0.2s ease;
                    font-weight: 500;
                    width: 100%;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 0.95rem;
                    text-align: left;
                    position: relative;
                }
                 .sidebar.collapsed .nav-item {
                    justify-content: center;
                    padding: 0.75rem;
                    gap: 0;
                    margin: 0.125rem 0;
                }
                .nav-item:hover {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                }
                .nav-item.active {
                    background-color: var(--bg-tertiary);
                    color: var(--text-primary);
                    font-weight: 600;
                    box-shadow: none;
                }
                .nav-item.active:hover {
                    background-color: var(--bg-tertiary);
                    color: var(--text-primary);
                }
                .nav-item.active::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 4px;
                    height: 24px;
                    background-color: var(--accent-primary);
                    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
                }
                .sidebar.collapsed .nav-item.active::before {
                    height: 20px;
                }
                .nav-item svg {
                    width: 20px;
                    height: 20px;
                    flex-shrink: 0;
                }
                .nav-item .ti {
                    font-size: 20px;
                    width: 20px;
                    height: 20px;
                    line-height: 20px;
                    flex-shrink: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .nav-label {
                    white-space: nowrap;
                    transition: opacity 0.2s ease, width 0.2s ease;
                    opacity: 1;
                    flex-grow: 1;
                    display: inline-block;
                }
                .sidebar.collapsed .nav-label {
                    opacity: 0;
                    width: 0;
                    display: none;
                }
                
                .nav-badge {
                    background-color: var(--accent-danger);
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 0.1rem 0.5rem;
                    border-radius: 20px;
                    line-height: 1.5;
                    transition: opacity 0.2s ease;
                }
                .sidebar.collapsed .nav-badge {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    padding: 0;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    font-size: 0;
                    border: 2px solid var(--bg-secondary);
                }
                
                /* Tooltip styles */
                .nav-tooltip {
                    position: absolute;
                    left: calc(100% + 0.5rem);
                    top: 50%;
                    transform: translateY(-50%);
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                    padding: 0.5rem 1rem;
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-md);
                    white-space: nowrap;
                    font-size: 0.9rem;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.2s ease, visibility 0.2s ease;
                    pointer-events: none;
                    z-index: 20;
                    display: none;
                }
                 .sidebar.collapsed .nav-item:hover .nav-tooltip {
                    opacity: 1;
                    visibility: visible;
                    display: block;
                }

                .nav-item-dropdown-container { 
                    margin: 0.125rem 0 0;
                    position: relative;
                }
                .dropdown-chevron { margin-left: auto; transition: transform 0.2s ease; }
                .sidebar.collapsed .dropdown-chevron { display: none; }
                .dropdown-chevron.open { transform: rotate(180deg); }
                
                .sidebar:not(.collapsed) .dropdown-menu {
                    padding-left: 3.5rem;
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease-out;
                }
                .sidebar:not(.collapsed) .dropdown-menu.open {
                    max-height: 200px;
                }

                /* Collapsed popover override */
                .sidebar.collapsed .dropdown-menu {
                    position: absolute;
                    left: calc(100% + 8px);
                    top: 0;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-md);
                    padding: 0.5rem;
                    width: max-content;
                    z-index: 20;
                    border: 1px solid var(--border);
                    opacity: 0;
                    visibility: hidden;
                    transform: scale(0.95);
                    transform-origin: left center;
                    transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
                    pointer-events: none;
                    max-height: none;
                    padding-left: 0.5rem;
                    overflow: visible;
                }
                .sidebar.collapsed .dropdown-menu.open {
                    opacity: 1;
                    visibility: visible;
                    transform: scale(1);
                    pointer-events: auto;
                }
                .sidebar.collapsed .dropdown-menu .dropdown-item {
                    padding: 0.6rem 1rem;
                }

                .dropdown-item {
                    background: none; border: none; color: var(--text-secondary);
                    padding: 0.6rem 0.8rem; width: 100%; text-align: left;
                    cursor: pointer; font-size: 0.9rem; font-weight: 500;
                    border-radius: var(--radius-sm); transition: background-color 0.2s ease, color 0.2s ease;
                }
                .dropdown-item:hover {
                    color: var(--text-primary);
                    background-color: var(--bg-tertiary);
                }

                .sidebar-footer {
                    flex-shrink: 0;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                }
                 .sidebar.collapsed .sidebar-footer {
                    align-items: center;
                }

                .collapse-toggle {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: var(--radius-md);
                }
                .collapse-toggle:hover {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                }
                .collapse-toggle svg {
                     transition: transform 0.3s ease;
                }
                .sidebar.collapsed .collapse-toggle svg {
                    transform: rotate(180deg);
                }
            `}</style>
            <div className="sidebar-body-wrap">
            <div className="sidebar-body" ref={sidebarRef}>
            <div className="sidebar-header">
                <div className="sidebar-logo-container">
                    {!isCollapsed ? (
                        <img 
                            src="/drk-logo.png"
                            alt="Logo"
                            className="sidebar-logo"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="sidebar-icon-logo-wrapper">
                            <img 
                                src="/drk-logo.png"
                                alt="DRK Logo"
                                className="sidebar-icon-logo"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    )}
                </div>
            </div>
            <div className="sidebar-toggle-container">
                <button 
                    className="collapse-toggle" 
                    onClick={() => setCollapsed(!isCollapsed)} 
                    title={isCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
                >
                    <ChevronsLeftRightIcon />
                </button>
            </div>
            <nav className="nav-menu" aria-label="Hauptnavigation">
                {navGroups.map((group) => {
                    const heading = SECTION_HEADING[group.section];
                    return (
                        <div key={group.section} className="nav-group">
                            {!isCollapsed ? (
                                <div className="nav-group-heading">
                                    <span className="nav-group-title">{heading}</span>
                                    <span className="nav-group-rule" aria-hidden="true" />
                                </div>
                            ) : null}
                            {group.items.map((item) =>
                                item.type === 'action' ? (
                                    <button
                                        key={item.action}
                                        className="nav-item"
                                        onClick={item.onClick}
                                        title={isCollapsed ? item.label : ''}
                                    >
                                        {item.icon}
                                        <span className="nav-label">{item.label}</span>
                                        <span className="nav-tooltip">{item.label}</span>
                                    </button>
                                ) : (
                                    <NavItem key={item.viewName} viewName={item.viewName} icon={item.icon} label={item.label} />
                                ),
                            )}
                            {group.section === 'aktionen' ? (
                                <div className="nav-item-dropdown-container">
                                    <button
                                        className={`nav-item ${isExportOpen ? 'active' : ''}`}
                                        onClick={() => setExportOpen(!isExportOpen)}
                                        title={isCollapsed ? 'Exportieren' : ''}
                                    >
                                        <i className="ti ti-download" aria-hidden />
                                        <span className="nav-label">Exportieren</span>
                                        <ChevronDownIcon className={`dropdown-chevron ${isExportOpen ? 'open' : ''}`} />
                                        <span className="nav-tooltip">Exportieren</span>
                                    </button>
                                    <div className={`dropdown-menu ${isExportOpen ? 'open' : ''}`}>
                                        <button type="button" className="dropdown-item" onClick={onExportPDF}>
                                            als PDF
                                        </button>
                                        <button type="button" className="dropdown-item" onClick={onExportCSV}>
                                            als CSV
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </nav>
            {lastSyncTime ? (
                <div
                    className="sidebar-sync"
                    title={`Zuletzt synchronisiert: ${lastSyncTime.toLocaleTimeString()}`}
                >
                    <div className={`sidebar-sync-dot ${isSyncing ? 'syncing' : ''}`}></div>
                    {!isCollapsed && <span>{isSyncing ? 'Synchronisiere...' : 'Synchronisiert'}</span>}
                </div>
            ) : null}
            {userRole === Role.Admin && brevoMailOk !== undefined && brevoMailOk !== null && brevoMailLastChecked ? (
                <div
                    className="sidebar-sync"
                    title={`Brevo geprüft: ${brevoMailLastChecked.toLocaleTimeString()}`}
                >
                    <div
                        className="sidebar-sync-dot"
                        style={{
                            background: brevoMailOk ? 'rgba(30, 156, 64, 0.95)' : 'rgba(220, 53, 69, 0.95)',
                        }}
                    />
                    {!isCollapsed && <span>{brevoMailOk ? 'E-Mail OK' : 'E-Mail FEHLER'}</span>}
                </div>
            ) : null}
            <div className="sidebar-footer">
                <ThemeToggle theme={theme} setTheme={setTheme} isCollapsed={isCollapsed} />
                <button
                    className="nav-item"
                    title={isCollapsed ? (userNameFull ?? userName ?? '') : (userNameFull ?? userName ?? '')}
                >
                     <Avatar name={userName ?? 'Benutzer'} initialsFrom={userNameFull ?? userName ?? undefined} />
                     <span className="nav-label">{userName ?? 'Benutzer'}</span>
                     <span className="nav-tooltip">{userNameFull ?? userName ?? 'Benutzer'}</span>
                </button>
                 <button className="nav-item" title={isCollapsed ? "Abmelden" : ''} onClick={onLogout}>
                    <i className="ti ti-logout" aria-hidden />
                    <span className="nav-label">Abmelden</span>
                    <span className="nav-tooltip">Abmelden</span>
                </button>
            </div>
            </div>{/* end sidebar-body */}
            <div
                className="sidebar-scroll-thumb"
                style={{
                    opacity: scrollThumb.visible ? 1 : 0,
                    top: scrollThumb.top,
                }}
            />
            </div>{/* end sidebar-body-wrap */}
        </aside>
    );
};

export default Sidebar;