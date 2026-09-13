import React, { useMemo, useState } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User } from '../types';
import { getDueDatesInYear, getRoutineAssigneeDisplayName, getRoutinePool, localISODate, routineDayStatus } from '../utils/routineHelpers';
import { ROUTINE_AMBER, ROUTINE_TEAL } from '../utils/routineUiPalette';
import { displayNameShort } from '../utils/displayNames';
import { CheckIcon } from './icons/CheckIcon';

const MONTHS_FULL = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function nvNameColor(name: string): string {
  const p = ['#DC2626','#2563EB','#059669','#D97706','#7C3AED','#0891B2','#DB2777','#65A30D'];
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  return p[Math.abs(h) % p.length];
}

function nvAccent(sch: RoutineSchedule & { recurrence?: any }): string {
  const rec = (sch as any).recurrence;
  if (!rec || rec.type === 'daily') return '#0EA5E9';
  if (rec.type === 'weekdays' || rec.type === 'weekly') {
    return Math.max(1, Number(rec.intervalWeeks || 1)) === 1 ? '#8B5CF6' : '#EC4899';
  }
  if (rec.type === 'monthly') return '#F59E0B';
  if (rec.type === 'yearly') return '#10B981';
  return '#6B7280';
}

function cadenceLabel(sch: RoutineSchedule & { recurrence?: any }): string {
  const rec: any = sch.recurrence;
  if (!rec || rec.type === 'daily') return 'Täglich';
  if (rec.type === 'weekly') { const n = Math.max(1, Number(rec.intervalWeeks || 1)); return n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`; }
  if (rec.type === 'weekdays') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    const map: Record<string, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
    const ORDER = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
    const days = (Array.isArray(rec.weekdays) ? rec.weekdays : []).slice().sort((a: string, b: string) => ORDER.indexOf(a) - ORDER.indexOf(b)).map((d: string) => map[d] || d).join(' · ');
    return (n === 1 ? '' : `Alle ${n} Wo · `) + (days || '—');
  }
  if (rec.type === 'monthly') { const n = Math.max(1, Number(rec.intervalMonths || 1)); return n === 1 ? 'Monatlich' : n === 3 ? 'Vierteljährl.' : `Alle ${n} Monate`; }
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
  missedSinceYmd?: string;
  onSetCompletion?: (scheduleId: string, ymd: string, completedBy: string | null) => void;
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

  const todayYmd = useMemo(() => localISODate(new Date()), []);
  const rpHolidaySet = useMemo(() => new Set(rpHolidayYmdList), [rpHolidayYmdList]);

  const visibleSchedules = useMemo(() => {
    const list = (schedules || []).filter((s) => s.enabled);
    if (scheduleFilter === 'alle') return list;
    return list.filter((s) => s.id === scheduleFilter);
  }, [schedules, scheduleFilter]);

  const scheduleSelectOptions = useMemo(() => (schedules || []).filter((s) => s.enabled), [schedules]);

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    ys.add(currentYear); ys.add(currentYear - 1); ys.add(currentYear + 1);
    (completions || []).forEach((c) => { const y = Number(c.date.slice(0, 4)); if (!Number.isNaN(y)) ys.add(y); });
    return Array.from(ys).sort((a, b) => b - a);
  }, [completions, currentYear]);

  const dueByScheduleId = useMemo(() => {
    const map = new Map<string, string[]>();
    visibleSchedules.forEach((sch) => { map.set(sch.id, getDueDatesInYear(sch, year, rpHolidaySet)); });
    return map;
  }, [visibleSchedules, year, rpHolidaySet]);

  const fmtYmd = (ymd: string) => { const [y, m, d] = ymd.split('-'); return `${d}.${m}.${y}`; };

  return (
    <div style={{ maxWidth: 1800 }}>
      <style>{`
        .nv-toolbar {
          display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px 18px; margin-top: 1.25rem;
        }
        .nv-field label {
          display: block; font-size: 10.5px; font-weight: 700;
          color: var(--text-muted); margin-bottom: 4px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .nv-field select {
          min-width: 150px; padding: 8px 12px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--bg-tertiary);
          color: var(--text-primary); font-size: 14px;
        }
        .nv-list { display: flex; flex-direction: column; gap: 8px; margin-top: 1.25rem; }
        .nv-card {
          border: 1px solid var(--border); border-radius: 12px;
          overflow: hidden; background: var(--bg-secondary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .nv-head {
          display: grid;
          grid-template-columns: 34px 1fr 170px 200px 140px;
          align-items: center;
          width: 100%; text-align: left; background: none; border: none;
          border-left: 4px solid transparent;
          cursor: pointer; padding: 0; font: inherit; color: inherit;
          min-height: 68px; transition: background 0.12s; box-sizing: border-box;
        }
        .nv-head:hover { background: var(--bg-tertiary); }
        .nv-head-chevron { display: flex; align-items: center; justify-content: center; }
        .nv-head-title { padding: 14px 16px 14px 4px; min-width: 0; }
        .nv-title {
          font-size: 14px; font-weight: 700; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.35;
        }
        .nv-sub-count { font-size: 11px; font-weight: 600; color: var(--text-muted); margin-left: 6px; }
        .nv-area-tag { font-size: 11.5px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 4px; }
        .nv-head-cad { padding: 14px 16px; }
        .nv-cad-badge {
          display: inline-flex; align-items: center;
          font-size: 12px; font-weight: 600; color: var(--text-secondary);
          background: var(--bg-tertiary); border: 1px solid var(--border);
          border-radius: 20px; padding: 4px 12px; white-space: nowrap;
        }
        .nv-head-prog { padding: 14px 16px; display: flex; flex-direction: column; gap: 5px; }
        .nv-prog-bar { height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; }
        .nv-prog-fill { height: 100%; border-radius: 3px; background: ${ROUTINE_TEAL.accent}; transition: width 0.4s; }
        .nv-prog-nums { font-size: 11.5px; font-weight: 600; color: var(--text-muted); }
        .nv-head-status { padding: 14px 18px 14px 0; display: flex; align-items: center; justify-content: flex-end; }
        .nv-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 700; border-radius: 20px;
          padding: 4px 12px; white-space: nowrap;
        }
        .nv-pill--done { background: ${ROUTINE_TEAL.bg}; color: ${ROUTINE_TEAL.dark}; border: 1px solid ${ROUTINE_TEAL.border}; }
        .nv-pill--open { background: ${ROUTINE_AMBER.bg}; color: ${ROUTINE_AMBER.dark}; border: 1px solid ${ROUTINE_AMBER.border}; }
        .nv-pill--none { background: var(--bg-tertiary); color: var(--text-muted); border: 1px solid var(--border); }
        /* Expanded */
        .nv-body {
          border-top: 1px solid var(--border);
          padding: 20px 22px 22px;
          background: var(--bg-primary);
        }
        .nv-current-info { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; }
        .nv-current-info strong { color: var(--text-primary); font-weight: 700; }
        .nv-circle {
          width: 28px; height: 28px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0; flex-shrink: 0; cursor: pointer;
          border: 2px solid var(--border); background: var(--bg-tertiary);
          font-family: inherit; line-height: 0; box-sizing: border-box; transition: all 0.15s;
        }
        .nv-circle--on { background: ${ROUTINE_TEAL.accent}; border-color: ${ROUTINE_TEAL.accent}; color: #fff; }
        .nv-circle:disabled { cursor: default; opacity: 0.5; }
        .nv-sub-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
        .nv-sub-row:last-child { border-bottom: none; }
        .nv-sub-block { margin-bottom: 16px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 4px 14px 4px; }
        .nv-legend {
          display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
          margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border);
        }
        .nv-legend-year {
          font-size: 11px; font-weight: 800; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.08em; margin-right: 4px;
        }
        .nv-legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); }
        .nv-legend-dot { width: 12px; height: 12px; border-radius: 4px; flex-shrink: 0; }
        .nv-month-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        @media (max-width: 900px) { .nv-month-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 580px) { .nv-month-grid { grid-template-columns: repeat(2, 1fr); } }
        .nv-month-card {
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 9px; padding: 11px 13px;
        }
        .nv-month-name {
          font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 9px;
        }
        .nv-days { display: flex; flex-wrap: wrap; gap: 4px; }
        .nv-day {
          width: 28px; height: 28px; border-radius: 7px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; cursor: default;
        }
        .nv-day--done { background: ${ROUTINE_TEAL.accent}; color: #fff; }
        .nv-day--partial { background: ${ROUTINE_AMBER.accent}; color: #fff; }
        .nv-day--missed { background: #DC2626; color: #fff; }
        .nv-day--planned { background: var(--bg-tertiary); color: var(--text-muted); border: 1px solid var(--border); }
        .nv-day--future { background: var(--bg-tertiary); color: var(--border-active); border: 1px solid var(--border); opacity: 0.4; }
        @media (max-width: 860px) {
          .nv-head { grid-template-columns: 34px 1fr 140px; }
          .nv-head-cad, .nv-head-status { display: none; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="nv-toolbar no-print">
        <div className="nv-field">
          <label htmlFor="nv-jahr">Jahr</label>
          <select id="nv-jahr" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="nv-field">
          <label htmlFor="nv-aufgabe">Aufgabe</label>
          <select id="nv-aufgabe" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
            <option value="alle">Alle anzeigen</option>
            {scheduleSelectOptions.map((s) => <option key={s.id} value={s.id}>{s.title || s.id}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          style={{ marginLeft: 'auto', alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <i className="ti ti-printer" aria-hidden="true" /> Drucken / PDF
        </button>
      </div>

      {visibleSchedules.length === 0 ? (
        <div style={{ marginTop: '1.25rem', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
          Keine Serienaufträge vorhanden.
        </div>
      ) : (
        <div className="nv-list">
          {visibleSchedules.map((sch) => {
            const dueList = dueByScheduleId.get(sch.id) || [];
            const pool = getRoutinePool(sch, users);
            const subtasks = sch.subtasks || [];
            const pastDue = dueList.filter(d => d <= todayYmd);
            const currentYmd = pastDue.length ? pastDue[pastDue.length - 1] : null;
            const st = currentYmd ? routineDayStatus(sch, currentYmd, completions) : null;
            const assignee = currentYmd ? getRoutineAssigneeDisplayName(sch, pool, currentYmd) : '—';
            const canComplete = userRole === Role.Admin || userRole === sch.targetRole;
            const expanded = !!openRows[sch.id];
            const accentColor = nvAccent(sch);

            const completedCount = pastDue.filter(d => routineDayStatus(sch, d, completions).complete).length;
            const totalPast = pastDue.length;
            const pct = totalPast > 0 ? Math.round((completedCount / totalPast) * 100) : 0;

            const wholeRec = currentYmd
              ? (completions || []).find(c => c.scheduleId === sch.id && c.date === currentYmd && !c.subtaskId)
              : undefined;

            return (
              <div key={sch.id} className="nv-card">
                {/* Collapsed header */}
                <button
                  className="nv-head"
                  style={{ borderLeftColor: accentColor }}
                  onClick={() => setOpenRows(p => ({ ...p, [sch.id]: !p[sch.id] }))}
                  aria-expanded={expanded}
                >
                  <div className="nv-head-chevron">
                    <i className={`ti ti-chevron-${expanded ? 'down' : 'right'}`} style={{ color: 'var(--text-muted)', fontSize: 14 }} aria-hidden />
                  </div>
                  <div className="nv-head-title">
                    <div className="nv-title">
                      {sch.title || '—'}
                      {subtasks.length > 0 ? <span className="nv-sub-count">· {subtasks.length} Punkte</span> : null}
                    </div>
                    {sch.area && String(sch.area).trim() ? (
                      <div className="nv-area-tag">
                        <i className="ti ti-map-pin" style={{ fontSize: 10 }} />
                        {String(sch.area).trim()}
                      </div>
                    ) : null}
                  </div>
                  <div className="nv-head-cad">
                    <span className="nv-cad-badge">{cadenceLabel(sch)}</span>
                  </div>
                  <div className="nv-head-prog">
                    <div className="nv-prog-bar">
                      <div className="nv-prog-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="nv-prog-nums">{completedCount}/{totalPast} in {year}</div>
                  </div>
                  <div className="nv-head-status">
                    {!currentYmd ? (
                      <span className="nv-pill nv-pill--none">—</span>
                    ) : st!.complete ? (
                      <span className="nv-pill nv-pill--done">
                        <CheckIcon width={12} height={12} strokeWidth={3} aria-hidden /> erledigt
                      </span>
                    ) : (
                      <span className="nv-pill nv-pill--open">offen</span>
                    )}
                  </div>
                </button>

                {/* Expanded body */}
                {expanded ? (
                  <div className="nv-body">
                    {currentYmd ? (
                      <div className="nv-current-info">
                        Aktueller Termin: <strong>{fmtYmd(currentYmd)}</strong> · zuständig: <strong>{displayNameShort(assignee)}</strong>
                      </div>
                    ) : (
                      <div className="nv-current-info">Noch kein fälliger Termin in {year}.</div>
                    )}

                    {currentYmd && subtasks.length > 0 ? (
                      <div className="nv-sub-block">
                        {subtasks.map((sub) => {
                          const done = st!.doneSubtaskIds.has(sub.id);
                          const rec = (completions || []).find(c => c.scheduleId === sch.id && c.date === currentYmd && c.subtaskId === sub.id);
                          return (
                            <div key={sub.id} className="nv-sub-row">
                              <button
                                className={`nv-circle${done ? ' nv-circle--on' : ''}`}
                                disabled={!canComplete}
                                onClick={() => onToggleSubtask && onToggleSubtask(sch.id, currentYmd, sub.id, done ? null : userName)}
                                title={done ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'}
                                aria-label={sub.label || 'Unter-Aufgabe'}
                              >
                                {done ? <CheckIcon width={12} height={12} strokeWidth={3} aria-hidden /> : null}
                              </button>
                              <span style={{ flex: 1, fontSize: 14, color: done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{sub.label || '—'}</span>
                              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{done && rec ? displayNameShort(rec.completedBy) : 'offen'}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : currentYmd && subtasks.length === 0 ? (
                      <div className="nv-sub-block">
                        <div className="nv-sub-row">
                          <button
                            className={`nv-circle${st!.complete ? ' nv-circle--on' : ''}`}
                            disabled={!canComplete}
                            onClick={() => onSetCompletion && onSetCompletion(sch.id, currentYmd, st!.complete ? null : userName)}
                            title={st!.complete ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'}
                            aria-label="Auftrag erledigt"
                          >
                            {st!.complete ? <CheckIcon width={12} height={12} strokeWidth={3} aria-hidden /> : null}
                          </button>
                          <span style={{ flex: 1, fontSize: 14 }}>Ganzen Auftrag als erledigt markieren</span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {st!.complete ? (wholeRec ? displayNameShort(wholeRec.completedBy) : 'erledigt') : 'offen'}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Legend + year grid */}
                    <div className="nv-legend">
                      <span className="nv-legend-year">Jahresübersicht {year}</span>
                      <div className="nv-legend-item"><div className="nv-legend-dot" style={{ background: ROUTINE_TEAL.accent }} />Erledigt</div>
                      <div className="nv-legend-item"><div className="nv-legend-dot" style={{ background: ROUTINE_AMBER.accent }} />Teilweise</div>
                      <div className="nv-legend-item"><div className="nv-legend-dot" style={{ background: '#DC2626' }} />Verpasst</div>
                      <div className="nv-legend-item"><div className="nv-legend-dot" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }} />Geplant</div>
                    </div>

                    <div className="nv-month-grid">
                      {MONTHS_FULL.map((mname, mi) => {
                        const mdays = dueList.filter(d => Number(d.split('-')[1]) - 1 === mi).sort();
                        return (
                          <div key={mi} className="nv-month-card">
                            <div className="nv-month-name">{mname}</div>
                            {mdays.length === 0 ? (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                            ) : (
                              <div className="nv-days">
                                {mdays.map(d => {
                                  const s2 = routineDayStatus(sch, d, completions);
                                  const past = d < todayYmd;
                                  const counts = d >= missedSinceYmd;
                                  const dn = Number(d.split('-')[2]);
                                  let cls = 'nv-day nv-day--future';
                                  let title = fmtYmd(d) + ': geplant';
                                  if (s2.complete) { cls = 'nv-day nv-day--done'; title = fmtYmd(d) + ': erledigt'; }
                                  else if (s2.anyDone) { cls = 'nv-day nv-day--partial'; title = `${fmtYmd(d)}: ${s2.done}/${s2.total} erledigt`; }
                                  else if (past && counts) { cls = 'nv-day nv-day--missed'; title = fmtYmd(d) + ': verpasst'; }
                                  else if (past) { cls = 'nv-day nv-day--planned'; title = fmtYmd(d) + ': nicht erfasst'; }
                                  return <span key={d} className={cls} title={title}>{dn}</span>;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
