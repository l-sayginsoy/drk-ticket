import React from 'react';
import { PRIORITIES } from '../constants';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { Role, GroupableKey } from '../types';
import { displayNameShort } from '../utils/displayNames';

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
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, setFilters, locations, technicians, statuses, reporters = [], groupBy, setGroupBy, currentView, userRole, panelEmbed = false }) => {
    
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
        name: string;
        options: Array<{ name: string; count: number } | string>;
        value: string;
        shortenPersonNames?: boolean;
    }> = ({ label, name, options, value, shortenPersonNames }) => (
        <div className={`custom-select filter-chip ${value !== 'Alle' ? 'active' : ''}`}>
            <span>{label}</span>
            {value !== 'Alle' && (
                <span className="filter-badge">{getDisplayValue(value, !!shortenPersonNames)}</span>
            )}
            <select value={value} onChange={(e) => handleFilterChange(name, e.target.value)}>
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
            className="action-btn action-btn--icon-only"
            onClick={resetFilters}
            aria-label="Filter zurücksetzen"
            title="Zurücksetzen"
        >
            <i className="ti ti-refresh" aria-hidden />
        </button>
    );

    const renderFiltersForView = () => {
        switch (currentView) {
            case 'dashboard':
            case 'tech-dashboard':
            case 'tickets':
                return (
                    <>
                        <FilterChip label="Standort" name="area" options={locations} value={filters.area} />
                        <FilterChip label="Status" name="status" options={statuses} value={filters.status} />
                        <FilterChip label="Priorität" name="priority" options={PRIORITIES} value={filters.priority} />
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
                    max-width: 1800px;
                    width: 100%;
                    box-sizing: border-box;
                    margin-top: 1.25rem;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    transition: var(--transition-smooth);
                    flex-wrap: wrap;
                    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
                }
                [data-theme="dark"] .filter-bar {
                    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
                }
                .filter-bar--panel-embed {
                    max-width: none;
                    margin-top: 0;
                    background: var(--bg-primary);
                    border: none;
                    border-radius: 0;
                    box-shadow: none;
                    border-bottom: 1px solid var(--border);
                }
                .filter-controls { display: flex; gap: 1rem; flex-wrap: wrap; flex-grow: 1; align-items: center; }
                .filter-bearbeiter-reset { display: flex; align-items: center; gap: 0.75rem; flex-wrap: nowrap; }
                
                .view-toggle { display: flex; background: var(--bg-tertiary); padding: 4px; border-radius: 6px; }
                .view-toggle .toggle-btn { background: transparent; border: none; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.9rem; color: var(--text-muted); transition: all 0.2s ease; }
                .view-toggle .toggle-btn.active { background: var(--bg-secondary); color: var(--text-primary); box-shadow: var(--shadow-sm); }

                .custom-select { position: relative; border: 1px solid var(--border); border-radius: 6px; padding-right: 2rem; font-size: 0.9rem; min-width: 120px; cursor: pointer; color: var(--text-secondary); height: 38px; display: flex; align-items: center; transition: var(--transition-smooth); }
                .custom-select:hover { border-color: var(--border-active); background-color: var(--bg-tertiary); }
                .custom-select.group-by-select { background-color: var(--bg-tertiary); padding-left: 0.75rem; }
                .custom-select.filter-chip {
                    background-color: var(--bg-tertiary);
                    padding-left: 0.75rem;
                    border-radius: 6px;
                    border: 1px solid var(--border);
                    box-shadow: none;
                }
                .custom-select.filter-chip:hover {
                    background-color: var(--bg-tertiary);
                    border-color: var(--border-active);
                    box-shadow: none;
                }
                .custom-select.filter-chip.active {
                    background-color: var(--bg-secondary);
                    border-color: var(--text-secondary);
                    box-shadow: none;
                }
                .custom-select select:focus { outline: none; }
                .filter-badge {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    background-color: var(--border);
                    padding: 0.15rem 0.5rem;
                    border-radius: 4px;
                    margin-left: 0.5rem;
                }

                .custom-select span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .custom-select select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
                .custom-select svg { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); pointer-events: none; width: 16px; height: 16px; color: var(--text-muted); }
                
                .action-btn { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); font-size: 0.9rem; padding: 0.5rem 1rem; border-radius: 6px; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: var(--transition-smooth); font-weight: 500; flex-shrink: 0; height: 38px; box-sizing: border-box; }
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
                
                .divider { width: 1px; height: 24px; background-color: var(--border); }
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
        </div>
    );
};

export default FilterBar;
