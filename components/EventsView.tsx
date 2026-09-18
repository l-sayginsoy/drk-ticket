import React, { useState } from 'react';
import { DrkEvent, EventTask, Role, Ticket, Status } from '../types';
import EventEditorModal from './EventEditorModal';

interface EventsViewProps {
  events: DrkEvent[];
  tickets: Ticket[];
  completedTickets: Ticket[];
  userRole: Role;
  users: { name: string }[];
  onSaveEvent: (event: DrkEvent) => void;
  onDeleteEvent: (id: string) => void;
  onHardDeleteEvent?: (id: string) => void;
  onUnarchiveEvent?: (id: string) => void;
  onSelectTicket: (ticket: Ticket) => void;
}

function formatDateDE(ymd: string): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}.${m}.${y}`;
}

function weekdayDE(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
}

function taskStatus(task: EventTask, tickets: Ticket[], completedTickets: Ticket[]): 'done' | 'open' | 'no-ticket' {
  if (!task.ticketId) return 'no-ticket';
  const inCompleted = completedTickets.find(t => t.id === task.ticketId);
  if (inCompleted) return 'done';
  const inActive = tickets.find(t => t.id === task.ticketId);
  if (inActive && inActive.status === Status.Abgeschlossen) return 'done';
  return 'open';
}

function newEventDraft(): DrkEvent {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: '',
    date: ymd,
    time: '',
    location: '',
    description: '',
    tasks: [],
    createdAt: new Date().toISOString(),
  };
}

export default function EventsView({ events, tickets, completedTickets, userRole, users, onSaveEvent, onDeleteEvent, onHardDeleteEvent, onUnarchiveEvent, onSelectTicket }: EventsViewProps) {
  const [editing, setEditing] = useState<{ event: DrkEvent; isNew: boolean } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const canEdit = userRole === Role.Admin;
  const allTickets = [...tickets, ...completedTickets];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const active = events.filter(e => !e.archivedAt);
  const archived = events.filter(e => !!e.archivedAt).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));
  const sorted = [...active].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter(e => e.date >= todayYmd);
  const past = sorted.filter(e => e.date < todayYmd).reverse();

  const renderEvent = (ev: DrkEvent) => {
    const done = ev.tasks.filter(t => taskStatus(t, tickets, completedTickets) === 'done').length;
    const total = ev.tasks.length;
    const allDone = total > 0 && done === total;
    const isPast = ev.date < todayYmd;

    const monthName = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][Number(ev.date.split('-')[1]) - 1];

    return (
      <div key={ev.id} className="ev-card">
        {/* Graue Datumsspalte — volle Höhe */}
        <div className="ev-date-col" style={{ opacity: isPast ? 0.7 : 1 }}>
          <div className="ev-wd">{weekdayDE(ev.date)}</div>
          <div className="ev-dn">{ev.date.split('-')[2]}</div>
          <div className="ev-mon">{monthName}</div>
          {ev.time && (
            <div className="ev-tm">{ev.time}{ev.timeTo ? `–${ev.timeTo}` : ''}</div>
          )}
        </div>

        {/* Rechte Seite: alles andere */}
        <div className="ev-right">
          <div className="ev-top">
            <div className="ev-main">
              <div className="ev-title-row">
                <span className="ev-title">{ev.title || '—'}</span>
                {total > 0 && (
                  <span className="ev-progress-pill" style={{ background: allDone ? '#dcfce7' : 'var(--bg-tertiary)', color: allDone ? '#16a34a' : 'var(--text-muted)' }}>
                    {done}/{total} erledigt
                  </span>
                )}
              </div>
              {(ev.location || ev.description) && (
                <div className="ev-meta">
                  {ev.location && <span><i className="ti ti-map-pin" /> {ev.location}</span>}
                  {ev.description && <span className="ev-meta-desc">{ev.description}</span>}
                </div>
              )}
            </div>
            {canEdit && (
              <button className="ev-edit-btn" onClick={() => setEditing({ event: ev, isNew: false })} title="Bearbeiten">
                <i className="ti ti-pencil" />
              </button>
            )}
          </div>

          {ev.tasks.length > 0 && (
            <div className="ev-chips">
              {ev.tasks.map(task => {
                const st = taskStatus(task, tickets, completedTickets);
                const ticket = task.ticketId ? allTickets.find(t => t.id === task.ticketId) : undefined;
                const label = task.label && task.label !== task.assignee ? task.label : task.assignee || '—';
                const firstName = (task.assignee || '').split(' ')[0];
                return (
                  <button
                    key={task.id}
                    className={`ev-chip ev-chip--${st}`}
                    onClick={() => ticket && onSelectTicket(ticket)}
                    title={`${label}${task.assignee && task.label !== task.assignee ? ' · ' + task.assignee : ''}${ticket ? ' · #' + ticket.id : ''}`}
                    style={{ cursor: ticket ? 'pointer' : 'default' }}
                  >
                    <span className={`ev-chip-dot ev-chip-dot--${st}`} />
                    <span>{label !== task.assignee ? label : firstName}</span>
                    {label !== task.assignee && task.assignee && task.assignee !== 'N/A' && (
                      <span className="ev-chip-who">{firstName}</span>
                    )}
                    {task.items && task.items.length > 0 && (
                      <span className="ev-chip-count">{task.items.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      <style>{`
        .ev-section-header {
          font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--text-muted);
          padding: 0.5rem 0 0.4rem; margin-top: 1.5rem;
          border-bottom: 1px solid var(--border); margin-bottom: 0.75rem;
        }
        /* Karte: flex-row, damit Datumsspalte volle Höhe hat */
        .ev-card {
          display: flex;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 0.5rem;
          overflow: hidden;
        }
        /* Graue Datumsspalte – volle Kartenhöhe */
        .ev-date-col {
          width: 100px; flex-shrink: 0;
          background: var(--bg-tertiary);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 14px 8px; text-align: center; gap: 2px;
        }
        .ev-wd {
          font-size: 10px; font-weight: 800; text-transform: uppercase;
          color: var(--text-muted); letter-spacing: 0.07em;
        }
        .ev-dn {
          font-size: 34px; font-weight: 900; line-height: 1;
          color: var(--text-primary); letter-spacing: -1px;
        }
        .ev-mon {
          font-size: 12px; font-weight: 700; text-transform: uppercase;
          color: var(--text-muted); letter-spacing: 0.05em;
        }
        .ev-tm {
          font-size: 11px; color: var(--text-muted); margin-top: 6px;
          line-height: 1.3; white-space: nowrap;
        }
        /* Rechte weiße Seite */
        .ev-right { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .ev-top {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 12px 14px 8px;
        }
        .ev-main { flex: 1; min-width: 0; }
        .ev-title-row {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .ev-title {
          font-size: 15px; font-weight: 700; color: var(--text-primary);
        }
        .ev-progress-pill {
          font-size: 11px; font-weight: 700; padding: 2px 8px;
          border-radius: 99px; white-space: nowrap;
        }
        .ev-meta {
          display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px;
          font-size: 12px; color: var(--text-muted); align-items: baseline;
        }
        .ev-meta i { font-size: 11px; margin-right: 2px; }
        .ev-meta-desc {
          flex-basis: 100%; color: var(--text-secondary); font-size: 12px;
          margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ev-edit-btn {
          background: none; border: 1px solid var(--border); border-radius: 7px;
          padding: 5px 8px; cursor: pointer; color: var(--text-muted);
          font-size: 14px; display: flex; align-items: center; flex-shrink: 0;
        }
        .ev-edit-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
        /* Chips */
        .ev-chips {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 0 14px 12px;
        }
        .ev-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px 4px 7px; border-radius: 99px;
          border: 1px solid var(--border); background: var(--bg-primary);
          font-size: 12.5px; font-weight: 600; color: var(--text-secondary);
          transition: background 0.12s;
        }
        .ev-chip:hover { background: var(--bg-tertiary); }
        .ev-chip--done { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
        .ev-chip--done:hover { background: #dcfce7; }
        .ev-chip--no-ticket { opacity: 0.6; }
        .ev-chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .ev-chip-dot--done { background: #16a34a; }
        .ev-chip-dot--open { background: var(--accent-primary); }
        .ev-chip-dot--no-ticket { background: var(--border-active); }
        .ev-chip-who {
          font-size: 11px; font-weight: 400; color: var(--text-muted);
          border-left: 1px solid var(--border); padding-left: 5px; margin-left: 2px;
        }
        .ev-chip-count {
          background: var(--bg-tertiary); border: 1px solid var(--border);
          border-radius: 99px; font-size: 10px; font-weight: 700;
          padding: 0 5px; color: var(--text-muted); min-width: 16px; text-align: center;
        }
        .ev-empty { padding: 2rem; text-align: center; color: var(--text-muted); font-size: 14px; }
      `}</style>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            onClick={() => setEditing({ event: newEventDraft(), isNew: true })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Neue Veranstaltung
          </button>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && archived.length === 0 && (
        <div className="ev-empty">Noch keine Veranstaltungen angelegt.<br />Mit „+ Neue Veranstaltung" loslegen.</div>
      )}

      {upcoming.length === 0 && past.length === 0 && archived.length > 0 && (
        <div className="ev-empty">Keine aktiven Veranstaltungen.<br />Archivierte Veranstaltungen findest du unten.</div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="ev-section-header">Bevorstehend</div>
          {upcoming.map(renderEvent)}
        </>
      )}

      {past.length > 0 && (
        <>
          <div className="ev-section-header">Vergangen</div>
          {past.map(renderEvent)}
        </>
      )}

      {archived.length > 0 && (
        <>
          <button
            onClick={() => setShowArchive(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: '1rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 0',
            }}
          >
            <i className={`ti ti-chevron-${showArchive ? 'down' : 'right'}`} />
            Archiv ({archived.length} Veranstaltung{archived.length !== 1 ? 'en' : ''})
          </button>
          {showArchive && archived.map(ev => (
            <div key={ev.id} style={{ opacity: 0.6, position: 'relative' }}>
              {renderEvent(ev)}
              {canEdit && (
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                  {onUnarchiveEvent && (
                    <button
                      onClick={() => onUnarchiveEvent(ev.id)}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
                      title="Aus Archiv wiederherstellen"
                    >
                      <i className="ti ti-archive-off" /> Wiederherstellen
                    </button>
                  )}
                  {onHardDeleteEvent && confirmHardDelete !== ev.id && (
                    <button
                      onClick={() => setConfirmHardDelete(ev.id)}
                      style={{ background: 'none', border: '1px solid #dc2626', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: '#dc2626' }}
                      title="Endgültig löschen"
                    >
                      <i className="ti ti-trash" /> Löschen
                    </button>
                  )}
                  {onHardDeleteEvent && confirmHardDelete === ev.id && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>Sicher?</span>
                      <button
                        onClick={() => { onHardDeleteEvent(ev.id); setConfirmHardDelete(null); }}
                        style={{ background: '#dc2626', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 700 }}
                      >Ja, endgültig löschen</button>
                      <button
                        onClick={() => setConfirmHardDelete(null)}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >Abbrechen</button>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {editing && (
        <EventEditorModal
          event={editing.event}
          isNew={editing.isNew}
          users={users}
          onSave={(ev) => { onSaveEvent(ev); setEditing(null); }}
          onDelete={(id) => { onDeleteEvent(id); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
