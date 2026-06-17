import React, { useMemo, useState } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User } from '../types';
import { getDueDatesInYear, getRoutineAssigneeDisplayName, getRoutinePool, isScheduleVisibleForUser, localISODate, routineDayStatus } from '../utils/routineHelpers';
import { ROUTINE_AMBER, ROUTINE_TEAL } from '../utils/routineUiPalette';
import { displayNameShort } from '../utils/displayNames';
import { CheckIcon } from './icons/CheckIcon';


const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function dayOfMonthFromYmd(ymd: string): number {
  const p = ymd.split('-');
  return p.length === 3 ? Number(p[2]) : 0;
}

function groupYmdsByMonth(ymds: string[]): Map<number, string[]> {
  const m = new Map<number, string[]>();
  ymds.forEach((ymd) => {
    const mo = Number(ymd.split('-')[1]) - 1;
    if (mo < 0 || mo > 11) return;
    if (!m.has(mo)) m.set(mo, []);
    m.get(mo)!.push(ymd);
  });
  m.forEach((arr) => arr.sort());
  return m;
}

function cadenceLabel(sch: RoutineSchedule & { recurrence?: any }): string {
  const rec: any = sch.recurrence;
  if (!rec || rec.type === 'daily') return 'Täglich';
  if (rec.type === 'weekly') { const n = Math.max(1, Number(rec.intervalWeeks || 1)); return n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`; }
  if (rec.type === 'weekdays') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    const map: Record<string, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
    const days = (Array.isArray(rec.weekdays) ? rec.weekdays : []).map((d: string) => map[d] || d).join(' · ');
    return (n === 1 ? '' : `Alle ${n} Wo · `) + (days || '—');
  }
  if (rec.type === 'monthly') { const n = Math.max(1, Number(rec.intervalMonths || 1)); return n === 1 ? 'Monatlich' : n === 3 ? 'Vierteljährlich' : `Alle ${n} Monate`; }
  if (rec.type === 'yearly') return 'Jährlich';
  return '—';
}

interface RoutineNachweisViewProps {
  schedules: Array<RoutineSchedule & { recurrence?: any }>;
  completions: RoutineDayCompletion[];
  users: User[];
  userRole: Role;
  userName: string;
  rpHolidayYmdList?: string[];
  /** Tage VOR diesem Datum (YYYY-MM-DD) zählen/zeigen NICHT als „verpasst" (vor Einführung). Leer = alles zählt. */
  missedSinceYmd?: string;
  /** Trägt eine Erledigung für einen beliebigen Tag ein (completedBy=null → entfernen). */
  onSetCompletion?: (scheduleId: string, ymd: string, completedBy: string | null) => void;
  /** Hakt eine einzelne Unter-Aufgabe ab/zurück (completedBy=null → entfernen). */
  onToggleSubtask?: (scheduleId: string, ymd: string, subtaskId: string, completedBy: string | null) => void;
}

export default function RoutineNachweisView({
  schedules,
  completions,
  users,
  userRole,
  userName,
  rpHolidayYmdList = [],
  missedSinceYmd = '',
  onSetCompletion,
  onToggleSubtask,
}: RoutineNachweisViewProps) {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [scheduleFilter, setScheduleFilter] = useState<string>('alle');
  const [personFilter, setPersonFilter] = useState<string>('alle');

  const todayYmd = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return localISODate(t);
  }, []);

  const currentMonthIndex = useMemo(() => new Date().getMonth(), []);
  const currentYearNum = useMemo(() => new Date().getFullYear(), []);

  const rpHolidaySet = useMemo(() => new Set(rpHolidayYmdList), [rpHolidayYmdList]);

  const visibleSchedules = useMemo(() => {
    const list = (schedules || []).filter((s) => isScheduleVisibleForUser(s, userRole, userName, users));
    if (scheduleFilter === 'alle') return list;
    return list.filter((s) => s.id === scheduleFilter);
  }, [schedules, userRole, userName, users, scheduleFilter]);

  const scheduleSelectOptions = useMemo(() => {
    return (schedules || []).filter((s) => isScheduleVisibleForUser(s, userRole, userName, users));
  }, [schedules, userRole, userName, users]);

  const personOptions = useMemo(() => {
    const names = new Set<string>();
    (completions || []).forEach((c) => names.add(c.completedBy));
    users
      .filter((u) => u.isActive && (u.role === Role.Technician || u.role === Role.Housekeeping || u.role === Role.Admin))
      .forEach((u) => names.add(u.name));
    return ['alle', ...Array.from(names).sort((a, b) => a.localeCompare(b, 'de'))];
  }, [completions, users]);

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    ys.add(currentYear);
    ys.add(currentYear - 1);
    ys.add(currentYear + 1);
    (completions || []).forEach((c) => {
      const y = Number(c.date.slice(0, 4));
      if (!Number.isNaN(y)) ys.add(y);
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [completions, currentYear]);

  const fmtYmd = (ymd: string) => {
    const [y, m, d] = ymd.split('-');
    return `${d}.${m}.${y}`;
  };

  const dueByScheduleId = useMemo(() => {
    const map = new Map<string, string[]>();
    visibleSchedules.forEach((sch) => {
      map.set(sch.id, getDueDatesInYear(sch, year, rpHolidaySet));
    });
    return map;
  }, [visibleSchedules, year, rpHolidaySet]);

  return (
    <div style={{ maxWidth: 1800 }}>
      <div className="nachweis-view-shell">
      <style>{`
        .nachweis-view-shell {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          margin-top: 1.5rem;
          overflow: hidden;
        }
        .nachweis-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
          padding: 14px 16px;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border);
        }
        .nachweis-field label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .nachweis-field select {
          min-width: 160px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 14px;
        }
        .nachweis-view-body {
          padding: 1rem 1.25rem 1.5rem;
          background: var(--bg-secondary);
        }
        .nachweis-legend {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .nachweis-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nachweis-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ── Schedule Section ── */
        .nachweis-section {
          margin-bottom: 20px;
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          background: var(--bg-secondary);
        }
        .nachweis-section-header {
          padding: 12px 16px;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .nachweis-section-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .nachweis-section-meta {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .nachweis-stats {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-shrink: 0;
        }
        .nachweis-stat-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .nachweis-stat-pill--done {
          background: ${ROUTINE_TEAL.bg};
          color: ${ROUTINE_TEAL.dark};
          border: 1px solid ${ROUTINE_TEAL.border};
        }
        .nachweis-stat-pill--missed {
          background: ${ROUTINE_AMBER.bg};
          color: ${ROUTINE_AMBER.dark};
          border: 1px solid ${ROUTINE_AMBER.border};
        }
        .nachweis-stat-pill--total {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border);
        }

        /* ── Month Grid ── */
        .nachweis-month-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
        }
        @media (max-width: 900px) {
          .nachweis-month-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 600px) {
          .nachweis-month-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .nachweis-month-card {
          padding: 12px 14px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .nachweis-month-card:nth-child(4n) { border-right: none; }
        .nachweis-month-card.future { opacity: 0.55; }

        .nachweis-month-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .nachweis-month-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .nachweis-month-summary {
          font-size: 11px;
          color: var(--text-muted);
          display: flex;
          gap: 6px;
        }
        .nachweis-month-summary span { font-weight: 600; }

        /* Progress bar */
        .nachweis-progress {
          height: 3px;
          border-radius: 2px;
          background: var(--border);
          margin-bottom: 10px;
          overflow: hidden;
          display: flex;
          gap: 1px;
        }
        .nachweis-progress-done {
          background: ${ROUTINE_TEAL.accent};
          height: 100%;
          transition: width 0.3s ease;
        }
        .nachweis-progress-missed {
          background: ${ROUTINE_AMBER.accent};
          height: 100%;
        }

        /* Mini calendar grid */
        .nachweis-cal {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .nachweis-cal th {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          text-align: center;
          padding: 0 0 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .nachweis-cal td {
          text-align: center;
          padding: 2px;
          height: 26px;
        }
        .nachweis-day {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 22px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 600;
          cursor: default;
        }
        .nachweis-day--done {
          background: ${ROUTINE_TEAL.bg};
          color: ${ROUTINE_TEAL.dark};
          border: 1px solid ${ROUTINE_TEAL.border};
        }
        .nachweis-day--missed {
          background: ${ROUTINE_AMBER.bg};
          color: ${ROUTINE_AMBER.dark};
          border: 1px solid ${ROUTINE_AMBER.border};
        }
        .nachweis-day--future {
          background: var(--bg-tertiary);
          color: var(--text-muted);
          border: 1px solid var(--border);
        }
        .nachweis-day--today {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 2px solid var(--accent-primary);
          font-weight: 700;
        }
        .nachweis-empty {
          font-size: 12px;
          color: var(--text-muted);
          font-style: italic;
        }

      `}</style>

      {/* Toolbar */}
      <div className="print-only" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, color: '#111' }}>Serien-Nachweis {year}</h1>
        <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
          {scheduleFilter === 'alle' ? 'Alle Aufgaben' : (scheduleSelectOptions.find((s) => s.id === scheduleFilter)?.title || scheduleFilter)}
          {' · '}
          {personFilter === 'alle' ? 'Alle Personen' : displayNameShort(personFilter)}
          {' · Stand: '}{fmtYmd(todayYmd)}
        </div>
      </div>
      <div className="nachweis-toolbar no-print">
        <div className="nachweis-field">
          <label htmlFor="nachweis-jahr">Jahr</label>
          <select id="nachweis-jahr" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="nachweis-field">
          <label htmlFor="nachweis-aufgabe">Aufgabe</label>
          <select id="nachweis-aufgabe" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
            <option value="alle">Alle sichtbaren</option>
            {scheduleSelectOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.title || s.id}</option>
            ))}
          </select>
        </div>
        <div className="nachweis-field">
          <label htmlFor="nachweis-person">Erledigt von</label>
          <select id="nachweis-person" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
            {personOptions.map((p) => (
              <option key={p} value={p}>{p === 'alle' ? 'Alle' : displayNameShort(p)}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          title="Diesen Nachweis drucken oder als PDF speichern"
          style={{ marginLeft: 'auto', alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
        >
          <i className="ti ti-printer" aria-hidden="true" /> Drucken / als PDF
        </button>
      </div>

      {/* Body */}
      <div className="nachweis-view-body">
        {/* Legend */}
        <div className="nachweis-legend">
          <div className="nachweis-legend-item">
            <div className="nachweis-legend-dot" style={{ background: ROUTINE_TEAL.accent }} />
            Erledigt
          </div>
          <div className="nachweis-legend-item">
            <div className="nachweis-legend-dot" style={{ background: ROUTINE_AMBER.accent }} />
            Verpasst
          </div>
          <div className="nachweis-legend-item">
            <div className="nachweis-legend-dot" style={{ background: 'var(--border-active)' }} />
            Ausstehend
          </div>
        </div>

        {/* Pro-Person-Auswertung: wer hat wie viel erledigt (sichtbare Routinen, dieses Jahr) */}
        {(() => {
          const visIds = new Set(visibleSchedules.map((s) => s.id));
          const counts = new Map<string, number>();
          (completions || []).forEach((c) => {
            if (!visIds.has(c.scheduleId)) return;
            if (!c.date.startsWith(String(year))) return;
            counts.set(c.completedBy, (counts.get(c.completedBy) || 0) + 1);
          });
          const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
          if (ranked.length === 0) return null;
          const max = ranked[0][1] || 1;
          const total = ranked.reduce((s, [, n]) => s + n, 0);
          return (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Erledigt nach Person · {year}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{total} Erledigungen gesamt</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {ranked.map(([name, n]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 130, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>{displayNameShort(name)}</span>
                    <div style={{ flex: 1, height: 16, background: 'var(--bg-tertiary)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((n / max) * 100)}%`, height: '100%', background: ROUTINE_TEAL.accent, borderRadius: 5 }} />
                    </div>
                    <span style={{ width: 32, textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: ROUTINE_TEAL.dark }}>{n}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Zählt erledigte Serientermine pro Person (sichtbare Aufgaben, {year}).
              </div>
            </div>
          );
        })()}

        <style>{`
          .nz-row { border: 1px solid var(--border); border-radius: 12px; background: var(--bg-secondary); margin-bottom: 8px; overflow: hidden; }
          .nz-head { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 12px 14px; font: inherit; color: inherit; }
          .nz-head:hover { background: var(--bg-tertiary); }
          .nz-title { font-weight: 700; font-size: 14px; color: var(--text-primary); flex: 1; min-width: 0; }
          .nz-area { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
          .nz-cad { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
          .nz-status { font-size: 12.5px; font-weight: 600; min-width: 96px; text-align: right; white-space: nowrap; }
          .nz-body { padding: 4px 14px 14px 38px; border-top: 1px solid var(--border); }
          .nz-sub { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
          .nz-sub:last-child { border-bottom: none; }
          .nz-circle { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border-active); background: var(--bg-tertiary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; padding: 0; color: #fff; }
          .nz-circle:disabled { cursor: default; opacity: 0.6; }
          .nz-circle--done { border-color: ${ROUTINE_TEAL.border}; background: ${ROUTINE_TEAL.accent}; }
        `}</style>
        {visibleSchedules.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '1rem 0', textAlign: 'center' }}>
            Keine Serienaufträge sichtbar.
          </div>
        ) : (
          <div>
            {visibleSchedules.map((sch) => {
              const dueList = dueByScheduleId.get(sch.id) || [];
              const pastOrToday = dueList.filter((d) => d <= todayYmd);
              const currentYmd = pastOrToday.length ? pastOrToday[pastOrToday.length - 1] : (dueList[0] || null);
              const pool = getRoutinePool(sch, users);
              const subtasks = sch.subtasks || [];
              const st = currentYmd ? routineDayStatus(sch, currentYmd, completions) : null;
              const assignee = currentYmd ? getRoutineAssigneeDisplayName(sch, pool, currentYmd) : '—';
              const canComplete = userRole === Role.Admin || assignee === userName;
              const expanded = !!openRows[sch.id];
              const wholeRec = currentYmd ? (completions || []).find((c) => c.scheduleId === sch.id && c.date === currentYmd && !c.subtaskId) : undefined;

              let statusEl;
              if (!currentYmd) {
                statusEl = <span style={{ color: 'var(--text-muted)' }}>—</span>;
              } else if (subtasks.length > 0) {
                const col = st!.complete ? ROUTINE_TEAL.dark : st!.anyDone ? ROUTINE_AMBER.dark : 'var(--text-muted)';
                statusEl = <span style={{ color: col }}>{st!.done}/{st!.total} erledigt</span>;
              } else if (st!.complete) {
                statusEl = <span style={{ color: ROUTINE_TEAL.dark, display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}><CheckIcon width={14} height={14} strokeWidth={2.5} aria-hidden /> erledigt</span>;
              } else {
                statusEl = <span style={{ color: ROUTINE_AMBER.dark }}>offen</span>;
              }

              return (
                <div key={sch.id} className="nz-row">
                  <button className="nz-head" onClick={() => setOpenRows((p) => ({ ...p, [sch.id]: !p[sch.id] }))} aria-expanded={expanded}>
                    <i className={`ti ti-chevron-${expanded ? 'down' : 'right'}`} style={{ color: 'var(--text-muted)', fontSize: 15, flexShrink: 0 }} aria-hidden />
                    <span className="nz-title">
                      {sch.title || '—'}
                      {subtasks.length > 0 ? <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>· {subtasks.length} Punkte</span> : null}
                    </span>
                    <span className="nz-area">{String(sch.area || '').trim() || '—'}</span>
                    <span className="nz-cad">{cadenceLabel(sch)}</span>
                    <span className="nz-status">{statusEl}</span>
                  </button>
                  {expanded ? (
                    <div className="nz-body">
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 10px' }}>
                        {currentYmd ? <>Aktueller Termin: {fmtYmd(currentYmd)} · zuständig: {displayNameShort(assignee)}</> : 'Noch kein fälliger Termin.'}
                      </div>

                      {currentYmd && subtasks.length > 0 ? subtasks.map((sub) => {
                        const done = st!.doneSubtaskIds.has(sub.id);
                        const rec = (completions || []).find((c) => c.scheduleId === sch.id && c.date === currentYmd && c.subtaskId === sub.id);
                        return (
                          <div key={sub.id} className="nz-sub">
                            <button className={`nz-circle${done ? ' nz-circle--done' : ''}`} disabled={!canComplete} onClick={() => onToggleSubtask && onToggleSubtask(sch.id, currentYmd, sub.id, done ? null : userName)} title={done ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'} aria-label={sub.label || 'Unter-Aufgabe'}>
                              {done ? <CheckIcon width={13} height={13} strokeWidth={3} aria-hidden /> : null}
                            </button>
                            <span style={{ flex: 1, fontSize: 14, color: done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{sub.label || '—'}</span>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{done && rec ? displayNameShort(rec.completedBy) : 'offen'}</span>
                          </div>
                        );
                      }) : null}

                      {currentYmd && subtasks.length === 0 ? (
                        <div className="nz-sub">
                          <button className={`nz-circle${st!.complete ? ' nz-circle--done' : ''}`} disabled={!canComplete} onClick={() => onSetCompletion && onSetCompletion(sch.id, currentYmd, st!.complete ? null : userName)} title={st!.complete ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'} aria-label="Auftrag erledigt">
                            {st!.complete ? <CheckIcon width={13} height={13} strokeWidth={3} aria-hidden /> : null}
                          </button>
                          <span style={{ flex: 1, fontSize: 14 }}>Ganzen Auftrag als erledigt markieren</span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{st!.complete ? (wholeRec ? displayNameShort(wholeRec.completedBy) : 'erledigt') : 'offen'}</span>
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Verlauf:</span>
                        {pastOrToday.slice(-8).map((d) => {
                          const s2 = routineDayStatus(sch, d, completions);
                          const past = d < todayYmd;
                          const counts = d >= missedSinceYmd;
                          let bg = 'var(--bg-tertiary)';
                          if (s2.complete) bg = ROUTINE_TEAL.accent;
                          else if (s2.anyDone) bg = ROUTINE_AMBER.accent;
                          else if (past && counts) bg = '#E24B4A';
                          return <span key={d} title={fmtYmd(d) + ': ' + (s2.complete ? 'erledigt' : s2.anyDone ? (s2.done + '/' + s2.total) : (past && counts ? 'verpasst' : 'geplant'))} style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: bg === 'var(--bg-tertiary)' ? '1px solid var(--border)' : 'none', flexShrink: 0 }} />;
                        })}
                        {pastOrToday.length === 0 ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>noch keine Termine</span> : null}
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jahresübersicht {year}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: ROUTINE_TEAL.accent }} /> erledigt</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: ROUTINE_AMBER.accent }} /> teilweise</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#E24B4A' }} /> verpasst</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }} /> geplant</span>
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                          {MONTHS_DE.map((mname, mi) => {
                            const mdays = dueList.filter((d) => Number(d.split('-')[1]) - 1 === mi).sort();
                            return (
                              <div key={mi} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-primary)' }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{mname}</div>
                                {mdays.length === 0 ? (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {mdays.map((d) => {
                                      const s2 = routineDayStatus(sch, d, completions);
                                      const past = d < todayYmd;
                                      const counts = d >= missedSinceYmd;
                                      let bg = 'var(--bg-tertiary)';
                                      let fg = 'var(--text-muted)';
                                      if (s2.complete) { bg = ROUTINE_TEAL.accent; fg = '#fff'; }
                                      else if (s2.anyDone) { bg = ROUTINE_AMBER.accent; fg = '#fff'; }
                                      else if (past && counts) { bg = '#E24B4A'; fg = '#fff'; }
                                      const dn = Number(d.split('-')[2]);
                                      return <span key={d} title={fmtYmd(d) + ': ' + (s2.complete ? 'erledigt' : s2.anyDone ? (s2.done + '/' + s2.total) : (past && counts ? 'verpasst' : 'geplant'))} style={{ width: 21, height: 21, borderRadius: 4, background: bg, color: fg, fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: bg === 'var(--bg-tertiary)' ? '1px solid var(--border)' : 'none' }}>{dn}</span>;
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
