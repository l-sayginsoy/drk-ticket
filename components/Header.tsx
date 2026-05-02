import React from 'react';
import { SearchIcon } from './icons/SearchIcon';
import { Status, AppSettings } from '../types';
import { statusColorMap } from '../constants';

interface HeaderProps {
    stats: {
        open: number;
        inProgress: number;
        overdue: number;
    };
    filters: { search: string, status: string };
    setFilters: React.Dispatch<React.SetStateAction<any>>;
    currentView: string;
    isSyncing?: boolean;
    lastSyncTime?: Date | null;
    appSettings: AppSettings;
}

const Header: React.FC<HeaderProps> = ({ stats, filters, setFilters, currentView, isSyncing, lastSyncTime, appSettings }) => {
    
    const getPageTitle = () => {
        switch (currentView) {
            case 'dashboard': return 'Dashboard';
            case 'tickets': return 'Aktuelle Tickets';
            case 'erledigt': return 'Abgeschlossen';
            case 'techniker': return 'Techniker Übersicht';
            case 'reports': return '';
            default: return 'Dashboard';
        }
    }
    // For the technician view, we render the title in the component itself.
    const pageTitle = currentView === 'techniker' ? '' : getPageTitle();

    const handleStatClick = (status: Status) => {
        setFilters((prev: any) => ({
            ...prev,
            status: prev.status === status ? 'Alle' : status,
        }));
    };

    return (
        <header className="main-header">
            <style>{`
                .main-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    /* Conditional padding: only add padding if there's content inside */
                    padding-bottom: ${pageTitle || currentView !== 'techniker' ? '1.5rem' : '0'};
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }
                .deploy-pipeline-test-badge {
                    display: inline-block;
                    font-size: 0.65rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    padding: 0.2rem 0.5rem;
                    border-radius: 6px;
                    background: var(--bg-tertiary);
                    color: var(--text-muted);
                    border: 1px solid var(--border);
                    flex-shrink: 0;
                }
                .sync-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    background: var(--bg-tertiary);
                    padding: 0.25rem 0.75rem;
                    border-radius: 999px;
                    margin-top: 0.25rem;
                }
                .sync-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: var(--accent-success);
                }
                .sync-dot.syncing {
                    background-color: var(--accent-warning);
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.4; }
                    100% { opacity: 1; }
                }
                .header-title {
                    font-size: 1.75rem;
                    font-weight: 700;
                }
                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-left: auto;
                }
                .stat-group {
                    display: flex;
                    gap: 1rem;
                }
                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.6rem 1rem;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
                    background-color: var(--bg-secondary);
                    border: 1px solid var(--border);
                    min-width: 140px;
                    justify-content: center;
                }
                .stat-item:hover {
                    background-color: var(--bg-tertiary);
                    border-color: var(--border-active);
                }
                .stat-item.active {
                    background-color: var(--bg-tertiary);
                    border-color: var(--accent-primary);
                    box-shadow: var(--shadow-sm);
                }
                .stat-item.active .stat-label {
                    color: var(--text-primary);
                }
                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    line-height: 1;
                }
                .stat-label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }
                .search-container {
                    position: relative;
                }
                .search-input {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 0.6rem 1rem 0.6rem 2.5rem;
                    min-width: 250px;
                    transition: var(--transition-smooth);
                }
                .search-input:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
                }
                .search-icon {
                    position: absolute;
                    left: 0.8rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }
                .search-icon svg { width: 18px; height: 18px; }
                                
                @media (max-width: 1024px) {
                    .main-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                    }
                    .header-actions {
                        width: 100%;
                        justify-content: space-between;
                        margin-left: 0;
                    }
                }
                @media (max-width: 768px) {
                    .header-left { margin-bottom: 0.5rem; }
                    .header-actions {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 1rem;
                    }
                    .stat-group {
                        width: 100%;
                        justify-content: space-around;
                        gap: 0.5rem;
                    }
                    .search-container { width: 100%; }
                    .search-input { width: 100%; }
                }

            `}</style>
            <div className="header-left">
                <span
                    className="deploy-pipeline-test-badge"
                    title="Kann entfernt werden, sobald Push→Firebase getestet ist"
                >
                    Deploy-Test
                </span>
                {pageTitle && (
                    <div className="header-title-container">
                        <h1 className="header-title">{pageTitle}</h1>
                        {lastSyncTime && (
                            <div className="sync-status" title={`Zuletzt synchronisiert: ${lastSyncTime.toLocaleTimeString()}`}>
                                <div className={`sync-dot ${isSyncing ? 'syncing' : ''}`}></div>
                                <span>{isSyncing ? 'Synchronisiere...' : 'Synchronisiert'}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="header-actions">
                {currentView === 'dashboard' ? (
                     <div className="stat-group">
                        <div
                            className={`stat-item ${filters.status === Status.Offen ? 'active' : ''}`}
                            onClick={() => handleStatClick(Status.Offen)}
                            role="button"
                            tabIndex={0}
                        >
                            <span className="stat-value" style={{ color: `var(${statusColorMap[Status.Offen]})` }}>{stats.open}</span>
                            <span className="stat-label">Offen</span>
                        </div>
                        <div
                            className={`stat-item ${filters.status === Status.InArbeit ? 'active' : ''}`}
                            onClick={() => handleStatClick(Status.InArbeit)}
                            role="button"
                            tabIndex={0}
                        >
                            <span className="stat-value" style={{ color: `var(${statusColorMap[Status.InArbeit]})` }}>{stats.inProgress}</span>
                            <span className="stat-label">In Arbeit</span>
                        </div>
                         <div
                            className={`stat-item ${filters.status === Status.Ueberfaellig ? 'active' : ''}`}
                            onClick={() => handleStatClick(Status.Ueberfaellig)}
                            role="button"
                            tabIndex={0}
                         >
                            <span className="stat-value" style={{ color: `var(${statusColorMap[Status.Ueberfaellig]})` }}>{stats.overdue}</span>
                            <span className="stat-label">Überfällig</span>
                        </div>
                    </div>
                ) : (currentView === 'tickets' || currentView === 'erledigt') ? (
                    <div className="search-container">
                         <span className="search-icon"><SearchIcon /></span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Tickets durchsuchen..."
                            value={filters.search}
                            onChange={(e) => setFilters((prev: any) => ({ ...prev, search: e.target.value }))}
                        />
                    </div>
                ) : null}
            </div>
        </header>
    );
};

export default Header;