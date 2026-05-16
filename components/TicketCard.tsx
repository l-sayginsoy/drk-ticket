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

    const cardClasses = `ticket-card ${selectedTicket?.id === ticket.id ? 'selected' : ''} ${ticket.status === Status.Abgeschlossen ? 'status-done' : ''} ${isEmergency ? 'urgent-alert' : ''}`;

    return (
        <div
            className={cardClasses}
            style={{ borderLeftColor: `var(${statusColorMap[ticket.status]})`, cursor: 'grab' }}
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <style>{`
                @keyframes pulse-border {
                    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.8); }
                    70% { box-shadow: 0 0 0 8px rgba(220, 53, 69, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
                }
                .ticket-card {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    margin-bottom: 1.5rem;
                    border: 1px solid var(--border);
                    border-left-width: 5px;
                    border-left-style: solid;
                    border-left-color: transparent;
                    box-shadow: var(--shadow-sm);
                    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
                    padding: 1rem 1.25rem;
                    position: relative;
                }
                .ticket-card.urgent-alert { animation: pulse-border 1.5s infinite; border-color: var(--accent-danger) !important; }
                .ticket-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
                .ticket-card.dragging { opacity: 0.5; }
                .ticket-card.selected { background-color: var(--border); box-shadow: 0 0 0 2px var(--accent-primary), var(--shadow-lg); }
                
                .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.1rem; }
                .card-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; flex-grow: 1;}
                .unassigned-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 5px;
                    border-radius: 10px;
                    background: #dc3545;
                    color: #fff;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 1;
                    flex-shrink: 0;
                }
                .auto-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #0d6efd;
                    color: #fff;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 1;
                    flex-shrink: 0;
                }
                .assigned-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #198754;
                    color: #fff;
                    font-size: 13px;
                    font-weight: 700;
                    line-height: 1;
                    flex-shrink: 0;
                }
                .card-location { font-size: 1rem; color: var(--text-secondary); font-weight: 500; }
                .reporter-name { display: block; margin-top: 0.4rem; font-size: 0.9rem; font-weight: 600; color: var(--text-muted); }
                .card-location span { font-weight: normal; color: var(--text-muted); }
                .card-meta { font-size: 0.9rem; color: var(--text-secondary); font-weight: 500; margin-bottom: 1rem; }
                
                .card-icons { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; flex-shrink: 0; }
                .urgent-icon { color: var(--accent-danger); }
                .stagnating-icon { color: var(--accent-primary); }
                .reopen-icon { color: var(--accent-warning); }
                
                .card-actions-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin-top: 1rem; }
                .action-item { font-size: 0.8rem; position: relative; }
                .action-label { color: var(--text-muted); margin-bottom: 0.25rem; font-size: 0.75rem; text-align: center; }
                /* Einheitliche Pill-Form wie in der Listenansicht (alle Raster-Felder) */
                .action-value-box,
                .details-btn,
                .custom-dropdown,
                .date-input-wrapper {
                    padding: 0.25rem 0.75rem;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    background: var(--bg-tertiary);
                    border: 1px solid transparent;
                    width: 100%;
                    text-align: center;
                    min-height: 29px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
                }
                .action-value-box.emergency { background-color: rgba(220, 53, 69, 0.1); color: #c82333; border-color: rgba(220, 53, 69, 0.3); font-weight: 600; }
                .date-input-wrapper { position: relative; }
                .date-input-wrapper input[type="date"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
                .date-input-wrapper input[type="date"]::-webkit-calendar-picker-indicator { width: 100%; height: 100%; cursor: pointer; }
                .custom-dropdown { display: flex; align-items: center; justify-content: center; gap: 0.25rem; position: relative; cursor: pointer; }
                .custom-dropdown.priority-high { background-color: rgba(220, 53, 69, 0.1); color: #c82333; border-color: rgba(220, 53, 69, 0.3); font-weight: 600; }
                .custom-dropdown.priority-medium { background-color: rgba(255, 193, 7, 0.1); color: #d97706; border-color: rgba(255, 193, 7, 0.3); font-weight: 600; }
                .custom-dropdown.priority-low { background-color: rgba(25, 135, 84, 0.1); color: var(--accent-success); border-color: rgba(25, 135, 84, 0.3); font-weight: 600; }
                .custom-dropdown > span:not(.auto-chip) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .custom-dropdown select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
                .custom-dropdown svg { width: 14px; height: 14px; flex-shrink: 0; }
                .details-btn { cursor: pointer; }
                .details-btn:hover, .date-input-wrapper:hover {
                    background: var(--border);
                    border-color: rgba(13, 110, 253, 0.22);
                    color: var(--text-primary);
                }
                .custom-dropdown:hover {
                    filter: brightness(0.96);
                    border-color: rgba(13, 110, 253, 0.22);
                }
                .custom-dropdown.priority-high:hover { filter: none; background-color: rgba(220, 53, 69, 0.16); border-color: rgba(220, 53, 69, 0.45); color: #c82333; }
                .custom-dropdown.priority-medium:hover { filter: none; background-color: rgba(255, 193, 7, 0.18); border-color: rgba(255, 193, 7, 0.45); color: #d97706; }
                .custom-dropdown.priority-low:hover { filter: none; background-color: rgba(25, 135, 84, 0.14); border-color: rgba(25, 135, 84, 0.4); color: var(--accent-success); }
            `}</style>
            
            <div className="card-header">
                <h3 className="card-title">{ticket.title}</h3>
                <div className="card-icons">
                    {badgeNumber !== undefined && (
                        <span className="unassigned-badge" title="Wartet auf Zuweisung">{badgeNumber}</span>
                    )}
                    {ticket.technician !== 'N/A' && badgeNumber === undefined && ticket.status === Status.Offen && (() => {
                        const isAuto = ticket.autoAssigned === true ||
                            (ticket.ticketType === 'reactive' && ticket.autoAssigned !== false);
                        return isAuto
                            ? <span className="auto-badge" title="Automatisch zugewiesen">A</span>
                            : <span className="assigned-badge" title="Manuell zugeteilt">✓</span>;
                    })()}
                    {ticket.is_reopened && (
                        <span title="Ticket wurde vom Melder wiedereröffnet" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px',
                            borderRadius: 999, background: '#fff3e0', color: '#e65100',
                            border: '1.5px solid #ff9800', whiteSpace: 'nowrap', lineHeight: 1.4,
                        }}>↩ Wiedereröffnet</span>
                    )}
                    {isTicketStagnating && <span title="Ticket stagniert (> 5 Tage keine Notiz)"><ClockIcon className="stagnating-icon" width="24" height="24" /></span>}
                    {isEmergency && <span className="urgent-icon" title="Notfall"><ExclamationTriangleIcon width="24" height="24" /></span>}
                    {ticket.hasNewNoteFromReporter && <span className="new-note-indicator" title="Neue Nachricht vom Melder"></span>}
                </div>
            </div>
            <p className="card-location">{ticket.area} <span>|</span> {ticket.location}</p>
            <span className="reporter-name">{ticket.reporter}</span>

            <div className="card-actions-grid">
                <div className="action-item">
                    <div className="action-label">Eingang</div>
                    <div className="action-value-box">{ticket.entryDate}</div>
                </div>
                <div className="action-item">
                    <div className="action-label">Fällig bis</div>
                    <div className="date-input-wrapper">
                        <span>{ticket.dueDate}</span>
                        <input type="date" value={toInputDate(ticket.dueDate)} onChange={handleDueDateChange} onClick={e => e.stopPropagation()} />
                    </div>
                </div>
                <div className="action-item">
                    <div className="action-label">Priorität</div>
                     {isEmergency ? (
                        <div className="action-value-box emergency">Notfall</div>
                    ) : (
                        <Dropdown options={Object.values(Priority)} selected={ticket.priority} onChange={handlePriorityChange} className={priorityClasses[ticket.priority]} />
                    )}
                </div>
                <div className="action-item">
                    <div className="action-label">Status</div>
                    <Dropdown options={Object.values(Status).filter(s => s !== Status.Ueberfaellig)} selected={ticket.status} onChange={handleStatusChange} />
                </div>
                 <div className="action-item">
                    <div className="action-label">Bearbeiter</div>
                    <div className="custom-dropdown">
                        <span>
                            {ticket.technician === 'N/A' ? 'Zuweisen' : displayNameShort(ticket.technician)}
                        </span>{' '}
                        <ChevronDownIcon />
                        <select value={ticket.technician} onChange={handleTechnicianSelectChange}>
                             {technicianOptions.map((opt) => {
                                 if (opt === 'N/A') {
                                     return (
                                         <option key={opt} value={opt}>
                                             Nicht zugewiesen
                                         </option>
                                     );
                                 }
                                 const u = technicians.find((t) => t.name === opt);
                                 const absent = u?.availability.status === AvailabilityStatus.OnLeave;
                                 return (
                                     <option key={opt} value={opt} disabled={!!absent}>
                                         {displayNameShort(opt)}
                                         {absent ? ' (Abwesend)' : ''}
                                     </option>
                                 );
                             })}
                        </select>
                    </div>
                </div>
                <div className="action-item">
                    <div className="action-label">Ticket</div>
                    <button className="details-btn" onClick={() => onSelectTicket(ticket)}>
                        {ticket.id}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TicketCard;