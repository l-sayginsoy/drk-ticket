import React, { useState, useMemo } from 'react';
import { Ticket, Status, Priority, Role } from '../types';
import { SortAscendingIcon } from './icons/SortAscendingIcon';
import { SortDescendingIcon } from './icons/SortDescendingIcon';
import { displayNameShort } from '../utils/displayNames';
import { getStaffChatState, hasUnreadReporterNote } from '../utils/staffChat';

interface ZurückgestelltViewProps {
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicket: Ticket | null;
  userRole?: Role | null;
  currentUserName?: string;
}

type SortKey = 'id' | 'title' | 'area' | 'technician' | 'priority' | 'entryDate' | 'parkedAt' | 'parkReminderNextDate' | 'parkReminderInterval';

const PriorityPill: React.FC<{ priority: Priority }> = ({ priority }) => {
  const cls = {
    [Priority.Hoch]: 'priority-high',
    [Priority.Mittel]: 'priority-medium',
    [Priority.Niedrig]: 'priority-low',
  };
  return <span className={`priority-pill ${cls[priority]}`}>{priority}</span>;
};

const techCell = (name: string) => (name === 'N/A' ? 'N/A' : displayNameShort(name));

const parseDE = (s?: string) => {
  if (!s) return '';
  const p = s.split('.');
  if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
  return s; // already YYYY-MM-DD
};

/** YYYY-MM-DD → DD.MM.JJJJ für die Anzeige */
const formatDE = (s?: string) => {
  if (!s) return '–';
  const p = s.split('-');
  if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
  return s;
};

const ZurückgestelltView: React.FC<ZurückgestelltViewProps> = ({
  tickets,
  onUpdateTicket,
  onSelectTicket,
  selectedTicket,
  userRole,
  currentUserName,
}) => {
  const parked = useMemo(() => {
    const all = tickets.filter(t => t.status === Status.Zurueckgestellt);
    if (userRole === Role.Admin) return all;
    return all.filter(t => t.technician === currentUserName);
  }, [tickets, userRole, currentUserName]);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'parkedAt',
    dir: 'desc',
  });
  const [filterArea, setFilterArea] = useState('Alle');
  const [filterTech, setFilterTech] = useState('Alle');
  const [filterPriority, setFilterPriority] = useState('Alle');
  const [filterReminder, setFilterReminder] = useState('Alle');
  const [search, setSearch] = useState('');

  const areas = useMemo(() => ['Alle', ...Array.from(new Set(parked.map(t => t.area))).sort()], [parked]);
  const techs = useMemo(() => ['Alle', ...Array.from(new Set(parked.map(t => t.technician).filter(t => t && t !== 'N/A'))).sort()], [parked]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return parked.filter(t => {
      if (filterArea !== 'Alle' && t.area !== filterArea) return false;
      if (filterTech !== 'Alle' && t.technician !== filterTech) return false;
      if (filterPriority !== 'Alle' && t.priority !== filterPriority) return false;
      if (filterReminder === 'Fällig' && (t.parkReminderNextDate || '9999') > today) return false;
      if (filterReminder === 'Ausstehend' && (t.parkReminderNextDate || '9999') <= today) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !t.id.toLowerCase().includes(q) &&
          !t.area.toLowerCase().includes(q) &&
          !t.technician.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [parked, filterArea, filterTech, filterPriority, filterReminder, search, today]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string = '';
      let bv: string = '';
      switch (sortConfig.key) {
        case 'id': av = a.id; bv = b.id; break;
        case 'title': av = a.title; bv = b.title; break;
        case 'area': av = a.area; bv = b.area; break;
        case 'technician': av = a.technician; bv = b.technician; break;
        case 'priority': av = a.priority; bv = b.priority; break;
        case 'entryDate': av = parseDE(a.entryDate); bv = parseDE(b.entryDate); break;
        case 'parkedAt': av = a.parkedAt || ''; bv = b.parkedAt || ''; break;
        case 'parkReminderNextDate': av = a.parkReminderNextDate || ''; bv = b.parkReminderNextDate || ''; break;
        case 'parkReminderInterval': av = String(a.parkReminderInterval || 0).padStart(2, '0'); bv = String(b.parkReminderInterval || 0).padStart(2, '0'); break;
      }
      if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1;
      if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  const requestSort = (key: SortKey) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortConfig.key !== k) return null;
    return sortConfig.dir === 'asc' ? <SortAscendingIcon /> : <SortDescendingIcon />;
  };

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th onClick={() => requestSort(k)}>
      <div className="sortable-header">{children}<span className="sort-icon"><SortIcon k={k} /></span></div>
    </th>
  );

  const handleUnpark = (e: React.MouseEvent, ticket: Ticket) => {
    e.stopPropagation();
    onUpdateTicket({ ...ticket, status: Status.InArbeit, parkReminderInterval: undefined, parkReminderNextDate: undefined, parkedAt: undefined, parkedForReturnOf: undefined });
  };

  const isReminderDue = (ticket: Ticket) => ticket.parkReminderNextDate && ticket.parkReminderNextDate <= today;

  return (
    <div className="erledigt-page">
      <style>{`
        .erledigt-page { display: flex; flex-direction: column; }
        .erledigt-month-nav {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.75rem 0 1rem; flex-wrap: wrap;
        }
        .erledigt-month-nav select {
          border: 1px solid var(--border); border-radius: 20px;
          padding: 0.35rem 1.75rem 0.35rem 0.85rem; font-size: 0.875rem;
          background: var(--bg-primary); color: var(--text-primary);
          cursor: pointer; appearance: none; -webkit-appearance: none;
        }
        .erledigt-month-nav input[type="text"] {
          border: 1px solid var(--border); border-radius: 20px;
          padding: 0.35rem 0.85rem; font-size: 0.875rem;
          background: var(--bg-primary); color: var(--text-primary);
          outline: none; min-width: 160px;
        }
        .erledigt-count { font-size: 0.85rem; color: var(--text-muted); margin-left: auto; }
        .table-view-container {
          background-color: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 8px; margin-top: 0; overflow-x: auto;
        }
        .ticket-table { width: 100%; border-collapse: collapse; text-align: left; }
        .ticket-table th, .ticket-table td { padding: 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; white-space: nowrap; }
        .ticket-table th { color: var(--text-muted); font-weight: 500; font-size: 0.875rem; background-color: var(--bg-primary); cursor: pointer; user-select: none; }
        .ticket-table th:hover { background-color: var(--bg-tertiary); }
        .sortable-header { display: flex; align-items: center; gap: 0.5rem; }
        .sort-icon svg { width: 14px; height: 14px; color: var(--text-primary); }
        .ticket-table td { color: var(--text-secondary); font-size: 0.9rem; }
        .ticket-table tbody tr:last-child td { border-bottom: none; }
        .ticket-table tbody tr { cursor: pointer; transition: background-color 0.2s ease; }
        .ticket-table tbody tr.selected { background-color: var(--border); }
        .ticket-table tbody tr:not(.selected):hover { background-color: var(--bg-tertiary); }
        .ticket-title { font-weight: 500; color: var(--text-primary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ticket-title-cell { max-width: 280px; }
        .reporter-name { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
        .priority-pill { padding: 0.18rem 0.65rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; display: inline-block; min-width: 72px; box-sizing: border-box; border: 1.5px solid transparent; text-align: center; white-space: nowrap; }
        .priority-pill.priority-high { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
        .priority-pill.priority-medium { background: #FAEEDA; color: #854F0B; border-color: #FAC775; }
        .priority-pill.priority-low { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
        .reminder-due-chip {
          display: inline-flex; align-items: center; gap: 0.25rem;
          background: rgba(255,140,0,0.12); color: rgba(200,80,0,0.95);
          border: 1px solid rgba(255,140,0,0.35); border-radius: 999px;
          padding: 0.15rem 0.55rem; font-size: 0.75rem; font-weight: 600;
        }
        .unpark-btn {
          padding: 0.35rem 0.8rem; border-radius: var(--radius-sm);
          font-weight: 600; font-size: 0.8rem; cursor: pointer;
          border: 1px solid var(--accent-primary); background: var(--accent-primary);
          color: #fff; display: inline-flex; align-items: center; gap: 0.3rem;
          transition: opacity 0.15s; white-space: nowrap;
        }
        .unpark-btn:hover { opacity: 0.85; }
        .actions-cell { text-align: right; }
      `}</style>

      {/* Filter-Leiste */}
      <div className="erledigt-month-nav">
        <input
          type="text"
          placeholder="Suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          {areas.map(a => <option key={a} value={a}>{a === 'Alle' ? 'Alle Standorte' : a}</option>)}
        </select>
        <select value={filterTech} onChange={e => setFilterTech(e.target.value)}>
          {techs.map(t => <option key={t} value={t}>{t === 'Alle' ? 'Alle Bearbeiter' : t}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="Alle">Alle Prioritäten</option>
          <option value={Priority.Hoch}>Hoch</option>
          <option value={Priority.Mittel}>Mittel</option>
          <option value={Priority.Niedrig}>Niedrig</option>
        </select>
        <select value={filterReminder} onChange={e => setFilterReminder(e.target.value)}>
          <option value="Alle">Alle Erinnerungen</option>
          <option value="Fällig">Erinnerung fällig</option>
          <option value="Ausstehend">Erinnerung ausstehend</option>
        </select>
        <span className="erledigt-count">{sorted.length} Auftrag{sorted.length !== 1 ? 'träge' : ''}</span>
      </div>

      {/* Tabelle */}
      <div className="table-view-container">
        <table className="ticket-table">
          <thead>
            <tr>
              <Th k="id">Ticket</Th>
              <Th k="title">Betreff</Th>
              <Th k="area">Standort</Th>
              <Th k="technician">Bearbeiter</Th>
              <Th k="priority">Priorität</Th>
              <Th k="entryDate">Eingang</Th>
              <Th k="parkedAt">Zurückgestellt am</Th>
              <Th k="parkReminderNextDate">Nächste Erinnerung</Th>
              <Th k="parkReminderInterval">Intervall</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? sorted.map(ticket => (
              <tr
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className={selectedTicket?.id === ticket.id ? 'selected' : ''}
              >
                <td>{ticket.id}</td>
                <td className="ticket-title-cell">
                  <div className="ticket-title">{ticket.title}</div>
                  <div className="reporter-name">{ticket.reporter}</div>
                  {ticket.parkedForReturnOf && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
                      fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                      background: 'rgba(249,115,22,0.10)', color: '#c2410c', border: '1px solid rgba(249,115,22,0.35)',
                    }}>
                      <i className="ti ti-clock-hour-4" style={{ fontSize: 11 }} aria-hidden="true" />
                      Wartet auf Rückkehr von {displayNameShort(ticket.parkedForReturnOf)}
                    </span>
                  )}
                  {(getStaffChatState(ticket, currentUserName ?? null) === 'unread' || hasUnreadReporterNote(ticket, currentUserName ?? null)) && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                      {getStaffChatState(ticket, currentUserName ?? null) === 'unread' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: '#6366f1', color: '#fff' }}>
                          <i className="ti ti-message-circle" style={{ fontSize: 11 }} aria-hidden="true" />Neuer Chat
                        </span>
                      )}
                      {hasUnreadReporterNote(ticket, currentUserName ?? null) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: '#F97316', color: '#fff' }}>
                          <i className="ti ti-mail" style={{ fontSize: 11 }} aria-hidden="true" />Melder
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ maxWidth: 180 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.area}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.location}</div>
                </td>
                <td>{techCell(ticket.technician)}</td>
                <td><PriorityPill priority={ticket.priority} /></td>
                <td>{ticket.entryDate}</td>
                <td>{formatDE(ticket.parkedAt)}</td>
                <td>
                  {ticket.parkReminderNextDate ? (
                    isReminderDue(ticket)
                      ? <span className="reminder-due-chip"><i className="ti ti-bell-ringing" style={{ fontSize: 12 }} />{formatDE(ticket.parkReminderNextDate)}</span>
                      : formatDE(ticket.parkReminderNextDate)
                  ) : '–'}
                </td>
                <td>
                  {ticket.parkReminderInterval ? `alle ${ticket.parkReminderInterval} Wo.` : '–'}
                </td>
                <td className="actions-cell" onClick={e => e.stopPropagation()}>
                  <button className="unpark-btn" onClick={e => handleUnpark(e, ticket)}>
                    <i className="ti ti-player-play" style={{ fontSize: 13 }} />
                    In Arbeit
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Keine zurückgestellten Aufträge{search || filterArea !== 'Alle' || filterTech !== 'Alle' || filterPriority !== 'Alle' || filterReminder !== 'Alle' ? ' (Filter aktiv)' : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ZurückgestelltView;
