import React, { useMemo, useState } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User } from '../types';
import { getDueDatesInYear, isScheduleVisibleForUser, localISODate } from '../utils/routineHelpers';
import { ROUTINE_AMBER, ROUTINE_TEAL } from '../utils/routineUiPalette';
import { displayNameShort } from '../utils/displayNames';

const MONTHS_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
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
}

export default function RoutineNachweisView({
  schedules,
  completions,
  users,
  userRole,
  userName,
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
      .filter(
        (u) =>
          u.isActive &&
          (u.role === Role.Technician || u.role === Role.Housekeeping || u.role === Role.Admin)
      )
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

  const dueByScheduleId = useMemo(() => {
    const map = new Map<string, string[]>();
    visibleSchedules.forEach((sch) => {
      map.set(sch.id, getDueDatesInYear(sch, year));
    });
    return map;
  }, [visibleSchedules, year]);

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
          margin-bottom: 0;
          padding: 14px 16px;
          background: var(--bg-primary);
          border: none;
          border-bottom: 1px solid var(--border);
          border-radius: 0;
        }
        .nachweis-view-body {
          padding: 1rem 1.25rem 1.5rem;
          background: var(--bg-secondary);
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
        .nachweis-month-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        .nachweis-month {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          background: var(--bg-tertiary);
        }
        .nachweis-month h4 {
          margin: 0 0 10px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .nachweis-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .nachweis-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          cursor: default;
        }
      `}</style>

      <div className="nachweis-toolbar">
        <div className="nachweis-field">
          <label htmlFor="nachweis-jahr">Jahr</label>
          <select id="nachweis-jahr" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="nachweis-field">
          <label htmlFor="nachweis-aufgabe">Aufgabe</label>
          <select
            id="nachweis-aufgabe"
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
          >
            <option value="alle">Alle sichtbaren</option>
            {scheduleSelectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.id}
              </option>
            ))}
          </select>
        </div>
        <div className="nachweis-field">
          <label htmlFor="nachweis-person">Erledigt von</label>
          <select
            id="nachweis-person"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
          >
            {personOptions.map((p) => (
              <option key={p} value={p}>
                {p === 'alle' ? 'Alle' : displayNameShort(p)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="nachweis-view-body">
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Pro Aufgabe: alle <strong>fälligen</strong> Tage im Jahr. <strong>✓</strong> = erledigt (laut Filter),{' '}
        <strong>!</strong> = vergangen aber ohne passenden Eintrag, hell = noch ausstehend.
      </p>

      {visibleSchedules.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '1rem 0', textAlign: 'center' }}>Keine Serienaufträge sichtbar.</div>
      ) : (
        visibleSchedules.map((sch) => {
          const dueList = dueByScheduleId.get(sch.id) || [];
          const byMonth = groupYmdsByMonth(dueList);
          const doneCount = dueList.filter((ymd) => !!completionFor(sch.id, ymd)).length;
          const missedPast = dueList.filter(
            (ymd) => ymd < todayYmd && !completionFor(sch.id, ymd)
          ).length;

          return (
            <section
              key={sch.id}
              style={{
                marginBottom: 16,
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--bg-secondary)',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--bg-primary)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <h2 className="app-page-heading" style={{ margin: '0 0 6px' }}>
                  {sch.title || '—'}
                </h2>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {String(sch.area || '').trim() || '—'} · Fällige Termine {year}:{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>{dueList.length}</strong> · Erledigt (Filter):{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>{doneCount}</strong>
                  {missedPast > 0 ? (
                    <span style={{ color: '#b02a37', fontWeight: 700 }}>
                      {' '}
                      · Verpasst (vergangen): {missedPast}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="nachweis-month-grid" style={{ padding: '14px 16px' }}>
                {MONTHS_DE.map((monthName, mi) => {
                  const days = byMonth.get(mi) || [];
                  return (
                    <div key={mi} className="nachweis-month">
                      <h4>{monthName}</h4>
                      {days.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      ) : (
                        <div className="nachweis-chips">
                          {days.map((ymd) => {
                            const comp = completionFor(sch.id, ymd);
                            const done = !!comp;
                            const isPast = ymd < todayYmd;
                            const dayNum = dayOfMonthFromYmd(ymd);
                            let bg = 'var(--bg-tertiary)';
                            let border = '1px solid var(--border)';
                            let color = 'var(--text-secondary)';
                            let label = `${dayNum}.`;
                            let title = `${ymd}: geplant`;

                            if (done) {
                              bg = ROUTINE_TEAL.bg;
                              border = `1px solid ${ROUTINE_TEAL.border}`;
                              color = ROUTINE_TEAL.dark;
                              label = `✓ ${dayNum}.`;
                              title = `${ymd}: Erledigt von ${displayNameShort(comp!.completedBy)}`;
                            } else if (isPast) {
                              bg = ROUTINE_AMBER.bg;
                              border = `1px solid ${ROUTINE_AMBER.border}`;
                              color = ROUTINE_AMBER.dark;
                              label = `! ${dayNum}.`;
                              title = `${ymd}: Nicht erledigt (vergangen)`;
                            }

                            return (
                              <span
                                key={ymd}
                                className="nachweis-chip"
                                style={{ background: bg, border, color }}
                                title={title}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
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
