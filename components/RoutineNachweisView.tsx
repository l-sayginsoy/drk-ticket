import React, { useMemo, useState } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User } from '../types';
import { getDueDatesInYear, localISODate, parseYmdLocal } from '../utils/routineHelpers';

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];

function fmtDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}.${m}.${y}`;
}
function fmtTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}
function weekdayShort(ymd: string): string {
  const d = parseYmdLocal(ymd);
  return DAYS_SHORT[d.getDay()];
}

function cadenceLabel(sch: RoutineSchedule & { recurrence?: any }): string {
  const rec: any = sch.recurrence;
  if (!rec || rec.type === 'daily') return 'Täglich';
  if (rec.type === 'weekly') { const n = Math.max(1, Number(rec.intervalWeeks || 1)); return n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`; }
  if (rec.type === 'weekdays') {
    const n = Math.max(1, Number(rec.intervalWeeks || 1));
    const map: Record<string, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
    const ORDER = ['mo','di','mi','do','fr','sa','so'];
    const days = (Array.isArray(rec.weekdays) ? rec.weekdays : []).slice().sort((a: string, b: string) => ORDER.indexOf(a) - ORDER.indexOf(b)).map((d: string) => map[d] || d).join(' · ');
    return (n === 1 ? '' : `Alle ${n} Wo · `) + (days || '—');
  }
  if (rec.type === 'monthly') { const n = Math.max(1, Number(rec.intervalMonths || 1)); return n === 1 ? 'Monatlich' : `Alle ${n} Monate`; }
  if (rec.type === 'yearly') return 'Jährlich';
  return '—';
}

type RowStatus = 'done' | 'missed' | 'upcoming';

interface DueRow {
  ymd: string;
  status: RowStatus;
  completions: RoutineDayCompletion[];
  isCorrected: boolean;
}

interface CorrectionState {
  scheduleId: string;
  originalDate: string;
  currentCompletedBy: string;
  currentCompletedAt: string;
  currentComment: string;
  users: string[];
}

interface RetroState {
  scheduleId: string;
  ymd: string;
  users: string[];
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
  onAdminRetroSetDay?: (scheduleId: string, ymd: string, completedBy: string | null, subtaskIds?: string[]) => void;
  onCorrectCompletion?: (
    scheduleId: string,
    originalDate: string,
    patch: { completedBy?: string; newDate?: string; newTime?: string; comment?: string; deleteEntry?: boolean }
  ) => void;
}

export default function RoutineNachweisView({
  schedules,
  completions,
  users,
  userRole,
  userName,
  rpHolidayYmdList = [],
  onAdminRetroSetDay,
  onCorrectCompletion,
}: RoutineNachweisViewProps) {
  const isAdmin = userRole === Role.Admin;
  const today = localISODate(new Date());
  const todayDate = new Date();

  const [month, setMonth] = useState(todayDate.getMonth() + 1); // 1-12
  const [year, setYear] = useState(todayDate.getFullYear());
  const [scheduleFilter, setScheduleFilter] = useState('alle');
  const [areaFilter, setAreaFilter] = useState('alle');
  const [bearbeiterFilter, setBearbeiterFilter] = useState('alle');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Correction modal
  const [corrModal, setCorrModal] = useState<CorrectionState | null>(null);
  const [corrPerson, setCorrPerson] = useState('');
  const [corrDate, setCorrDate] = useState('');
  const [corrTime, setCorrTime] = useState('');
  const [corrComment, setCorrComment] = useState('');

  // Retro-add modal
  const [retroModal, setRetroModal] = useState<RetroState | null>(null);
  const [retroPerson, setRetroPerson] = useState('');
  const [retroTime, setRetroTime] = useState('');
  const [retroComment, setRetroComment] = useState('');

  const rpHolidaySet = useMemo(() => new Set(rpHolidayYmdList || []), [rpHolidayYmdList]);

  const userNames = useMemo(() =>
    users.filter(u => u.isActive).map(u => u.name).sort(),
    [users]
  );

  // All areas
  const areas = useMemo(() => {
    const s = new Set(schedules.filter(s => s.enabled).map(s => s.area || s.location));
    return ['alle', ...Array.from(s).sort()];
  }, [schedules]);

  // Compute due dates for each schedule in the selected month
  const monthData = useMemo(() => {
    const allDuesYear = schedules.filter(s => s.enabled).map(sch => {
      const all = getDueDatesInYear(sch as any, year, rpHolidaySet);
      const monthDues = all.filter(d => Number(d.split('-')[1]) === month);
      return { schedule: sch, dues: monthDues };
    }).filter(x => x.dues.length > 0);

    return allDuesYear.map(({ schedule, dues }) => {
      const rows: DueRow[] = dues.map(ymd => {
        const dayComps = completions.filter(c => c.scheduleId === schedule.id && c.date === ymd);
        const isDone = dayComps.length > 0;
        const isPast = ymd < today;
        const isCorrected = dayComps.some(c => !!c.correctedBy);
        let status: RowStatus;
        if (isDone) status = 'done';
        else if (isPast) status = 'missed';
        else status = 'upcoming';
        return { ymd, status, completions: dayComps, isCorrected };
      });
      return { schedule, rows };
    });
  }, [schedules, year, month, completions, today, rpHolidaySet]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Filter
  const filtered = useMemo(() => {
    return monthData
      .filter(({ schedule }) => scheduleFilter === 'alle' || schedule.id === scheduleFilter)
      .filter(({ schedule }) => areaFilter === 'alle' || (schedule.area || schedule.location) === areaFilter)
      .filter(({ rows }) => {
        if (statusFilter === 'alle') return true;
        return rows.some(r => r.status === statusFilter);
      })
      .filter(({ rows }) => {
        if (bearbeiterFilter === 'alle') return true;
        return rows.some(r => r.completions.some(c => c.completedBy === bearbeiterFilter));
      })
      .map(({ schedule, rows }) => {
        const filteredRows = rows.filter(r => {
          if (statusFilter !== 'alle' && r.status !== statusFilter) return false;
          if (bearbeiterFilter !== 'alle' && !r.completions.some(c => c.completedBy === bearbeiterFilter)) return false;
          return true;
        });
        return { schedule, rows: filteredRows };
      })
      .filter(x => x.rows.length > 0);
  }, [monthData, scheduleFilter, areaFilter, statusFilter, bearbeiterFilter]);

  // All bearbeiter found in the month
  const bearbeiterList = useMemo(() => {
    const s = new Set<string>();
    monthData.forEach(({ rows }) => rows.forEach(r => r.completions.forEach(c => s.add(c.completedBy))));
    return ['alle', ...Array.from(s).sort()];
  }, [monthData]);

  // Open correction modal
  const openCorrection = (scheduleId: string, row: DueRow) => {
    const main = row.completions[0];
    setCorrModal({
      scheduleId,
      originalDate: row.ymd,
      currentCompletedBy: main?.completedBy || '',
      currentCompletedAt: main?.completedAt || '',
      currentComment: main?.comment || '',
      users: userNames,
    });
    setCorrPerson(main?.completedBy || '');
    setCorrDate(row.ymd);
    const t = main?.completedAt ? fmtTime(main.completedAt) : '';
    setCorrTime(t === '—' ? '' : t);
    setCorrComment(main?.comment || '');
  };

  const saveCorrection = () => {
    if (!corrModal || !onCorrectCompletion) return;
    onCorrectCompletion(corrModal.scheduleId, corrModal.originalDate, {
      completedBy: corrPerson !== corrModal.currentCompletedBy ? corrPerson : undefined,
      newDate: corrDate !== corrModal.originalDate ? corrDate : undefined,
      newTime: corrTime || undefined,
      comment: corrComment !== corrModal.currentComment ? corrComment : undefined,
    });
    setCorrModal(null);
  };

  const deleteEntry = () => {
    if (!corrModal || !onCorrectCompletion) return;
    if (!window.confirm('Diesen Eintrag wirklich löschen? Der Auftrag gilt danach als nicht erledigt.')) return;
    onCorrectCompletion(corrModal.scheduleId, corrModal.originalDate, { deleteEntry: true });
    setCorrModal(null);
  };

  const openRetro = (scheduleId: string, ymd: string) => {
    setRetroModal({ scheduleId, ymd, users: userNames });
    setRetroPerson(userName || userNames[0] || '');
    setRetroTime('');
    setRetroComment('');
  };

  const saveRetro = () => {
    if (!retroModal || !onAdminRetroSetDay) return;
    onAdminRetroSetDay(retroModal.scheduleId, retroModal.ymd, retroPerson || null);
    setRetroModal(null);
  };

  const toggleCollapse = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  const statusBadge = (status: RowStatus) => {
    if (status === 'done') return <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Erledigt</span>;
    if (status === 'missed') return <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>✗ Vergessen</span>;
    return <span style={{ background: '#F3F4F6', color: '#6B7280', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Geplant</span>;
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200 }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Serien-Nachweis</h2>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <button onClick={prevMonth} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 160, textAlign: 'center', color: 'var(--text-primary)' }}>{MONTHS_DE[month - 1]} {year}</span>
          <button onClick={nextMonth} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>›</button>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ marginLeft: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 13 }}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Filter:</span>
        <select value={scheduleFilter} onChange={e => setScheduleFilter(e.target.value)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 13, maxWidth: 220 }}>
          <option value="alle">Alle Aufträge</option>
          {schedules.filter(s => s.enabled).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 13 }}>
          <option value="alle">Alle Bereiche</option>
          {areas.slice(1).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={bearbeiterFilter} onChange={e => setBearbeiterFilter(e.target.value)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 13 }}>
          <option value="alle">Alle Bearbeiter</option>
          {bearbeiterList.slice(1).map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 13 }}>
          <option value="alle">Alle Status</option>
          <option value="done">Erledigt</option>
          <option value="missed">Vergessen</option>
          <option value="upcoming">Geplant</option>
        </select>
        {(scheduleFilter !== 'alle' || areaFilter !== 'alle' || bearbeiterFilter !== 'alle' || statusFilter !== 'alle') && (
          <button onClick={() => { setScheduleFilter('alle'); setAreaFilter('alle'); setBearbeiterFilter('alle'); setStatusFilter('alle'); }}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>
            × Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', fontSize: 15 }}>
          {monthData.length === 0
            ? `Keine Serienaufträge mit Terminen im ${MONTHS_DE[month - 1]} ${year}.`
            : 'Keine Einträge mit diesen Filterkriterien.'}
        </div>
      ) : filtered.map(({ schedule, rows }) => {
        const done = rows.filter(r => r.status === 'done').length;
        const missed = rows.filter(r => r.status === 'missed').length;
        const isOpen = !collapsed[schedule.id];

        return (
          <div key={schedule.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
            {/* Section header */}
            <div
              onClick={() => toggleCollapse(schedule.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--border)' : 'none', background: 'var(--bg-secondary)' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', userSelect: 'none' }}>{isOpen ? '▾' : '▸'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{schedule.title}</span>
                <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-secondary)' }}>{schedule.area || schedule.location} · {cadenceLabel(schedule as any)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {done > 0 && <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>✓ {done} erledigt</span>}
                {missed > 0 && <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>✗ {missed} vergessen</span>}
                {done === 0 && missed === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{rows.length} geplant</span>}
              </div>
            </div>

            {/* Table */}
            {isOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 12 }}>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Tag</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Datum</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600 }}>Erledigt von</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Uhrzeit</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600 }}>Kommentar</th>
                      {isAdmin && <th style={{ padding: '7px 14px', textAlign: 'center', fontWeight: 600, width: 50 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const main = row.completions[0];
                      const bg = row.status === 'missed' ? '#FFF5F5' : row.status === 'done' ? undefined : undefined;
                      return (
                        <tr key={row.ymd} style={{ borderTop: '1px solid var(--border)', background: bg || undefined }}>
                          <td style={{ padding: '8px 14px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{weekdayShort(row.ymd)}</td>
                          <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontWeight: row.ymd === today ? 700 : 400 }}>{fmtDate(row.ymd)}</td>
                          <td style={{ padding: '8px 14px' }}>{statusBadge(row.status)}</td>
                          <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>
                            {row.status === 'done' ? (
                              <span>
                                {row.completions.map((c, i) => (
                                  <span key={i}>
                                    {i > 0 && <span style={{ color: 'var(--text-secondary)' }}>, </span>}
                                    {c.completedBy}
                                    {c.subtaskId && <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}> (Teilaufg.)</span>}
                                  </span>
                                ))}
                                {row.isCorrected && (
                                  <span
                                    title={main?.correctedBy ? `Korrigiert von ${main.correctedBy} am ${fmtDateTime(main.correctedAt || '')}: ${main.correctionNote || ''}` : 'Korrigiert'}
                                    style={{ marginLeft: 6, background: '#FEF3C7', color: '#92400E', borderRadius: 4, padding: '1px 5px', fontSize: 11, cursor: 'help', fontWeight: 600 }}>
                                    korr.
                                  </span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {row.status === 'done' && main?.completedAt ? fmtTime(main.completedAt) : '—'}
                          </td>
                          <td style={{ padding: '8px 14px', color: 'var(--text-secondary)', maxWidth: 240 }}>
                            {row.status === 'done' && main?.comment ? (
                              <span style={{ fontStyle: 'italic' }}>„{main.comment}"</span>
                            ) : '—'}
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                              {row.status === 'done' ? (
                                <button
                                  onClick={() => openCorrection(schedule.id, row)}
                                  title="Eintrag korrigieren"
                                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                                  ✎
                                </button>
                              ) : row.status === 'missed' ? (
                                <button
                                  onClick={() => openRetro(schedule.id, row.ymd)}
                                  title="Erledigung nachtragen"
                                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#059669', fontSize: 13, fontWeight: 700 }}>
                                  +
                                </button>
                              ) : null}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Correction Modal */}
      {corrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 28, minWidth: 380, maxWidth: 480, width: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Eintrag korrigieren</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
              {schedules.find(s => s.id === corrModal.scheduleId)?.title} · {fmtDate(corrModal.originalDate)}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Erledigt von
                <select value={corrPerson} onChange={e => setCorrPerson(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 14 }}>
                  {corrModal.users.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Datum
                <input type="date" value={corrDate} onChange={e => setCorrDate(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 14 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Uhrzeit (optional)
                <input type="time" value={corrTime} onChange={e => setCorrTime(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 14 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Kommentar
                <textarea value={corrComment} onChange={e => setCorrComment(e.target.value)} rows={2}
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical' }} />
              </label>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderRadius: 6, padding: '7px 10px' }}>
                Die Korrektur wird mit Ihrem Namen ({userName}) und Zeitstempel gespeichert. Der ursprüngliche Eintrag bleibt im Audit-Trail sichtbar.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
              <button onClick={deleteEntry}
                style={{ background: '#FEE2E2', border: 'none', borderRadius: 7, padding: '8px 14px', cursor: 'pointer', color: '#991B1B', fontWeight: 600, fontSize: 13 }}>
                🗑 Löschen
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setCorrModal(null)}
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 16px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Abbrechen
                </button>
                <button onClick={saveCorrection} disabled={!corrPerson}
                  style={{ background: '#2563EB', border: 'none', borderRadius: 7, padding: '8px 18px', cursor: 'pointer', color: '#fff', fontWeight: 600, fontSize: 13, opacity: !corrPerson ? 0.5 : 1 }}>
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retro-Add Modal */}
      {retroModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 28, minWidth: 360, maxWidth: 460, width: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Erledigung nachtragen</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
              {schedules.find(s => s.id === retroModal.scheduleId)?.title} · {fmtDate(retroModal.ymd)}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Erledigt von
                <select value={retroPerson} onChange={e => setRetroPerson(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 14 }}>
                  {retroModal.users.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Uhrzeit (optional)
                <input type="time" value={retroTime} onChange={e => setRetroTime(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 14 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Kommentar (optional)
                <textarea value={retroComment} onChange={e => setRetroComment(e.target.value)} rows={2}
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical' }} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button onClick={() => setRetroModal(null)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 16px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                Abbrechen
              </button>
              <button onClick={saveRetro} disabled={!retroPerson}
                style={{ background: '#059669', border: 'none', borderRadius: 7, padding: '8px 18px', cursor: 'pointer', color: '#fff', fontWeight: 600, fontSize: 13, opacity: !retroPerson ? 0.5 : 1 }}>
                Nachtragen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
