import React, { useMemo, useState } from 'react';
// FIX: Replaced non-existent 'Technician' type with the correct 'User' type.
import { Ticket, User, Status, Priority, Role } from '../types';
import { Avatar } from './Avatar';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { displayNameShort, normalizePersonName } from '../utils/displayNames';
import { isTicketParticipant } from '../utils/ticketParticipants';

interface TechnicianViewProps {
    tickets: Ticket[];
    // FIX: Changed prop type from 'Technician' to 'User'.
    technicians: User[];
    onTechnicianSelect: (filters: { technician: string, status: 'Alle' }) => void;
    onFilter: (filters: { status: Status, technician?: string }) => void;
}

const parseGermanDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr || dateStr === 'N/A') return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return null;
};

const TechnicianView: React.FC<TechnicianViewProps> = ({ tickets, technicians, onTechnicianSelect, onFilter }) => {

    const { totalOverdue, activeTicketCount, availableCount, sortedTechnicians, performanceRanking } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const totalOverdue = tickets.filter(t => t.status === Status.Ueberfaellig).length;

        // --- Technician-Level Stats ---
        const processedTechnicians = technicians.map(tech => {
            const techKey = normalizePersonName(tech.name);
            const assignedTickets = tickets.filter(t => isTicketParticipant(t, techKey));
            const activeTickets = assignedTickets.filter(t => t.status !== Status.Abgeschlossen);
            const overdueTicketsCount = activeTickets.filter(t => t.status === Status.Ueberfaellig).length;
            
            const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);
            const sixtyDaysAgo = new Date(today); sixtyDaysAgo.setDate(today.getDate() - 60);

            const completedLast30Days = assignedTickets.filter(t => {
                const completionDate = parseGermanDate(t.completionDate);
// FIX: Use .getTime() for robust date comparison to resolve arithmetic operation error.
                return completionDate && completionDate.getTime() >= thirtyDaysAgo.getTime() && completionDate.getTime() <= today.getTime();
            }).length;

            const completedPrev30Days = assignedTickets.filter(t => {
                const completionDate = parseGermanDate(t.completionDate);
// FIX: Use .getTime() for robust date comparison to resolve arithmetic operation error.
                return completionDate && completionDate.getTime() >= sixtyDaysAgo.getTime() && completionDate.getTime() < thirtyDaysAgo.getTime();
            }).length;

            let performanceTrend: 'up' | 'down' | 'neutral' = 'neutral';
            if (completedLast30Days > completedPrev30Days) performanceTrend = 'up';
            if (completedLast30Days < completedPrev30Days) performanceTrend = 'down';

            return {
                ...tech,
                assignedTicketsCount: assignedTickets.length,
                activeTicketsCount: activeTickets.length,
                overdueTicketsCount,
                completedLast30Days,
                performanceTrend,
            };
        });
        
        // Alle bleiben sichtbar (auch 0), aber Auslastung berechnen wir nur über wirklich aktive Tickets.
        const totalActiveTeamTickets = processedTechnicians.reduce((sum, tech: any) => sum + (tech.activeTicketsCount ?? 0), 0);
        
        const finalTechnicians = processedTechnicians.map((tech: any) => ({
            ...tech,
            proportionalLoad: totalActiveTeamTickets > 0 ? (tech.activeTicketsCount / totalActiveTeamTickets) * 100 : 0,
        }));

        // Default sort: most critical first
        finalTechnicians.sort((a, b) => {
            return (b.overdueTicketsCount ?? 0) - (a.overdueTicketsCount ?? 0) || (b.activeTicketsCount ?? 0) - (a.activeTicketsCount ?? 0);
        });

        const performanceRanking = finalTechnicians
            .map(t => ({ name: t.name, completed: t.completedLast30Days }))
            .sort((a,b) => b.completed - a.completed);

        return {
            totalOverdue,
            activeTicketCount: tickets.filter(t => [Status.Offen, Status.InArbeit, Status.Ueberfaellig].includes(t.status)).length,
            availableCount: technicians.filter(t => t.availability.status === 'Verfügbar').length,
            sortedTechnicians: finalTechnicians,
            performanceRanking,
        };

    }, [tickets, technicians]);

    const PerformanceTrendIcon: React.FC<{ trend: 'up' | 'down' | 'neutral' }> = ({ trend }) => {
        if (trend === 'up') return <ArrowUpIcon style={{ color: 'var(--accent-success)' }} />;
        if (trend === 'down') return <ArrowDownIcon style={{ color: 'var(--accent-danger)' }} />;
        return <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>-</span>;
    };

    return (
        <div className="technician-view">
            <style>{`
                .technician-view { padding-top: 0; /* Adjusted from 1.5rem */ }

                /* New Simplified Header */
                .view-header {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    padding: 0 0 1.5rem 0;
                }
                .critical-kpi-button {
                    background-color: transparent;
                    border: 1px solid transparent;
                    border-radius: var(--radius-md);
                    padding: 0.6rem 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                    transition: background-color 0.2s ease, border-color 0.2s ease;
                }
                .critical-kpi-button:hover {
                    background-color: var(--bg-tertiary);
                    border-color: var(--border-active);
                }
                .critical-kpi-button .kpi-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    line-height: 1;
                    color: var(--accent-danger);
                }
                .critical-kpi-button .kpi-label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }
                .critical-kpi-button .kpi-icon {
                    color: var(--accent-danger);
                }
                 .critical-kpi-button .kpi-icon svg {
                    width: 20px;
                    height: 20px;
                }
                
                .technician-grid {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem;
                }
                .technician-card {
                    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg);
                    padding: 1.25rem; display: flex; flex-direction: column;
                    box-shadow: var(--shadow-sm); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
                    cursor: pointer;
                }
                .technician-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--accent-primary); }

                .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .technician-info { display: flex; align-items: center; gap: 0.75rem; }
                .technician-name { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); }
                
                .kpi-row { display: flex; justify-content: space-around; text-align: center; padding: 0.75rem 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
                .kpi-item { padding: 0 0.5rem; }
                .kpi-item.clickable { cursor: pointer; border-radius: var(--radius-sm); transition: background-color 0.2s ease; }
                .kpi-item.clickable:hover { background-color: var(--bg-tertiary); }
                .kpi-value { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
                .kpi-value.is-overdue { color: var(--accent-danger); font-weight: 800; }
                .kpi-label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; }
                .kpi-trend { display: flex; align-items: center; justify-content: center; gap: 0.25rem; }
                .kpi-trend svg { width: 14px; height: 14px; }

                .workload-section { margin-top: auto; } /* Pushes to bottom */
                .workload-label-wrapper { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
                .workload-label { font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); }
                .workload-percentage { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); }
                .workload-bar-track { height: 14px; background: var(--bg-tertiary); border-radius: 7px; overflow: hidden; display: flex; border: 1px solid var(--border); }
                .workload-bar-normal-segment { background: var(--text-muted); height: 100%; transition: width 0.3s ease; }
                .workload-bar-overdue-segment { background: var(--accent-danger); height: 100%; transition: width 0.3s ease; }

                .performance-ranking-container {
                    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg);
                    padding: 1.5rem; margin-top: 2.5rem; box-shadow: var(--shadow-sm);
                }
                .performance-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1.5rem; }
                .ranking-list { display: flex; flex-direction: column; gap: 1rem; }
                .ranking-item { display: grid; grid-template-columns: 120px 1fr 40px; gap: 1rem; align-items: center; }
                .ranking-name { font-size: 0.9rem; font-weight: 500; color: var(--text-secondary); text-align: right; }
                .ranking-bar-track { height: 10px; background: var(--bg-tertiary); border-radius: 5px; }
                .ranking-bar-fill { height: 100%; background-color: var(--accent-primary); border-radius: 5px; transition: width 0.5s ease-out; }
                .ranking-value { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); }

                /* Teamübersicht: kompakte, klar vergleichbare Karten */
                .team-summary-header {
                    display: flex; align-items: center; justify-content: space-between; gap: 18px;
                    padding: 18px 20px; margin-bottom: 18px; border: 1px solid var(--border);
                    border-radius: 14px; background: var(--bg-secondary);
                }
                .team-summary-eyebrow { margin: 0 0 5px; color: var(--accent-primary); font-size: .72rem; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
                .team-summary-header h2 { margin: 0; color: var(--text-primary); font-size: 1.3rem; letter-spacing: -.025em; }
                .team-summary-header > div > p:last-child { margin: 4px 0 0; color: var(--text-secondary); font-size: .84rem; }
                .team-summary-metrics { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
                .team-summary-metrics > span, .team-summary-metrics > button {
                    display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border: 1px solid var(--border);
                    border-radius: 999px; background: var(--bg-primary); color: var(--text-secondary); font: inherit; font-size: .78rem; white-space: nowrap;
                }
                .team-summary-metrics strong { color: var(--text-primary); }
                .team-summary-metrics > button { border-color: rgba(220,53,69,.28); background: rgba(220,53,69,.05); color: #C0343F; cursor: pointer; }
                .team-summary-metrics > button strong { color: #C0343F; }
                .view-header { display: none; }
                .technician-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
                .technician-card { min-width: 0; padding: 16px; border-radius: 14px; box-shadow: var(--shadow-sm); }
                .technician-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
                .technician-card--critical { border-color: rgba(220,53,69,.42); }
                .card-header { margin-bottom: 14px; }
                .technician-info .avatar { width: 36px; height: 36px; font-size: .78rem; }
                .technician-name { display: block; font-size: .98rem; font-weight: 750; }
                .technician-role { display: block; margin-top: 2px; color: var(--text-muted); font-size: .72rem; }
                .technician-availability { display: inline-flex; align-items: center; gap: 4px; padding: 4px 7px; border-radius: 999px; font-size: .68rem; font-weight: 750; }
                .technician-availability::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
                .technician-availability.is-available { color: #16815F; background: rgba(22,129,95,.1); }
                .technician-availability.is-away { color: #8A5B08; background: rgba(202,138,4,.11); }
                .kpi-row { gap: 8px; margin-bottom: 14px; padding: 0; border: 0; }
                .kpi-item { flex: 1; padding: 10px; border-radius: 10px; background: var(--bg-tertiary); }
                .kpi-item.clickable { background: rgba(220,53,69,.055); }
                .kpi-value { font-size: 1.28rem; }
                .kpi-label { margin-top: 4px; font-size: .65rem; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
                .workload-section { margin-top: 0; }
                .workload-label { font-size: .75rem; }
                .workload-bar-track { height: 7px; border: 0; }
                .performance-ranking-container { display: none; }
                @media (max-width: 720px) { .team-summary-header { align-items: flex-start; flex-direction: column; } .team-summary-metrics { justify-content: flex-start; } .technician-grid { grid-template-columns: 1fr; } }
            `}</style>

            <header className="team-summary-header">
                <div>
                    <p className="team-summary-eyebrow"><i className="ti ti-users" aria-hidden="true" /> Verwaltung · Team</p>
                    <h2>Team &amp; Auslastung</h2>
                    <p>Verfügbarkeit, Arbeitslast und kritische Fristen auf einen Blick.</p>
                </div>
                <div className="team-summary-metrics">
                    <span><i className="ti ti-users" aria-hidden="true" /> Verfügbar <strong>{availableCount}/{technicians.length}</strong></span>
                    <span><i className="ti ti-briefcase" aria-hidden="true" /> Aktive Tickets <strong>{activeTicketCount}</strong></span>
                    <button type="button" onClick={() => onFilter({ status: Status.Ueberfaellig })}><i className="ti ti-alert-triangle" aria-hidden="true" /> Überfällig <strong>{totalOverdue}</strong></button>
                </div>
            </header>

            {totalOverdue > 0 ? (
                <div className="view-header">
                    <button className="critical-kpi-button" onClick={() => onFilter({ status: Status.Ueberfaellig })}>
                        <span className="kpi-icon"><ExclamationTriangleIcon /></span>
                        <span className="kpi-value">{totalOverdue}</span>
                        <span className="kpi-label">Kritische Tickets</span>
                    </button>
                </div>
            ) : null}

            <div className="technician-grid">
                {sortedTechnicians.map(tech => {
                    const normalTicketsCount = tech.activeTicketsCount - tech.overdueTicketsCount;
                    
                    const normalSegmentWidth = tech.activeTicketsCount > 0 ? (normalTicketsCount / tech.activeTicketsCount) * 100 : 0;
                    const overdueSegmentWidth = tech.activeTicketsCount > 0 ? (tech.overdueTicketsCount / tech.activeTicketsCount) * 100 : 0;

                    return (
                        <div
                            key={tech.name}
                            className={`technician-card${tech.overdueTicketsCount > 0 ? ' technician-card--critical' : ''}`}
                            title={tech.name}
                            onClick={() => onTechnicianSelect({ technician: tech.name, status: 'Alle' })}
                        >
                            <div className="card-header">
                                <div className="technician-info">
                                    <Avatar name={displayNameShort(tech.name)} initialsFrom={tech.name} color={tech.color} />
                                    <div>
                                        <span className="technician-name">{displayNameShort(tech.name)}</span>
                                        <span className="technician-role">{tech.role === Role.Technician ? 'Haustechnik' : 'Hauswirtschaft'}</span>
                                    </div>
                                </div>
                                <span className={`technician-availability ${tech.availability.status === 'Verfügbar' ? 'is-available' : 'is-away'}`}>{tech.availability.status}</span>
                            </div>
                            <div className="kpi-row">
                                <div className="kpi-item">
                                    <div className="kpi-value">{tech.activeTicketsCount}</div>
                                    <div className="kpi-label">Aktive Aufträge</div>
                                </div>
                                <div className="kpi-item clickable" onClick={(e) => { e.stopPropagation(); onFilter({ status: Status.Ueberfaellig, technician: tech.name }); }}>
                                    <div className={`kpi-value ${tech.overdueTicketsCount > 0 ? 'is-overdue' : ''}`}>{tech.overdueTicketsCount}</div>
                                    <div className="kpi-label">Kritisch</div>
                                </div>
                                <div className="kpi-item">
                                    <div className="kpi-value kpi-trend">
                                        <PerformanceTrendIcon trend={tech.performanceTrend} /> {tech.completedLast30Days}
                                    </div>
                                    <div className="kpi-label">Abgeschlossen (30T)</div>
                                </div>
                            </div>
                            <div className="workload-section">
                                <div className="workload-label-wrapper">
                                    <div className="workload-label">Anteil an Team-Auslastung</div>
                                    <div className="workload-percentage">{Math.round(tech.proportionalLoad)}%</div>
                                </div>
                                <div className="workload-bar-track" title={`${normalTicketsCount} aktive Aufträge, ${tech.overdueTicketsCount} kritische Aufträge`}>
                                    <div className="workload-bar-normal-segment" style={{ width: `${normalSegmentWidth}%` }}></div>
                                    <div className="workload-bar-overdue-segment" style={{ width: `${overdueSegmentWidth}%` }}></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="performance-ranking-container">
                <h3 className="performance-title">Abgeschlossene Aufträge (letzte 30 Tage)</h3>
                <div className="ranking-list">
                    {performanceRanking.map(tech => {
                        const maxCompleted = Math.max(...performanceRanking.map(t => t.completed), 1);
                        const barWidth = (tech.completed / maxCompleted) * 100;
                        return (
                            <div className="ranking-item" key={tech.name} title={tech.name}>
                                <div className="ranking-name">{displayNameShort(tech.name)}</div>
                                <div className="ranking-bar-track">
                                    <div className="ranking-bar-fill" style={{ width: `${barWidth}%` }}></div>
                                </div>
                                <div className="ranking-value">{tech.completed}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TechnicianView;
