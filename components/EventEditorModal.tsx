import React, { useState } from 'react';
import { DrkEvent, EventTask, Ticket } from '../types';
import MicButton from './MicButton';

interface Props {
  event: DrkEvent;
  isNew: boolean;
  users: { name: string }[];
  tickets: Ticket[];
  canDelete?: boolean;
  onSave: (event: DrkEvent) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function newTask(eventDate: string): EventTask {
  return {
    id: `et-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    label: '',
    assignee: 'N/A',
    description: '',
    dueDate: eventDate,
    items: [],
  };
}

function newItem(): { id: string; label: string } {
  return { id: `ei-${Date.now()}-${Math.floor(Math.random() * 10000)}`, label: '' };
}

interface EventTaskEditorProps {
  task: EventTask;
  index: number;
  users: { name: string }[];
  ticket?: Ticket;
  eventDate: string;
  onPatchTask: (id: string, fields: Partial<EventTask>) => void;
  onRemoveTask: (id: string) => void;
  onPatchItem: (taskId: string, itemId: string, label: string) => void;
  onRemoveItem: (taskId: string, itemId: string) => void;
  onAddItem: (taskId: string) => void;
}

const EventTaskEditor: React.FC<EventTaskEditorProps> = ({ task, index, users, ticket, eventDate, onPatchTask, onRemoveTask, onPatchItem, onRemoveItem, onAddItem }) => {
  const items = task.items || [];
  const doneIds = new Set(ticket?.eventChecklistDone || []);
  const doneCount = items.filter(item => doneIds.has(item.id)).length;
  return (
    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '0.45rem', overflow: 'hidden' }}>
      <div style={{ padding: '0.65rem 0.75rem', borderBottom: items.length > 0 ? '1px solid var(--border)' : 'none' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, minWidth: 18 }}>{index + 1}.</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: 11 }}>Zuständig</label>
                <select value={task.assignee} onChange={e => onPatchTask(task.id, { assignee: e.target.value, label: task.label && task.label !== task.assignee ? task.label : e.target.value })} style={{ ...inputStyle, margin: 0, fontSize: 12 }}>
                  <option value="N/A">— nicht zugewiesen —</option>
                  {users.map(user => <option key={user.name} value={user.name}>{user.name}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 0 130px' }}>
                <label style={{ ...labelStyle, fontSize: 11 }}>Erledigt bis</label>
                <input type="date" value={task.dueDate || eventDate} onChange={e => onPatchTask(task.id, { dueDate: e.target.value })} style={{ ...inputStyle, margin: 0, fontSize: 12 }} />
              </div>
            </div>
            <input value={task.label === task.assignee ? '' : task.label} onChange={e => onPatchTask(task.id, { label: e.target.value.trim() || task.assignee })} placeholder="Kurzbeschreibung (optional, z. B. Saal vorbereiten)" style={{ ...inputStyle, margin: 0, fontSize: 12, color: 'var(--text-secondary)' }} />
          </div>
          <button onClick={() => onRemoveTask(task.id)} title="Entfernen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: '0 4px', marginTop: 18 }}>×</button>
        </div>
        {task.ticketId && <div style={{ paddingLeft: '1.5rem', marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>Ticket #{task.ticketId} wurde bereits erstellt{items.length > 0 ? ` · ${doneCount}/${items.length} Punkte im Ticket erledigt` : ''}.</div>}
      </div>
      <div style={{ padding: '0.4rem 0.75rem 0.5rem 2rem', background: 'var(--bg-primary)' }}>
        {items.map((item, itemIndex) => {
          const done = doneIds.has(item.id);
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span title={done ? 'Im Ticket erledigt' : 'Noch offen'} style={{ width: 14, height: 14, border: `1.5px solid ${done ? '#16a34a' : 'var(--border-active)'}`, borderRadius: 3, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: done ? '#16a34a' : 'transparent', color: '#fff', fontSize: 10, fontWeight: 800 }}>{done ? '✓' : ''}</span>
              <input value={item.label} onChange={e => onPatchItem(task.id, item.id, e.target.value)} placeholder={`Punkt ${itemIndex + 1} …`} style={{ ...inputStyle, margin: 0, flex: 1, fontSize: 12.5, padding: '4px 8px', textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : 'var(--text-primary)' }} />
              <button onClick={() => onRemoveItem(task.id, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
          );
        })}
        <button onClick={() => onAddItem(task.id)} style={{ fontSize: 11.5, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>+ Punkt hinzufügen</button>
      </div>
    </div>
  );
};

export default function EventEditorModal({ event, isNew, users, tickets, canDelete = false, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<DrkEvent>({ ...event, tasks: event.tasks.map(t => ({ ...t })) });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (fields: Partial<DrkEvent>) => setDraft(prev => ({ ...prev, ...fields }));

  const patchTask = (id: string, fields: Partial<EventTask>) =>
    setDraft(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, ...fields } : t) }));

  const addTask = () =>
    setDraft(prev => ({ ...prev, tasks: [...prev.tasks, newTask(prev.date)] }));

  const removeTask = (id: string) =>
    setDraft(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));

  const addItem = (taskId: string) =>
    setDraft(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, items: [...(t.items || []), newItem()] } : t) }));

  const patchItem = (taskId: string, itemId: string, label: string) =>
    setDraft(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, items: (t.items || []).map(it => it.id === itemId ? { ...it, label } : it) } : t) }));

  const removeItem = (taskId: string, itemId: string) =>
    setDraft(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, items: (t.items || []).filter(it => it.id !== itemId) } : t) }));

  const handleSave = () => {
    if (!draft.title.trim() || !draft.date) return;
    onSave(draft);
  };

  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, background: 'var(--bg-secondary)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden', marginBottom: 40 }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            {isNew ? 'Neue Veranstaltung' : 'Veranstaltung bearbeiten'}
          </span>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Titel */}
          <div>
            <label style={labelStyle}>Bezeichnung *</label>
            <input
              value={draft.title}
              onChange={e => patch({ title: e.target.value })}
              placeholder="z. B. Gottesdienst, Saalvermietung Müller"
              style={inputStyle}
            />
          </div>

          {/* Datum + Von/Bis */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={labelStyle}>Datum *</label>
              <input type="date" value={draft.date} onChange={e => patch({ date: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: '0 0 100px' }}>
              <label style={labelStyle}>Von</label>
              <input type="time" value={draft.time || ''} onChange={e => patch({ time: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: '0 0 100px' }}>
              <label style={labelStyle}>Bis</label>
              <input type="time" value={draft.timeTo || ''} onChange={e => patch({ timeTo: e.target.value })} style={inputStyle} />
            </div>
          </div>

          {/* Raum */}
          <div>
            <label style={labelStyle}>Raum / Standort</label>
            <input
              list="event-location-list"
              value={draft.location || ''}
              onChange={e => patch({ location: e.target.value })}
              placeholder="Auswählen oder frei eingeben …"
              style={inputStyle}
            />
            <datalist id="event-location-list">
              <option value="Kleiner Saal" />
              <option value="Cafeteria" />
              <option value="Terrasse" />
              <option value="Kreisverband" />
              <option value="Wohnbereich" />
            </datalist>
          </div>

          {/* Melder-E-Mail */}
          <div>
            <label style={labelStyle}>Benachrichtigungs-E-Mail (Melder / Anfragender)</label>
            <input
              type="email"
              value={draft.reporterEmail || ''}
              onChange={e => patch({ reporterEmail: e.target.value })}
              placeholder="name@beispiel.de – erhält Eingangs- und Abschlussbestätigung"
              style={inputStyle}
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label style={labelStyle}>Notizen / Besonderheiten</label>
            <div style={{ position: 'relative' }}>
              <textarea value={draft.description || ''} onChange={e => patch({ description: e.target.value })} placeholder="Besondere Wünsche, Hinweise …" rows={2} style={{ ...inputStyle, resize: 'vertical', paddingRight: 30 }} />
              <div style={{ position: 'absolute', bottom: 6, right: 4 }}>
                <MicButton value={draft.description || ''} onChange={v => patch({ description: v })} title="Per Sprache eingeben" />
              </div>
            </div>
          </div>

          {/* Aufgaben */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ ...labelStyle, margin: 0 }}>Aufgaben & Zuständigkeiten</label>
              <button onClick={addTask} style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                + Aufgabe
              </button>
            </div>

            {draft.tasks.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0.5rem 0' }}>Noch keine Aufgaben – mit „+ Aufgabe" hinzufügen.</div>
            )}

            {draft.tasks.map((task, idx) => (
              <EventTaskEditor
                key={task.id}
                task={task}
                index={idx}
                users={sortedUsers}
                ticket={task.ticketId ? tickets.find(ticket => ticket.id === task.ticketId) : undefined}
                onPatchTask={patchTask}
                onRemoveTask={removeTask}
                onPatchItem={patchItem}
                onRemoveItem={removeItem}
                onAddItem={addItem}
                eventDate={draft.date}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0.85rem 1.2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)' }}>
          <div>
            {!isNew && canDelete && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Löschen
              </button>
            )}
            {confirmDelete && (
              <span style={{ fontSize: 13, color: '#dc2626' }}>
                Sicher?{' '}
                <button onClick={() => onDelete(draft.id)} style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Ja, löschen</button>
                {' '}
                <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}>Abbrechen</button>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>Abbrechen</button>
            <button
              onClick={handleSave}
              disabled={!draft.title.trim() || !draft.date}
              style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: 8, padding: '7px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', opacity: (!draft.title.trim() || !draft.date) ? 0.5 : 1 }}
            >
              {isNew ? 'Erstellen & Aufträge generieren' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: 13.5,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
};
