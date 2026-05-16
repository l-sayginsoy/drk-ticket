import React, { useMemo } from 'react';
import { Ticket, Priority, Status, User, AvailabilityStatus } from '../types';
import { statusColorMap } from '../constants';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { CheckIcon } from './icons/CheckIcon';
import { ClockIcon } from './icons/ClockIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { displayNameShort } from '../utils/displayNames';

interface TicketCardProps {
  ticket: Ticket;
  /** Aktive Service-Team-Mitarbeitende (wie in Einstellungen / NewTicketModal) */
  technicians?: User[];
  onUpdateTicket: (ticket: Ticket) => void;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicket: Ticket | null;
  badgeNumber?: number;
}

const ExclamationTriangleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
);

const parseGermanDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr || dateStr === 'N/A') return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        const year = parseInt(parts[2], 10);
        const fullYear = year < 100 ? 2000 + year : year;
        return new Date(fullYear, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return null;
};

const parseDateFromNote = (note: string): Date | null => {
    const match = note.match(/\((\w+\s?[\w.]*)\s(?:am\s)?(\d{1,2}\.\d{1,2}\.\d{4}),?\s(\d{2}:\d{2})\)$/);
    if (match) {
        const [, , dateStr] = match;
        return parseGermanDate(dateStr);
    }
    return null;
};

const isStagnating = (ticket: Ticket): boolean => {
    if (ticket.status !== Status.InArbeit) {
        return false;
    }
    // Use a fixed date for consistent demo behavior
    const today = new Date(2026, 1, 7); 
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);

    let lastActivityDate: Date | null = null;
    if (ticket.notes && ticket.notes.length > 0) {
        lastActivityDate = parseDateFromNote(ticket.notes[ticket.notes.length - 1]);
    }
    if (!lastActivityDate) {
        lastActivityDate = parseGermanDate(ticket.entryDate);
    }
    return lastActivityDate ? lastActivityDate < fiveDaysAgo : false;
};


const TicketCard: React.FC<TicketCardProps> = ({
    ticket,
    technicians: techniciansProp,
    onUpdateTicket,
    onSelectTicket,
    selectedTicket,
    badgeNumber,
}) => {
    const technicians = techniciansProp ?? [];

    const priorityClasses = {
        [Priority.Hoch]: 'priority-high',
        [Priority.Mittel]: 'priority-medium',
        [Priority.Niedrig]: 'priority-low',
    };

    const toInputDate = (dateStr: string) => {
        const parts = dateStr.split('.');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return '';
    };

    const fromInputDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        return '';
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('select, input, button, a')) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData("ticketId", ticket.id);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '';
    };
    
    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdateTicket({ ...ticket, status: e.target.value as Status });
    };

    const handleTechnicianSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdateTicket({ ...ticket, technician: e.target.value });
    };

    const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdateTicket({ ...ticket, priority: e.target.value as Priority });
    };
    
    const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdateTicket({ ...ticket, dueDate: fromInputDate(e.target.value) });
    };

    const technicianOptions = useMemo(() => {
        const techNames = [...technicians.map((t) => t.name)].sort((a, b) => a.localeCompare(b, 'de'));
        const set = new Set(techNames);
        if (ticket.technician && ticket.technician !== 'N/A' && !set.has(ticket.technician)) {
            techNames.push(ticket.technician);
            techNames.sort((a, b) => a.localeCompare(b, 'de'));
        }
        return ['N/A', ...techNames] as const;
    }, [technicians, ticket.technician]);
    
    const isEmergency = !!ticket.is_emergency;
    const isTicketStagnating = isStagnating(ticket);

    const Dropdown: React.FC<{
        options: string[],
        selected: string,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void,
        className?: string
    }> = ({ options, selected, onChange, className = '' }) => {
        const isValueInOptions = options.includes(selected);
        return (
            <div className={`custom-dropdown ${className}`} onClick={e => e.stopPropagation()}>
                <span>{selected}</span> <ChevronDownIcon />
                <select value={isValueInOptions ? selected : ""} onChange={onChange}>
                    {!isValueInOptions && <option value="" disabled hidden>{selected}</option>}
                    {options.map(opt => <option key={opt} value={opt}>{opt === Status.Abgeschlossen ? 'Abschließen' : opt}</option>)}
                </select>
            </div>
        );
    };

    const isAssigned = !!(ticket.technician && ticket.technician !== 'N/A');
    const initials = (() => {
        const n = ticket.technician;
        if (!n || n === 'N/A') return '?';
        const p = n.trim().split(' ');
        return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
    })();

    const statusBorderColor: Record<string, string> = {
        [Status.Offen]: '#adb5bd',
        [Status.InArbeit]: '#0d6efd',
        [Status.Ueberfaellig]: '#dc3545',
        [Status.Abgeschlossen]: '#198754',
    };

    const priorityPillClass = isEmergency ? 'pill-priority-high'
        : ticket.priority === Priority.Hoch ? 'pill-priority-high'
        : ticket.priority === Priority.Mittel ? 'pill-priority-medium'
        : 'pill-priority-low';

    const statusPillClass = ticket.status === Status.InArbeit ? 'pill-status-inarbeit'
        : ticket.status === Status.Ueberfaellig ? 'pill-status-ueberfaellig'
        : ticket.status === Status.Abgeschlossen ? 'pill-status-done'
        : 'pill-status-offen';

    const cardClasses = `ticket-card ${selectedTicket?.id === ticket.id ? 'selected' : ''} ${ticket.status === Status.Abgeschlossen ? 'status-done' : ''} ${isEmergency ? 'urgent-alert' : ''}`;

    return (
        <div
            className={cardClasses}
            style={{ borderLeftColor: statusBorderColor[ticket.status] ?? '#adb5bd', cursor: 'grab' }}
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <style>{`
                @keyframes pulse-border {
                    0% { box-shadow: 0 0 0 0 rgba(220,53,69,0.8); }
                    70% { box-shadow: 0 0 0 8px rgba(220,53,69,0); }
                    100% { box-shadow: 0 0 0 0 rgba(220,53,69,0); }
                }
                .ticket-card {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    margin-bottom: 0.85rem;
                    border: 1px solid var(--border);
                    border-left-width: 3px;
                    border-left-style: solid;
                    box-shadow: var(--shadow-sm);
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                    padding: 0.85rem 1rem;
                    position: relative;
                }
                .ticket-card.urgent-alert { animation: pulse-border 1.5s infinite; }
                .ticket-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
                .ticket-card.selected { box-shadow: 0 0 0 2px var(--accent-primary), var(--shadow-lg); }

                .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.15rem; }
                .card-title { font-size: 1rem; font-weight: 700; color: var(--text-primary); margin: 0; flex-grow: 1; line-height: 1.35; }
                .card-icons { display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0; }
                .card-id { font-size: 0.72rem; color: var(--text-muted); font-weight: 500; cursor: pointer; padding: 2px 6px; border-radius: 6px; transition: background 0.15s, color 0.15s; }
                .card-id:hover { background: var(--bg-tertiary); color: var(--text-primary); }
                .unassigned-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: #dc3545; color: #fff; font-size: 10px; font-weight: 700; }
                .auto-badge { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; background: #0d6efd; color: #fff; font-size: 10px; font-weight: 700; }
                .assigned-badge { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; background: #198754; color: #fff; font-size: 11px; font-weight: 700; }
                .urgent-icon { color: var(--accent-danger); }
                .stagnating-icon { color: var(--accent-primary); }

                .card-location { font-size: 0.92rem; color: var(--text-secondary); margin: 0 0 0.45rem 0; }
                .card-reporter { display: flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.7rem; }

                /* Pill-Zeile mit Labels */
                .card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-bottom: 0.6rem; }
                .grid-cell { display: flex; flex-direction: column; gap: 0.18rem; }
                .grid-label { font-size: 0.62rem; font-weight: 400; color: var(--text-muted); text-align: center; }
                .grid-pill {
                    display: flex; align-items: center; justify-content: center; gap: 0.2rem;
                    padding: 0.18rem 0.6rem; border-radius: 999px;
                    font-size: 0.75rem; font-weight: 600;
                    border: 1.5px solid var(--border);
                    background: var(--bg-tertiary); color: var(--text-secondary);
                    position: relative; cursor: pointer; white-space: nowrap;
                    height: 24px; width: 100%; box-sizing: border-box;
                }
                .grid-pill:hover { filter: brightness(0.93); }
                .grid-pill select, .grid-pill input[type="date"] { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
                .pill-priority-high { background: rgba(220,53,69,0.1); color: #c82333; border-color: rgba(220,53,69,0.3); }
                .pill-priority-medium { background: rgba(255,152,0,0.12); color: #e65100; border-color: rgba(255,152,0,0.3); }
                .pill-priority-low { background: rgba(25,135,84,0.1); color: #198754; border-color: rgba(25,135,84,0.28); }
                .pill-status-inarbeit { background: rgba(13,110,253,0.1); color: #0d6efd; border-color: rgba(13,110,253,0.25); }
                .pill-status-ueberfaellig { background: rgba(220,53,69,0.1); color: #c82333; border-color: rgba(220,53,69,0.25); }
                .pill-status-done { background: rgba(25,135,84,0.1); color: #198754; border-color: rgba(25,135,84,0.25); }
                .pill-status-offen { background: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border); }

                /* Trennlinie */
                .card-divider { height: 1px; background: var(--border); margin-bottom: 0.55rem; }

                /* Footer */
                .card-footer { display: flex; align-items: center; justify-content: space-between; }
                .assignee-chip {
                    display: inline-flex; align-items: center; gap: 0.3rem;
                    padding: 0.18rem 0.5rem 0.18rem 0.2rem;
                    border-radius: 999px; border: 1.5px solid var(--border);
                    background: var(--bg-tertiary); color: var(--text-secondary);
                    font-size: 0.75rem; font-weight: 600; cursor: pointer;
                    position: relative; white-space: nowrap;
                }
                .assignee-chip:hover { filter: brightness(0.93); }
                .assignee-chip select { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
                .av { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: #0d6efd; color: #fff; font-size: 0.6rem; font-weight: 700; flex-shrink: 0; }
                .av.unassigned { background: #6c757d; }
            `}</style>

            {/* Zeile 1: Titel + Badges + ID */}
            <div className="card-header">
                <h3 className="card-title">{ticket.title}</h3>
                <div className="card-icons">
                    {badgeNumber !== undefined && <span className="unassigned-badge" title="Wartet auf Zuweisung">{badgeNumber}</span>}
                    {ticket.technician !== 'N/A' && badgeNumber === undefined && ticket.status === Status.Offen && (() => {
                        const isAuto = ticket.autoAssigned === true || (ticket.ticketType === 'reactive' && ticket.autoAssigned !== false);
                        return isAuto
                            ? <span className="auto-badge" title="Automatisch zugewiesen">A</span>
                            : <span className="assigned-badge" title="Manuell zugeteilt">✓</span>;
                    })()}
                    {ticket.is_reopened && (
                        <span title="Wiedereröffnet" style={{ display:'inline-flex', alignItems:'center', fontSize:'0.65rem', fontWeight:700, padding:'1px 5px', borderRadius:999, background:'#fff3e0', color:'#e65100', border:'1.5px solid #ff9800' }}>↩</span>
                    )}
                    {isTicketStagnating && <span title="Ticket stagniert"><ClockIcon className="stagnating-icon" width="15" height="15" /></span>}
                    {isEmergency && <span className="urgent-icon" title="Notfall"><ExclamationTriangleIcon width="15" height="15" /></span>}
                    {ticket.hasNewNoteFromReporter && <span className="new-note-indicator" title="Neue Nachricht vom Melder" />}
                    <span className="card-id" onClick={() => onSelectTicket(ticket)}>#{ticket.id}</span>
                </div>
            </div>

            {/* Zeile 2: Standort */}
            <p className="card-location">{ticket.area} · {ticket.location}</p>

            {/* Zeile 3: Reporter + Datum + Uhrzeit */}
            <div className="card-reporter">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, opacity:0.65 }}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                <span>{ticket.reporter}</span>
                <span>·</span>
                <span>{ticket.entryDate.slice(0,5)}{ticket.entryTime ? ` · ${ticket.entryTime}` : ''}</span>
            </div>

            {/* Zeile 4: Fällig bis | Priorität | Status */}
            <div className="card-grid" onClick={e => e.stopPropagation()}>
                <div className="grid-cell">
                    <span className="grid-label">Fällig bis</span>
                    <div className="grid-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                        {ticket.dueDate.slice(0,5)}
                        <input type="date" value={toInputDate(ticket.dueDate)} onChange={handleDueDateChange} />
                    </div>
                </div>
                <div className="grid-cell">
                    <span className="grid-label">Priorität</span>
                    {isEmergency ? (
                        <div className="grid-pill pill-priority-high">Notfall</div>
                    ) : (
                        <div className={`grid-pill ${priorityPillClass}`}>
                            {ticket.priority}
                            <select value={ticket.priority} onChange={handlePriorityChange}>
                                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <div className="grid-cell">
                    <span className="grid-label">Status</span>
                    <div className={`grid-pill ${statusPillClass}`}>
                        {ticket.status}
                        <select value={ticket.status} onChange={handleStatusChange}>
                            {Object.values(Status).filter(s => s !== Status.Ueberfaellig).map(s => (
                                <option key={s} value={s}>{s === Status.Abgeschlossen ? 'Abschließen' : s}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Trennlinie */}
            <div className="card-divider" />

            {/* Zeile 5: Bearbeiter */}
            <div className="card-footer" onClick={e => e.stopPropagation()}>
                <div className="assignee-chip">
                    <span className={`av${isAssigned ? '' : ' unassigned'}`}>{initials}</span>
                    <span>{isAssigned ? displayNameShort(ticket.technician) : 'Zuweisen'}</span>
                    <ChevronDownIcon />
                    <select value={ticket.technician} onChange={handleTechnicianSelectChange}>
                        {technicianOptions.map((opt) => {
                            if (opt === 'N/A') return <option key={opt} value={opt}>Nicht zugewiesen</option>;
                            const u = technicians.find((t) => t.name === opt);
                            const absent = u?.availability.status === AvailabilityStatus.OnLeave;
                            return <option key={opt} value={opt} disabled={!!absent}>{displayNameShort(opt)}{absent ? ' (Abwesend)' : ''}</option>;
                        })}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default TicketCard;