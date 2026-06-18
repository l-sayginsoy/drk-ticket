import React, { useMemo, useState } from 'react';
import { Role, RoutineSchedule, User, WeekdayKey } from '../types';

const WEEKDAYS: { key: WeekdayKey; label: string }[] = [
  { key: 'mo', label: 'Mo' }, { key: 'di', label: 'Di' }, { key: 'mi', label: 'Mi' },
  { key: 'do', label: 'Do' }, { key: 'fr', label: 'Fr' }, { key: 'sa', label: 'Sa' }, { key: 'so', label: 'So' },
];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

interface Props {
  schedule: RoutineSchedule & { recurrence?: any };
  isNew: boolean;
  users: User[];
  onSave: (s: RoutineSchedule) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function RoutineEditorModal({ schedule, isNew, users, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<RoutineSchedule & { recurrence?: any }>(() => ({ ...schedule }));
  const patch = (p: Partial<RoutineSchedule & { recurrence?: any }>) => setDraft(d => ({ ...d, ...p }));

  const eligible = useMemo(
    () => users.filter(u => u.isActive && u.role === draft.targetRole).map(u => u.name).sort((a, b) => a.localeCompare(b, 'de')),
    [users, draft.targetRole]
  );

  const rec: any = draft.recurrence || { type: 'weekdays', intervalWeeks: 1, weekdays: [] };
  const recType: string = rec.type || 'weekdays';

  const setRole = (role: Role.Technician | Role.Housekeeping) => {
    const newEligible = users.filter(u => u.isActive && u.role === role).map(u => u.name);
    const assignees = (draft.assignees || []).filter(n => newEligible.includes(n));
    let assignment = draft.assignment;
    if (assignment?.type === 'fixed' && !newEligible.includes(assignment.userName)) assignment = { type: 'rotate' };
    patch({ targetRole: role, assignees, assignment, rotationCursor: 0 });
  };

  const toggleAssignee = (name: string) => {
    const cur = draft.assignees || [];
    patch({ assignees: cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name], rotationCursor: 0 });
  };

  const toggleWeekday = (d: WeekdayKey) => {
    const cur: WeekdayKey[] = Array.isArray(rec.weekdays) ? rec.weekdays : [];
    patch({ recurrence: { ...rec, type: 'weekdays', weekdays: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] } });
  };

  const setRecType = (type: string) => {
    let next: any;
    if (type === 'daily') next = { type: 'daily' };
    else if (type === 'weekly') next = { type: 'weekly', intervalWeeks: Math.max(1, Number(rec.intervalWeeks || 1)) };
    else if (type === 'weekdays') next = { type: 'weekdays', intervalWeeks: Math.max(1, Number(rec.intervalWeeks || 1)), weekdays: Array.isArray(rec.weekdays) && rec.weekdays.length ? rec.weekdays : ['mo'] };
    else if (type === 'monthly') next = { type: 'monthly', intervalMonths: Math.max(1, Number(rec.intervalMonths || 1)), dayOfMonth: Math.max(1, Math.min(31, Number(rec.dayOfMonth || 1))) };
    else next = { type: 'yearly', month: Math.max(1, Math.min(12, Number(rec.month || 1))), day: Math.max(1, Math.min(31, Number(rec.day || 1))) };
    patch({ recurrence: next });
  };

  const canSave = (draft.title || '').trim().length > 0;

  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, marginTop: 14 };
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' };
  const chip = (on: boolean): React.CSSProperties => ({ padding: '7px 12px', borderRadius: 8, border: `1px solid ${on ? 'var(--accent-primary)' : 'var(--border)'}`, background: on ? 'var(--accent-primary)' : 'var(--bg-primary)', color: on ? '#fff' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--bg-secondary)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{isNew ? 'Neuer Serienauftrag' : 'Serienauftrag bearbeiten'}</h2>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: 24, lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '4px 20px 20px', maxHeight: '68vh', overflow: 'auto' }}>
          <label style={label}>Titel *</label>
          <input style={input} value={draft.title || ''} onChange={e => patch({ title: e.target.value })} placeholder="z. B. Wasser verteilen" autoFocus />

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Bereich</label>
              <input style={input} value={draft.area || ''} onChange={e => patch({ area: e.target.value })} placeholder="z. B. KV / Alle Wohnbereiche" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Ort / Detail</label>
              <input style={input} value={draft.location || ''} onChange={e => patch({ location: e.target.value })} placeholder="optional" />
            </div>
          </div>

          <label style={label}>Beschreibung</label>
          <textarea style={{ ...input, minHeight: 72, resize: 'vertical' }} value={draft.description || ''} onChange={e => patch({ description: e.target.value })} placeholder="Was ist zu tun? (erscheint im erzeugten Ticket)" />

          <label style={label}>Info-E-Mail bei Erledigung (optional)</label>
          <input style={input} type="text" value={draft.notifyEmail || ''} onChange={e => patch({ notifyEmail: e.target.value })} placeholder="z. B. leitung@drk.de" />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Wird automatisch benachrichtigt, sobald der Auftrag für den Tag vollständig abgehakt ist. Mehrere Adressen mit Komma trennen.
          </div>

          <label style={label}>Rolle</label>
          <select style={input} value={draft.targetRole} onChange={e => setRole(e.target.value as Role.Technician | Role.Housekeeping)}>
            <option value={Role.Technician}>Haustechniker</option>
            <option value={Role.Housekeeping}>Hauswirtschaft</option>
          </select>

          <label style={label}>Wiederholung</label>
          <select style={input} value={recType} onChange={e => setRecType(e.target.value)}>
            <option value="daily">Täglich</option>
            <option value="weekdays">Bestimmte Wochentage</option>
            <option value="weekly">Wöchentlich (nur Intervall)</option>
            <option value="monthly">Monatlich</option>
            <option value="yearly">Jährlich</option>
          </select>

          {(recType === 'weekdays' || recType === 'weekly') && (
            <>
              <label style={label}>Intervall (alle … Wochen)</label>
              <input type="number" min={1} style={input} value={Number(rec.intervalWeeks || 1)} onChange={e => patch({ recurrence: { ...rec, intervalWeeks: Math.max(1, parseInt(e.target.value || '1', 10)) } })} />
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>1 = jede Woche, 2 = alle 2 Wochen …</div>
            </>
          )}
          {recType === 'weekdays' && (
            <>
              <label style={label}>Wochentage</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {WEEKDAYS.map(w => {
                  const on = Array.isArray(rec.weekdays) && rec.weekdays.includes(w.key);
                  return <button key={w.key} type="button" onClick={() => toggleWeekday(w.key)} style={chip(on)}>{w.label}</button>;
                })}
              </div>
            </>
          )}
          {recType === 'monthly' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}><label style={label}>Alle … Monate</label><input type="number" min={1} style={input} value={Number(rec.intervalMonths || 1)} onChange={e => patch({ recurrence: { ...rec, intervalMonths: Math.max(1, parseInt(e.target.value || '1', 10)) } })} /></div>
              <div style={{ flex: 1 }}><label style={label}>Tag im Monat</label><input type="number" min={1} max={31} style={input} value={Number(rec.dayOfMonth || 1)} onChange={e => patch({ recurrence: { ...rec, dayOfMonth: Math.max(1, Math.min(31, parseInt(e.target.value || '1', 10))) } })} /></div>
            </div>
          )}
          {recType === 'yearly' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}><label style={label}>Monat</label><select style={input} value={Number(rec.month || 1)} onChange={e => patch({ recurrence: { ...rec, month: Number(e.target.value) } })}>{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
              <div style={{ flex: 1 }}><label style={label}>Tag</label><input type="number" min={1} max={31} style={input} value={Number(rec.day || 1)} onChange={e => patch({ recurrence: { ...rec, day: Math.max(1, Math.min(31, parseInt(e.target.value || '1', 10))) } })} /></div>
            </div>
          )}

          <label style={label}>Startdatum {(recType === 'monthly' || recType === 'yearly') ? '(erforderlich)' : '(optional)'}</label>
          <input type="date" style={input} value={draft.startDate || ''} onChange={e => patch({ startDate: e.target.value || null })} />

          <label style={label}>Zuweisung</label>
          <select style={input} value={draft.assignment?.type || 'rotate'} onChange={e => patch({ assignment: e.target.value === 'fixed' ? { type: 'fixed', userName: eligible[0] || '' } : { type: 'rotate' }, rotationCursor: 0 })}>
            <option value="rotate">Rotation (abwechselnd)</option>
            <option value="fixed">Fest (eine Person)</option>
          </select>
          {draft.assignment?.type === 'fixed' && (
            <>
              <label style={label}>Feste Person</label>
              <select style={input} value={(draft.assignment as any).userName || ''} onChange={e => patch({ assignment: { type: 'fixed', userName: e.target.value } })}>
                {eligible.length === 0 ? <option value="">— keine aktiven Mitarbeiter —</option> : eligible.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </>
          )}

          <label style={label}>Zuständige Mitarbeiter{draft.assignment?.type === 'rotate' ? ' (Rotations-Pool)' : ''}</label>
          {eligible.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Keine aktiven Mitarbeiter in dieser Rolle.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {eligible.map(n => {
                const on = (draft.assignees || []).includes(n);
                return <button key={n} type="button" onClick={() => toggleAssignee(n)} style={{ padding: '6px 11px', borderRadius: 8, border: `1px solid ${on ? 'var(--accent-primary)' : 'var(--border)'}`, background: on ? 'rgba(179,0,12,0.08)' : 'var(--bg-primary)', color: on ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{on ? '✓ ' : ''}{n}</button>;
              })}
            </div>
          )}

          <label style={label}>Unter-Aufgaben (Checkliste, optional)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(draft.subtasks || []).map((st, i) => (
              <div key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13, width: 16, textAlign: 'right' }}>{i + 1}.</span>
                <input
                  style={{ ...input, flex: 1 }}
                  value={st.label}
                  onChange={e => { const list = [...(draft.subtasks || [])]; list[i] = { ...st, label: e.target.value }; patch({ subtasks: list }); }}
                  placeholder={`z. B. Unkraut entfernen`}
                />
                <button type="button" title="Entfernen" aria-label="Entfernen" onClick={() => patch({ subtasks: (draft.subtasks || []).filter(x => x.id !== st.id) })} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => patch({ subtasks: [...(draft.subtasks || []), { id: `st-${Date.now()}-${Math.floor(Math.random() * 1000)}`, label: '' }] })}
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px dashed var(--border-active)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Punkt hinzufügen
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            Leer = nur der ganze Auftrag wird abgehakt. Mit Punkten wird jeder einzeln abgehakt (z. B. Unkraut / Müll / Mülleimer / Reinigung).
          </div>

          <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.enabled !== false} onChange={e => patch({ enabled: e.target.checked })} />
            Aktiv (erzeugt automatisch Termine)
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          {!isNew && (
            <button onClick={() => { if (window.confirm('Diesen Serienauftrag wirklich löschen?')) onDelete(draft.id); }} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--accent-danger, #dc3545)', background: 'var(--bg-secondary)', color: 'var(--accent-danger, #dc3545)', fontWeight: 600, cursor: 'pointer' }}>Löschen</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Abbrechen</button>
            <button onClick={() => canSave && onSave(draft)} disabled={!canSave} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: canSave ? 'var(--accent-primary)' : 'var(--border)', color: '#fff', fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed' }}>Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}
