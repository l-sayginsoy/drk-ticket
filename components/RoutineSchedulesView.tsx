import React, { useMemo, useState, useEffect } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User, WeekdayKey } from '../types';
import {
  findWindowDueDate,
  getRoutineAssigneeDisplayName,
  getRoutinePool,
  isRoutineDueOnCalendarDay,
  lastDueDateUpTo,
  localISODate,
  nextDueDateFrom,
  parseYmdLocal,
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
  onComplete: (scheduleId: string, forDate?: string, comment?: string) => void;
  onUncomplete: (scheduleId: string, forDate?: string) => void;
  onSaveSchedule: (schedule: RoutineSchedule) => void;
  onDeleteSchedule: (id: string) => void;
  onToggleSubtask?: (scheduleId: string, ymd: string, subtaskId: string, completedBy: string | null, comment?: string) => void;
  /** Bereits quittierte vergessene Termine (Keys: `${scheduleId}|${ymd}`) */
  acknowledgedMissedRoutines?: string[];
  /** Verpassten Termin quittieren (Meldung zur Kenntnis nehmen) */
  onAcknowledgeMissed?: (scheduleId: string, ymd: string) => void;
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

/** Rhythmus-Gruppe für die gruppierte Anzeige: Sortier-Reihenfolge + Überschrift.
 *  Order = ungefähre Anzahl Tage zwischen Terminen → häufigste Aufträge oben. */
function cadenceGroupOf(schedule: RoutineSchedule & { recurrence?: any }): { order: number; label: string } {
  const rec = (schedule as any).recurrence;
  if (!rec || rec.type === 'daily') return { order: 1, label: 'Täglich' };
  if (rec.type === 'weekly' || rec.type === 'weekdays') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    const days = n * 7;
    const label = n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`;
    return { order: days, label };
  }
  if (rec.type === 'monthly') {
    const n = Math.max(1, Number(rec.intervalMonths || 1));
    const days = n * 30;
    const label = n === 1 ? 'Monatlich' : `Alle ${n} Monate`;
    return { order: days, label };
  }
  if (rec.type === 'yearly') return { order: 365, label: 'Jährlich' };
  return { order: 999, label: 'Sonstige' };
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

function formatDe(ymd: string): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
  const mon = ['Jan.', 'Feb.', 'Mär.', 'Apr.', 'Mai', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'][m - 1];
  const thisYear = new Date().getFullYear();
  const yearPart = y !== thisYear ? ` ${y}` : '';
  return `${dow}, ${d}. ${mon}${yearPart}`;
}

function daysRelLabel(days: number): string {
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days === -1) return 'Gestern';
  if (days < 0) return `Vor ${-days} Tagen`;
  if (days <= 13) return `In ${days} Tagen`;
  if (days <= 20) return 'In 2 Wochen';
  const w = Math.round(days / 7);
  return w <= 52 ? `In ${w} Wochen` : `In ${Math.round(days / 30)} Monaten`;
}

function compactRhythm(s: RoutineSchedule & { recurrence?: any }): string {
  const rec = (s as any).recurrence;
  if (!rec || rec.type === 'daily') return 'Täglich';
  if (rec.type === 'weekdays') {
    const ORDER: WeekdayKey[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
    const SHORT: Record<WeekdayKey, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
    const days: WeekdayKey[] = (Array.isArray(rec.weekdays) ? rec.weekdays : []).slice().sort((a: WeekdayKey, b: WeekdayKey) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    const prefix = n > 1 ? `Alle ${n} Wo · ` : '';
    return prefix + (days.length ? days.map((d: WeekdayKey) => SHORT[d]).join(', ') : '—');
  }
  if (rec.type === 'weekly') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    return n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`;
  }
  if (rec.type === 'monthly') {
    const n = Math.max(1, Number(rec.intervalMonths || 1));
    const dom = Math.max(1, Math.min(31, Number(rec.dayOfMonth || 1)));
    return n === 1 ? `Monatlich · ${dom}.` : `Alle ${n} Mo. · ${dom}.`;
  }
  if (rec.type === 'yearly') {
    const mo = Math.max(1, Math.min(12, Number(rec.month || 1)));
    const dom = Math.max(1, Math.min(31, Number(rec.day || 1)));
    const mon = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][mo - 1];
    return `Jährlich · ${dom}. ${mon}`;
  }
  return formatInterval(s);
}

export default function RoutineSchedulesView(props: RoutineSchedulesViewProps) {
  const { userRole, userName, schedules, users, rpHolidayYmdList = [], onReorder, completions, onComplete, onUncomplete, onSaveSchedule, onDeleteSchedule, onToggleSubtask, acknowledgedMissedRoutines = [], onAcknowledgeMissed } = props;
  const acknowledgedSet = useMemo(() => new Set(acknowledgedMissedRoutines), [acknowledgedMissedRoutines]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ schedule: RoutineSchedule & { recurrence?: any }; isNew: boolean } | null>(null);
  const [subPop, setSubPop] = useState<{ schedId: string; activeDate: string } | null>(null);
  const [subPopComment, setSubPopComment] = useState('');
  const [completeModal, setCompleteModal] = useState<{ schedId: string; forDate: string } | null>(null);
  const [completeComment, setCompleteComment] = useState('');
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
    // Admins sehen auch deaktivierte Aufträge (ausgegraut), damit sie reaktiviert werden können
    const all = canEdit ? schedules : schedules.filter(s => s.enabled);
    if (myTasksOnly && isTechRole) {
      return all.filter(s => {
        if (!s.enabled) return false;
        const pool = getRoutinePool(s, users);
        const current = getRoutineAssigneeDisplayName(s, pool, todayYmd);
        return current === userName;
      });
    }
    return all;
  }, [schedules, myTasksOnly, isTechRole, canEdit, users, todayYmd, userName]);

  type RowStatus = 'overdue' | 'today' | 'window' | 'done' | 'upcoming' | 'disabled';
  interface RoutineRow {
    schedule: RoutineSchedule & { recurrence?: any };
    pool: string[];
    assigneeName: string;
    subtasks: { id: string; label: string }[];
    status: RowStatus;
    activeDueDate: string | null;
    isDone: boolean;
    nextDate: string | null;
    daysUntil: number;
    currentDue: string | null;
    windowDate: string | null;
    dueToday: boolean;
    sortKey: number;
  }

  const rows = useMemo((): RoutineRow[] => {
    const today = parseYmdLocal(todayYmd);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return visible.map((s): RoutineRow => {
      const subtasks = (s.subtasks as { id: string; label: string }[] | undefined) || [];
      const pool = getRoutinePool(s, users);
      const assigneeName = getRoutineAssigneeDisplayName(s, pool, todayYmd);

      if (!s.enabled) {
        const nxt = nextDueDateFrom(s, today, rpHolidaySet);
        const days = nxt ? Math.round((parseYmdLocal(nxt).getTime() - today.getTime()) / 86400000) : 9999;
        return { schedule: s, pool, assigneeName, subtasks, status: 'disabled', activeDueDate: null, isDone: false, nextDate: nxt, daysUntil: days, currentDue: null, windowDate: null, dueToday: false, sortKey: 9999 };
      }

      const dueToday = isRoutineDueOnCalendarDay(s, today, rpHolidaySet);
      const windowDate = !dueToday ? findWindowDueDate(s, todayYmd, completions, rpHolidaySet) : null;
      const activeDueDate = dueToday ? todayYmd : (windowDate ?? null);
      const currentDue = lastDueDateUpTo(s, today, rpHolidaySet);

      const isDone = activeDueDate
        ? subtasks.length > 0
          ? routineDayStatus(s, activeDueDate, completions).complete
          : completions.some(c => c.scheduleId === s.id && c.date === activeDueDate && !c.subtaskId)
        : false;

      let nextDate: string | null;
      if (isDone) {
        nextDate = nextDueDateFrom(s, tomorrow, rpHolidaySet);
      } else if (dueToday) {
        nextDate = todayYmd;
      } else if (windowDate) {
        nextDate = windowDate;
      } else {
        nextDate = nextDueDateFrom(s, today, rpHolidaySet);
      }

      const daysUntil = nextDate
        ? Math.round((parseYmdLocal(nextDate).getTime() - today.getTime()) / 86400000)
        : 9999;

      let status: RowStatus;
      let sortKey: number;

      // Letzter Fälligkeitstag war erledigt, auch wenn er nicht mehr das activeDueDate ist
      // (z. B. wöchentlich: gestern fällig + erledigt → activeDueDate=null, isDone=false → falsches "Vergessen")
      const currentDueDone = !isDone && !!currentDue
        ? subtasks.length > 0
          ? routineDayStatus(s, currentDue!, completions).complete
          : completions.some(c => c.scheduleId === s.id && c.date === currentDue && !c.subtaskId)
        : false;

      const isAcknowledged = !!currentDue && acknowledgedSet.has(`${s.id}|${currentDue}`);
      const isOverdue = !dueToday && !windowDate && !!currentDue && currentDue < todayYmd && !isDone && !currentDueDone && !isAcknowledged;
      if (isOverdue) {
        status = 'overdue';
        const daysAgo = Math.round((today.getTime() - parseYmdLocal(currentDue!).getTime()) / 86400000);
        sortKey = -1000 + daysAgo;
      } else if (currentDueDone && !dueToday && !windowDate) {
        // Letzter Fälligkeitstag war erledigt, aber heute kein Fälligkeitstag:
        // kein ERLEDIGT-Badge zeigen (wäre missverständlich), einfach nächsten Termin anzeigen.
        status = 'upcoming';
        sortKey = 100 + Math.min(daysUntil, 500);
      } else if ((dueToday || windowDate) && !isDone) {
        status = dueToday ? 'today' : 'window';
        sortKey = dueToday ? 0 : 1;
      } else if (isDone) {
        status = 'done';
        sortKey = 500 + Math.min(daysUntil, 500);
      } else {
        status = 'upcoming';
        sortKey = 100 + Math.min(daysUntil, 500);
      }

      return { schedule: s, pool, assigneeName, subtasks, status, activeDueDate, isDone, nextDate, daysUntil, currentDue, windowDate: windowDate ?? null, dueToday, sortKey };
    }).sort((a, b) => a.sortKey - b.sortKey);
  }, [visible, completions, todayYmd, rpHolidaySet, users]);

  const statusMeta: Record<RowStatus, { color: string; label: string; bg: string }> = {
    overdue:  { color: '#DC2626', label: 'VERGESSEN',    bg: '#FEF2F2' },
    today:    { color: '#EA580C', label: 'HEUTE FÄLLIG', bg: '#FFF7ED' },
    window:   { color: '#D97706', label: 'NOCH OFFEN',   bg: '#FFFBEB' },
    done:     { color: '#059669', label: 'ERLEDIGT',     bg: '#F0FDF4' },
    upcoming: { color: '#6366F1', label: '',             bg: 'transparent' },
    disabled: { color: '#9CA3AF', label: 'INAKTIV',      bg: 'transparent' },
  };

  const overdueCount = rows.filter(r => r.status === 'overdue').length;
  const todayCount   = rows.filter(r => r.status === 'today').length;
  const windowCount  = rows.filter(r => r.status === 'window').length;
  const doneCount    = rows.filter(r => r.status === 'done').length;

  return (
    <div style={{ maxWidth: 1800 }}>
      <style>{`
        .rs2-topbar { display: flex; align-items: center; gap: 10; margin-top: 1.5rem; flex-wrap: wrap; }
        .rs2-stats  { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; }
        .rs2-stat-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1.5px solid; white-space: nowrap; }
        .rs2-thead {
          display: grid;
          grid-template-columns: 1fr 175px 185px 148px 72px 40px;
          padding: 0 0 5px; margin-top: 1.1rem;
          border-bottom: 2px solid var(--border);
        }
        .rs2-thead > span {
          padding: 0 14px; font-size: 10px; font-weight: 800; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .rs2-list { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--bg-secondary); box-shadow: 0 1px 4px rgba(0,0,0,0.07); margin-top: 8px; }
        .rs2-row {
          display: grid;
          grid-template-columns: 1fr 175px 185px 148px 72px 40px;
          align-items: center; min-height: 68px;
          border-bottom: 1px solid var(--border);
          border-left: 4px solid transparent;
          transition: background 0.1s;
        }
        .rs2-row:last-child { border-bottom: none; }
        .rs2-row:hover { background: var(--bg-tertiary); }
        .rs2-cell { padding: 12px 14px; min-width: 0; }
        .rs2-title { font-size: 14px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rs2-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rs2-status-badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 4px; margin-top: 4px; }
        .rs2-next-main { font-size: 13px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rs2-next-sub  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .rs2-next-warn { font-size: 11.5px; color: #DC2626; font-weight: 600; margin-bottom: 2px; }
        .rs2-avatar { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff; }
        .rs2-person-name { font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rs2-pool-hint { font-size: 10.5px; color: var(--text-muted); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rs2-action-cell { padding: 12px 0; display: flex; align-items: center; justify-content: center; }
        .rs2-circle { width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; border: 2px solid var(--border); background: var(--bg-tertiary); font-family: inherit; line-height: 0; cursor: pointer; box-sizing: border-box; transition: all 0.15s; }
        .rs2-circle--off:hover { border-color: ${ROUTINE_TEAL.accent}; background: ${ROUTINE_TEAL.bg}; }
        .rs2-circle--on { background: ${ROUTINE_TEAL.accent}; border-color: ${ROUTINE_TEAL.accent}; color: #fff; }
        button.rs2-circle--on:hover { filter: brightness(0.88); }
        .rs2-by { font-size: 10px; font-weight: 600; color: var(--text-muted); margin-top: 3px; }
        .rs2-sub-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 700; font-family: inherit; border: 1.5px solid var(--border); background: var(--bg-tertiary); transition: all 0.12s; }
        .rs2-sub-btn:hover { background: var(--bg-secondary); }
        .rs2-edit-btn { width: 32px; height: 32px; border-radius: 7px; border: 1px solid var(--border); background: none; color: var(--text-muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.12s; font-size: 15px; }
        .rs2-edit-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
        /* SubTask popup circles */
        .routine-today-circle { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; cursor: pointer; border: 2px solid transparent; background: var(--bg-secondary); color: var(--text-muted); font-family: inherit; line-height: 0; box-sizing: border-box; }
        .routine-today-circle--off { border-color: var(--border); background: var(--bg-tertiary); }
        .routine-today-circle--off:hover { border-color: var(--border-active); }
        .routine-today-circle--on { border-color: ${ROUTINE_TEAL.accent}; background: ${ROUTINE_TEAL.accent}; color: #fff; }
        button.routine-today-circle--on:hover { filter: brightness(0.9); }
        span.routine-today-circle--on { cursor: default; }
        @media (max-width: 1100px) {
          .rs2-row, .rs2-thead { grid-template-columns: 1fr 175px 140px 72px 40px; }
          .rs2-row .rs2-cell:nth-child(2), .rs2-thead > span:nth-child(2) { display: none; }
        }
        @media (max-width: 700px) {
          .rs2-row, .rs2-thead { grid-template-columns: 1fr 72px 36px; }
          .rs2-row .rs2-cell:nth-child(3), .rs2-row .rs2-cell:nth-child(4), .rs2-thead > span:nth-child(3), .rs2-thead > span:nth-child(4) { display: none; }
          .rs2-row .rs2-cell:nth-child(6) { display: none; }
          .rs2-cell { padding: 10px 12px; }
          .rs2-title { font-size: 13.5px; white-space: normal; }
        }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '1.5rem', flexWrap: 'wrap' }}>
        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', flex: 1 }}>
          {overdueCount > 0 && (
            <span className="rs2-stat-chip" style={{ color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} /> {overdueCount} Vergessen
            </span>
          )}
          {todayCount > 0 && (
            <span className="rs2-stat-chip" style={{ color: '#EA580C', borderColor: '#FED7AA', background: '#FFF7ED' }}>
              <i className="ti ti-clock" style={{ fontSize: 12 }} /> {todayCount} Heute fällig
            </span>
          )}
          {windowCount > 0 && (
            <span className="rs2-stat-chip" style={{ color: '#D97706', borderColor: '#FDE68A', background: '#FFFBEB' }}>
              <i className="ti ti-hourglass" style={{ fontSize: 12 }} /> {windowCount} Noch offen
            </span>
          )}
          {doneCount > 0 && (
            <span className="rs2-stat-chip" style={{ color: '#059669', borderColor: '#A7F3D0', background: '#F0FDF4' }}>
              <i className="ti ti-check" style={{ fontSize: 12 }} /> {doneCount} Erledigt
            </span>
          )}
        </div>
        {isTechRole && (
          <button type="button" onClick={() => setMyTasksOnly(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${myTasksOnly ? '#DC2626' : 'var(--border)'}`, background: myTasksOnly ? '#DC2626' : 'var(--bg-secondary)', color: myTasksOnly ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', transition: 'all 0.15s' }}>
            <i className="ti ti-user" aria-hidden />{myTasksOnly ? 'Alle anzeigen' : 'Meine Aufgaben'}
          </button>
        )}
        {canEdit && (
          <button type="button" onClick={() => setEditing({ schedule: newRoutineDraft(), isNew: true })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
            <span style={{ fontSize: 17, lineHeight: 1, marginTop: -1 }}>+</span> Neuer Serienauftrag
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{ marginTop: '1.5rem', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
          Keine Serienaufträge vorhanden.
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="rs2-thead">
            <span>Aufgabe</span>
            <span>Rhythmus</span>
            <span>Nächster Termin</span>
            <span>Zuständig</span>
            <span style={{ textAlign: 'center' }}>Abhaken</span>
            <span />
          </div>
          <div className="rs2-list">
            {rows.map(row => {
              const { schedule: s, pool, assigneeName, subtasks, status, activeDueDate, isDone, nextDate, daysUntil, currentDue, windowDate, dueToday } = row;
              const meta = statusMeta[status];
              const avatarColor = nameToColor(assigneeName);
              const poolLabel = pool.length > 1 ? pool.map(n => displayNameShort(n)).join(' · ') : null;
              const canAct = !isDone && !!activeDueDate && (userRole === Role.Admin || userRole === s.targetRole);
              const canUndo = isDone && !!activeDueDate && (userRole === Role.Admin || userRole === s.targetRole);
              const completion = activeDueDate ? (completions || []).find(c => c.scheduleId === s.id && c.date === activeDueDate && !c.subtaskId) : undefined;
              const subStatus = subtasks.length > 0 && activeDueDate ? routineDayStatus(s, activeDueDate, completions) : null;

              return (
                <div key={s.id} className="rs2-row" style={{ borderLeftColor: meta.color, opacity: status === 'disabled' ? 0.5 : 1 }}>
                  {/* Col 1: Aufgabe */}
                  <div className="rs2-cell">
                    <div className="rs2-title">{s.title || '—'}{subtasks.length > 0 ? <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>· {subtasks.length} Pkt.</span> : null}</div>
                    <div className="rs2-sub">
                      {s.area && String(s.area).trim() ? <><i className="ti ti-map-pin" style={{ fontSize: 10, flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(s.area).trim()}</span></> : null}
                    </div>
                    {meta.label ? (
                      <span className="rs2-status-badge" style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}30` }}>{meta.label}</span>
                    ) : null}
                  </div>

                  {/* Col 2: Rhythmus / Wochentag-Chips */}
                  <div className="rs2-cell">
                    {(() => {
                      const rec = (s as any).recurrence;
                      const isWeekdays = rec?.type === 'weekdays' || rec?.type === 'daily' || !rec;
                      if (!isWeekdays) {
                        return <span style={{ color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 500 }}>{compactRhythm(s)}</span>;
                      }
                      const ORDER: WeekdayKey[] = ['mo','di','mi','do','fr','sa','so'];
                      const SHORT: Record<WeekdayKey, string> = { mo:'Mo', di:'Di', mi:'Mi', do:'Do', fr:'Fr', sa:'Sa', so:'So' };
                      const weekdays: WeekdayKey[] = rec?.type === 'weekdays'
                        ? (Array.isArray(rec.weekdays) ? rec.weekdays : []).slice().sort((a: WeekdayKey, b: WeekdayKey) => ORDER.indexOf(a) - ORDER.indexOf(b))
                        : ['mo','di','mi','do','fr'] as WeekdayKey[];
                      const intervalLabel = rec?.type === 'weekdays' && Number(rec.intervalWeeks || 1) > 1
                        ? `${rec.intervalWeeks}W` : null;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'nowrap' }}>
                          {intervalLabel && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2, flexShrink: 0, whiteSpace: 'nowrap' }}>{intervalLabel} ·</span>
                          )}
                          {weekdays.map(dayKey => {
                            const chipYmd = ymdForWeekdayInWeekContaining(dayKey, parseYmdLocal(todayYmd));
                            const isToday = chipYmd === todayYmd;
                            const doneToday = isToday && s.enabled && completions.some(c => c.scheduleId === s.id && c.date === chipYmd);
                            const dueTodayOpen = isToday && !doneToday && (status === 'today');

                            if (doneToday) {
                              return (
                                <span key={dayKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: '#059669', color: '#fff', flexShrink: 0 }}>
                                  <span style={{ fontSize: 9 }}>✓</span>{SHORT[dayKey]}
                                </span>
                              );
                            } else if (dueTodayOpen) {
                              return (
                                <span key={dayKey} style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: '#FFF7ED', color: '#EA580C', border: '1.5px solid #FED7AA', flexShrink: 0 }}>
                                  {SHORT[dayKey]}
                                </span>
                              );
                            } else {
                              // Alle anderen Tage (vergangen, zukünftig): neutral grau
                              return (
                                <span key={dayKey} style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', padding: '0 2px', flexShrink: 0 }}>
                                  {SHORT[dayKey]}
                                </span>
                              );
                            }
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Col 3: Nächster Termin */}
                  <div className="rs2-cell">
                    {status === 'overdue' && currentDue ? (
                      <>
                        <div className="rs2-next-warn"><i className="ti ti-alert-triangle" style={{ fontSize: 11 }} /> Vergessen: {formatDe(currentDue)}</div>
                        {nextDate && nextDate !== currentDue ? (
                          <div className="rs2-next-sub">Nächster: {formatDe(nextDate)} · {daysRelLabel(daysUntil)}</div>
                        ) : null}
                        {onAcknowledgeMissed && canEdit && (
                          <button
                            type="button"
                            onClick={() => onAcknowledgeMissed(s.id, currentDue)}
                            style={{ marginTop: 4, background: 'none', border: '1px solid #FCA5A5', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', color: '#DC2626', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
                            title="Zur Kenntnis genommen – verschwindet aus der Vergessen-Liste">
                            Zur Kenntnis nehmen
                          </button>
                        )}
                      </>
                    ) : status === 'window' && windowDate ? (
                      <>
                        <div className="rs2-next-main" style={{ color: '#D97706' }}>Offen seit {formatDe(windowDate)}</div>
                        {nextDate && nextDate !== windowDate ? (
                          <div className="rs2-next-sub">Nächster: {formatDe(nextDate)}</div>
                        ) : null}
                      </>
                    ) : status === 'today' ? (
                      <div className="rs2-next-main" style={{ color: '#EA580C' }}>Heute fällig</div>
                    ) : nextDate ? (
                      <>
                        <div className="rs2-next-main" style={{ color: status === 'done' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{formatDe(nextDate)}</div>
                        <div className="rs2-next-sub" style={{ color: daysUntil <= 2 ? '#D97706' : 'var(--text-muted)' }}>{daysRelLabel(daysUntil)}</div>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                    )}
                  </div>

                  {/* Col 4: Zuständig */}
                  <div className="rs2-cell" title={poolLabel ? `Rotation: ${pool.join(', ')}` : undefined}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span className="rs2-avatar" style={{ background: avatarColor }}>{assigneeName.trim().charAt(0).toUpperCase()}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="rs2-person-name">{displayNameShort(assigneeName)}</div>
                        {poolLabel && <div className="rs2-pool-hint">{poolLabel}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Col 5: Abhaken */}
                  <div className="rs2-action-cell">
                    {!activeDueDate ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: 20, fontWeight: 200, lineHeight: 1 }}>—</span>
                    ) : subtasks.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <button type="button" className="rs2-sub-btn"
                          onClick={() => setSubPop({ schedId: s.id, activeDate: activeDueDate })}
                          style={{ color: subStatus?.complete ? ROUTINE_TEAL.dark : subStatus?.anyDone ? '#854F0B' : 'var(--text-muted)', borderColor: subStatus?.complete ? ROUTINE_TEAL.border : 'var(--border)', background: subStatus?.complete ? ROUTINE_TEAL.bg : 'var(--bg-tertiary)' }}>
                          {subStatus?.complete ? <CheckIcon width={12} height={12} strokeWidth={2.5} aria-hidden /> : null}
                          {subStatus?.done}/{subStatus?.total}
                        </button>
                      </div>
                    ) : isDone ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {canUndo ? (
                          <button type="button" className="rs2-circle rs2-circle--on"
                            title="Erledigt – Klick zum Zurücknehmen"
                            onClick={() => onUncomplete(s.id, activeDueDate)}>
                            <CheckIcon width={15} height={15} strokeWidth={2.5} aria-hidden />
                          </button>
                        ) : (
                          <span className="rs2-circle rs2-circle--on" style={{ cursor: 'default' }}>
                            <CheckIcon width={15} height={15} strokeWidth={2.5} aria-hidden />
                          </span>
                        )}
                        {completion?.completedBy && <div className="rs2-by">{displayNameShort(completion.completedBy)}</div>}
                      </div>
                    ) : canAct ? (
                      <button type="button" className="rs2-circle rs2-circle--off"
                        title="Als erledigt markieren" aria-label="Als erledigt markieren"
                        onClick={() => { setCompleteModal({ schedId: s.id, forDate: activeDueDate }); setCompleteComment(''); }} />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 20, fontWeight: 200, lineHeight: 1 }}>—</span>
                    )}
                  </div>

                  {/* Col 6: Edit */}
                  <div style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {canEdit && (
                      <button type="button" className="rs2-edit-btn"
                        title={s.enabled ? 'Bearbeiten' : 'Deaktiviert – zum Reaktivieren klicken'}
                        onClick={() => setEditing({ schedule: s, isNew: false })}>
                        <i className="ti ti-pencil" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {subPop && (() => {
        const sched = visible.find((x) => x.id === subPop.schedId);
        if (!sched) return null;
        const subs = sched.subtasks || [];
        const assignee = getRoutineAssigneeDisplayName(sched, getRoutinePool(sched, users), todayYmd);
        const canAct = userRole === Role.Admin || userRole === sched.targetRole;
        const popDate = subPop.activeDate;
        const status = routineDayStatus(sched, popDate, completions);
        const popDateLabel = popDate === todayYmd ? 'Heute' : `${popDate.split('-')[2]}.${popDate.split('-')[1]}.`;
        return (
          <div onClick={() => { setSubPop(null); setSubPopComment(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', overflow: 'auto' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--bg-secondary)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{sched.title || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{popDateLabel} · {status.done}/{status.total} erledigt</div>
                </div>
                <button onClick={() => { setSubPop(null); setSubPopComment(''); }} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: 24, lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: '6px 18px 16px' }}>
                {subs.map((sub) => {
                  const rec = (completions || []).find((c) => c.scheduleId === sched.id && c.date === popDate && c.subtaskId === sub.id);
                  const done = !!rec;
                  return (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        disabled={!canAct}
                        className={`routine-today-circle ${done ? 'routine-today-circle--on' : 'routine-today-circle--off'}`}
                        title={done ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'}
                        aria-label={sub.label || 'Unter-Aufgabe'}
                        onClick={() => onToggleSubtask && onToggleSubtask(sched.id, popDate, sub.id, done ? null : userName, subPopComment.trim() || undefined)}
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
              {canAct && (
                <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border)' }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 5px' }}>
                    Kommentar
                  </label>
                  <textarea
                    value={subPopComment}
                    onChange={e => setSubPopComment(e.target.value)}
                    placeholder="z. B. Alles geprüft, kein Handlungsbedarf"
                    rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Wird beim Abklicken der letzten Aufgabe mit der Info-Mail versendet (nur wenn E-Mail hinterlegt).</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {completeModal && (() => {
        const sched = visible.find(x => x.id === completeModal.schedId);
        const dateLabel = completeModal.forDate === todayYmd ? 'Heute' : `${completeModal.forDate.split('-')[2]}.${completeModal.forDate.split('-')[1]}.`;
        return (
          <div onClick={() => setCompleteModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', overflow: 'auto' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--bg-secondary)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{sched?.title || 'Erledigt markieren'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dateLabel} als erledigt markieren</div>
                </div>
                <button onClick={() => setCompleteModal(null)} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: 24, lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Kommentar
                </label>
                <textarea
                  value={completeComment}
                  onChange={e => setCompleteComment(e.target.value)}
                  placeholder="z. B. Alles geprüft, kein Handlungsbedarf"
                  rows={3}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 13, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Wird in der Info-Mail mitgeschickt (nur wenn E-Mail hinterlegt ist).</div>
              </div>
              <div style={{ padding: '4px 18px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setCompleteModal(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Abbrechen</button>
                <button
                  onClick={() => {
                    onComplete(completeModal.schedId, completeModal.forDate, completeComment.trim() || undefined);
                    setCompleteModal(null);
                    setCompleteComment('');
                  }}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: ROUTINE_TEAL.accent, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  Erledigt speichern
                </button>
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

