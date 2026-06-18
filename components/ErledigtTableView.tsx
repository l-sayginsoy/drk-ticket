import React, { useState, useMemo, useEffect } from 'react';
import { Ticket, Priority, Role } from '../types';
import { SortAscendingIcon } from './icons/SortAscendingIcon';
import { SortDescendingIcon } from './icons/SortDescendingIcon';
import { TrashIcon } from './icons/TrashIcon';
import { displayNameShort } from '../utils/displayNames';
import DeleteTicketDialog from './DeleteTicketDialog';

interface ErledigtTableViewProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicket: Ticket | null;
  onDeleteTicket: (ticketId: string) => void;
  userRole?: Role | null;
  // Neu:
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onReload: (month: number, year: number) => void;
  isLoading?: boolean;
}

type SortableKeys = keyof Ticket | 'entryDate' | 'dueDate' | 'completionDate';

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const PriorityPill: React.FC<{ priority: Priority }> = ({ priority }) => {
  const priorityClasses = {
    [Priority.Hoch]: 'priority-high',
    [Priority.Mittel]: 'priority-medium',
    [Priority.Niedrig]: 'priority-low',
  };
  return <span className={`priority-pill ${priorityClasses[priority]}`}>{priority}</span>;
};

const technicianCell = (name: string) => (name === 'N/A' ? 'N/A' : displayNameShort(name));

const ErledigtTableView: React.FC<ErledigtTableViewProps> = ({
  tickets,
  onSelectTicket,
  selectedTicket,
  onDeleteTicket,
  userRole,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onReload,
  isLoading,
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({
    key: 'completionDate',
    direction: 'descending',
  });
  const [deleteDialogTicket, setDeleteDialogTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    setDeleteDialogTicket(null);
  }, [tickets]);

  const sortedTickets = useMemo(() => {
    const sortableItems = [...tickets];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (sortConfig.key === 'entryDate' || sortConfig.key === 'dueDate' || sortConfig.key === 'completionDate') {
          const dateAStr = aValue as string | undefined;
          const dateBStr = bValue as string | undefined;

          if (!dateAStr) return 1;
          if (!dateBStr) return -1;

          const dateA = dateAStr.split('.').reverse().join('-');
          const dateB = dateBStr.split('.').reverse().join('-');
          if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;

          // Gleiches Datum → Uhrzeit als Tiebreaker
          if (sortConfig.key === 'completionDate') {
            const timeA = a.completionTime || '00:00';
            const timeB = b.completionTime || '00:00';
            if (timeA < timeB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (timeA > timeB) return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [tickets, sortConfig]);

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

  const SortableHeader: React.FC<{ sortKey: SortableKeys; children: React.ReactNode }> = ({ sortKey, children }) => (
    <th onClick={() => requestSort(sortKey)}>
      <div className="sortable-header">
        {children}
        <span className="sort-icon">{getSortIcon(sortKey)}</span>
      </div>
    </th>
  );

  const handleDeleteClick = (e: React.MouseEvent, ticket: Ticket) => {
    e.stopPropagation();
    setDeleteDialogTicket(ticket);
  };

  const handleDeleteConfirm = () => {
    if (!deleteDialogTicket) return;
    onDeleteTicket(deleteDialogTicket.id);
    setDeleteDialogTicket(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogTicket(null);
  };

  return (
    <div className="erledigt-page">
      <DeleteTicketDialog
        open={!!deleteDialogTicket}
        ticketId={deleteDialogTicket?.id ?? ''}
        ticketTitle={deleteDialogTicket?.title ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      <style>{`
                .erledigt-page {
                  display: flex;
                  flex-direction: column;
                }
                .erledigt-month-nav {
                  display: flex;
                  align-items: center;
                  gap: 0.75rem;
                  padding: 0.75rem 0 1rem;
                  flex-wrap: wrap;
                }
                .erledigt-month-nav select {
                  border: 1px solid var(--border);
                  border-radius: 20px;
                  padding: 0.35rem 1.75rem 0.35rem 0.85rem;
                  font-size: 0.875rem;
                  background: var(--bg-primary);
                  color: var(--text-primary);
                  cursor: pointer;
                  appearance: none;
                  -webkit-appearance: none;
                }
                .erledigt-loading {
                  font-size: 0.85rem;
                  color: var(--text-muted);
                }
                .erledigt-count {
                  font-size: 0.85rem;
                  color: var(--text-muted);
                  margin-left: auto;
                }
                .table-view-container {
                  background-color: var(--bg-secondary);
                  border: 1px solid var(--border);
                  border-radius: 8px;
                  margin-top: 0;
                  overflow-x: auto;
                }
                .ticket-table { width: 100%; border-collapse: collapse; text-align: left; }
                .ticket-table th, .ticket-table td { padding: 1rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; white-space: nowrap; }
                .ticket-table th { color: var(--text-muted); font-weight: 500; font-size: 0.875rem; background-color: var(--bg-primary); cursor: pointer; user-select: none; }
                .ticket-table th:hover { background-color: var(--bg-tertiary); }
                .sortable-header { display: flex; align-items: center; gap: 0.5rem; }
                .sort-icon svg { width: 14px; height: 14px; color: var(--text-primary); }
                .ticket-table td { color: var(--text-secondary); font-size: 0.9rem; }
                .ticket-table td.completion-cell {
                    white-space: normal;
                    vertical-align: top;
                    text-align: left;
                }
                .completion-stack {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    text-align: left;
                }
                .completion-date-line {
                    font-weight: 500;
                    color: var(--text-primary);
                    text-align: left;
                }
                .completion-time-line {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 400;
                    color: var(--text-muted);
                    margin-top: 0.25rem;
                    letter-spacing: 0.02em;
                    text-align: left;
                }
                .ticket-table tbody tr:last-child td { border-bottom: none; }
                .ticket-table tbody tr { cursor: pointer; transition: background-color 0.2s ease; }
                .ticket-table tbody tr.selected { background-color: var(--border); }
                .ticket-table tbody tr.selected:hover { background-color: var(--border-active); }
                .ticket-table tbody tr:not(.selected):hover { background-color: var(--bg-tertiary); }
                .ticket-title { font-weight: 500; color: var(--text-primary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .ticket-title-cell { max-width: 280px; }
                .reporter-name { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
                .priority-pill { padding: 0.18rem 0.65rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; display: inline-block; min-width: 72px; box-sizing: border-box; border: 1.5px solid transparent; text-align: center; white-space: nowrap; }
                .priority-pill.priority-high { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
                .priority-pill.priority-medium { background: #FAEEDA; color: #854F0B; border-color: #FAC775; }
                .priority-pill.priority-low { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
                .actions-cell { text-align: center; }
                .btn-delete {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-muted);
                    padding: 0.5rem;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: var(--transition-smooth);
                }
                .btn-delete:hover {
                    color: var(--accent-danger);
                    background-color: rgba(220, 53, 69, 0.1);
                }
                .btn-delete svg {
                    width: 18px;
                    height: 18px;
                }
            `}</style>
      <div className="erledigt-month-nav">
        <select value={selectedYear} onChange={e => { const y = Number(e.target.value); onYearChange(y); onReload(selectedMonth, y); }}>
          {Array.from({ length: new Date().getFullYear() - 2025 }, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={selectedMonth} onChange={e => { const m = Number(e.target.value); onMonthChange(m); onReload(m, selectedYear); }}>
          {MONTHS.map((name, i) => (
            <option key={i+1} value={i+1}>{name}</option>
          ))}
        </select>
        {isLoading && <span className="erledigt-loading">Lade...</span>}
        <span className="erledigt-count">{tickets.length} Ticket{tickets.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="table-view-container">
        <table className="ticket-table">
          <thead>
            <tr>
              <SortableHeader sortKey="id">Ticket</SortableHeader>
              <SortableHeader sortKey="title">Betreff</SortableHeader>
              <SortableHeader sortKey="area">Standort</SortableHeader>
              <SortableHeader sortKey="technician">Bearbeiter</SortableHeader>
              <SortableHeader sortKey="priority">Priorität</SortableHeader>
              <SortableHeader sortKey="entryDate">Eingang</SortableHeader>
              <SortableHeader sortKey="dueDate">Fällig bis</SortableHeader>
              <SortableHeader sortKey="completionDate">Abgeschlossen am</SortableHeader>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedTickets.length > 0 ? (
              sortedTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  className={selectedTicket?.id === ticket.id ? 'selected' : ''}
                >
                  <td>{ticket.id}</td>
                  <td className="ticket-title-cell">
                    <div className="ticket-title">{ticket.title}</div>
                    <div className="reporter-name">{ticket.reporter}</div>
                  </td>
                  <td style={{maxWidth: 180}}>
                    <div style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ticket.area}</div>
                    <div style={{fontSize:'0.78rem', color:'var(--text-muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ticket.location}</div>
                  </td>
                  <td>{technicianCell(ticket.technician)}</td>
                  <td>
                    <PriorityPill priority={ticket.priority} />
                  </td>
                  <td className="completion-cell">
                    <div className="completion-stack">
                      <span className="completion-date-line">{ticket.entryDate.slice(0,5)}.</span>
                      {ticket.entryTime && <span className="completion-time-line">{ticket.entryTime}</span>}
                    </div>
                  </td>
                  <td className="completion-cell">
                    <div className="completion-stack">
                      <span className="completion-date-line">{ticket.dueDate.slice(0,5)}.</span>
                    </div>
                  </td>
                  <td className="completion-cell">
                    <div className="completion-stack">
                      <span className="completion-date-line">{ticket.completionDate || 'N/A'}</span>
                      {ticket.completionTime ? (
                        <span className="completion-time-line">{ticket.completionTime}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    {userRole === Role.Admin && (
                      <button
                        type="button"
                        className="btn-delete"
                        title="Abgeschlossenen Auftrag löschen"
                        onClick={(e) => handleDeleteClick(e, ticket)}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {isLoading ? 'Lade Aufträge...' : `Keine abgeschlossenen Aufträge im ${MONTHS[selectedMonth - 1]} ${selectedYear}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ErledigtTableView;
