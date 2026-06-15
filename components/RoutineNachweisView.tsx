import React, { useMemo, useState } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User } from '../types';
import { getDueDatesInYear, getRoutineAssigneeDisplayName, getRoutinePool, isScheduleVisibleForUser, localISODate } from '../utils/routineHelpers';
import { ROUTINE_AMBER, ROUTINE_TEAL } from '../utils/routineUiPalette';
import { displayNameShort } from '../utils/displayNames';


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
}: RoutineNachweisViewProps) {
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

  const completionFor = (scheduleId: string, ymd: string): RoutineDayCompletion | undefined => {
    const matches = (completions || []).filter((c) => c.scheduleId === scheduleId && c.date === ymd);
    if (personFilter === 'alle') return matches[0];
    return matches.find((c) => c.completedBy === personFilter);
  };

  // Eigenständiger Hover-Tooltip: zeigt sofort, WER erledigt hat (+ wann) bzw. wer zuständig ist/war.
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; lines: string[]; tone: 'done' | 'missed' | 'today' | 'future' } | null>(null);

  // Popover zum Nachtragen/Korrigieren einer Erledigung (Klick auf einen Tag).
  const [editCell, setEditCell] = useState<
    { schedId: string; schedTitle: string; ymd: string; x: number; y: number; options: string[]; current?: RoutineDayCompletion } | null
  >(null);
  const [personSel, setPersonSel] = useState('');

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
      {hoverTip && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(hoverTip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 99999) - 240),
            top: hoverTip.y + 16,
            zIndex: 10000,
            pointerEvents: 'none',
            background: '#1f2430',
            color: '#fff',
            padding: '7px 11px',
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.4,
            boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
            maxWidth: 240,
            borderLeft: `3px solid ${hoverTip.tone === 'done' ? '#34c759' : hoverTip.tone === 'missed' ? '#e0992f' : hoverTip.tone === 'today' ? '#3b82f6' : '#9aa0aa'}`,
          }}
        >
          {hoverTip.lines.map((l, i) => (
            <div key={i} style={{ fontWeight: i === 0 ? 700 : 400, opacity: i === 0 ? 1 : 0.85 }}>{l}</div>
          ))}
        </div>
      )}
      {editCell && (
        <>
          <div onClick={() => setEditCell(null)} style={{ position: 'fixed', inset: 0, zIndex: 10001 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: Math.min(editCell.x, (typeof window !== 'undefined' ? window.innerWidth : 99999) - 270),
              top: Math.min(editCell.y + 14, (typeof window !== 'undefined' ? window.innerHeight : 99999) - 210),
              zIndex: 10002,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              padding: 14,
              width: 250,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{fmtYmd(editCell.ymd)}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>{editCell.schedTitle}</div>
            {editCell.current ? (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 12 }}>
                  ✓ Erledigt von <strong>{displayNameShort(editCell.current.completedBy)}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { onSetCompletion!(editCell.schedId, editCell.ymd, null); setEditCell(null); }}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #e0992f', background: 'var(--bg-secondary)', color: '#b9760f', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
                  >Rückgängig</button>
                  <button
                    onClick={() => setEditCell(null)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
                  >Schließen</button>
                </div>
              </>
            ) : editCell.options.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Keine möglichen Bearbeiter hinterlegt.</div>
            ) : (
              <>
                <label style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Wer hat es erledigt?</label>
                <select
                  value={personSel}
                  onChange={(e) => setPersonSel(e.target.value)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 12 }}
                >
                  {editCell.options.map((n) => <option key={n} value={n}>{displayNameShort(n)}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { if (personSel) onSetCompletion!(editCell.schedId, editCell.ymd, personSel); setEditCell(null); }}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: 'none', background: ROUTINE_TEAL.accent, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                  >Als erledigt eintragen</button>
                  <button
                    onClick={() => setEditCell(null)}
                    style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
                  >Abbr.</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
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

        {visibleSchedules.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '1rem 0', textAlign: 'center' }}>
            Keine Serienaufträge sichtbar.
          </div>
        ) : (
          visibleSchedules.map((sch) => {
            const dueList = dueByScheduleId.get(sch.id) || [];
            const byMonth = groupYmdsByMonth(dueList);
            const doneCount = dueList.filter((ymd) => !!completionFor(sch.id, ymd)).length;
            const missedCount = dueList.filter((ymd) => ymd < todayYmd && ymd >= missedSinceYmd && !completionFor(sch.id, ymd)).length;
            const pct = dueList.length > 0 ? Math.round((doneCount / dueList.length) * 100) : 0;
            const missedPct = dueList.length > 0 ? Math.round((missedCount / dueList.length) * 100) : 0;

            // Verantwortliche Person nur bei FESTER Zuweisung sicher bestimmbar (Rotation = für
            // vergangene Tage nicht zuverlässig rekonstruierbar → bewusst kein Name, um nicht falsch zuzuordnen).
            const pool = getRoutinePool(sch, users);
            const fixedResponsible = sch.assignment?.type === 'fixed' ? getRoutineAssigneeDisplayName(sch, pool, todayYmd) : null;

            return (
              <section key={sch.id} className="nachweis-section">
                {/* Section header */}
                <div className="nachweis-section-header">
                  <div>
                    <h2 className="nachweis-section-title">{sch.title || '—'}</h2>
                    <div className="nachweis-section-meta">
                      {String(sch.area || '').trim() || '—'} · {dueList.length} Termine {year}
                    </div>
                  </div>
                  <div className="nachweis-stats">
                    {doneCount > 0 && (
                      <span className="nachweis-stat-pill nachweis-stat-pill--done">
                        ✓ {doneCount} erledigt
                      </span>
                    )}
                    {missedCount > 0 && (
                      <span className="nachweis-stat-pill nachweis-stat-pill--missed">
                        ! {missedCount} verpasst
                      </span>
                    )}
                    <span className="nachweis-stat-pill nachweis-stat-pill--total">
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Month grid */}
                <div className="nachweis-month-grid">
                  {MONTHS_DE.map((monthName, mi) => {
                    const days = byMonth.get(mi) || [];
                    const isFutureMonth = year === currentYearNum ? mi > currentMonthIndex : year > currentYearNum;
                    const monthDone = days.filter((ymd) => !!completionFor(sch.id, ymd)).length;
                    const monthMissed = days.filter((ymd) => ymd < todayYmd && ymd >= missedSinceYmd && !completionFor(sch.id, ymd)).length;
                    const monthTotal = days.length;
                    const donePct = monthTotal > 0 ? (monthDone / monthTotal) * 100 : 0;
                    const missedPctMonth = monthTotal > 0 ? (monthMissed / monthTotal) * 100 : 0;

                    return (
                      <div key={mi} className={`nachweis-month-card${isFutureMonth ? ' future' : ''}`}>
                        <div className="nachweis-month-header">
                          <span className="nachweis-month-name">{monthName}</span>
                          {monthTotal > 0 && !isFutureMonth && (
                            <div className="nachweis-month-summary">
                              {monthDone > 0 && <span style={{ color: ROUTINE_TEAL.dark }}>✓{monthDone}</span>}
                              {monthMissed > 0 && <span style={{ color: ROUTINE_AMBER.dark }}>{monthMissed}</span>}
                              {monthTotal - monthDone - monthMissed > 0 && (
                                <span>{monthTotal - monthDone - monthMissed} offen</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Progress bar */}
                        {monthTotal > 0 && !isFutureMonth && (
                          <div className="nachweis-progress">
                            <div className="nachweis-progress-done" style={{ width: `${donePct}%` }} />
                            <div className="nachweis-progress-missed" style={{ width: `${missedPctMonth}%` }} />
                          </div>
                        )}

                        {/* Mini calendar */}
                        {days.length === 0 ? (
                          <span className="nachweis-empty">—</span>
                        ) : (() => {
                          // Build a set of due dates for quick lookup
                          const dueSet = new Set(days.map(d => dayOfMonthFromYmd(d)));

                          // First day of month (0=Sun..6=Sat), convert to Mon-based (0=Mon..6=Sun)
                          const firstDate = new Date(year, mi, 1);
                          const firstDow = (firstDate.getDay() + 6) % 7; // Mon=0
                          const daysInMonth = new Date(year, mi + 1, 0).getDate();

                          // Build week rows
                          const cells: (number | null)[] = [
                            ...Array(firstDow).fill(null),
                            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                          ];
                          // Pad to full weeks
                          while (cells.length % 7 !== 0) cells.push(null);
                          const weeks: (number | null)[][] = [];
                          for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

                          return (
                            <table className="nachweis-cal">
                              <thead>
                                <tr>
                                  {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
                                    <th key={d}>{d}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {weeks.map((week, wi) => (
                                  <tr key={wi}>
                                    {week.map((dayNum, di) => {
                                      if (!dayNum) return <td key={di} />;
                                      if (!dueSet.has(dayNum)) {
                                        return (
                                          <td key={di}>
                                            <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:26, height:22, fontSize:11, color:'var(--text-muted)', opacity:0.35 }}>
                                              {dayNum}.
                                            </span>
                                          </td>
                                        );
                                      }
                                      const ymd = `${year}-${String(mi+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
                                      const comp = completionFor(sch.id, ymd);
                                      const done = !!comp;
                                      const isPast = ymd < todayYmd;
                                      const isToday = ymd === todayYmd;
                                      const ddmm = `${String(dayNum).padStart(2,'0')}.${String(mi+1).padStart(2,'0')}.${year}`;
                                      let cls = 'nachweis-day nachweis-day--future';
                                      let lines: string[];
                                      let tone: 'done' | 'missed' | 'today' | 'future' = 'future';
                                      if (done) {
                                        cls = 'nachweis-day nachweis-day--done';
                                        tone = 'done';
                                        let when = '';
                                        if (comp!.completedAt) {
                                          const d = new Date(comp!.completedAt);
                                          if (!isNaN(d.getTime())) when = `${d.toLocaleDateString('de-DE')}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
                                        }
                                        lines = [`✓ Erledigt von ${displayNameShort(comp!.completedBy) || 'unbekannt'}`, when || ddmm];
                                      } else if (isToday) {
                                        cls = 'nachweis-day nachweis-day--today';
                                        tone = 'today';
                                        lines = ['Heute fällig', fixedResponsible ? `Zuständig: ${displayNameShort(fixedResponsible)}` : ddmm];
                                      } else if (isPast && ymd >= missedSinceYmd) {
                                        cls = 'nachweis-day nachweis-day--missed';
                                        tone = 'missed';
                                        lines = ['! Nicht erledigt', fixedResponsible ? `Zuständig war: ${displayNameShort(fixedResponsible)}` : `war fällig am ${ddmm}`];
                                      } else if (isPast) {
                                        // Vor Einführung der Nachweis-Zählung → neutral, NICHT als verpasst werten
                                        cls = 'nachweis-day nachweis-day--future';
                                        tone = 'future';
                                        lines = ['Vor Einführung', 'wird nicht als verpasst gewertet'];
                                      } else {
                                        lines = ['Geplant', fixedResponsible ? `Zuständig: ${displayNameShort(fixedResponsible)}` : ddmm];
                                      }
                                      const titleStr = lines.join(' — ');
                                      return (
                                        <td key={di}>
                                          <span
                                            className={cls}
                                            title={onSetCompletion && ymd <= todayYmd ? `${titleStr} — klicken zum Eintragen/Korrigieren` : titleStr}
                                            style={onSetCompletion && ymd <= todayYmd ? { cursor: 'pointer' } : undefined}
                                            onMouseEnter={(e) => setHoverTip({ x: e.clientX, y: e.clientY, lines, tone })}
                                            onMouseLeave={() => setHoverTip(null)}
                                            onClick={onSetCompletion && ymd <= todayYmd ? (e) => {
                                              e.stopPropagation();
                                              setHoverTip(null);
                                              const opts = pool.length ? pool : users.filter(u => u.isActive && u.role === sch.targetRole).map(u => u.name);
                                              setPersonSel(opts.includes(userName) ? userName : (opts[0] || userName));
                                              setEditCell({ schedId: sch.id, schedTitle: sch.title || '', ymd, x: e.clientX, y: e.clientY, options: opts, current: comp });
                                            } : undefined}
                                          >{dayNum}.</span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}
