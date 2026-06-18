import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Ticket, Status, Priority, GroupableKey } from '../types';
import { SortAscendingIcon } from './icons/SortAscendingIcon';
import { SortDescendingIcon } from './icons/SortDescendingIcon';
import { statusColorMap, statusBgColorMap, statusBorderColorMap } from '../constants';
import { ClockIcon } from './icons/ClockIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { displayNameShort } from '../utils/displayNames';

interface TicketTableViewProps {
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicketIds: string[];
  setSelectedTicketIds: (ids: string[]) => void;
  selectedTicket: Ticket | null;
  groupBy: GroupableKey | 'none';
  showRoutineSection?: boolean;
}

type SortableKeys = keyof Ticket | 'entryDate' | 'dueDate' | 'location';

interface FlatTickets {
  type: 'flat';
  data: Ticket[];
}

interface GroupedTickets {
  type: 'grouped';
  data: [string, Ticket[]][];
}

type ProcessedTickets = FlatTickets | GroupedTickets;

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


const getTicketSortPriority = (ticket: Ticket): number => {
    if (ticket.is_emergency) return 0; // Highest priority
    if (ticket.status === Status.Ueberfaellig) return 1; // Second highest
    return 2; // Normal
};

const ExclamationTriangleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="20" height="20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
);

const statusPillStyle: Record<string, React.CSSProperties> = {
    [Status.Offen]:        { background: '#F1F0EC', color: '#5F5E5A', borderColor: '#D3D1C7' },
    [Status.InArbeit]:     { background: '#E6F1FB', color: '#185FA5', borderColor: '#B5D4F4' },
    [Status.Ueberfaellig]: { background: '#FCEBEB', color: '#A32D2D', borderColor: '#F7C1C1' },
    [Status.Abgeschlossen]:{ background: '#EAF3DE', color: '#3B6D11', borderColor: '#C0DD97' },
};

const StatusPill: React.FC<{ status: Status }> = ({ status }) => (
    <span className="status-pill" style={statusPillStyle[status] ?? statusPillStyle[Status.Offen]}>
        {status}
    </span>
);


const PriorityPill: React.FC<{ priority: Priority }> = ({ priority }) => {
    const priorityClasses = {
        [Priority.Hoch]: 'priority-high',
        [Priority.Mittel]: 'priority-medium',
        [Priority.Niedrig]: 'priority-low',
    };
    return <span className={`priority-pill ${priorityClasses[priority]}`}>{priority}</span>;
};

const technicianCell = (name: string) => (name === 'N/A' ? 'N/A' : displayNameShort(name));


const TicketTableView: React.FC<TicketTableViewProps> = ({ tickets, onSelectTicket, selectedTicketIds, setSelectedTicketIds, selectedTicket, groupBy, showRoutineSection = false }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'entryDate', direction: 'descending' });
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
    const routineTickets = useMemo(() => tickets.filter(t => t.origin === 'routine'), [tickets]);
    const mainTickets = useMemo(() => tickets.filter(t => t.origin !== 'routine'), [tickets]);
    const showingOnlyRoutineTickets = tickets.length > 0 && routineTickets.length === tickets.length;

    useEffect(() => {
        const numSelected = selectedTicketIds.length;
        const numTickets = mainTickets.length;
        if (selectAllCheckboxRef.current) {
            if (numSelected === 0) {
                selectAllCheckboxRef.current.checked = false;
                selectAllCheckboxRef.current.indeterminate = false;
            } else if (numTickets > 0 && numSelected === numTickets) {
                selectAllCheckboxRef.current.checked = true;
                selectAllCheckboxRef.current.indeterminate = false;
            } else {
                selectAllCheckboxRef.current.checked = false;
                selectAllCheckboxRef.current.indeterminate = true;
            }
        }
    }, [selectedTicketIds, mainTickets]);

    const processedTickets: ProcessedTickets = useMemo(() => {
        let sortableItems = [...mainTickets];
        
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const priorityA = getTicketSortPriority(a);
                const priorityB = getTicketSortPriority(b);
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }

                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (sortConfig.key === 'entryDate' || sortConfig.key === 'dueDate') {
                    const dateA = (aValue as string).split('.').reverse().join('-');
                    const dateB = (bValue as string).split('.').reverse().join('-');
                    if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                }
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        
        if (groupBy === 'none') {
            return { type: 'flat', data: sortableItems };
        }

        const groups = sortableItems.reduce((acc, ticket) => {
            const key = String(ticket[groupBy as GroupableKey]);
            if (!acc[key]) acc[key] = [];
            acc[key].push(ticket);
            return acc;
        }, {} as Record<string, Ticket[]>);

        const sortedGroups = Object.entries(groups).sort(([keyA], [keyB]) => {
            if (groupBy === 'priority') {
                const order = { [Priority.Hoch]: 1, [Priority.Mittel]: 2, [Priority.Niedrig]: 3 };
                return (order[keyA as Priority] || 99) - (order[keyB as Priority] || 99);
            }
            if (groupBy === 'status') {
                const order = { [Status.Ueberfaellig]: 1, [Status.InArbeit]: 2, [Status.Offen]: 3, [Status.Abgeschlossen]: 4 };
                return (order[keyA as Status] || 99) - (order[keyB as Status] || 99);
            }
            return keyA.localeCompare(keyB);
        });

        return { type: 'grouped', data: sortedGroups };
    }, [mainTickets, sortConfig, groupBy]);


    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        if (sortConfig.direction === 'ascending') return <SortAscendingIcon />;
        return <SortDescendingIcon />;
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedTicketIds(mainTickets.map(t => t.id));
        } else {
            setSelectedTicketIds([]);
        }
    };

    const handleSelectOne = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
        if (e.target.checked) {
            setSelectedTicketIds([...selectedTicketIds, id]);
        } else {
            setSelectedTicketIds(selectedTicketIds.filter(ticketId => ticketId !== id));
        }
    };
    
    const getGroupHeaderLabel = (key: GroupableKey, groupName: string) => {
        const labels: Record<string, string> = {
            status: 'Status',
            technician: 'Bearbeiter',
            priority: 'Priorität',
            area: 'Standort',
        };
        const displayName =
            groupName === 'N/A' ? 'Nicht zugewiesen' : key === 'technician' ? displayNameShort(groupName) : groupName;
        return `${labels[key] || 'Gruppe'}: ${displayName}`;
    };

    const SortableHeader: React.FC<{ sortKey: SortableKeys; children: React.ReactNode }> = ({ sortKey, children }) => (
        <th onClick={() => requestSort(sortKey)}>
            <div className="sortable-header">
                {children}
                <span className="sort-icon">{getSortIcon(sortKey)}</span>
            </div>
        </th>
    );

     const renderTicketRow = (ticket: Ticket) => {
         const isEmergency = !!ticket.is_emergency;
         const isTicketStagnating = isStagnating(ticket);
         const rowClasses = [
            (selectedTicketIds.includes(ticket.id) || selectedTicket?.id === ticket.id) ? 'selected' : '',
            isEmergency ? 'urgent-alert' : '',
         ].filter(Boolean).join(' ');

        return (
            <tr key={ticket.id} onClick={() => onSelectTicket(ticket)} className={rowClasses}>
                <td className="checkbox-cell" onClick={e => e.stopPropagation()}>
                   <input type="checkbox" checked={selectedTicketIds.includes(ticket.id)} onChange={e => handleSelectOne(e, ticket.id)} />
                </td>
                <td>
                  <div className="ticket-id-cell">
                    {ticket.id}
                    {ticket.hasNewNoteFromReporter && <span className="new-note-indicator" title="Neue Nachricht vom Melder"></span>}
                  </div>
                </td>
                <td className="icons-cell">
                    <div className="icons-cell-content">
                        {ticket.is_reopened && (
                            <span title="Ticket wurde vom Melder wiedereröffnet" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px',
                                borderRadius: 999, background: '#fff3e0', color: '#e65100',
                                border: '1.5px solid #ff9800', whiteSpace: 'nowrap', lineHeight: 1.4,
                            }}>↩ Wiedereröffnet</span>
                        )}
                        {isTicketStagnating && <span className="stagnating-icon" title="Ticket stagniert (> 5 Tage keine Notiz)"><ClockIcon /></span>}
                        {isEmergency && <span className="urgent-icon" title="Notfall"><ExclamationTriangleIcon /></span>}
                    </div>
                </td>
                <td>
                    <div className="ticket-title-cell">
                        <div className="ticket-title">{ticket.title}</div>
                        <div className="reporter-name">{ticket.reporter}</div>
                    </div>
                </td>
                <td style={{maxWidth: 180}}>
                    <div style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ticket.area}</div>
                    <div style={{fontSize:'0.78rem', color:'var(--text-muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ticket.location}</div>
                </td>
                <td>{technicianCell(ticket.technician)}</td>
                <td><StatusPill status={ticket.status} /></td>
                <td>
                    {isEmergency ? (
                        <span className="priority-pill priority-high">Notfall</span>
                    ) : (
                        <PriorityPill priority={ticket.priority} />
                    )}
                </td>
                <td style={{whiteSpace:'nowrap', verticalAlign:'top'}}>
                    <div style={{fontWeight:500, color:'var(--text-primary)'}}>{ticket.entryDate.slice(0,5)}.</div>
                    {ticket.entryTime && <div style={{fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.25rem', letterSpacing:'0.02em'}}>{ticket.entryTime}</div>}
                </td>
                <td style={{verticalAlign:'top'}}>
                    <div style={{fontWeight:500, color:'var(--text-primary)'}}>{ticket.dueDate.slice(0,5)}.</div>
                </td>
            </tr>
        );
     }

    const noTicketsRow = (
         <tr>
            <td colSpan={10} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>
                Keine Tickets für die aktuellen Filter gefunden.
            </td>
         </tr>
    );

    const renderTableBody = () => {
        switch (processedTickets.type) {
            case 'flat': {
                const ticketsData = processedTickets.data;
                if (ticketsData.length === 0) {
                    return <tbody>{noTicketsRow}</tbody>;
                }
                return <tbody>{ticketsData.map(renderTicketRow)}</tbody>;
            }
            case 'grouped': {
                const groupedData = processedTickets.data;
                if (groupedData.length === 0) {
                    return <tbody>{noTicketsRow}</tbody>;
                }
                return (
                    <tbody>
                        {groupedData.flatMap(([groupName, groupTickets]) => [
                            <tr key={`header-${groupName}`} className="group-header">
                                <td colSpan={10}>
                                    <div className="group-header-content">
                                        {getGroupHeaderLabel(groupBy as GroupableKey, groupName)}
                                        <span className="group-count">{groupTickets.length} Ticket{groupTickets.length !== 1 ? 's' : ''}</span>
                                    </div>
                                </td>
                            </tr>,
                            ...groupTickets.map(renderTicketRow)
                        ])}
                    </tbody>
                );
            }
        }
    };

    const renderRoutineTableBody = () => {
        if (routineTickets.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td colSpan={10} style={{textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)'}}>
                            Keine Serienaufträge für die aktuellen Filter gefunden.
                        </td>
                    </tr>
                </tbody>
            );
        }
        return <tbody>{routineTickets.map(renderTicketRow)}</tbody>;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!showRoutineSection && !showingOnlyRoutineTickets && (
        <div className="table-view-container">
            <style>{`
                 @keyframes pulse-border {
                    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.8); }
                    70% { box-shadow: 0 0 0 8px rgba(220, 53, 69, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
                }
                .table-view-container {
                  background-color: var(--bg-secondary);
                  border: 1px solid var(--border);
                  border-radius: 8px;
                  margin-top: 1.5rem;
                  overflow-x: auto;
                }
                .ticket-table {
                  width: 100%;
                  border-collapse: collapse;
                  text-align: left;
                }
                .ticket-table th, .ticket-table td {
                  padding: 1rem 1rem;
                  border-bottom: 1px solid var(--border);
                  vertical-align: middle;
                  white-space: nowrap;
                }
                .ticket-table th.checkbox-cell, .ticket-table td.checkbox-cell {
                    padding-right: 0.5rem;
                    width: 1%;
                }
                .ticket-table th.icons-header-cell,
                .ticket-table td.icons-cell {
                    width: 1%;
                    padding: 1rem 0.5rem;
                    text-align: center;
                    vertical-align: middle;
                }
                .icons-cell-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                }
                .stagnating-icon {
                    color: var(--accent-primary);
                    width: 20px;
                    height: 20px;
                }

                .ticket-table th {
                  color: var(--text-muted);
                  font-weight: 500;
                  font-size: 0.875rem;
                  background-color: var(--bg-primary);
                  cursor: pointer;
                  user-select: none;
                }
                .ticket-table th:hover {
                    background-color: var(--bg-tertiary);
                }
                .sortable-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .sort-icon svg {
                    width: 14px;
                    height: 14px;
                    color: var(--text-primary);
                }
                .ticket-table td {
                  color: var(--text-secondary);
                  font-size: 0.9rem;
                }
                .ticket-table tbody tr:last-child td {
                  border-bottom: none;
                }
                .ticket-table tbody tr {
                  cursor: pointer;
                  transition: background-color: 0.2s ease;
                }
                 .ticket-table tbody tr.selected {
                    background-color: var(--border);
                }
                .ticket-table tbody tr.selected:hover {
                    background-color: var(--border-active);
                }
                .ticket-table tbody tr.urgent-alert {
                    animation: pulse-border 1.5s infinite;
                    background-color: rgba(220, 53, 69, 0.05);
                    box-shadow: inset 4px 0 0 0 var(--accent-danger);
                }
                .ticket-table tbody tr.urgent-alert:hover {
                    background-color: rgba(220, 53, 69, 0.1);
                }
                .ticket-table tbody tr:not(.selected):not(.urgent-alert) {
                    box-shadow: inset 4px 0 0 0 transparent;
                }
                .ticket-table tbody tr:not(.selected):hover {
                  background-color: var(--bg-tertiary);
                }
                 .ticket-table tbody tr:not(.urgent-alert) {
                     box-shadow: none;
                 }
                .ticket-id-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .urgent-icon { color: var(--accent-danger); }
                .ticket-title-cell {
                    /* Icon moved to area column, flex properties removed */
                }
                .area-cell {
                    display: flex;
                    align-items: center;
                    gap: 0rem;
                }
                .ticket-title {
                    font-weight: 500;
                    color: var(--text-primary);
                    max-width: 260px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .ticket-title-cell { max-width: 280px; }
                .group-header td {
                    background-color: var(--bg-primary);
                    font-weight: 600;
                    color: var(--text-primary);
                    padding-top: 1.5rem;
                    padding-bottom: 0.75rem;
                    font-size: 1rem;
                    border-top: 1px solid var(--border-active);
                    border-bottom: 1px solid var(--border-active);
                    cursor: default;
                }
                .group-header:first-child td {
                    border-top: none;
                }
                .group-header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .group-count {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    background-color: var(--bg-tertiary);
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                }
                .ticket-table input[type="checkbox"] {
                  appearance: none;
                  -webkit-appearance: none;
                  width: 18px;
                  height: 18px;
                  background-color: var(--bg-secondary);
                  border: 1px solid var(--border-active);
                  border-radius: 4px;
                  cursor: pointer;
                  display: inline-block;
                  position: relative;
                  vertical-align: middle;
                  transition: background-color 0.2s ease, border-color 0.2s ease;
                }
                .ticket-table input[type="checkbox"]:hover {
                  border-color: var(--accent-primary);
                  background-color: var(--bg-tertiary);
                }
                .ticket-table input[type="checkbox"]:focus-visible {
                  outline: 2px solid var(--accent-primary);
                  outline-offset: 1px;
                }
                .ticket-table input[type="checkbox"]:checked {
                  background-color: var(--accent-primary);
                  border-color: var(--accent-primary);
                }
                .ticket-table input[type="checkbox"]:checked::after {
                  content: '';
                  position: absolute;
                  left: 5px;
                  top: 1px;
                  width: 5px;
                  height: 10px;
                  border: solid white;
                  border-width: 0 2px 2px 0;
                  transform: rotate(45deg);
                }
                .ticket-table input[type="checkbox"]:indeterminate {
                    background-color: var(--accent-primary);
                    border-color: var(--accent-primary);
                }
                .ticket-table input[type="checkbox"]:indeterminate::after {
                    content: '';
                    position: absolute;
                    left: 4px;
                    top: 7px;
                    width: 8px;
                    height: 2px;
                    background-color: white;
                }
                .status-pill, .priority-pill {
                    padding: 0.18rem 0.65rem;
                    border-radius: 999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    display: inline-block;
                    border: 1.5px solid transparent;
                    text-align: center;
                    white-space: nowrap;
                }
                .priority-pill { min-width: 72px; box-sizing: border-box; }
                .priority-pill.priority-high { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
                .priority-pill.priority-medium { background: #FAEEDA; color: #854F0B; border-color: #FAC775; }
                .priority-pill.priority-low { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
                .reporter-name { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
                .standort-cell { display: flex; flex-direction: column; gap: 1px; }
                .standort-main { color: var(--text-secondary); }
                .standort-sub { font-size: 0.78rem; color: var(--text-muted); }
            `}</style>
            <table className="ticket-table">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                        <input type="checkbox" ref={selectAllCheckboxRef} onChange={handleSelectAll} />
                    </th>
                    <SortableHeader sortKey="id">Ticket</SortableHeader>
                    <th className="icons-header-cell"></th>
                    <SortableHeader sortKey="title">Betreff</SortableHeader>
                    <SortableHeader sortKey="area">Standort</SortableHeader>
                    <SortableHeader sortKey="technician">Bearbeiter</SortableHeader>
                    <SortableHeader sortKey="status">Status</SortableHeader>
                    <SortableHeader sortKey="priority">Priorität</SortableHeader>
                    <SortableHeader sortKey="entryDate">Eingang</SortableHeader>
                    <SortableHeader sortKey="dueDate">Fällig bis</SortableHeader>
                  </tr>
                </thead>
                {renderTableBody()}
            </table>
        </div>
        )}

        {showRoutineSection && (
            <div className="table-view-container">
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong>Serienaufträge</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {routineTickets.length} Eintrag{routineTickets.length !== 1 ? 'e' : ''}
                    </span>
                </div>
                <table className="ticket-table">
                    <thead>
                        <tr>
                            <th className="checkbox-cell"></th>
                            <th>ID</th>
                            <th className="icons-header-cell"></th>
                            <th><SortableHeader sortKey="title">Titel</SortableHeader></th>
                            <th><SortableHeader sortKey="area">Standort</SortableHeader></th>
                            <th><SortableHeader sortKey="technician">Zugewiesen</SortableHeader></th>
                            <th><SortableHeader sortKey="status">Status</SortableHeader></th>
                            <th><SortableHeader sortKey="priority">Prio</SortableHeader></th>
                            <th><SortableHeader sortKey="entryDate">Eingang</SortableHeader></th>
                            <th><SortableHeader sortKey="dueDate">Fällig</SortableHeader></th>
                        </tr>
                    </thead>
                    {renderRoutineTableBody()}
                </table>
            </div>
        )}
        </div>
    );
};

export default TicketTableView;