import React, { useMemo, useState } from 'react';
import { Ticket, Status, Priority, User, Role, AppSettings, RoutineSchedule, RoutineDayCompletion } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { displayNameShort } from '../utils/displayNames';
import { isTicketParticipant } from '../utils/ticketParticipants';
import { getDueDatesInYear, getRoutinePool, getRoutineAssigneeDisplayName, localISODate, routineDayStatus } from '../utils/routineHelpers';

interface ReportsViewProps {
  activeTickets: Ticket[];
  completedTickets: Ticket[];
  completedMonth: number;
  completedYear: number;
  onLoadMonth: (month: number, year: number) => void;
  users: User[];
  appSettings: AppSettings;
  routineSchedules?: Array<RoutineSchedule & { recurrence?: any }>;
  routineCompletions?: RoutineDayCompletion[];
  rpHolidayYmdList?: string[];
  reportYearTickets?: Ticket[];
  reportLoadedYear?: number | null;
  isLoadingReportYear?: boolean;
  onLoadYearForStats?: (year: number) => void;
}

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const TECH_COLORS = ['#0d6efd','#6f42c1','#198754','#fd7e14','#20c997','#e83e8c','#6c757d','#17a2b8'];

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{ label: string; value: string | number; sub?: string; accent?: string }> = ({ label, value, sub, accent = 'var(--text-primary)' }) => (
  <div className="rp-kpi">
    <div className="rp-kpi-value" style={{ color: accent }}>{value}</div>
    <div className="rp-kpi-label">{label}</div>
    {sub && <div className="rp-kpi-sub">{sub}</div>}
  </div>
);

// ── Horizontal Bar ────────────────────────────────────────────────────────────
interface BarItem { label: string; value: number; color?: string; suffix?: string; caption?: string; valueLabel?: string }

const HBar: React.FC<{ items: BarItem[]; maxOverride?: number; labelWidth?: number }> = ({ items, maxOverride, labelWidth = 90 }) => {
  const max = maxOverride ?? Math.max(...items.map(i => i.value), 1);
  return (
    <div className="rp-hbar-list">
      {items.map((item, idx) => (
        <div className="rp-hbar-row" key={item.label} style={{ animationDelay: `${idx * 40}ms`, gridTemplateColumns: `${labelWidth}px 1fr auto` }}>
          <span className="rp-hbar-label" title={item.label}>{item.caption ?? item.label}</span>
          <div className="rp-hbar-track">
            <div className="rp-hbar-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? 'var(--accent-primary)' }} />
          </div>
          <span className="rp-hbar-val">{item.valueLabel ?? `${item.value}${item.suffix ?? ''}`}</span>
        </div>
      ))}
    </div>
  );
};

// ── Section ───────────────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; sub?: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="rp-section">
    <div className="rp-section-head">
      <span className="rp-section-title">{title}</span>
      {sub && <span className="rp-section-sub">{sub}</span>}
    </div>
    {children}
  </div>
);

const formatWorkDuration = (minutes: number) => {
  if (minutes <= 0) return '–';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} Min.`;
  return rest > 0 ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
};

interface WorkTimeTicketRow {
  ticket: Ticket;
  minutes: number;
  minutesByPerson: Record<string, number>;
}

const WorkTimeTicketList: React.FC<{ rows: WorkTimeTicketRow[] }> = ({ rows }) => {
  if (rows.length === 0) return <div className="rp-empty">Noch keine Arbeitszeit gebucht</div>;
  return (
    <div className="rp-work-list">
      {rows.map(({ ticket, minutes, minutesByPerson }) => (
        <div className="rp-work-ticket" key={ticket.id}>
          <div>
            <strong className="rp-work-ticket-title" title={ticket.title}>{ticket.title}</strong>
            <span className="rp-work-ticket-meta">#{ticket.id} · {ticket.location}{ticket.area ? ` · ${ticket.area}` : ''}</span>
          </div>
          <div className="rp-work-ticket-time">
            <strong>{formatWorkDuration(minutes)}</strong>
            <span className="rp-work-ticket-people" title={Object.entries(minutesByPerson).map(([name, value]) => `${name}: ${formatWorkDuration(value)}`).join(' · ')}>
              {Object.entries(minutesByPerson).map(([name, value]) => `${displayNameShort(name)} ${formatWorkDuration(value)}`).join(' · ')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
const ReportsView: React.FC<ReportsViewProps> = ({
  activeTickets, completedTickets, completedMonth, completedYear, onLoadMonth,
  users, appSettings, routineSchedules = [], routineCompletions = [], rpHolidayYmdList = [],
  reportYearTickets = [], reportLoadedYear = null, isLoadingReportYear = false, onLoadYearForStats,
}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [filterArea, setFilterArea] = useState('Alle');
  const [filterTech, setFilterTech] = useState('Alle');

  const isCurrentMonth = completedMonth === (now.getMonth() + 1) && completedYear === now.getFullYear();
  const monthLabel = `${MONTHS_DE[completedMonth - 1]} ${completedYear}`;
  const isYearMode = reportLoadedYear === currentYear && reportYearTickets.length > 0;
  const yearLabel = `Jahr ${currentYear}`;

  // ── Monatsoptionen ab Mai 2026 ──────────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const opts: { month: number; year: number; label: string }[] = [];
    let y = 2026, m = 5;
    const nowM = now.getMonth() + 1, nowY = now.getFullYear();
    while (y < nowY || (y === nowY && m <= nowM)) {
      opts.push({ month: m, year: y, label: `${MONTHS_DE[m - 1]} ${y}` });
      m++; if (m > 12) { m = 1; y++; }
    }
    return opts.reverse();
  }, []);

  // ── Filter-Optionen ─────────────────────────────────────────────────────────
  const techOptions = useMemo(() => {
    const names = users
      .filter(u => (u.role === Role.Technician || u.role === Role.Housekeeping) && u.isActive)
      .map(u => u.name).sort((a, b) => a.localeCompare(b, 'de'));
    return ['Alle', ...names];
  }, [users]);

  const areaOptions = useMemo(() => {
    const src = isYearMode ? reportYearTickets : isCurrentMonth ? activeTickets : completedTickets;
    const areas = new Set(src.map(t => t.area).filter(Boolean));
    return ['Alle', ...Array.from(areas).sort((a, b) => a.localeCompare(b, 'de'))];
  }, [activeTickets, completedTickets, reportYearTickets, isCurrentMonth, isYearMode]);

  // ── Gefilterte AKTIVE Tickets ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!isCurrentMonth && !isYearMode) return [];
    return activeTickets.filter(t => {
      if (filterArea !== 'Alle' && t.area !== filterArea) return false;
      if (filterTech !== 'Alle' && !isTicketParticipant(t, filterTech)) return false;
      return true;
    });
  }, [activeTickets, filterArea, filterTech, isCurrentMonth, isYearMode]);

  // ── Gefilterte abgeschlossene Tickets (Monat oder Jahr) ────────────────────
  const filteredCompleted = useMemo(() => {
    const src = isYearMode ? reportYearTickets : completedTickets;
    return src.filter(t => {
      if (filterArea !== 'Alle' && t.area !== filterArea) return false;
      if (filterTech !== 'Alle' && !isTicketParticipant(t, filterTech)) return false;
      return true;
    });
  }, [completedTickets, reportYearTickets, isYearMode, filterArea, filterTech]);

  // ── KPIs aktueller Monat ────────────────────────────────────────────────────
  const activeKpi = useMemo(() => ({
    total: filtered.length,
    ueberfaellig: filtered.filter(t => t.status === Status.Ueberfaellig).length,
    unassigned: filtered.filter(t => !t.technician || t.technician === 'N/A').length,
  }), [filtered]);

  // ── Charts aktive Tickets ───────────────────────────────────────────────────
  const workload = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(t => { if (t.technician && t.technician !== 'N/A') counts[t.technician] = (counts[t.technician] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ label: name, caption: displayNameShort(name), value, color: TECH_COLORS[i % TECH_COLORS.length] }));
  }, [filtered]);

  const byArea = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(t => { counts[t.area] = (counts[t.area] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([label, value]) => ({ label, value, color: '#0d6efd' }));
  }, [filtered]);

  const byCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(t => {
      const cat = appSettings.ticketCategories?.find(c => c.id === t.categoryId)?.name ?? 'Keine Kategorie';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: '#6f42c1' }));
  }, [filtered, appSettings.ticketCategories]);

  const byPriority = useMemo(() => {
    const colors: Record<string, string> = { [Priority.Hoch]: '#dc3545', [Priority.Mittel]: '#fd7e14', [Priority.Niedrig]: '#198754' };
    const counts: Record<string, number> = {};
    filtered.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => { const o: Record<string,number> = {[Priority.Hoch]:0,[Priority.Mittel]:1,[Priority.Niedrig]:2}; return (o[a[0]]??9)-(o[b[0]]??9); })
      .map(([label, value]) => ({ label, value, color: colors[label] ?? '#6c757d' }));
  }, [filtered]);

  // ── Charts abgeschlossene Tickets (Monat oder Jahr) ─────────────────────────
  const completedByTech = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCompleted.forEach(t => { if (t.technician && t.technician !== 'N/A') counts[t.technician] = (counts[t.technician] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ label: name, caption: displayNameShort(name), value, color: TECH_COLORS[i % TECH_COLORS.length] }));
  }, [filteredCompleted]);

  const completedByTechPct = useMemo(() => {
    const total = filteredCompleted.filter(t => t.technician && t.technician !== 'N/A').length;
    if (total === 0) return [];
    const counts: Record<string, number> = {};
    filteredCompleted.forEach(t => { if (t.technician && t.technician !== 'N/A') counts[t.technician] = (counts[t.technician] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ label: name, caption: displayNameShort(name), value: Math.round((value / total) * 1000) / 10, suffix: '%', color: TECH_COLORS[i % TECH_COLORS.length] }));
  }, [filteredCompleted]);

  // Die Zeit wird demjenigen zugerechnet, der sie gebucht hat. Damit wird ein
  // gemeinsamer Auftrag nicht doppelt gezählt, sondern fair nach Aufwand geteilt.
  const workTimeShareByTech = useMemo(() => {
    const minutesByPerson: Record<string, number> = {};
    filteredCompleted.forEach(ticket => {
      (ticket.workTimeEntries || []).forEach(entry => {
        if (!entry.author || !entry.minutes) return;
        minutesByPerson[entry.author] = (minutesByPerson[entry.author] || 0) + entry.minutes;
      });
    });
    const totalMinutes = Object.values(minutesByPerson).reduce((sum, minutes) => sum + minutes, 0);
    if (totalMinutes === 0) return [];
    return Object.entries(minutesByPerson).sort((a, b) => b[1] - a[1])
      .map(([name, minutes], index) => ({
        label: name,
        caption: displayNameShort(name),
        value: Math.round((minutes / totalMinutes) * 1000) / 10,
        suffix: '%',
        color: TECH_COLORS[index % TECH_COLORS.length],
      }));
  }, [filteredCompleted]);

  // Kompakter Überblick über die tatsächlich gebuchte Zeit. Die Einträge
  // bleiben die Quelle der Wahrheit, damit gemeinsame Tickets nicht doppelt
  // in der Auswertung erscheinen.
  const workTimeSummary = useMemo(() => {
    const rows = filteredCompleted.map(ticket => {
      const minutesByPerson: Record<string, number> = {};
      (ticket.workTimeEntries || []).forEach(entry => {
        if (!entry.minutes) return;
        const person = entry.author || 'Unbekannt';
        minutesByPerson[person] = (minutesByPerson[person] || 0) + entry.minutes;
      });
      const minutes = Object.values(minutesByPerson).reduce((sum, value) => sum + value, 0);
      return { ticket, minutes, minutesByPerson };
    }).filter(row => row.minutes > 0);

    const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
    return {
      totalMinutes,
      ticketsWithTime: rows.length,
      averageMinutes: rows.length ? Math.round(totalMinutes / rows.length) : 0,
      ticketRows: rows.sort((a, b) => b.minutes - a.minutes).slice(0, 8),
    };
  }, [filteredCompleted]);

  const workTimeByArea = useMemo(() => {
    const minutesByArea: Record<string, number> = {};
    filteredCompleted.forEach(ticket => {
      const minutes = (ticket.workTimeEntries || []).reduce((sum, entry) => sum + (entry.minutes || 0), 0);
      if (minutes <= 0) return;
      const area = ticket.area || ticket.location || 'Ohne Standort';
      minutesByArea[area] = (minutesByArea[area] || 0) + minutes;
    });
    const totalMinutes = Object.values(minutesByArea).reduce((sum, value) => sum + value, 0);
    if (totalMinutes === 0) return [];
    return Object.entries(minutesByArea).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([label, minutes], index) => {
        const percent = Math.round((minutes / totalMinutes) * 1000) / 10;
        return {
          label,
          value: percent,
          valueLabel: `${formatWorkDuration(minutes)} · ${percent} %`,
          color: TECH_COLORS[index % TECH_COLORS.length],
        };
      });
  }, [filteredCompleted]);

  const completedByArea = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCompleted.forEach(t => { if (t.area) counts[t.area] = (counts[t.area] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([label, value]) => ({ label, value, color: '#0d6efd' }));
  }, [filteredCompleted]);

  const completedByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCompleted.forEach(t => {
      const cat = appSettings.ticketCategories?.find(c => c.id === t.categoryId)?.name ?? 'Keine Kategorie';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: '#6f42c1' }));
  }, [filteredCompleted, appSettings.ticketCategories]);

  const completedByPriority = useMemo(() => {
    const colors: Record<string, string> = { [Priority.Hoch]: '#dc3545', [Priority.Mittel]: '#fd7e14', [Priority.Niedrig]: '#198754' };
    const counts: Record<string, number> = {};
    filteredCompleted.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => { const o: Record<string,number> = {[Priority.Hoch]:0,[Priority.Mittel]:1,[Priority.Niedrig]:2}; return (o[a[0]]??9)-(o[b[0]]??9); })
      .map(([label, value]) => ({ label, value, color: colors[label] ?? '#6c757d' }));
  }, [filteredCompleted]);

  // ── Häufigste Störungen: Ticket-Titel-Ranking ─────────────────────────────
  const recurringIssues = useMemo(() => {
    const yearSet = reportYearTickets.length > 0 ? new Set(reportYearTickets.map(t => t.id)) : null;
    const base = yearSet
      ? [...activeTickets.filter(t => !yearSet.has(t.id)), ...reportYearTickets]
      : [...activeTickets, ...completedTickets];
    const all = base.filter(t => t.origin !== 'routine');

    const counts: Record<string, number> = {};
    const titleMap: Record<string, string> = {};
    const areaCounts: Record<string, Record<string, number>> = {};

    all.forEach(t => {
      const key = (t.title || '').trim();
      if (!key) return;
      const norm = key.toLowerCase();
      if (!counts[norm]) counts[norm] = 0;
      counts[norm]++;
      if (!titleMap[norm]) titleMap[norm] = key;
      const area = (t.area || '').trim();
      if (area) {
        if (!areaCounts[norm]) areaCounts[norm] = {};
        areaCounts[norm][area] = (areaCounts[norm][area] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([norm, value]) => {
        const title = titleMap[norm] || norm;
        const areaFreq = areaCounts[norm] ?? {};
        const topArea = Object.entries(areaFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        return {
          label: topArea ? `${title} · ${topArea}` : title,
          value,
          color: value >= 5 ? '#DC2626' : value >= 3 ? '#F59E0B' : '#6366F1',
        };
      });
  }, [activeTickets, completedTickets, reportYearTickets]);

  // ── Serienaufträge: wer hat wie viel erledigt ─────────────────────────────
  const routinePersonStats = useMemo(() => {
    const yearStr = currentYear.toString();
    const counts: Record<string, number> = {};
    routineCompletions
      .filter(c => c.date.startsWith(yearStr) && !c.subtaskId)
      .forEach(c => {
        if (!c.completedBy) return;
        counts[c.completedBy] = (counts[c.completedBy] || 0) + 1;
      });
    const schedIds = new Set(routineSchedules.map(s => s.id));
    const subtaskCounts: Record<string, Set<string>> = {};
    routineCompletions
      .filter(c => c.date.startsWith(yearStr) && !!c.subtaskId && schedIds.has(c.scheduleId))
      .forEach(c => {
        const key = `${c.scheduleId}|${c.date}`;
        if (!subtaskCounts[c.completedBy]) subtaskCounts[c.completedBy] = new Set();
        subtaskCounts[c.completedBy].add(key);
      });
    Object.entries(subtaskCounts).forEach(([name, keys]) => {
      counts[name] = (counts[name] || 0) + keys.size;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({
        label: name, caption: displayNameShort(name),
        value: total > 0 ? Math.round((count / total) * 100) : 0,
        suffix: `% · ${count}×`,
        color: TECH_COLORS[i % TECH_COLORS.length],
      }));
  }, [routineCompletions, routineSchedules, currentYear]);

  const empty = <div className="rp-empty">Keine Daten</div>;
  const periodLabel = isYearMode ? yearLabel : monthLabel;

  return (
    <div className="rp-root">
      <style>{`
        .rp-root { padding-top: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }

        /* ── Toolbar ── */
        .rp-toolbar {
          display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 16px;
        }
        .rp-month-select { display: flex; align-items: center; gap: 0.5rem; }
        .rp-month-select label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
        .rp-chip {
          position: relative; display: flex; align-items: center; gap: 0.4rem;
          border: 1px solid var(--border); border-radius: 20px; padding: 0 2rem 0 0.85rem;
          height: 34px; font-size: 0.875rem; color: var(--text-secondary);
          background: var(--bg-primary); cursor: pointer; min-width: 110px;
        }
        .rp-chip--current { border-color: #198754; color: #198754; font-weight: 600; }
        .rp-chip--year { border-color: #0d6efd; color: #0d6efd; font-weight: 600; }
        .rp-chip select { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
        .rp-chip svg { position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%); width: 14px; color: var(--text-muted); pointer-events: none; }
        .rp-divider { width: 1px; height: 24px; background: var(--border); }
        .rp-chip-badge { font-size: 0.75rem; font-weight: 700; background: var(--border); padding: 1px 6px; border-radius: 10px; color: var(--text-primary); }
        .rp-reset { background: transparent; border: none; color: var(--text-muted); font-size: 0.875rem; padding: 0.4rem 0.75rem; border-radius: 20px; cursor: pointer; margin-left: auto; display: flex; align-items: center; gap: 0.4rem; }
        .rp-reset:hover { background: var(--bg-tertiary); color: var(--text-primary); }

        /* ── Mode badge ── */
        .rp-mode-badge {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-size: 0.75rem; font-weight: 600; padding: 4px 12px;
          border-radius: 20px; margin-bottom: -0.5rem;
        }
        .rp-mode-badge--live { background: #e1f5ee; color: #085041; border: 1px solid #5dcaa5; }
        .rp-mode-badge--past { background: #e6f1fb; color: #185fa5; border: 1px solid #b5d4f4; }
        .rp-mode-badge--year { background: #eff6ff; color: #1d4ed8; border: 1px solid #93c5fd; }

        /* ── KPI row ── */
        .rp-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .rp-kpi-row--3 { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 800px) { .rp-kpi-row { grid-template-columns: repeat(2, 1fr); } }
        .rp-kpi { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem 1.5rem; }
        .rp-kpi-value { font-size: 2.25rem; font-weight: 800; line-height: 1; margin-bottom: 0.35rem; }
        .rp-kpi-label { font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); }
        .rp-kpi-sub { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem; }

        /* ── Chart grids ── */
        .rp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .rp-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; }
        @media (max-width: 1100px) { .rp-grid-3 { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 800px) { .rp-grid-2, .rp-grid-3 { grid-template-columns: 1fr; } }

        /* ── Section ── */
        .rp-section { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem 1.5rem; }
        .rp-section-head { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 1.25rem; }
        .rp-section-title { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
        .rp-section-sub { font-size: 0.78rem; color: var(--text-muted); }

        /* ── H-bar ── */
        .rp-hbar-list { display: flex; flex-direction: column; gap: 0.55rem; }
        .rp-hbar-row { display: grid; grid-template-columns: 90px 1fr 38px; gap: 0.6rem; align-items: center; animation: rp-slidein 0.4s ease-out both; }
        @keyframes rp-slidein { from { opacity:0; transform: translateX(-12px); } to { opacity:1; transform: none; } }
        .rp-hbar-label { font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rp-hbar-track { background: var(--border); border-radius: 99px; height: 6px; overflow: hidden; }
        .rp-hbar-fill { height: 100%; border-radius: 99px; transition: width 0.5s ease-out; opacity: 0.85; }
        .rp-hbar-val { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-align: right; }
        .rp-empty { color: var(--text-muted); font-size: 0.875rem; padding: 1rem 0; text-align: center; }
        .rp-work-list { display: flex; flex-direction: column; }
        .rp-work-ticket { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1rem; align-items: center; padding: 0.7rem 0; border-top: 1px solid var(--border); }
        .rp-work-ticket:first-child { border-top: 0; padding-top: 0; }
        .rp-work-ticket-title { display: block; font-size: 0.86rem; color: var(--text-primary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .rp-work-ticket-meta, .rp-work-ticket-people { display: block; margin-top: 0.18rem; font-size: 0.74rem; color: var(--text-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .rp-work-ticket-time { text-align: right; font-size: 0.84rem; color: #185fa5; white-space: nowrap; }
        .rp-work-ticket-people { max-width: 185px; }
        @media (max-width: 500px) { .rp-work-ticket { gap: 0.6rem; } .rp-work-ticket-people { max-width: 105px; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="rp-toolbar">
        <div className="rp-month-select">
          <label>Zeitraum</label>
          <div className={`rp-chip${isYearMode ? ' rp-chip--year' : isCurrentMonth ? ' rp-chip--current' : ''}`} style={{ minWidth: 170 }}>
            {isLoadingReportYear
              ? <span><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> Lade Jahr…</span>
              : <span>{isYearMode ? `Jahr ${currentYear}` : `${monthLabel}${isCurrentMonth ? ' (aktuell)' : ''}`}</span>}
            <select
              value={isYearMode ? `year-${currentYear}` : `${completedYear}-${completedMonth}`}
              onChange={e => {
                const val = e.target.value;
                if (val.startsWith('year-')) {
                  const y = parseInt(val.split('-')[1]);
                  onLoadYearForStats?.(y);
                } else {
                  const [y, m] = val.split('-').map(Number);
                  onLoadMonth(m, y);
                }
              }}
            >
              <option value={`year-${currentYear}`}>Jahr {currentYear}</option>
              <option disabled>──────────────</option>
              {monthOptions.map(o => (
                <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
              ))}
            </select>
            <ChevronDownIcon />
          </div>
        </div>

        <div className="rp-divider" />

        {/* Standort-Filter */}
        <div className={`rp-chip${filterArea !== 'Alle' ? ' rp-chip--current' : ''}`}>
          <span>Standort</span>
          {filterArea !== 'Alle' && <span className="rp-chip-badge">{filterArea}</span>}
          <select value={filterArea} onChange={e => setFilterArea(e.target.value)}>
            {areaOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDownIcon />
        </div>

        {/* Bearbeiter-Filter */}
        <div className={`rp-chip${filterTech !== 'Alle' ? ' rp-chip--current' : ''}`}>
          <span>Bearbeiter</span>
          {filterTech !== 'Alle' && <span className="rp-chip-badge">{displayNameShort(filterTech)}</span>}
          <select value={filterTech} onChange={e => setFilterTech(e.target.value)}>
            {techOptions.map(o => <option key={o} value={o}>{o !== 'Alle' ? displayNameShort(o) : o}</option>)}
          </select>
          <ChevronDownIcon />
        </div>

        <button className="rp-reset" onClick={() => { setFilterArea('Alle'); setFilterTech('Alle'); }}>
          <i className="ti ti-refresh" /> Zurücksetzen
        </button>
      </div>

      {/* ══ Abgeschlossene Statistiken (Monat oder Jahr) ══════════════════════ */}
      {(isYearMode || !isCurrentMonth) && (
        <>
          <div className={`rp-mode-badge ${isYearMode ? 'rp-mode-badge--year' : 'rp-mode-badge--past'}`}>
            {isYearMode
              ? <><i className="ti ti-calendar-stats" /> Jahresstatistik {currentYear} – alle abgeschlossenen Tickets</>
              : <>Abgeschlossene Tickets – {monthLabel}</>}
          </div>

          <div className="rp-kpi-row">
            <KpiCard
              label={`Abgeschlossen ${periodLabel}`}
              value={filteredCompleted.length}
              accent="#198754"
            />
            <KpiCard label="Bearbeiter aktiv" value={completedByTech.length} />
            <KpiCard label="Standorte" value={completedByArea.length} />
            <KpiCard
              label="Gebuchte Arbeitszeit"
              value={formatWorkDuration(workTimeSummary.totalMinutes)}
              sub={workTimeSummary.ticketsWithTime > 0 ? `Ø ${formatWorkDuration(workTimeSummary.averageMinutes)} je Ticket` : 'Noch keine Zeit gebucht'}
              accent="#185fa5"
            />
          </div>

          <div className="rp-grid-2">
            <Section title={`Abgeschlossen pro Bearbeiter – ${periodLabel}`} sub="Anzahl">
              {completedByTech.length > 0 ? <HBar items={completedByTech} /> : empty}
            </Section>
            <Section title="Prozentualer Anteil" sub="Wer hat wie viel erledigt">
              {completedByTechPct.length > 0 ? <HBar items={completedByTechPct} maxOverride={100} /> : empty}
            </Section>
          </div>
          <div className="rp-grid-2">
              <Section title="Arbeitszeit nach Mitarbeiter" sub="Anteil der gebuchten Zeit">
                {workTimeShareByTech.length > 0 ? <HBar items={workTimeShareByTech} maxOverride={100} /> : <div className="rp-empty">Noch keine Arbeitszeit gebucht</div>}
              </Section>
              <Section title="Arbeitszeit nach Standort / Bereich" sub="Zeitaufwand und Anteil">
                {workTimeByArea.length > 0 ? <HBar items={workTimeByArea} maxOverride={100} labelWidth={130} /> : <div className="rp-empty">Noch keine Arbeitszeit gebucht</div>}
              </Section>
            </div>
          <Section title="Zeitaufwand pro Auftrag" sub="Abgeschlossene Tickets mit Zeitbuchung">
            <WorkTimeTicketList rows={workTimeSummary.ticketRows} />
          </Section>

          <div className="rp-grid-3">
            <Section title={`Nach Standort – ${periodLabel}`}>
              {completedByArea.length > 0 ? <HBar items={completedByArea} /> : empty}
            </Section>
            <Section title={`Nach Kategorie – ${periodLabel}`}>
              {completedByCategory.length > 0 ? <HBar items={completedByCategory} /> : empty}
            </Section>
            <Section title={`Nach Priorität – ${periodLabel}`}>
              {completedByPriority.length > 0 ? <HBar items={completedByPriority} /> : empty}
            </Section>
          </div>
        </>
      )}

      {/* ══ LIVE: aktive Tickets (aktueller Monat oder Jahr-Modus) ══════════════ */}
      {(isCurrentMonth || isYearMode) && (
        <>
          <div className="rp-mode-badge rp-mode-badge--live">
            ● Live – aktuelle offene Tickets
          </div>

          <div className="rp-kpi-row rp-kpi-row--3">
            <KpiCard label="Aktive Tickets" value={activeKpi.total} />
            <KpiCard label="Überfällig" value={activeKpi.ueberfaellig}
              sub={activeKpi.total > 0 ? `${Math.round((activeKpi.ueberfaellig / activeKpi.total) * 100)} % aller aktiven` : undefined}
              accent={activeKpi.ueberfaellig > 0 ? '#dc3545' : undefined} />
            <KpiCard label="Nicht zugewiesen" value={activeKpi.unassigned}
              sub="Offen ohne Bearbeiter"
              accent={activeKpi.unassigned > 0 ? '#fd7e14' : undefined} />
          </div>

          <div className="rp-grid-2">
            <Section title="Offene Aufträge pro Bearbeiter" sub="Aktuelle aktive Tickets">
              {workload.length > 0 ? <HBar items={workload} /> : empty}
            </Section>
            <Section title={`Abgeschlossen pro Bearbeiter – ${isYearMode ? yearLabel : monthLabel}`} sub="Erledigte Tickets">
              {completedByTech.length > 0 ? <HBar items={completedByTech} /> : <div className="rp-empty">Noch keine abgeschlossenen Tickets</div>}
            </Section>
          </div>
          {!isYearMode && <div className="rp-grid-2">
            <Section title="Arbeitszeit nach Mitarbeiter" sub="Anteil der gebuchten Zeit">
              {workTimeShareByTech.length > 0 ? <HBar items={workTimeShareByTech} maxOverride={100} /> : <div className="rp-empty">Noch keine Arbeitszeit gebucht</div>}
            </Section>
            <Section title="Arbeitszeit nach Standort / Bereich" sub="Zeitaufwand und Anteil">
              {workTimeByArea.length > 0 ? <HBar items={workTimeByArea} maxOverride={100} labelWidth={130} /> : <div className="rp-empty">Noch keine Arbeitszeit gebucht</div>}
            </Section>
          </div>}
          {!isYearMode && <Section title="Zeitaufwand pro Auftrag" sub="Abgeschlossene Tickets mit Zeitbuchung">
            <WorkTimeTicketList rows={workTimeSummary.ticketRows} />
          </Section>}

          <div className="rp-grid-3">
            <Section title="Aktive Tickets nach Standort">
              {byArea.length > 0 ? <HBar items={byArea} /> : empty}
            </Section>
            <Section title="Aktive Tickets nach Kategorie">
              {byCategory.length > 0 ? <HBar items={byCategory} /> : <div className="rp-empty">Keine Kategorien zugewiesen</div>}
            </Section>
            <Section title="Aktive Tickets nach Priorität">
              {byPriority.length > 0 ? <HBar items={byPriority} /> : empty}
            </Section>
          </div>
        </>
      )}

      {/* ── Häufigste Störungen ─────────────────────────────────────────────── */}
      <Section
        title="Häufigste Störungen"
        sub={isYearMode
          ? `${yearLabel} · ${activeTickets.length + reportYearTickets.length} Tickets · Standort = häufigster Meldeort`
          : `${activeTickets.length + completedTickets.length} Tickets geladen · Standort = häufigster Meldeort`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#DC2626', marginRight: 4 }} />≥ 5×</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#F59E0B', marginRight: 4 }} />3–4×</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#6366F1', marginRight: 4 }} />1–2×</span>
          </div>
          {!isYearMode && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              → "Ganzes Jahr" oben wählen für vollständige Auswertung
            </span>
          )}
        </div>
        {recurringIssues.length > 0 ? (
          <HBar items={recurringIssues} labelWidth={180} />
        ) : (
          <div className="rp-empty">Keine Daten</div>
        )}
      </Section>

      {/* ── Serienaufträge: wer hat wie viel erledigt ─────────────────────────── */}
      {routinePersonStats.length > 0 && (
        <Section
          title="Serienaufträge – wer hat wie viel erledigt"
          sub={`Laufendes Jahr ${currentYear} · Anteil an allen Erledigungen`}
        >
          <HBar items={routinePersonStats} maxOverride={100} />
        </Section>
      )}
    </div>
  );
};

export default ReportsView;
