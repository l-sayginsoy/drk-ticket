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

    // Avatar-Farbe: auto=blau, manuell=orange
    const isAutoAssigned = ticket.autoAssigned === true || (ticket.ticketType === 'reactive' && ticket.autoAssigned !== false);
    const avColor = isAssigned
        ? (isAutoAssigned
            ? { bg: '#B5D4F4', text: '#185FA5' }   // blau
            : { bg: '#FAC775', text: '#854F0B' })   // orange
        : { bg: 'transparent', text: '#E24B4A' };

    const isOverdue = ticket.status === Status.Ueberfaellig;

    const statusBorderColor: Record<string, string> = {
        [Status.Offen]:        '#888780',
        [Status.InArbeit]:     '#378ADD',
        [Status.Ueberfaellig]: '#E24B4A',
        [Status.Abgeschlossen]:'#639922',
    };

    const priorityPillClass = isEmergency ? 'pill-p-hoch'
        : ticket.priority === Priority.Hoch   ? 'pill-p-hoch'
        : ticket.priority === Priority.Mittel ? 'pill-p-mittel'
        : 'pill-p-niedrig';

    const statusPillClass = ticket.status === Status.InArbeit     ? 'pill-s-inarbeit'
        : ticket.status === Status.Ueberfaellig ? 'pill-s-ueberfaellig'
        : ticket.status === Status.Abgeschlossen ? 'pill-s-done'
        : 'pill-s-offen';

    const cardClasses = `ticket-card ${selectedTicket?.id === ticket.id ? 'selected' : ''} ${ticket.status === Status.Abgeschlossen ? 'status-done' : ''} ${isEmergency ? 'urgent-alert' : ''}`;

    return (
        <div
            className={cardClasses}
            style={{ borderLeftColor: statusBorderColor[ticket.status] ?? '#888780', cursor: 'grab' }}
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <style>{`
                @keyframes pulse-border {
                    0%   { box-shadow: 0 0 0 0   rgba(226,75,74,0.7); }
                    70%  { box-shadow: 0 0 0 8px rgba(226,75,74,0);   }
                    100% { box-shadow: 0 0 0 0   rgba(226,75,74,0);   }
                }
                .ticket-card {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    margin-bottom: 8px;
                    border: 0.5px solid #E5E5E5;
                    border-left-width: 3px;
                    border-left-style: solid;
                    overflow: hidden;
                    transition: transform 0.15s ease;
                    position: relative;
                }
                [data-theme="dark"] .ticket-card { border-color: var(--border); }
                .ticket-card:hover { transform: translateY(-1px); }
                .ticket-card.urgent-alert { animation: pulse-border 1.5s infinite; }
                .ticket-card.selected { outline: 2px solid #378ADD; outline-offset: 1px; }

                /* ── Body ── */
                .card-body { padding: 12px 14px 12px; }
                .card-row1 { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 3px; }
                .card-title { font-size: 13px; font-weight: 500; color: var(--text-primary); flex: 1; line-height: 1.35; margin: 0; }
                .card-icons { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
                .card-tnum { font-size: 10px; color: #999; white-space: nowrap; margin-top: 2px; }
                .urgent-icon { color: #E24B4A; }
                .stagnating-icon { color: #378ADD; }

                .card-loc { font-size: 12px; color: #555; font-weight: 500; margin-bottom: 3px; }
                .card-who { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #666; margin-bottom: 11px; flex-wrap: nowrap; }
                .card-who i { font-size: 11px; color: #999; flex-shrink: 0; }

                /* ── Pills ── */
                .card-pills { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
                .pill-cell { display: flex; flex-direction: column; }
                .pill-lbl { font-size: 9.5px; color: #999; letter-spacing: 0; margin-bottom: 3px; text-align: center; }
                .pill {
                    display: flex; align-items: center; justify-content: center; gap: 3px;
                    padding: 4px 8px; border-radius: 20px; font-size: 10.5px;
                    border: 0.5px solid; width: 100%; box-sizing: border-box;
                    position: relative; cursor: pointer; white-space: nowrap;
                }
                .pill i { font-size: 10px; flex-shrink: 0; }
                .pill select, .pill input[type="date"] { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }

                .pill-p-hoch     { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
                .pill-p-mittel   { background: #FAEEDA; color: #854F0B; border-color: #FAC775; }
                .pill-p-niedrig  { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
                .pill-s-inarbeit     { background: #E6F1FB; color: #185FA5; border-color: #B5D4F4; }
                .pill-s-offen        { background: #F1F0EC; color: #5F5E5A; border-color: #D3D1C7; }
                .pill-s-ueberfaellig { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
                .pill-s-done         { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
                .pill-due            { background: #F1F0EC; color: #5F5E5A; border-color: #D3D1C7; }
                .pill-due.overdue    { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }

                /* ── Footer ── */
                .card-footer {
                    background: #F8F8F7;
                    border-top: 0.5px solid #E5E5E5;
                    padding: 8px 14px;
                    display: flex; align-items: center;
                    cursor: pointer; transition: background 0.12s;
                }
                [data-theme="dark"] .card-footer { background: var(--bg-tertiary); border-top-color: var(--border); }
                .card-footer:hover { background: #F1F0EC; }
                [data-theme="dark"] .card-footer:hover { background: var(--border); }

                .assignee-chip {
                    display: inline-flex; align-items: center; gap: 5px;
                    font-size: 11px; font-weight: 500; color: var(--text-primary);
                    position: relative; cursor: pointer;
                }
                .assignee-chip select { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
                .assignee-chip .chev { font-size: 10px; color: #999; }

                .av {
                    width: 22px; height: 22px; border-radius: 50%;
                    display: inline-flex; align-items: center; justify-content: center;
                    font-size: 9px; font-weight: 700; flex-shrink: 0;
                }
                .av-un {
                    background: transparent; border: 1.5px dashed #E24B4A; color: #E24B4A;
                }
                .av-un i { font-size: 10px; }

                .footer-detail-btn {
                    margin-left: auto; width: 28px; height: 28px; border-radius: 50%;
                    background: #fff; border: 0.5px solid #E5E5E5;
                    display: flex; align-items: center; justify-content: center;
                    color: #185FA5; pointer-events: none; flex-shrink: 0;
                    transition: border-color 0.12s;
                }
                [data-theme="dark"] .footer-detail-btn { background: var(--bg-secondary); border-color: var(--border); }
                .card-footer:hover .footer-detail-btn { border-color: #378ADD; }
                .footer-detail-btn i { font-size: 14px; }

                .footer-msg-pill {
                    margin-left: auto;
                    background: #E24B4A; color: #fff;
                    border-radius: 20px; padding: 5px 10px;
                    font-size: 11px; font-weight: 500;
                    display: inline-flex; align-items: center; gap: 4px;
                    pointer-events: none; flex-shrink: 0;
                }
                .footer-msg-pill i { font-size: 11px; }
            `}</style>

            <div className="card-body">
                {/* Zeile 1: Titel + Badges + Ticketnummer */}
                <div className="card-row1">
                    <h3 className="card-title">{ticket.title}</h3>
                    <div className="card-icons">
                        {ticket.is_reopened && (
                            <span title="Wiedereröffnet" style={{ display:'inline-flex', alignItems:'center', fontSize:'0.6rem', fontWeight:700, padding:'1px 4px', borderRadius:999, background:'#fff3e0', color:'#e65100', border:'0.5px solid #ff9800' }}>↩</span>
                        )}
                        {isTicketStagnating && <span title="Ticket stagniert"><ClockIcon className="stagnating-icon" width="13" height="13" /></span>}
                        {isEmergency && <span className="urgent-icon" title="Notfall"><ExclamationTriangleIcon width="13" height="13" /></span>}
                        {ticket.hasNewNoteFromReporter && <span className="new-note-indicator" title="Neue Nachricht vom Melder" />}
                        <span className="card-tnum">#{ticket.id}</span>
                    </div>
                </div>

                {/* Zeile 2: Standort */}
                <div className="card-loc">{ticket.area} · {ticket.location}</div>

                {/* Zeile 3: Melder + Datum + Uhrzeit */}
                <div className="card-who">
                    <i className="ti ti-user" aria-hidden="true" />
                    <span>{ticket.reporter} · {ticket.entryDate.slice(0,5)}.{ticket.entryTime ? ` · ${ticket.entryTime}` : ''}</span>
                </div>

                {/* Zeile 4: Pills */}
                <div className="card-pills" onClick={e => e.stopPropagation()}>
                    <div className="pill-cell">
                        <div className="pill-lbl">Priorität</div>
                        {isEmergency ? (
                            <div className="pill pill-p-hoch">Notfall</div>
                        ) : (
                            <div className={`pill ${priorityPillClass}`}>
                                {ticket.priority}
                                <select value={ticket.priority} onChange={handlePriorityChange}>
                                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="pill-cell">
                        <div className="pill-lbl">Fällig bis</div>
                        <div className={`pill pill-due${isOverdue ? ' overdue' : ''}`}>
                            <i className="ti ti-calendar-due" aria-hidden="true" />
                            {ticket.dueDate.slice(0,5)}.
                            <input type="date" value={toInputDate(ticket.dueDate)} onChange={handleDueDateChange} />
                        </div>
                    </div>
                    <div className="pill-cell">
                        <div className="pill-lbl">Status</div>
                        <div className={`pill ${statusPillClass}`}>
                            {ticket.status}
                            <select value={ticket.status} onChange={handleStatusChange}>
                                {Object.values(Status).filter(s => s !== Status.Ueberfaellig).map(s => (
                                    <option key={s} value={s}>{s === Status.Abgeschlossen ? 'Abschließen' : s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer: klickbar → Detailansicht */}
            <div className="card-footer" onClick={() => onSelectTicket(ticket)}>
                <div className="assignee-chip" onClick={e => e.stopPropagation()}>
                    {isAssigned
                        ? <span className="av" style={{ background: avColor.bg, color: avColor.text }}>{initials}</span>
                        : <span className="av av-un"><i className="ti ti-plus" style={{ fontSize: 10 }} aria-hidden="true" /></span>
                    }
                    <span>{isAssigned ? displayNameShort(ticket.technician) : 'Zuweisen'}</span>
                    <i className="ti ti-chevron-down chev" aria-hidden="true" />
                    <select value={ticket.technician} onChange={handleTechnicianSelectChange}>
                        {technicianOptions.map((opt) => {
                            if (opt === 'N/A') return <option key={opt} value={opt}>Nicht zugewiesen</option>;
                            const u = technicians.find((t) => t.name === opt);
                            const absent = u?.availability.status === AvailabilityStatus.OnLeave;
                            return <option key={opt} value={opt} disabled={!!absent}>{displayNameShort(opt)}{absent ? ' (Abwesend)' : ''}</option>;
                        })}
                    </select>
                </div>
                {ticket.hasNewNoteFromReporter ? (
                    <div className="footer-msg-pill">
                        <i className="ti ti-message" aria-hidden="true" />
                        <span>Neue Nachricht</span>
                    </div>
                ) : (
                    <div className="footer-detail-btn">
                        <i className="ti ti-chevron-right" aria-hidden="true" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TicketCard;