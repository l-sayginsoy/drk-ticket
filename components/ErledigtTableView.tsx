import React, { useState, useMemo, useEffect } from 'react';
import { Ticket, Priority } from '../types';
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
}

type SortableKeys = keyof Ticket | 'entryDate' | 'dueDate' | 'completionDate';

type YearFilter = number | 'all';

const parseGermanDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr || dateStr === 'N/A') return null;
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  return null;
};

const completionYear = (ticket: Ticket): number | null => {
  const d = parseGermanDate(ticket.completionDate);
  return d ? d.getFullYear() : null;
};

const PriorityPill: React.FC<{ priority: Priority }> = ({ priority }) => {
  const priorityClasses = {
    [Priority.Hoch]: 'priority-high',
    [Priority.Mittel]: 'priority-medium',
    [Priority.Niedrig]: 'priority-low',
  };
  return <span className={`priority-pill ${priorityClasses[priority]}`}>{priority}</span>;
};

const technicianCell = (name: string) => (name === 'N/A' ? 'N/A' : displayNameShort(name));

const ErledigtTableView: React.FC<ErledigtTableViewProps> = ({ tickets, onSelectTicket, selectedTicket, onDeleteTicket }) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({
    key: 'completionDate',
    direction: 'descending',
  });
  const currentCalendarYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<YearFilter>(() => currentCalendarYear);
  const [deleteDialogTicket, setDeleteDialogTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    setDeleteDialogTicket(null);
  }, [yearFilter, tickets]);

  /** Jahre mit Daten + laufendes Jahr + aktuell gewähltes Jahr (bleibt im Dropdown gültig). */
  const yearDropdownYears = useMemo(() => {
    const ys = new Set<number>();
    tickets.forEach((t) => {
      const y = completionYear(t);
      if (y != null) ys.add(y);
    });
    ys.add(currentCalendarYear);
    if (typeof yearFilter === 'number') ys.add(yearFilter);
    return [...ys].sort((a, b) => b - a);
  }, [tickets, currentCalendarYear, yearFilter]);

  const displayedTickets = useMemo(() => {
    if (yearFilter === 'all') return tickets;
    return tickets.filter((t) => completionYear(t) === yearFilter);
  }, [tickets, yearFilter]);

  const sortedTickets = useMemo(() => {
    const sortableItems = [...displayedTickets];
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
          return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [displayedTickets, sortConfig]);

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

  const yearDescription =
    yearFilter === 'all'
      ? 'Alle abgeschlossenen Aufträge (alle Jahre).'
      : yearFilter === currentCalendarYear
        ? `Abgeschlossene Aufträge im Kalenderjahr ${yearFilter} (laufendes Jahr). Vorjahre finden Sie unter „Archiv …“.`
        : `Archiv: Kalenderjahr ${yearFilter}.`;

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
                .erledigt-header {
                    background-color: var(--bg-secondary);
                    padding: 1rem 1.5rem;
                    border: 1px solid var(--border);
                    border-bottom: none;
                    border-top-left-radius: 8px;
                    border-top-right-radius: 8px;
                    margin-top: 1.5rem;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem 1.5rem;
                    align-items: center;
                    justify-content: space-between;
                }
                .erledigt-header-left {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                    min-width: 0;
                    flex: 1;
                }
                .erledigt-info {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    line-height: 1.45;
                }
                .year-select-wrap {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }
                .year-select-wrap label {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    white-space: nowrap;
                }
                .year-select {
                    background-color: var(--bg-tertiary);
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    cursor: pointer;
                    min-width: 200px;
                }
                .erledigt-page {
                  display: flex;
                  flex-direction: column;
                }
                .table-view-container {
                  background-color: var(--bg-secondary);
                  border: 1px solid var(--border);
                  border-top: none;
                  border-radius: 0 0 8px 8px;
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
                .ticket-title { font-weight: 500; color: var(--text-primary); }
                .priority-pill { padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600; display: inline-block; border: 1px solid transparent; min-width: 100px; text-align: center; }
                .priority-pill.priority-high { background-color: rgba(220, 53, 69, 0.1); color: #c82333; border-color: rgba(220, 53, 69, 0.3); }
                .priority-pill.priority-medium { background-color: rgba(255, 193, 7, 0.1); color: #d97706; border-color: rgba(255, 193, 7, 0.3); }
                .priority-pill.priority-low { background-color: rgba(25, 135, 84, 0.1); color: var(--accent-success); border-color: rgba(25, 135, 84, 0.3); }
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
      <div className="erledigt-header">
        <div className="erledigt-header-left">
          <p className="erledigt-info">{yearDescription}</p>
        </div>
        <div className="year-select-wrap">
          <label htmlFor="erledigt-year">Zeitraum</label>
          <select
            id="erledigt-year"
            className="year-select"
            value={yearFilter === 'all' ? 'all' : String(yearFilter)}
            onChange={(e) => {
              const v = e.target.value;
              setYearFilter(v === 'all' ? 'all' : parseInt(v, 10));
            }}
          >
            {yearDropdownYears.map((y) => (
              <option key={y} value={y}>
                {y === currentCalendarYear ? `Jahr ${y} (aktuell)` : `Archiv ${y}`}
              </option>
            ))}
            <option value="all">Alle Jahre</option>
          </select>
        </div>
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
                  <td>
                    <div className="ticket-title">{ticket.title}</div>
                    <small style={{ color: 'var(--text-muted)' }}>{ticket.location}</small>
                  </td>
                  <td>{ticket.area}</td>
                  <td>{technicianCell(ticket.technician)}</td>
                  <td>
                    <PriorityPill priority={ticket.priority} />
                  </td>
                  <td>{ticket.entryDate}</td>
                  <td>{ticket.dueDate}</td>
                  <td className="completion-cell">
                    <div className="completion-stack">
                      <span className="completion-date-line">{ticket.completionDate || 'N/A'}</span>
                      {ticket.completionTime ? (
                        <span className="completion-time-line">{ticket.completionTime}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-delete"
                      title="Abgeschlossenen Auftrag löschen"
                      onClick={(e) => handleDeleteClick(e, ticket)}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {yearFilter === 'all'
                    ? 'Keine abgeschlossenen Aufträge.'
                    : `Keine abgeschlossenen Aufträge ${yearFilter === currentCalendarYear ? `im Jahr ${yearFilter}` : `im Archiv ${yearFilter}`}.`}
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
