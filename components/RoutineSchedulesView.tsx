import React, { useMemo, useState, useEffect } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User, WeekdayKey } from '../types';
import {
  getRoutineAssigneeDisplayName,
  getRoutinePool,
  isRoutineDueOnCalendarDay,
  localISODate,
  routineDayStatus,
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
  onToggleSubtask?: (scheduleId: string, ymd: string, subtaskId: string, completedBy: string | null) => void;
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

function nameToColor(name: string): string {
  const palette = ['#DC2626','#2563EB','#059669','#D97706','#7C3AED','#0891B2','#DB2777','#65A30D'];
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function getCadenceAccent(schedule: RoutineSchedule & { recurrence?: any }): string {
  const rec = (schedule as any).recurrence;
  if (!rec || rec.type === 'daily') return '#0EA5E9';
  if (rec.type === 'weekdays' || rec.type === 'weekly') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    return n === 1 ? '#8B5CF6' : '#EC4899';
  }
  if (rec.type === 'monthly') return '#F59E0B';
  if (rec.type === 'yearly') return '#10B981';
  return '#6B7280';
}

export default function RoutineSchedulesView(props: RoutineSchedulesViewProps) {
  const { userRole, userName, schedules, users, rpHolidayYmdList = [], onReorder, completions, onComplete, onUncomplete, onSaveSchedule, onDeleteSchedule, onToggleSubtask } = props;
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ schedule: RoutineSchedule & { recurrence?: any }; isNew: boolean } | null>(null);
  const [subPop, setSubPop] = useState<{ schedId: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const canEdit = userRole === Role.Admin;
  const [todayYmd, setTodayYmd] = useState(() => localISODate(new Date()));
  useEffect(() => {
    const tick = () => setTodayYmd(localISODate(new Date()));
    const id = setInterval(tick, 60_000); // jede Minute prüfen ob Tag gewechselt
    return () => clearInterval(id);
  }, []);
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

  const isTechRole = userRole === Role.Technician || userRole === Role.Housekeeping;
  const [myTasksOnly, setMyTasksOnly] = useState(isTechRole);

  const visible = useMemo(() => {
    const all = schedules.filter(s => s.enabled);
    if (myTasksOnly && isTechRole) {
      return all.filter(s => {
        const pool = getRoutinePool(s, users);
        const current = getRoutineAssigneeDisplayName(s, pool, todayYmd);
        return current === userName;
      });
    }
    return all;
  }, [schedules, myTasksOnly, isTechRole, users, todayYmd, userName]);

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
      const WEEKDAY_ORDER: WeekdayKey[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
      const days: WeekdayKey[] = (Array.isArray(rec.weekdays) ? rec.weekdays : []).slice().sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: '1.5rem', flexWrap: 'wrap' }}>
        {isTechRole && (
          <button
            type="button"
            onClick={() => setMyTasksOnly(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${myTasksOnly ? '#DC2626' : 'var(--border)'}`, background: myTasksOnly ? '#DC2626' : 'var(--bg-secondary)', color: myTasksOnly ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <i className="ti ti-user" aria-hidden />
            {myTasksOnly ? 'Alle anzeigen' : 'Meine Aufgaben'}
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({ schedule: newRoutineDraft(), isNew: true })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 17, lineHeight: 1, marginTop: -1 }}>+</span> Neuer Serienauftrag
          </button>
        )}
      </div>
      <style>{`
        .rs-col-hd {
          display: grid;
          grid-template-columns: 1fr 200px 220px 90px;
          padding: 0 0 6px;
          margin-top: 1.25rem;
        }
        .rs-col-hd > span {
          padding: 0 20px;
          font-size: 10.5px; font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .rs-col-hd > span:last-child { text-align: center; }
        .rs-group { display: flex; flex-direction: column; }
        .rs-group-hd {
          display: flex; align-items: center; gap: 10px;
          padding: 18px 0 8px;
        }
        .rs-group-label {
          font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--text-secondary); white-space: nowrap;
        }
        .rs-group-pill {
          font-size: 11px; font-weight: 700; color: var(--text-secondary); white-space: nowrap;
        }
        .rs-group-rule { flex: 1; height: 1px; background: var(--border); }
        .rs-card-list {
          border: 1px solid var(--border); border-radius: 12px;
          overflow: hidden; background: var(--bg-secondary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.07);
        }
        .rs-card {
          display: grid;
          grid-template-columns: 1fr 200px 220px 90px;
          align-items: center;
          min-height: 64px;
          border-bottom: 1px solid var(--border);
          border-left: 4px solid transparent;
          transition: background 0.12s;
        }
        .rs-card:last-child { border-bottom: none; }
        .rs-card:hover { background: var(--bg-tertiary); }
        .rs-card--clickable { cursor: pointer; }
        .rs-cell { padding: 13px 20px; min-width: 0; }
        .rs-title {
          font-size: 14px; font-weight: 700; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.35;
        }
        .rs-area {
          display: inline-flex; align-items: center; gap: 4px;
          margin-top: 4px; font-size: 11.5px; color: var(--text-muted);
        }
        .rs-chip {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 28px; height: 24px; border-radius: 6px;
          border: 1.5px solid var(--border); background: var(--bg-tertiary);
          font-size: 11px; font-weight: 700; color: var(--text-secondary); padding: 0 5px;
        }
        .rs-chip--done {
          background: ${ROUTINE_TEAL.bg}; color: ${ROUTINE_TEAL.dark}; border-color: ${ROUTINE_TEAL.border};
        }
        .rs-badge {
          display: inline-flex; align-items: center;
          font-size: 12px; font-weight: 600; color: var(--text-secondary);
          background: var(--bg-tertiary); border: 1px solid var(--border);
          border-radius: 20px; padding: 4px 12px; white-space: nowrap;
        }
        .rs-avatar {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; color: #fff;
        }
        .rs-person-name {
          font-size: 13.5px; font-weight: 600; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .rs-pool-hint {
          font-size: 11px; color: var(--text-muted); margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .rs-today-cell {
          padding: 13px 20px; display: flex; align-items: center; justify-content: center;
        }
        .rs-circle {
          width: 34px; height: 34px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0; flex-shrink: 0; border: 2px solid var(--border);
          background: var(--bg-tertiary); font-family: inherit; line-height: 0;
          cursor: pointer; box-sizing: border-box; transition: all 0.15s;
        }
        .rs-circle--off:hover { border-color: ${ROUTINE_TEAL.accent}; background: ${ROUTINE_TEAL.bg}; }
        .rs-circle--on { background: ${ROUTINE_TEAL.accent}; border-color: ${ROUTINE_TEAL.accent}; color: #fff; }
        button.rs-circle--on:hover { filter: brightness(0.88); }
        .rs-by { font-size: 10px; font-weight: 600; color: var(--text-muted); margin-top: 3px; }
        .rs-sub-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 13px; border-radius: 20px; cursor: pointer;
          font-size: 12.5px; font-weight: 700; font-family: inherit;
          border: 1.5px solid var(--border); background: var(--bg-tertiary); transition: all 0.12s;
        }
        .rs-sub-btn:hover { background: var(--bg-secondary); }
        /* SubTask popup circles */
        .routine-today-circle { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; cursor: pointer; border: 2px solid transparent; background: var(--bg-secondary); color: var(--text-muted); font-family: inherit; line-height: 0; box-sizing: border-box; }
        .routine-today-circle--off { border-color: var(--border); background: var(--bg-tertiary); }
        .routine-today-circle--off:hover { border-color: var(--border-active); }
        .routine-today-circle--on { border-color: ${ROUTINE_TEAL.accent}; background: ${ROUTINE_TEAL.accent}; color: #fff; }
        button.routine-today-circle--on:hover { filter: brightness(0.9); }
        span.routine-today-circle--on { cursor: default; }
        @media (max-width: 960px) {
          .rs-card, .rs-col-hd { grid-template-columns: 1fr 160px 180px 72px; }
        }
        @media (max-width: 660px) {
          .rs-card { grid-template-columns: 1fr 64px; min-height: 60px; }
          .rs-col-hd { display: none; }
          .rs-card .rs-cell:nth-child(2), .rs-card .rs-cell:nth-child(3) { display: none; }
          .rs-title { white-space: normal; line-height: 1.3; font-size: 13.5px; }
          .rs-cell { padding: 10px 14px; }
          .rs-today-cell { padding: 10px 0; min-height: 60px; }
          .rs-circle { width: 40px; height: 40px; }
          .rs-group-hd { padding: 14px 0 6px; }
        }
        /* Expand-Panel (Nachweis-Stil) */
        .rs-expand-body {
          border-top: 1px solid var(--border);
          padding: 20px 22px 22px;
          background: var(--bg-primary);
        }
        .rs-expand-info { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; }
        .rs-expand-info strong { color: var(--text-primary); font-weight: 700; }
        .rs-expand-sub-block { margin-bottom: 0; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 4px 14px; }
        .rs-expand-sub-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
        .rs-expand-sub-row:last-child { border-bottom: none; }
        .rs-expand-circle {
          width: 28px; height: 28px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0; flex-shrink: 0; cursor: pointer;
          border: 2px solid var(--border); background: var(--bg-tertiary);
          font-family: inherit; line-height: 0; box-sizing: border-box; transition: all 0.15s;
        }
        .rs-expand-circle--on { background: ${ROUTINE_TEAL.accent}; border-color: ${ROUTINE_TEAL.accent}; color: #fff; }
        .rs-expand-circle:disabled { cursor: default; opacity: 0.5; }
        .rs-expand-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 14px; }
      `}</style>

      {visible.length === 0 ? (
        <div style={{ marginTop: '1.5rem', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
          Keine Serienaufträge vorhanden.
        </div>
      ) : (
        <>
          <div className="rs-col-hd">
            <span>Aufgabe</span>
            <span>Fällig</span>
            <span>Zuständig</span>
            <span>Heute</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {groups.map(group => (
              <div key={group.label} className="rs-group">
                <div className="rs-group-hd">
                  <span className="rs-group-label">{group.label}</span>
                  <span className="rs-group-pill">{group.items.length}</span>
                  <span className="rs-group-rule" />
                </div>
                <div className="rs-card-list">
                  {group.items.map(s => {
                    const pool = getRoutinePool(s, users);
                    const poolLabel = pool.length > 1 ? pool.map(n => displayNameShort(n)).join(' · ') : null;
                    const current = getRoutineAssigneeDisplayName(s, pool, todayYmd);
                    const avatarColor = nameToColor(current);
                    const accentColor = getCadenceAccent(s);
                    const due = isRoutineDueOnCalendarDay(s, new Date(), rpHolidaySet);
                    const subtasks = s.subtasks || [];
                    const completed = (completions || []).some(c => c.scheduleId === s.id && c.date === todayYmd && !c.subtaskId);
                    const completion = (completions || []).find(c => c.scheduleId === s.id && c.date === todayYmd);
                    const canComplete = !completed && (userRole === Role.Admin || userRole === s.targetRole);
                    const canUncomplete = completed && (userRole === Role.Admin || userRole === s.targetRole || completion?.completedBy === userName);
                    const subtaskStatus = subtasks.length > 0 ? routineDayStatus(s, todayYmd, completions) : null;
                    const rec = (s as any).recurrence;
                    const WEEKDAY_ORDER: WeekdayKey[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
                    const isExpanded = expandedId === s.id;
                    const hasDetails = (s.description && String(s.description).trim()) || subtasks.length > 0;
                    return (
                      <div key={s.id} style={{ borderLeft: `3px solid ${accentColor}` }}>
                      <div
                        className={`rs-card${canEdit ? ' rs-card--clickable' : ''}`}
                        style={{ borderLeft: 'none' }}
                        onClick={canEdit ? () => setEditing({ schedule: s, isNew: false }) : undefined}
                        title={canEdit ? 'Zum Bearbeiten klicken' : undefined}
                      >
                        {/* Aufgabe */}
                        <div className="rs-cell">
                          <div className="rs-title" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : s.id); }}
                              style={{
                                background: 'none', border: 'none', padding: '0 6px 0 0', cursor: 'pointer',
                                color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                              }}
                              title={isExpanded ? 'Details einklappen' : 'Details anzeigen'}
                              aria-label={isExpanded ? 'Details einklappen' : 'Details anzeigen'}
                            >
                              <i className={`ti ti-chevron-${isExpanded ? 'down' : 'right'}`} style={{ fontSize: 13 }} />
                            </button>
                            <span>{s.title || '—'}</span>
                            {subtasks.length > 0 ? (
                              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>· {subtasks.length} Punkte</span>
                            ) : null}
                          </div>
                          {s.area && String(s.area).trim() ? (
                            <div className="rs-area" style={{ paddingLeft: 19 }}>
                              <i className="ti ti-map-pin" style={{ fontSize: 10 }} />
                              {String(s.area).trim()}
                            </div>
                          ) : null}
                        </div>
                        {/* Fällig */}
                        <div className="rs-cell">
                          {(() => {
                            if (!rec || rec.type === 'daily') return <span className="rs-badge">Täglich</span>;
                            if (rec.type === 'weekdays') {
                              const days: WeekdayKey[] = (Array.isArray(rec.weekdays) ? rec.weekdays : [])
                                .slice().sort((a: WeekdayKey, b: WeekdayKey) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
                              return (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {days.map((d: WeekdayKey) => {
                                    const chipYmd = ymdForWeekdayInWeekContaining(d, workWeekRefDate(new Date()));
                                    const done = (completions || []).some(c => c.scheduleId === s.id && c.date === chipYmd);
                                    return <span key={d} className={`rs-chip${done ? ' rs-chip--done' : ''}`}>{weekdayLabel[d]}</span>;
                                  })}
                                </div>
                              );
                            }
                            return <span className="rs-badge">{formatInterval(s)}</span>;
                          })()}
                        </div>
                        {/* Zuständig */}
                        <div className="rs-cell" title={poolLabel ? `Rotation: ${pool.join(', ')}` : undefined}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span className="rs-avatar" style={{ background: avatarColor }}>
                              {current.trim().charAt(0).toUpperCase()}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div className="rs-person-name">{displayNameShort(current)}</div>
                              {poolLabel && <div className="rs-pool-hint">{poolLabel}</div>}
                            </div>
                          </div>
                        </div>
                        {/* Heute */}
                        <div className="rs-today-cell">
                          {!due ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: 22, fontWeight: 200, lineHeight: 1 }}>—</span>
                          ) : subtasks.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSubPop({ schedId: s.id }); }}
                              title="Unter-Aufgaben abhaken"
                              className="rs-sub-btn"
                              style={{
                                color: subtaskStatus!.complete ? ROUTINE_TEAL.dark : subtaskStatus!.anyDone ? '#854F0B' : 'var(--text-muted)',
                                borderColor: subtaskStatus!.complete ? ROUTINE_TEAL.border : 'var(--border)',
                                background: subtaskStatus!.complete ? ROUTINE_TEAL.bg : 'var(--bg-tertiary)',
                              }}
                            >
                              {subtaskStatus!.complete ? <CheckIcon width={13} height={13} strokeWidth={2.5} aria-hidden /> : null}
                              {subtaskStatus!.done}/{subtaskStatus!.total}
                            </button>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              {!completed && canComplete ? (
                                <button type="button" className="rs-circle rs-circle--off"
                                  title="Heute als erledigt markieren" aria-label="Heute als erledigt markieren"
                                  onClick={(e) => { e.stopPropagation(); onComplete(s.id); }} />
                              ) : !completed ? (
                                <span style={{ color: 'var(--text-muted)', fontSize: 22, fontWeight: 200, lineHeight: 1 }}>—</span>
                              ) : canUncomplete ? (
                                <>
                                  <button type="button" className="rs-circle rs-circle--on"
                                    title="Erledigt – Klick zum Zurücknehmen" aria-label="Erledigt"
                                    onClick={(e) => { e.stopPropagation(); onUncomplete(s.id); }}>
                                    <CheckIcon width={15} height={15} strokeWidth={2.5} aria-hidden />
                                  </button>
                                  {completion?.completedBy && <div className="rs-by">{displayNameShort(completion.completedBy)}</div>}
                                </>
                              ) : (
                                <>
                                  <span className="rs-circle rs-circle--on" style={{ cursor: 'default' }} title="Erledigt" aria-label="Erledigt">
                                    <CheckIcon width={15} height={15} strokeWidth={2.5} aria-hidden />
                                  </span>
                                  {completion?.completedBy && <div className="rs-by">{displayNameShort(completion.completedBy)}</div>}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="rs-expand-body" onClick={e => e.stopPropagation()}>
                          {/* Info-Zeile */}
                          <div className="rs-expand-info">
                            {due
                              ? <>Aktueller Termin: <strong>Heute</strong> · zuständig: <strong>{displayNameShort(current)}</strong></>
                              : <>Nicht heute fällig · zuständig: <strong>{displayNameShort(current)}</strong></>
                            }
                          </div>
                          {/* Beschreibung */}
                          {s.description && String(s.description).trim() ? (
                            <p className="rs-expand-desc">{String(s.description).trim()}</p>
                          ) : null}
                          {/* Unteraufgaben oder ganzer Auftrag */}
                          {subtasks.length > 0 ? (
                            <div className="rs-expand-sub-block">
                              {subtasks.map((sub) => {
                                const subDone = (completions || []).some(c => c.scheduleId === s.id && c.date === todayYmd && c.subtaskId === sub.id);
                                const subRec = (completions || []).find(c => c.scheduleId === s.id && c.date === todayYmd && c.subtaskId === sub.id);
                                const canAct = due && (userRole === Role.Admin || userRole === s.targetRole);
                                return (
                                  <div key={sub.id} className="rs-expand-sub-row">
                                    <button
                                      className={`rs-expand-circle${subDone ? ' rs-expand-circle--on' : ''}`}
                                      disabled={!canAct}
                                      onClick={() => onToggleSubtask?.(s.id, todayYmd, sub.id, subDone ? null : userName)}
                                      title={subDone ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'}
                                    >
                                      {subDone ? <CheckIcon width={12} height={12} strokeWidth={3} aria-hidden /> : null}
                                    </button>
                                    <span style={{ flex: 1, fontSize: 14, color: subDone ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{sub.label || '—'}</span>
                                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{subDone && subRec ? displayNameShort(subRec.completedBy) : 'offen'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rs-expand-sub-block">
                              <div className="rs-expand-sub-row">
                                <button
                                  className={`rs-expand-circle${completed ? ' rs-expand-circle--on' : ''}`}
                                  disabled={!due || !(userRole === Role.Admin || userRole === s.targetRole)}
                                  onClick={() => completed ? onUncomplete(s.id) : onComplete(s.id)}
                                  title={completed ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'}
                                >
                                  {completed ? <CheckIcon width={12} height={12} strokeWidth={3} aria-hidden /> : null}
                                </button>
                                <span style={{ flex: 1, fontSize: 14 }}>Ganzen Auftrag als erledigt markieren</span>
                                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                  {completed ? (completion?.completedBy ? displayNameShort(completion.completedBy) : 'erledigt') : 'offen'}
                                </span>
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {subPop && (() => {
        const sched = visible.find((x) => x.id === subPop.schedId);
        if (!sched) return null;
        const subs = sched.subtasks || [];
        const assignee = getRoutineAssigneeDisplayName(sched, getRoutinePool(sched, users), todayYmd);
        const canAct = userRole === Role.Admin || userRole === sched.targetRole;
        const status = routineDayStatus(sched, todayYmd, completions);
        return (
          <div onClick={() => setSubPop(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', overflow: 'auto' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--bg-secondary)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{sched.title || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Heute · {status.done}/{status.total} erledigt</div>
                </div>
                <button onClick={() => setSubPop(null)} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: 24, lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: '6px 18px 16px' }}>
                {subs.map((sub) => {
                  const rec = (completions || []).find((c) => c.scheduleId === sched.id && c.date === todayYmd && c.subtaskId === sub.id);
                  const done = !!rec;
                  return (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        disabled={!canAct}
                        className={`routine-today-circle ${done ? 'routine-today-circle--on' : 'routine-today-circle--off'}`}
                        title={done ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'}
                        aria-label={sub.label || 'Unter-Aufgabe'}
                        onClick={() => onToggleSubtask && onToggleSubtask(sched.id, todayYmd, sub.id, done ? null : userName)}
                      >
                        {done ? <CheckIcon width={14} height={14} strokeWidth={2.5} aria-hidden /> : null}
                      </button>
                      <span style={{ flex: 1, fontSize: 14, color: done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{sub.label || '—'}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{done && rec ? displayNameShort(rec.completedBy) : 'offen'}</span>
                    </div>
                  );
                })}
                {!canAct && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Nur die zuständige Person oder ein Admin kann abhaken.</div>}
              </div>
            </div>
          </div>
        );
      })()}
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

