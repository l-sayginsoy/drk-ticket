import React, { useMemo, useState } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User, WeekdayKey } from '../types';
import {
  getRoutineAssigneeDisplayName,
  getRoutinePool,
  isRoutineDueOnCalendarDay,
  localISODate,
  workWeekRefDate,
  ymdForWeekdayInWeekContaining,
} from '../utils/routineHelpers';
import { ROUTINE_TEAL } from '../utils/routineUiPalette';
import { displayNameShort } from '../utils/displayNames';
import { CheckIcon } from './icons/CheckIcon';
import RoutineEditorModal from './RoutineEditorModal';

interface RoutineSchedulesViewProps {
  userRole: Role;
  userName: string;
  schedules: Array<RoutineSchedule & { recurrence?: any }>;
  users: User[];
  /** Feiertage RP (YYYY-MM-DD), z. B. aus feiertage-api.de — für Fälligkeit inkl. Verschiebung */
  rpHolidayYmdList?: string[];
  onReorder: (fromId: string, toId: string) => void;
  completions: RoutineDayCompletion[];
  onComplete: (scheduleId: string) => void;
  onUncomplete: (scheduleId: string) => void;
  onSaveSchedule: (schedule: RoutineSchedule) => void;
  onDeleteSchedule: (id: string) => void;
}

const weekdayLabel: Record<WeekdayKey, string> = {
  mo: 'Mo',
  di: 'Di',
  mi: 'Mi',
  do: 'Do',
  fr: 'Fr',
  sa: 'Sa',
  so: 'So',
};

function formatInterval(schedule: RoutineSchedule & { recurrence?: any }): string {
  const rec = (schedule as any).recurrence;
  if (!rec || rec.type === 'daily') return 'Täglich';
  if (rec.type === 'weekly') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    return n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`;
  }
  if (rec.type === 'weekdays') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    const days: WeekdayKey[] = Array.isArray(rec.weekdays) ? rec.weekdays : [];
    const dayStr = days.map(d => weekdayLabel[d] || d).join(', ');
    const prefix = n === 1 ? '' : `Alle ${n} Wochen: `;
    return `${prefix}${dayStr || '—'}`;
  }
  if (rec.type === 'monthly') {
    const n = Math.max(1, Number(rec.intervalMonths || 1));
    const dom = Math.max(1, Math.min(31, Number(rec.dayOfMonth || 1)));
    return n === 1 ? `Monatlich am ${dom}.` : `Alle ${n} Monate am ${dom}.`;
  }
  if (rec.type === 'yearly') {
    const mo = Math.max(1, Math.min(12, Number(rec.month || 1)));
    const d = Math.max(1, Math.min(31, Number(rec.day || 1)));
    const mn = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][mo - 1];
    return `Jährlich ${mn} ${d}.`;
  }
  return '—';
}

/** Rhythmus-Gruppe für die gruppierte Anzeige: Sortier-Reihenfolge + Überschrift. */
function cadenceGroupOf(schedule: RoutineSchedule & { recurrence?: any }): { order: number; label: string } {
  const rec = (schedule as any).recurrence;
  if (!rec || rec.type === 'daily') return { order: 0, label: 'Täglich' };
  if (rec.type === 'weekly' || rec.type === 'weekdays') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    if (n === 1) return { order: 1, label: 'Wöchentlich' };
    if (n === 2) return { order: 2, label: 'Alle 2 Wochen' };
    return { order: 3, label: `Alle ${n} Wochen` };
  }
  if (rec.type === 'monthly') {
    const n = Math.max(1, Number(rec.intervalMonths || 1));
    return { order: 4, label: n === 1 ? 'Monatlich' : n === 3 ? 'Vierteljährlich' : `Alle ${n} Monate` };
  }
  if (rec.type === 'yearly') return { order: 5, label: 'Jährlich' };
  return { order: 9, label: 'Sonstige' };
}

/** Leerer Entwurf für einen neuen Serienauftrag (gleiche Defaults wie in den Einstellungen). */
function newRoutineDraft(): RoutineSchedule & { recurrence?: any } {
  return {
    id: `routine-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: '',
    description: '',
    area: '',
    location: '',
    targetRole: Role.Technician,
    assignees: [],
    assignment: { type: 'rotate' },
    enabled: true,
    lastGenerated: null,
    rotationCursor: 0,
    startDate: localISODate(new Date()),
    recurrence: { type: 'weekdays', intervalWeeks: 1, weekdays: ['mo'] },
  };
}

export default function RoutineSchedulesView(props: RoutineSchedulesViewProps) {
  const { userRole, userName, schedules, users, rpHolidayYmdList = [], onReorder, completions, onComplete, onUncomplete, onSaveSchedule, onDeleteSchedule } = props;
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ schedule: RoutineSchedule & { recurrence?: any }; isNew: boolean } | null>(null);
  const canEdit = userRole === Role.Admin;
  const todayYmd = useMemo(() => localISODate(new Date()), []);
  const rpHolidaySet = useMemo(() => new Set(rpHolidayYmdList), [rpHolidayYmdList]);

  const activeUsersByRole = useMemo(() => {
    const map = new Map<string, string[]>();
    const serviceTeam = users
      .filter(u => u.isActive && u.role === Role.Technician)
      .map(u => u.name)
      .sort((a, b) => a.localeCompare(b, 'de'));
    const housekeeping = users
      .filter(u => u.isActive && u.role === Role.Housekeeping)
      .map(u => u.name)
      .sort((a, b) => a.localeCompare(b, 'de'));
    map.set(Role.Technician, serviceTeam);
    map.set(Role.Housekeeping, housekeeping);
    return map;
  }, [users]);

  const visible = useMemo(() => {
    const enabled = schedules.filter(s => s.enabled);

    // Admin: alles sehen
    if (userRole === Role.Admin) return enabled;

    // Mitarbeiter: nur ihren Bereich + nur wenn sie in der Zuständigkeitsliste sind (oder Liste leer => alle im Bereich)
    return enabled.filter(s => {
      if (s.targetRole !== userRole) return false;
      const poolAll = activeUsersByRole.get(s.targetRole) || [];
      const assignees = (s as any).assignees as string[] | undefined;
      if (!assignees || assignees.length === 0) return true;
      return assignees.includes(userName) && poolAll.includes(userName);
    });
  }, [schedules, userRole, userName, activeUsersByRole]);

  // Nach Rhythmus gruppieren: Täglich → Wöchentlich → Alle 2 Wochen → … → Monatlich → Jährlich.
  const groups = useMemo(() => {
    const map = new Map<string, { order: number; label: string; items: Array<RoutineSchedule & { recurrence?: any }> }>();
    const seen: string[] = [];
    for (const s of visible) {
      const g = cadenceGroupOf(s);
      if (!map.has(g.label)) { map.set(g.label, { order: g.order, label: g.label, items: [] }); seen.push(g.label); }
      map.get(g.label)!.items.push(s);
    }
    return seen.map(l => map.get(l)!).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'de'));
  }, [visible]);

  const renderInterval = (s: RoutineSchedule & { recurrence?: any }) => {
    const rec = (s as any).recurrence;
    if (!rec || rec.type === 'daily') {
      return (
        <span className="routine-chip">Täglich</span>
      );
    }
    if (rec.type === 'weekly') {
      const n = Math.max(1, Number(rec.intervalWeeks || 1));
      return (
        <>
          <div className="routine-interval-label">Wöchentlich</div>
          {n !== 1 && <div className="routine-sub">{`alle ${n} Wochen`}</div>}
        </>
      );
    }
    if (rec.type === 'weekdays') {
      const n = Math.max(1, Number(rec.intervalWeeks || 1));
      const days: WeekdayKey[] = Array.isArray(rec.weekdays) ? rec.weekdays : [];
      return (
        <>
          <div className="routine-interval-label">
            {n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`}
          </div>
          <div className="routine-chips">
            {days.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>—</span>
            ) : (
              days.map((d: WeekdayKey) => {
                const chipYmd = ymdForWeekdayInWeekContaining(d, workWeekRefDate(new Date()));
                const doneThisDay = (completions || []).some(
                  (c) => c.scheduleId === s.id && c.date === chipYmd
                );
                return (
                  <span key={d} className={`routine-chip${doneThisDay ? ' routine-chip-past' : ''}`}>
                    {weekdayLabel[d] || d}
                  </span>
                );
              })
            )}
          </div>
        </>
      );
    }
    if (rec.type === 'monthly' || rec.type === 'yearly') {
      return (
        <>
          <div className="routine-interval-label">{rec.type === 'monthly' ? 'Monatlich' : 'Jährlich'}</div>
          <div className="routine-sub">{formatInterval(s)}</div>
        </>
      );
    }
    return <span>{formatInterval(s)}</span>;
  };

  return (
    <div style={{ maxWidth: 1800 }}>
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setEditing({ schedule: newRoutineDraft(), isNew: true })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 17, lineHeight: 1, marginTop: -1 }}>+</span> Neuer Serienauftrag
          </button>
        </div>
      )}
      <div className="routine-view-container">
        <style>{`
          .routine-view-container {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-top: 1.5rem;
            overflow: hidden;
          }
          .routine-table-wrap {
            overflow-x: auto;
          }
          .routine-table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            table-layout: fixed;
          }
          .routine-th {
            padding: 1rem 1rem;
            border-bottom: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 0.875rem;
            font-weight: 500;
            background-color: var(--bg-primary);
          }
          .routine-td {
            padding: 1rem 1rem;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
            color: var(--text-secondary);
            font-size: 0.9rem;
          }
          .routine-table tbody tr {
            transition: background-color 0.2s ease;
          }
          .routine-table tbody tr:hover {
            background-color: var(--bg-tertiary);
          }
          .routine-table tbody tr:last-child td {
            border-bottom: none;
          }
          .routine-table thead .routine-th:last-child,
          .routine-table tbody td.routine-td:last-child {
            text-align: center;
          }
          .routine-title, .routine-area {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            line-height: 1.25;
          }
          .routine-sub {
            color: var(--text-muted);
            font-size: 12px;
            margin-top: 6px;
            line-height: 1.35;
          }
          .routine-interval {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .routine-interval-label {
            font-size: 12px;
            font-weight: 800;
            color: var(--text-secondary);
            line-height: 1.2;
          }
          .routine-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .routine-chip {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid var(--border);
            background: var(--bg-tertiary);
            font-size: 12px;
            font-weight: 700;
            color: var(--text-secondary);
            line-height: 1.2;
          }
          .routine-chip-past {
            color: ${ROUTINE_TEAL.dark} !important;
            border-color: ${ROUTINE_TEAL.border} !important;
            background: ${ROUTINE_TEAL.bg} !important;
            font-weight: 700;
          }
          .routine-current {
            display: inline;
            padding: 0;
            border-radius: 0;
            font-size: 14px;
            font-weight: 600;
            border: none;
            background: transparent;
            color: rgb(25, 135, 84);
            max-width: 100%;
          }
          .routine-rotation {
            color: var(--text-muted);
            font-size: 12px;
            line-height: 1.35;
            margin-top: 8px;
            word-break: break-word;
          }
          .routine-rotation strong { font-weight: 700; }
          .routine-drag {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--bg-secondary);
            color: var(--text-muted);
            cursor: grab;
            user-select: none;
            margin-right: 10px;
          }
          .routine-drag:active { cursor: grabbing; }
          .routine-today-stack {
            display: inline-flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
            text-align: center;
            max-width: 100%;
          }
          .routine-today-circle {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            flex-shrink: 0;
            cursor: pointer;
            border: 2px solid transparent;
            background: var(--bg-secondary);
            color: var(--text-muted);
            font-family: inherit;
            line-height: 0;
            box-sizing: border-box;
          }
          .routine-today-circle--off {
            border-color: var(--border);
            background: var(--bg-tertiary);
          }
          .routine-today-circle--off:hover {
            border-color: var(--border-active);
            background: var(--bg-secondary);
          }
          .routine-today-circle--on {
            border-color: ${ROUTINE_TEAL.border};
            background: ${ROUTINE_TEAL.bg};
            color: ${ROUTINE_TEAL.dark};
          }
          button.routine-today-circle--on:hover {
            filter: brightness(0.96);
          }
          span.routine-today-circle--on {
            cursor: default;
          }
          .routine-today-by-under {
            font-size: 10px;
            font-weight: 600;
            color: var(--text-muted);
            line-height: 1.15;
            width: auto;
            max-width: 100%;
            text-align: center;
          }
          .routine-group-row td {
            background: var(--bg-tertiary);
            padding: 0.75rem 1rem 0.75rem 1.1rem;
            border-top: 1px solid var(--border-active);
            border-bottom: 1px solid var(--border-active);
            border-left: 4px solid var(--accent-primary);
            text-align: left;
          }
          .routine-group-row:hover td { background: var(--bg-tertiary); }
          .routine-group-cell {
            display: inline-flex;
            align-items: center;
            font-size: 0.82rem;
            font-weight: 800;
            letter-spacing: 0.07em;
            text-transform: uppercase;
            color: var(--text-primary);
          }
          .routine-group-count {
            margin-left: 10px;
            font-weight: 700;
            font-size: 0.72rem;
            color: var(--text-secondary);
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 1px 9px;
            line-height: 1.5;
          }
        `}</style>
        <div className="routine-table-wrap">
          <table className="routine-table">
            <thead>
              <tr>
                <th className="routine-th" style={{ width: '26%' }}>Aufgabe</th>
                <th className="routine-th" style={{ width: '18%' }}>Bereich</th>
                <th className="routine-th" style={{ width: '18%' }}>Intervall</th>
                <th className="routine-th" style={{ width: '22%' }}>Zuständig</th>
                <th className="routine-th" style={{ width: '16%' }}>Heute</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="routine-td" style={{ color: 'var(--text-muted)' }}>
                    Keine Serienaufträge vorhanden.
                  </td>
                </tr>
              ) : (
                groups.map(group => (
                  <React.Fragment key={group.label}>
                    <tr className="routine-group-row">
                      <td colSpan={5} className="routine-group-cell">
                        {group.label}
                        <span className="routine-group-count">{group.items.length}</span>
                      </td>
                    </tr>
                    {group.items.map(s => (
                  <tr
                    key={s.id}
                    onClick={canEdit ? () => setEditing({ schedule: s, isNew: false }) : undefined}
                    style={canEdit ? { cursor: 'pointer' } : undefined}
                    title={canEdit ? 'Zum Bearbeiten klicken' : undefined}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      onReorder(dragId, s.id);
                      setDragId(null);
                    }}
                  >
                    <td className="routine-td">
                      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <span
                          className="routine-drag"
                          draggable
                          onDragStart={(e) => {
                            setDragId(s.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => setDragId(null)}
                          onClick={(e) => e.stopPropagation()}
                          title="Reihenfolge ändern (ziehen)"
                        >
                          ⋮⋮
                        </span>
                        <div>
                          <div className="routine-title">{s.title || '—'}</div>
                          {s.description ? <div className="routine-sub">{s.description}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="routine-td">
                      <div className="routine-area">{String(s.area || '').trim() || '—'}</div>
                    </td>
                    <td className="routine-td">
                      <div className="routine-interval">{renderInterval(s)}</div>
                    </td>
                    <td className="routine-td">
                      {(() => {
                        const pool = getRoutinePool(s, users);
                        const current = getRoutineAssigneeDisplayName(s, pool, todayYmd);
                        const hasPool = pool.length > 0;
                        return (
                          <>
                            <span className="routine-current" style={{ fontWeight: 600 }} title={current}>
                              {displayNameShort(current)}
                            </span>
                            <div className="routine-rotation">
                              <strong>Rotation:</strong>{' '}
                              {hasPool ? pool.map((n) => displayNameShort(n)).join(', ') : '—'}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="routine-td">
                      {(() => {
                        const due = isRoutineDueOnCalendarDay(s, new Date(), rpHolidaySet);
                        if (!due) {
                          return (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          );
                        }
                        const pool = getRoutinePool(s, users);
                        const assignee = getRoutineAssigneeDisplayName(s, pool, todayYmd);
                        const completed = (completions || []).some(
                          (c) => c.scheduleId === s.id && c.date === todayYmd
                        );
                        const completion = (completions || []).find(
                          (c) => c.scheduleId === s.id && c.date === todayYmd
                        );
                        const canComplete =
                          !completed &&
                          (userRole === Role.Admin || assignee === userName);
                        const canUncomplete =
                          completed &&
                          (userRole === Role.Admin ||
                            assignee === userName ||
                            completion?.completedBy === userName);

                        const nameUnder =
                          completed && completion?.completedBy ? (
                            <div className="routine-today-by-under" title={completion.completedBy}>
                              {displayNameShort(completion.completedBy)}
                            </div>
                          ) : null;

                        const checkMark = <CheckIcon width={14} height={14} strokeWidth={2.5} aria-hidden />;

                        return (
                          <div className="routine-today-stack">
                            {!completed && canComplete ? (
                              <button
                                type="button"
                                className="routine-today-circle routine-today-circle--off"
                                title="Heute als erledigt markieren"
                                aria-label="Heute als erledigt markieren"
                                onClick={(e) => { e.stopPropagation(); onComplete(s.id); }}
                              />
                            ) : null}
                            {!completed && !canComplete ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                            ) : null}
                            {completed && canUncomplete ? (
                              <>
                                <button
                                  type="button"
                                  className="routine-today-circle routine-today-circle--on"
                                  title="Erledigt – Klick zum Zurücknehmen"
                                  aria-label="Erledigt, Klick zum Zurücknehmen"
                                  onClick={(e) => { e.stopPropagation(); onUncomplete(s.id); }}
                                >
                                  {checkMark}
                                </button>
                                {nameUnder}
                              </>
                            ) : null}
                            {completed && !canUncomplete ? (
                              <>
                                <span
                                  className="routine-today-circle routine-today-circle--on"
                                  title="Erledigt (Zurücknehmen nicht möglich)"
                                  aria-label="Erledigt"
                                >
                                  {checkMark}
                                </span>
                                {nameUnder}
                              </>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <RoutineEditorModal
          schedule={editing.schedule}
          isNew={editing.isNew}
          users={users}
          onSave={(s) => { onSaveSchedule(s); setEditing(null); }}
          onDelete={(id) => { onDeleteSchedule(id); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

