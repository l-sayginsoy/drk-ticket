import React, { useMemo, useState } from 'react';
import { Ticket, Status, User, Role } from '../types';
import { STATUSES, LOCATIONS_FOR_FILTER } from '../constants';
import { DocumentIcon } from './icons/DocumentIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ClockIcon } from './icons/ClockIcon';
import { displayNameShort, normalizePersonName } from '../utils/displayNames';

interface ReportsViewProps {
  /** Wie Listenansicht-Haupttabelle: aktiv, ohne Serienaufträge (origin routine), ohne Abgeschlossen */
  activeTickets: Ticket[];
  /** Wie oben, nur Status Abgeschlossen (ohne Serienaufträge) */
  completedTickets: Ticket[];
  users: User[];
}

// --- HELPER FUNCTIONS ---
const parseGermanDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr || dateStr === 'N/A') return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return null;
};

// --- ICON COMPONENTS (locally scoped for this view) ---
const ExclamationTriangleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
);
const CheckCircleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const BoltIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
);

// --- UI COMPONENTS ---
const StatCard: React.FC<{ title: string; value: string | number; description?: string; icon: React.ReactNode; iconBgColor: string; }> = ({ title, value, description, icon, iconBgColor }) => (
    <div className="stat-card">
        <div className="stat-card-header">
            <h3 className="stat-card-title">{title}</h3>
            <div className="stat-icon-wrapper" style={{ backgroundColor: iconBgColor }}>{icon}</div>
        </div>
        <p className="stat-card-value">{value}</p>
        {description && <p className="stat-card-description">{description}</p>}
    </div>
);

type HBarDatum = { label: string; value: number; color?: string; barCaption?: string; barTitle?: string };

const HorizontalBarChart: React.FC<{ title: string; data: HBarDatum[]; barColor?: string; valueSuffix?: string; }> = ({ title, data, barColor, valueSuffix = '' }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="chart-container">
            <h3 className="chart-title">{title}</h3>
            {data.length > 0 ? (
                <div className="h-bar-chart">
                    {data.map((item, index) => (
                        <div className="h-bar-row" key={item.label} style={{ animationDelay: `${index * 50}ms` }}>
                            <span className="h-bar-label" title={item.barTitle ?? item.label}>{item.barCaption ?? item.label}</span>
                            <div className="h-bar-wrapper">
                                <div className="h-bar" style={{ '--bar-width': `${(item.value / maxValue) * 100}%`, '--bar-color': item.color || barColor } as React.CSSProperties}></div>
                            </div>
                            <span className="h-bar-value">{item.value.toFixed(item.value % 1 === 0 ? 0 : 1)}{valueSuffix}</span>
                        </div>
                    ))}
                </div>
            ) : <div className="no-data-placeholder">Keine Daten verfügbar.</div>}
        </div>
    );
};

// --- MAIN COMPONENT ---
const ReportsView: React.FC<ReportsViewProps> = ({ activeTickets, completedTickets, users }) => {
    const [reportFilters, setReportFilters] = useState({
        area: 'Alle', technician: 'Alle'
    });
    
    const technicians = useMemo(
      () =>
        users.filter(
          u =>
            (u.role === Role.Technician || u.role === Role.Housekeeping) && u.isActive
        ),
      [users]
    );
    const allTechnicianNames = useMemo(
      () => [
        'Alle',
        ...technicians.map(t => t.name).sort((a, b) => a.localeCompare(b, 'de')),
      ],
      [technicians]
    );

    const filteredActiveTickets = useMemo(() => {
        return activeTickets.filter(ticket => {
            if (reportFilters.area !== 'Alle' && ticket.area !== reportFilters.area) return false;
            if (reportFilters.technician !== 'Alle' && normalizePersonName(ticket.technician) !== normalizePersonName(reportFilters.technician)) return false;
            return true;
        });
    }, [activeTickets, reportFilters]);

    const filteredCompletedTickets = useMemo(() => {
        return completedTickets.filter(ticket => {
            if (reportFilters.area !== 'Alle' && ticket.area !== reportFilters.area) return false;
            if (reportFilters.technician !== 'Alle' && normalizePersonName(ticket.technician) !== normalizePersonName(reportFilters.technician)) return false;
            return true;
        });
    }, [completedTickets, reportFilters]);

    const stats = useMemo(() => {
        const totalActive = filteredActiveTickets.length;
        const totalCompleted = filteredCompletedTickets.length;
        const ueberfaellige = filteredActiveTickets.filter(t => t.status === Status.Ueberfaellig).length;
        const resolvedTickets = filteredCompletedTickets.filter(t => t.completionDate && t.entryDate);
        let avgProcessingTime = 0;
        if (resolvedTickets.length > 0) {
            const totalTime = resolvedTickets.reduce((acc: number, t) => {
                const entry = parseGermanDate(t.entryDate);
                const completion = parseGermanDate(t.completionDate);
                if (entry && completion) {
                    return acc + (completion.getTime() - entry.getTime());
                }
                return acc;
            }, 0);
            avgProcessingTime = totalTime / resolvedTickets.length / (1000 * 60 * 60 * 24);
        }
        return { totalActive, totalCompleted, ueberfaellige, avgProcessingTime: avgProcessingTime.toFixed(1) };
    }, [filteredActiveTickets, filteredCompletedTickets]);

    const ticketsByArea = useMemo(() => {
        const counts = filteredActiveTickets.reduce((acc: Record<string, number>, ticket) => {
            acc[ticket.area] = (acc[ticket.area] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    }, [filteredActiveTickets]);

    const ticketsByTechnician = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredActiveTickets.forEach(ticket => {
            if (ticket.technician && ticket.technician !== 'N/A') {
                counts[ticket.technician] = (counts[ticket.technician] || 0) + 1;
            }
        });

        // Nur Bearbeiter anzeigen, die im Zeitraum wirklich Tickets haben.
        const sorted = Object.entries(counts)
            .map(([label, value]) => ({ label, value }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value);
        
        const colors = ['#0d6efd', '#6f42c1', '#dc3545', '#fd7e14', '#198754', '#6c757d', '#343a40', '#adb5bd'];
        return sorted.map((item, index) => ({
            ...item,
            barCaption: displayNameShort(item.label),
            barTitle: item.label,
            color: colors[index % colors.length],
        }));
    }, [filteredActiveTickets, technicians]);

    const technicianWorkload = useMemo(() => {
        const totalActiveTickets = filteredActiveTickets.length;
        
        const counts: Record<string, number> = {};

        filteredActiveTickets.forEach(ticket => {
             if (ticket.technician && ticket.technician !== 'N/A') {
                counts[ticket.technician] = (counts[ticket.technician] || 0) + 1;
             }
        });

        return Object.entries(counts)
            .map(([label, value]) => ({
                label,
                barCaption: displayNameShort(label),
                barTitle: label,
                value: totalActiveTickets > 0 ? (value / totalActiveTickets) * 100 : 0,
            }))
            .filter((x) => x.value > 0)
            .sort((a, b) => b.value - a.value);

    }, [filteredActiveTickets, technicians]);
    
    const avgProcessingTimePerTechnician = useMemo(() => {
        const resolvedTickets = filteredCompletedTickets.filter(t => t.completionDate && t.entryDate && t.technician !== 'N/A');
        const techData: Record<string, { totalTime: number, count: number }> = {};

        resolvedTickets.forEach(t => {
            const entry = parseGermanDate(t.entryDate);
            const completion = parseGermanDate(t.completionDate);
            if (entry && completion) {
                if (!techData[t.technician]) techData[t.technician] = { totalTime: 0, count: 0 };
                const time = (completion.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24);
                techData[t.technician].totalTime += time;
                techData[t.technician].count += 1;
            }
        });

        return Object.entries(techData)
            .map(([label, data]) => ({
                label,
                barCaption: displayNameShort(label),
                barTitle: label,
                value: data.count > 0 ? data.totalTime / data.count : 0,
            }))
            .filter((x) => x.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [filteredCompletedTickets, technicians]);

    const handleFilterChange = (filterName: string, value: string) => setReportFilters(prev => ({ ...prev, [filterName]: value as any }));
    const resetFilters = () => setReportFilters({ area: 'Alle', technician: 'Alle' });

    const FilterChip: React.FC<{ label: string; name: string; options: string[]; value: string }> = ({
        label,
        name,
        options,
        value,
    }) => (
        <div className={`custom-select filter-chip ${value !== 'Alle' && name !== 'timeRange' ? 'active' : ''}`}>
            <span>{label}</span>
            {value !== 'Alle' && name !== 'timeRange' && (
                <span className="filter-badge">
                    {name === 'technician' ? displayNameShort(value) : value}
                </span>
            )}
            <select value={value} onChange={(e) => handleFilterChange(name, e.target.value)}>
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {name === 'technician' && opt !== 'Alle' ? displayNameShort(opt) : opt}
                    </option>
                ))}
            </select>
            <ChevronDownIcon />
        </div>
    );
    return (
        <div className="reports-view">
            <style>{`
                /* General */
                .reports-view { padding-top: 1.5rem; }
                .no-data-placeholder { height: 100%; min-height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
                
                /* Filters */
                .reports-filter-bar { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
                .custom-select { position: relative; border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 2rem 0.5rem 0.75rem; font-size: 0.9rem; min-width: 120px; cursor: pointer; color: var(--text-secondary); height: 38px; display: flex; align-items: center; transition: var(--transition-smooth); background-color: var(--bg-tertiary); }
                .custom-select:hover { border-color: var(--border-active); }
                .custom-select select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
                .custom-select svg { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); pointer-events: none; width: 16px; height: 16px; color: var(--text-muted); }
                .action-btn { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); font-size: 0.9rem; padding: 0.5rem 1rem; border-radius: 6px; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: var(--transition-smooth); font-weight: 500; margin-left: auto; }
                .action-btn:hover { background: var(--border); }
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

                /* Stats Grid */
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
                .stat-card { background-color: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; }
                .stat-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
                .stat-card-title { font-size: 0.9rem; font-weight: 500; color: var(--text-secondary); }
                .stat-icon-wrapper { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
                .stat-icon-wrapper svg { width: 20px; height: 20px; color: var(--text-primary); }
                .stat-card-value { font-size: 2.25rem; font-weight: 700; color: var(--text-primary); }
                .stat-card-description { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }

                /* Charts */
                .charts-grid { display: grid; grid-template-columns: 1fr; gap: 2rem; }
                @media (min-width: 992px) { .charts-grid { grid-template-columns: 3fr 2fr; } }
                .chart-container { background-color: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; }
                .chart-container.full-width { grid-column: 1 / -1; }
                .chart-title { font-size: 1.2rem; font-weight: 700; letter-spacing: 0.02em; color: var(--text-primary); margin-bottom: 1.5rem; flex-shrink: 0; }
                
                .technician-charts-stack { display: flex; flex-direction: column; gap: 2rem; }

                /* Horizontal Bar Chart */
                .h-bar-chart { display: flex; flex-direction: column; gap: 1rem; }
                .h-bar-row { display: grid; grid-template-columns: 100px 1fr 80px; gap: 0.75rem; align-items: center; animation: slideIn 0.5s ease-out forwards; opacity: 0; }
                @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
                .h-bar-label { font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .h-bar-wrapper { background-color: var(--bg-tertiary); border-radius: 4px; height: 16px; }
                .h-bar { height: 100%; border-radius: 4px; background: var(--bar-color, var(--accent-primary)); width: var(--bar-width, 0%); transition: width 0.5s ease-out; }
                .h-bar-value { font-size: 0.8rem; font-weight: 500; color: var(--text-primary); text-align: right; white-space: nowrap; }
                
                /* Line Chart */
                .line-chart-area { flex-grow: 1; display: grid; grid-template-columns: auto 1fr; grid-template-rows: 1fr auto; }
                .y-axis { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; justify-content: space-between; text-align: right; padding-right: 0.5rem; font-size: 0.75rem; color: var(--text-muted); }
                .line-chart-svg-wrapper { grid-column: 2; grid-row: 1; position: relative; }
                .line-chart-svg-wrapper svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
                .x-axis { grid-column: 2; grid-row: 2; display: flex; justify-content: space-between; padding-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); }
                .line-chart-legend { grid-column: 1 / -1; grid-row: 3; display: flex; justify-content: center; gap: 1.5rem; padding-top: 1rem; }
                .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
                .legend-color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
            `}</style>
            <div className="reports-filter-bar">
                <FilterChip label="Standort" name="area" options={LOCATIONS_FOR_FILTER} value={reportFilters.area} />
                <FilterChip label="Bearbeiter" name="technician" options={allTechnicianNames} value={reportFilters.technician} />
                <button className="action-btn" onClick={resetFilters}>
                    <i className="ti ti-rotate" aria-hidden />
                    Zurücksetzen
                </button>
            </div>
            
            <div className="stats-grid">
                <StatCard title="Aktive Tickets" value={stats.totalActive} description="Wie Dashboard/Listenansicht" icon={<DocumentIcon />} iconBgColor="rgba(0, 123, 255, 0.1)" />
                <StatCard title="Abgeschlossen" value={stats.totalCompleted} description="Wie Abgeschlossen-Ansicht" icon={<CheckCircleIcon />} iconBgColor="rgba(40, 167, 69, 0.1)" />
                <StatCard title="Überfällig (aktiv)" value={stats.ueberfaellige} description="Aktuell überfällige Tickets" icon={<ExclamationTriangleIcon />} iconBgColor="rgba(220, 53, 69, 0.1)" />
                <StatCard title="Bearbeitungszeit (Ø)" value={`${stats.avgProcessingTime} Tage`} description="Für vorhandene abgeschlossene Tickets" icon={<BoltIcon />} iconBgColor="rgba(255, 193, 7, 0.1)" />
            </div>
            
            <div className="charts-grid">
                <HorizontalBarChart title="Top 8 Standorte nach Ticketaufkommen" data={ticketsByArea} barColor="linear-gradient(90deg, #fd7e14, #dc3545)" />
                <div className="technician-charts-stack">
                    <HorizontalBarChart title="Ticket-Verteilung pro Bearbeiter" data={ticketsByTechnician} />
                    <HorizontalBarChart title="Prozentuale Auslastung (Aktive Tickets)" data={technicianWorkload} barColor="linear-gradient(90deg, #198754, #0d6efd)" valueSuffix="%" />
                </div>
                <div className="chart-container full-width">
                    <HorizontalBarChart 
                        title="Durchschnittliche Bearbeitungszeit pro Bearbeiter (Tage)" 
                        data={avgProcessingTimePerTechnician} 
                        barColor="var(--accent-primary)"
                        valueSuffix=" Tage"
                    />
                </div>
            </div>
        </div>
    );
};
export default ReportsView;