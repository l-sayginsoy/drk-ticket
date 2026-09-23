import React from 'react';
import { PRIORITIES } from '../constants';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { Role, GroupableKey, Ticket } from '../types';
import { displayNameShort } from '../utils/displayNames';
import MessageInbox, { MessageActivityItem } from './MessageInbox';

interface FilterBarProps {
    filters: any;
    setFilters: React.Dispatch<React.SetStateAction<any>>;
    locations: Array<{ name: string; count: number }>;
    technicians: string[];
    statuses: string[];
    reporters?: string[];
    groupBy: GroupableKey | 'none';
    setGroupBy: (value: GroupableKey | 'none') => void;
    currentView: string;
    userRole: Role | null;
    /** Oben in gemeinsamer Karte mit Kanban: gleiche Fläche, nur dezente Linie nach unten */
    panelEmbed?: boolean;
    /** Anzahl aktiver Tickets für die Statusleiste */
    statusCounts?: { offen: number; inArbeit: number; ueberfaellig: number };
    /** Tickets mit neuer Aktivität (Chat/Melder) – speist die Benachrichtigungs-Glocke */
    messageActivity?: MessageActivityItem[];
    /** Öffnet ein Ticket aus der Benachrichtigungsliste in der Detailansicht */
    onOpenTicket?: (ticket: Ticket) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, setFilters, locations, technicians, statuses, reporters = [], groupBy, setGroupBy, currentView, userRole, panelEmbed = false, statusCounts, messageActivity = [], onOpenTicket }) => {
    
    if (currentView === 'techniker' || currentView === 'reports' || currentView === 'routines' || currentView === 'routine-nachweis') {
        return null;
    }
    
    const isServiceTeamUser = userRole === Role.Technician || userRole === Role.Housekeeping;

    const handleFilterChange = (filterName: string, value: string) => {
        setFilters((prev: any) => ({ ...prev, [filterName]: value }));
    }

    const resetFilters = () => {
        setFilters({
            area: 'Alle',
            technician: isServiceTeamUser ? filters.technician : 'Alle',
            priority: 'Alle',
            status: 'Alle',
            reporter: 'Alle',
            origin: 'Alle',
            search: filters.search,
        });
        setGroupBy('none');
    }

    const groupByOptions = [
        { value: 'status', label: 'Status' },
        { value: 'area', label: 'Standort' },
        { value: 'technician', label: 'Bearbeiter' },
    ];
    
    const getDisplayValue = (val: string, shortenPeople: boolean) => {
        if (val === 'N/A') return 'Nicht zugewiesen';
        if (shortenPeople && val !== 'Alle') return displayNameShort(val);
        return val;
    };

    const FilterChip: React.FC<{
        label: string;
        icon?: string;
        name: string;
        options: Array<{ name: string; count: number } | string>;
        value: string;
        shortenPersonNames?: boolean;
        onChangeRaw?: (v: string) => void;
    }> = ({ label, icon, name, options, value, shortenPersonNames, onChangeRaw }) => (
        <div className={`custom-select filter-chip ${value !== 'Alle' ? 'active' : ''}`}>
            {icon && <i className={`ti ti-${icon}`} aria-hidden="true" style={{ marginRight: 8, fontSize: 17 }} />}
            <span>{label}</span>
            {value !== 'Alle' && (
                <span className="filter-badge">{getDisplayValue(value, !!shortenPersonNames)}</span>
            )}
            <select aria-label={label} value={value} onChange={(e) => onChangeRaw ? onChangeRaw(e.target.value) : handleFilterChange(name, e.target.value)}>
                {options.map(opt => {
                    if (typeof opt === 'object' && opt !== null && 'name' in opt) {
                        const locOpt = opt as { name: string; count: number };
                        return (
                            <option 
                                key={locOpt.name} 
                                value={locOpt.name}
                                style={{ color: locOpt.count === 0 && locOpt.name !== 'Alle' ? 'var(--text-muted)' : 'inherit' }}
                            >
                                {locOpt.name === 'Alle' ? `Alle Standorte (${locOpt.count})` : `${locOpt.name} (${locOpt.count})`}
                            </option>
                        );
                    }
                    const strOpt = String(opt);
                    return (
                        <option key={strOpt} value={strOpt}>
                            {getDisplayValue(strOpt, !!shortenPersonNames)}
                        </option>
                    );
                })}
            </select>
            <ChevronDownIcon />
        </div>
    );

    const resetButton = (
        <button
            type="button"
            className="action-btn action-btn--reset"
            onClick={resetFilters}
            aria-label="Filter zurücksetzen"
        >
            <i className="ti ti-refresh" aria-hidden />
            Zurücksetzen
        </button>
    );

    const renderFiltersForView = () => {
        switch (currentView) {
            case 'dashboard':
            case 'tech-dashboard': {
                const extraCount = [filters.status, filters.origin, filters.reporter].filter(value => value && value !== 'Alle').length;
                return <>
                    <FilterChip label="Standort" icon="map-pin" name="area" options={locations} value={filters.area} />
                    {!isServiceTeamUser && <FilterChip label="Bearbeiter" icon="user" name="technician" options={technicians} value={filters.technician} shortenPersonNames />}
                    <FilterChip label="Priorität" icon="flag" name="priority" options={PRIORITIES} value={filters.priority} />
                    <details className="more-filters" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
                        <summary><i className="ti ti-filter" aria-hidden="true" />Weitere Filter{extraCount > 0 && <span className="filter-badge">{extraCount}</span>}<ChevronDownIcon /></summary>
                        <div className="more-filters-panel">
                            <FilterChip label="Status" name="status" options={statuses} value={filters.status} />
                            <FilterChip label="Typ" name="origin" options={['Alle', 'Veranstaltung', 'Manuell']} value={filters.origin === 'event' ? 'Veranstaltung' : filters.origin === 'manual' ? 'Manuell' : 'Alle'} onChangeRaw={value => setFilters((previous: any) => ({ ...previous, origin: value === 'Veranstaltung' ? 'event' : value === 'Manuell' ? 'manual' : 'Alle' }))} />
                            {reporters.length > 1 && <FilterChip label="Melder" name="reporter" options={reporters} value={filters.reporter ?? 'Alle'} />}
                        </div>
                    </details>
                    <span className="divider" aria-hidden="true" />
                    {resetButton}
                </>;
            }
            case 'tickets':
                return (
                    <>
                        <FilterChip label="Standort" name="area" options={locations} value={filters.area} />
                        <FilterChip label="Status" name="status" options={statuses} value={filters.status} />
                        <FilterChip label="Priorität" name="priority" options={PRIORITIES} value={filters.priority} />
                        <FilterChip label="Typ" name="origin" options={['Alle', 'Veranstaltung', 'Manuell']} value={filters.origin === 'event' ? 'Veranstaltung' : filters.origin === 'manual' ? 'Manuell' : 'Alle'} onChangeRaw={(v) => setFilters((prev: any) => ({ ...prev, origin: v === 'Veranstaltung' ? 'event' : v === 'Manuell' ? 'manual' : 'Alle' }))} />
                        {reporters.length > 1 && (
                            <FilterChip label="Melder" name="reporter" options={reporters} value={filters.reporter ?? 'Alle'} />
                        )}
                        {!isServiceTeamUser ? (
                            <div className="filter-bearbeiter-reset">
                                <FilterChip
                                    label="Bearbeiter"
                                    name="technician"
                                    options={technicians}
                                    value={filters.technician}
                                    shortenPersonNames
                                />
                                {resetButton}
                            </div>
                        ) : (
                            resetButton
                        )}
                    </>
                );
            case 'erledigt':
                return (
                    <>
                        <FilterChip label="Standort" name="area" options={locations} value={filters.area} />
                        <FilterChip label="Priorität" name="priority" options={PRIORITIES} value={filters.priority} />
                        {!isServiceTeamUser ? (
                            <div className="filter-bearbeiter-reset">
                                <FilterChip
                                    label="Bearbeiter"
                                    name="technician"
                                    options={technicians}
                                    value={filters.technician}
                                    shortenPersonNames
                                />
                                {resetButton}
                            </div>
                        ) : (
                            resetButton
                        )}
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className={`filter-bar${panelEmbed ? ' filter-bar--panel-embed' : ''}`}>
            <style>{`
                .filter-bar {
                    max-width: 2400px;
                    width: 100%;
                    box-sizing: border-box;
                    margin-top: 0;
                    background: transparent;
                    border: none;
                    border-radius: 0;
                    padding: 10px 0;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }
                .filter-bar--panel-embed {
                    max-width: none;
                    margin-top: 0;
                    background: transparent;
                    border: none;
                    border-radius: 0;
                    box-shadow: none;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border);
                }
                .filter-controls { display: flex; gap: 12px; flex-wrap: wrap; flex-grow: 1; align-items: center; }
                .filter-bearbeiter-reset { display: flex; align-items: center; gap: 0.75rem; flex-wrap: nowrap; }
                
                .view-toggle { display: flex; background: var(--bg-tertiary); padding: 4px; border-radius: 6px; }
                .view-toggle .toggle-btn { background: transparent; border: none; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.9rem; color: var(--text-muted); transition: all 0.2s ease; }
                .view-toggle .toggle-btn.active { background: var(--bg-secondary); color: var(--text-primary); box-shadow: var(--shadow-sm); }

                .custom-select { position: relative; border: 1px solid var(--border); border-radius: 9px; padding-right: 1.85rem; font-size: 0.85rem; font-weight: 500; min-width: auto; cursor: pointer; color: var(--text-secondary); height: 36px; display: flex; align-items: center; transition: var(--transition-smooth); background: var(--bg-tertiary); }
                .custom-select:hover { border-color: var(--border-active); background-color: var(--bg-tertiary); }
                .custom-select.group-by-select { background-color: var(--bg-tertiary); padding-left: 0.85rem; border-radius: 9px; }
                .custom-select.filter-chip {
                    background-color: var(--bg-tertiary);
                    padding-left: 0.85rem;
                    border-radius: 9px;
                    border: 1px solid var(--border);
                }
                .custom-select.filter-chip:hover {
                    background-color: var(--bg-tertiary);
                    border-color: var(--border-active);
                }
                .custom-select.filter-chip.active {
                    background-color: var(--bg-secondary);
                    border-color: var(--text-secondary);
                    color: var(--text-primary);
                    font-weight: 600;
                }
                .custom-select select:focus { outline: none; }
                .filter-badge {
                    font-size: 0.74rem;
                    font-weight: 600;
                    color: var(--bg-secondary);
                    background-color: var(--text-secondary);
                    padding: 0.12rem 0.45rem;
                    border-radius: 6px;
                    margin-left: 0.45rem;
                    letter-spacing: 0.01em;
                }

                .custom-select span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .custom-select select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
                .custom-select svg { position: absolute; right: 0.7rem; top: 50%; transform: translateY(-50%); pointer-events: none; width: 14px; height: 14px; color: var(--text-muted); }

                .action-btn { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); font-size: 0.85rem; padding: 0.4rem 1rem; border-radius: 9px; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: var(--transition-smooth); font-weight: 500; flex-shrink: 0; height: 36px; box-sizing: border-box; }
                .action-btn:hover { background: var(--border); }
                .action-btn svg { width: 16px; height: 16px; }
                .action-btn .ti {
                    font-size: 16px;
                    width: 16px;
                    height: 16px;
                    line-height: 16px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .action-btn--icon-only {
                    width: 38px;
                    padding: 0;
                    justify-content: center;
                    gap: 0;
                }
                .action-btn--reset {
                    background: transparent;
                    border-color: transparent;
                    color: var(--text-muted);
                    font-weight: 500;
                    box-shadow: none;
                }
                .action-btn--reset:hover {
                    background: var(--bg-tertiary);
                    border-color: var(--border);
                    color: var(--text-primary);
                }
                
                .divider { width: 1px; height: 24px; background-color: var(--border); }

                .status-summary {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }
                .status-stat {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    font-size: 0.78rem;
                    font-weight: 600;
                    padding: 0.2rem 0.6rem;
                    border-radius: 7px;
                    border: 1.5px solid transparent;
                    white-space: nowrap;
                    cursor: default;
                    user-select: none;
                }
                .status-stat--offen    { background: #F1F0EC; color: #5F5E5A; border-color: #D3D1C7; }
                .status-stat--inarbeit { background: #E6F1FB; color: #185FA5; border-color: #B5D4F4; }
                .status-stat--ueberfaellig { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
                .filter-bar .custom-select.filter-chip { background: var(--bg-secondary); height: 40px; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
                .filter-bar .custom-select:focus-within { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
                .more-filters { position: relative; }
                .more-filters summary { display: flex; align-items: center; gap: 8px; list-style: none; cursor: pointer; height: 40px; padding: 0 12px; font-size: .85rem; font-weight: 500; color: var(--text-secondary); background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 9px; }
                .more-filters summary::-webkit-details-marker { display: none; }
                .more-filters summary svg { width: 14px; height: 14px; }
                .more-filters summary:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
                .more-filters-panel { position: absolute; top: calc(100% + 8px); left: 0; width: 230px; max-width: 75vw; display: grid; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-secondary); box-shadow: 0 8px 24px rgba(0,0,0,.12); z-index: 30; }
            `}</style>
            <div className="filter-controls">
                {currentView === 'tickets' && (
                    <>
                        <div className="view-toggle">
                            <button className={`toggle-btn ${groupBy === 'none' ? 'active' : ''}`} onClick={() => setGroupBy('none')}>Liste</button>
                            <button className={`toggle-btn ${groupBy !== 'none' ? 'active' : ''}`} onClick={() => setGroupBy('status')}>Gruppiert</button>
                        </div>
                        {groupBy !== 'none' && (
                            <div className="custom-select group-by-select">
                                <span>Gruppieren nach</span>
                                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupableKey)}>
                                    {groupByOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <ChevronDownIcon />
                            </div>
                        )}
                        <div className="divider" />
                    </>
                )}
                {renderFiltersForView()}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'nowrap', alignSelf: 'center' }}>
                {statusCounts && currentView === 'tickets' && (
                    <div className="status-summary">
                        <span className="status-stat status-stat--offen">
                            {statusCounts.offen} Offen
                        </span>
                        <span className="status-stat status-stat--inarbeit">
                            {statusCounts.inArbeit} In Arbeit
                        </span>
                        {statusCounts.ueberfaellig > 0 && (
                            <span className="status-stat status-stat--ueberfaellig">
                                {statusCounts.ueberfaellig} Überfällig
                            </span>
                        )}
                    </div>
                )}
                <MessageInbox items={messageActivity} onOpenTicket={onOpenTicket} />
            </div>
        </div>
    );
};

export default FilterBar;
