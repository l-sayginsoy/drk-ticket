import React, { useMemo, useState } from 'react';
import { LayoutDashboardIcon } from './icons/LayoutDashboardIcon';
import { UserIcon } from './icons/UserIcon';
import { SlidersIcon } from './icons/SlidersIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { CheckBadgeIcon } from './icons/CheckBadgeIcon';
import { Avatar } from './Avatar';
import ThemeToggle from './ThemeToggle';
import { ChevronsLeftRightIcon } from './icons/ChevronsLeftRightIcon';
import { Role, Ticket, Status, AppSettings } from '../types';
import { DocumentPlusIcon } from './icons/DocumentPlusIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { PlusIcon } from './icons/PlusIcon';
import { BarChartIcon } from './icons/BarChartIcon';


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
    userName: string | null;
    tickets: Ticket[];
    onNewTicketClick: () => void;
    onExportPDF: () => void;
    onExportCSV: () => void;
}


const Sidebar: React.FC<SidebarProps> = ({ appSettings, isCollapsed, setCollapsed, theme, setTheme, currentView, setCurrentView, onLogout, userRole, userName, tickets, onNewTicketClick, onExportPDF, onExportCSV }) => {
    
    const [isExportOpen, setExportOpen] = useState(false);
    const newNotesCount = useMemo(() => {
        return tickets.filter(t => t.hasNewNoteFromReporter && t.status !== Status.Abgeschlossen).length;
    }, [tickets]);
    
    const navItems = [
        // Admin
        { type: 'view', viewName: 'dashboard', icon: <LayoutDashboardIcon />, label: 'Dashboard', requiredRoles: [Role.Admin] },
        { type: 'view', viewName: 'tickets', icon: <ClipboardIcon />, label: 'Aktuelle Tickets', requiredRoles: [Role.Admin] },
        { type: 'view', viewName: 'erledigt', icon: <CheckBadgeIcon />, label: 'Abgeschlossen', requiredRoles: [Role.Admin] },
        { type: 'view', viewName: 'techniker', icon: <UserIcon />, label: 'Team', requiredRoles: [Role.Admin] },
        { type: 'view', viewName: 'reports', icon: <BarChartIcon />, label: 'Reports', requiredRoles: [Role.Admin] },
        { type: 'view', viewName: 'settings', icon: <SlidersIcon />, label: 'Einstellungen', requiredRoles: [Role.Admin] },

        // Techniker: eigenes Dashboard + Liste (Tabelle bleibt identisch)
        { type: 'view', viewName: 'tech-dashboard', icon: <LayoutDashboardIcon />, label: 'Dashboard', requiredRoles: [Role.Technician, Role.Housekeeping] },
        { type: 'view', viewName: 'tickets', icon: <ClipboardIcon />, label: 'Listenansicht', requiredRoles: [Role.Technician, Role.Housekeeping] },

        // Gemeinsame Aktionen
        { type: 'action', action: 'newTicket', icon: <DocumentPlusIcon />, label: 'Neues Ticket', requiredRoles: [Role.Admin, Role.Technician, Role.Housekeeping], onClick: onNewTicketClick },
    ];

    const NavItem: React.FC<{viewName: string, icon: React.ReactNode, label: string}> = ({ viewName, icon, label }) => (
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
            <span className="nav-tooltip">{label}</span>
        </button>
    );

     const DisabledNavItem: React.FC<{icon: React.ReactNode, label: string}> = ({ icon, label }) => (
        <button 
            className="nav-item" 
            disabled 
            style={{cursor: 'not-allowed', opacity: 0.5}}
            title={isCollapsed ? label : ''}
        >
            {icon}
            <span className="nav-label">{label}</span>
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
                    padding: 0.75rem;
                    transition: width 0.3s ease, background-color 0.3s ease, padding 0.3s ease;
                    flex-shrink: 0;
                    overflow-y: auto;
                    height: 100%;
                }
                .sidebar.collapsed {
                    width: 70px;
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
                
                .sidebar-toggle-container {
                    display: flex;
                    justify-content: flex-end;
                    padding: 0;
                    margin-bottom: 0.5rem;
                }
                .sidebar.collapsed .sidebar-toggle-container {
                    justify-content: center;
                    margin-bottom: 0.5rem;
                    padding: 0;
                }
                
                .nav-menu {
                    flex-grow: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    margin-top: 0;
                }
                .sidebar.collapsed .nav-menu {
                    overflow: visible; /* Allow popovers to show */
                }
                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    text-decoration: none;
                    margin: 0.125rem 0;
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
                    margin: 0.5rem 0; 
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
                    padding-top: 1.5rem;
                    border-top: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
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
            <nav className="nav-menu">
                {navItems.map(item => {
                    if (!userRole || !item.requiredRoles.includes(userRole)) {
                        return null;
                    }

                    if (item.type === 'action') {
                        return (
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
                        );
                    }

                    if (item.type === 'view') {
                        return (
                            <NavItem
                                key={item.viewName}
                                viewName={item.viewName}
                                icon={item.icon}
                                label={item.label}
                            />
                        );
                    }
                    return null;
                })}
                <div className="nav-item-dropdown-container">
                    <button 
                        className={`nav-item ${isExportOpen ? 'active' : ''}`}
                        onClick={() => setExportOpen(!isExportOpen)}
                        title={isCollapsed ? "Exportieren" : ''}
                    >
                        <DocumentArrowDownIcon />
                        <span className="nav-label">Exportieren</span>
                        <ChevronDownIcon className={`dropdown-chevron ${isExportOpen ? 'open' : ''}`} />
                        <span className="nav-tooltip">Exportieren</span>
                    </button>
                    <div className={`dropdown-menu ${isExportOpen ? 'open' : ''}`}>
                        <button className="dropdown-item" onClick={onExportPDF}>als PDF</button>
                        <button className="dropdown-item" onClick={onExportCSV}>als CSV</button>
                    </div>
                </div>
            </nav>
            <div className="sidebar-footer">
                <ThemeToggle theme={theme} setTheme={setTheme} isCollapsed={isCollapsed} />
                <button className="nav-item" title={isCollapsed ? (userName ?? '') : ''}>
                     <Avatar name={userName ?? 'Benutzer'} />
                     <span className="nav-label">{userName ?? 'Benutzer'}</span>
                     <span className="nav-tooltip">{userName ?? 'Benutzer'}</span>
                </button>
                 <button className="nav-item" title={isCollapsed ? "Abmelden" : ''} onClick={onLogout}>
                    <LogoutIcon />
                    <span className="nav-label">Abmelden</span>
                    <span className="nav-tooltip">Abmelden</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;