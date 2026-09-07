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

export default function EventsView({ events, tickets, completedTickets, userRole, users, onSaveEvent, onDeleteEvent, onSelectTicket }: EventsViewProps) {
  const [editing, setEditing] = useState<{ event: DrkEvent; isNew: boolean } | null>(null);
  const canEdit = userRole === Role.Admin;
  const allTickets = [...tickets, ...completedTickets];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter(e => e.date >= todayYmd);
  const past = sorted.filter(e => e.date < todayYmd).reverse();

  const renderEvent = (ev: DrkEvent) => {
    const done = ev.tasks.filter(t => taskStatus(t, tickets, completedTickets) === 'done').length;
    const total = ev.tasks.length;
    const allDone = total > 0 && done === total;
    const isPast = ev.date < todayYmd;

    return (
      <div key={ev.id} className="ev-card">
        <div className="ev-card-header">
          <div className="ev-date-col">
            <div className="ev-weekday">{weekdayDE(ev.date)}</div>
            <div className="ev-date">{formatDateDE(ev.date)}</div>
            {ev.time && <div className="ev-time">{ev.time} Uhr</div>}
          </div>
          <div className="ev-info-col">
            <div className="ev-title">{ev.title || '—'}</div>
            {ev.location && <div className="ev-location"><i className="ti ti-map-pin" aria-hidden /> {ev.location}</div>}
            {ev.description && <div className="ev-desc">{ev.description}</div>}
            <div className="ev-progress">
              {total === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Keine Aufgaben</span>
              ) : (
                <>
                  <div className="ev-progress-bar-wrap">
                    <div className="ev-progress-bar" style={{ width: `${Math.round((done / total) * 100)}%`, background: allDone ? '#16a34a' : 'var(--accent-primary)' }} />
                  </div>
                  <span className="ev-progress-label" style={{ color: allDone ? '#16a34a' : 'var(--text-secondary)' }}>
                    {done}/{total} erledigt
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="ev-actions-col">
            {canEdit && (
              <button className="ev-edit-btn" onClick={() => setEditing({ event: ev, isNew: false })} title="Bearbeiten">
                <i className="ti ti-pencil" aria-hidden />
              </button>
            )}
          </div>
        </div>
        {ev.tasks.length > 0 && (
          <div className="ev-tasks">
            {ev.tasks.map(task => {
              const st = taskStatus(task, tickets, completedTickets);
              const ticket = task.ticketId ? allTickets.find(t => t.id === task.ticketId) : undefined;
              return (
                <div key={task.id} className={`ev-task-row ${st === 'done' ? 'ev-task-done' : ''}`}>
                  <span className={`ev-task-dot ev-task-dot--${st}`} />
                  <span className="ev-task-label">{task.label || '—'}</span>
                  {task.assignee && task.assignee !== 'N/A' && (
                    <span className="ev-task-assignee">{task.assignee}</span>
                  )}
                  {task.dueDate && task.dueDate !== ev.date && (
                    <span className="ev-task-due">bis {formatDateDE(task.dueDate)}</span>
                  )}
                  {ticket && (
                    <button className="ev-task-ticket-link" onClick={() => onSelectTicket(ticket)} title={`Ticket #${ticket.id} öffnen`}>
                      #{ticket.id}
                      <span className={`ev-task-ticket-status ev-task-ticket-status--${ticket.status === Status.Abgeschlossen ? 'done' : ticket.status === Status.Ueberfaellig ? 'late' : 'open'}`}>
                        {ticket.status}
                      </span>
                    </button>
                  )}
                  {!task.ticketId && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>kein Ticket</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      <style>{`
        .ev-section-header {
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 0.5rem 0 0.4rem;
          margin-top: 1.5rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0.75rem;
        }
        .ev-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px;
          margin-bottom: 0.65rem;
          overflow: hidden;
        }
        .ev-card-header {
          display: flex;
          align-items: flex-start;
          gap: 0;
        }
        .ev-date-col {
          min-width: 80px;
          padding: 0.85rem 1rem;
          border-right: 1px solid var(--border);
          text-align: center;
          flex-shrink: 0;
          background: var(--bg-tertiary);
        }
        .ev-weekday {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }
        .ev-date {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin-top: 2px;
          white-space: nowrap;
        }
        .ev-time {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 3px;
        }
        .ev-info-col {
          flex: 1;
          padding: 0.7rem 1rem;
          min-width: 0;
        }
        .ev-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.3;
        }
        .ev-location {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 3px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .ev-desc {
          font-size: 12.5px;
          color: var(--text-secondary);
          margin-top: 4px;
          line-height: 1.45;
        }
        .ev-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        .ev-progress-bar-wrap {
          flex: 1;
          max-width: 120px;
          height: 5px;
          background: var(--border);
          border-radius: 999px;
          overflow: hidden;
        }
        .ev-progress-bar {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s;
        }
        .ev-progress-label {
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .ev-actions-col {
          padding: 0.6rem 0.7rem 0;
          flex-shrink: 0;
        }
        .ev-edit-btn {
          background: none;
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 5px 8px;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 14px;
          display: flex;
          align-items: center;
        }
        .ev-edit-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
        .ev-tasks {
          border-top: 1px solid var(--border);
          padding: 0.5rem 1rem 0.6rem 1.4rem;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .ev-task-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .ev-task-done { opacity: 0.55; }
        .ev-task-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .ev-task-dot--done { background: #16a34a; }
        .ev-task-dot--open { background: var(--accent-primary); }
        .ev-task-dot--no-ticket { background: var(--border-active); }
        .ev-task-label { flex: 1; font-weight: 500; }
        .ev-task-assignee {
          font-size: 11.5px;
          color: var(--text-muted);
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1px 6px;
          white-space: nowrap;
        }
        .ev-task-due {
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .ev-task-ticket-link {
          background: none;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          color: var(--accent-primary);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .ev-task-ticket-link:hover { background: var(--bg-tertiary); }
        .ev-task-ticket-status {
          font-size: 10.5px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 3px;
        }
        .ev-task-ticket-status--done { background: #dcfce7; color: #16a34a; }
        .ev-task-ticket-status--late { background: #fee2e2; color: #dc2626; }
        .ev-task-ticket-status--open { background: var(--bg-tertiary); color: var(--text-muted); }
        .ev-empty {
          padding: 2rem;
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
        }
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

      {upcoming.length === 0 && past.length === 0 && (
        <div className="ev-empty">Noch keine Veranstaltungen angelegt.<br />Mit „+ Neue Veranstaltung" loslegen.</div>
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
