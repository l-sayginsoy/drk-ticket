import React, { useMemo, useState } from 'react';
import { Ticket, Status, Priority, User, Role, AppSettings } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { displayNameShort, normalizePersonName } from '../utils/displayNames';

interface ReportsViewProps {
  activeTickets: Ticket[];
  completedTickets: Ticket[];
  completedMonth: number;
  completedYear: number;
  onLoadMonth: (month: number, year: number) => void;
  users: User[];
  appSettings: AppSettings;
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
interface BarItem { label: string; value: number; color?: string; suffix?: string; caption?: string }

const HBar: React.FC<{ items: BarItem[]; maxOverride?: number }> = ({ items, maxOverride }) => {
  const max = maxOverride ?? Math.max(...items.map(i => i.value), 1);
  return (
    <div className="rp-hbar-list">
      {items.map((item, idx) => (
        <div className="rp-hbar-row" key={item.label} style={{ animationDelay: `${idx * 40}ms` }}>
          <span className="rp-hbar-label" title={item.label}>{item.caption ?? item.label}</span>
          <div className="rp-hbar-track">
            <div className="rp-hbar-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? 'var(--accent-primary)' }} />
          </div>
          <span className="rp-hbar-val">{item.value}{item.suffix ?? ''}</span>
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

// ── MAIN ──────────────────────────────────────────────────────────────────────
const ReportsView: React.FC<ReportsViewProps> = ({ activeTickets, completedTickets, completedMonth, completedYear, onLoadMonth, users, appSettings }) => {
  const now = new Date();
  const [filterArea, setFilterArea] = useState('Alle');
  const [filterTech, setFilterTech] = useState('Alle');

  const isCurrentMonth = completedMonth === (now.getMonth() + 1) && completedYear === now.getFullYear();
  const monthLabel = `${MONTHS_DE[completedMonth - 1]} ${completedYear}`;

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
    const src = isCurrentMonth ? activeTickets : completedTickets;
    const areas = new Set(src.map(t => t.area).filter(Boolean));
    return ['Alle', ...Array.from(areas).sort((a, b) => a.localeCompare(b, 'de'))];
  }, [activeTickets, completedTickets, isCurrentMonth]);

  // ── Gefilterte AKTIVE Tickets (nur für aktuellen Monat) ─────────────────────
  const filtered = useMemo(() => {
    if (!isCurrentMonth) return [];
    return activeTickets.filter(t => {
      if (filterArea !== 'Alle' && t.area !== filterArea) return false;
      if (filterTech !== 'Alle' && normalizePersonName(t.technician) !== normalizePersonName(filterTech)) return false;
      return true;
    });
  }, [activeTickets, filterArea, filterTech, isCurrentMonth]);

  // ── Gefilterte ABGESCHLOSSENE Tickets ──────────────────────────────────────
  const filteredCompleted = useMemo(() => {
    return completedTickets.filter(t => {
      if (filterArea !== 'Alle' && t.area !== filterArea) return false;
      if (filterTech !== 'Alle' && normalizePersonName(t.technician) !== normalizePersonName(filterTech)) return false;
      return true;
    });
  }, [completedTickets, filterArea, filterTech]);

  // ── KPIs aktueller Monat ────────────────────────────────────────────────────
  const activeKpi = useMemo(() => ({
    total: filtered.length,
    ueberfaellig: filtered.filter(t => t.status === Status.Ueberfaellig).length,
    unassigned: filtered.filter(t => !t.technician || t.technician === 'N/A').length,
    completedCount: completedTickets.length,
  }), [filtered, completedTickets]);

  // ── Charts aktueller Monat ──────────────────────────────────────────────────
  const workload = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(t => { if (t.technician && t.technician !== 'N/A') counts[t.technician] = (counts[t.technician] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ label: name, caption: displayNameShort(name), value, color: TECH_COLORS[i % TECH_COLORS.length] }));
  }, [filtered]);

  const workloadPct = useMemo(() => {
    const total = filtered.filter(t => t.technician && t.technician !== 'N/A').length;
    if (total === 0) return [];
    const counts: Record<string, number> = {};
    filtered.forEach(t => { if (t.technician && t.technician !== 'N/A') counts[t.technician] = (counts[t.technician] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ label: name, caption: displayNameShort(name), value: Math.round((value / total) * 1000) / 10, suffix: '%', color: TECH_COLORS[i % TECH_COLORS.length] }));
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

  // ── Charts vergangener Monat (aus completedTickets) ─────────────────────────
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

  const empty = <div className="rp-empty">Keine Daten</div>;

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
        .rp-month-select {
          display: flex; align-items: center; gap: 0.5rem;
        }
        .rp-month-select label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
        .rp-chip {
          position: relative; display: flex; align-items: center; gap: 0.4rem;
          border: 1px solid var(--border); border-radius: 20px; padding: 0 2rem 0 0.85rem;
          height: 34px; font-size: 0.875rem; color: var(--text-secondary);
          background: var(--bg-primary); cursor: pointer; min-width: 110px;
        }
        .rp-chip--current { border-color: #198754; color: #198754; font-weight: 600; }
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

      `}</style>

      {/* ── Toolbar ── */}
      <div className="rp-toolbar">
        {/* Monatsauswahl */}
        <div className="rp-month-select">
          <label>Monat</label>
          <div className={`rp-chip${isCurrentMonth ? ' rp-chip--current' : ''}`} style={{ minWidth: 150 }}>
            <span>{monthLabel}{isCurrentMonth ? ' (aktuell)' : ''}</span>
            <select value={`${completedYear}-${completedMonth}`} onChange={e => {
              const [y, m] = e.target.value.split('-').map(Number);
              onLoadMonth(m, y);
            }}>
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

      {isCurrentMonth ? (
        /* ══ AKTUELLER MONAT: live aktive Tickets ══════════════════════════════ */
        <>
          <div className="rp-mode-badge rp-mode-badge--live">
            ● Live – aktuelle Tickets ({monthLabel})
          </div>

          <div className={`rp-kpi-row rp-kpi-row--3`}>
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
            <Section title={`Abgeschlossen pro Bearbeiter – ${monthLabel}`} sub="Erledigte Tickets diesen Monat">
              {completedByTech.length > 0 ? <HBar items={completedByTech} /> : <div className="rp-empty">Noch keine abgeschlossenen Tickets</div>}
            </Section>
          </div>

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
      ) : (
        /* ══ VERGANGENER MONAT: kumulierte abgeschlossene Daten ════════════════ */
        <>
          <div className="rp-mode-badge rp-mode-badge--past">
            Abgeschlossene Tickets – {monthLabel}
          </div>

          <div className="rp-kpi-row rp-kpi-row--3">
            <KpiCard label={`Abgeschlossen ${monthLabel}`} value={filteredCompleted.length} accent="#198754" />
            <KpiCard label="Bearbeiter aktiv" value={completedByTech.length} />
            <KpiCard label="Standorte" value={completedByArea.length} />
          </div>

          <div className="rp-grid-2">
            <Section title={`Abgeschlossen pro Bearbeiter – ${monthLabel}`} sub="Anzahl">
              {completedByTech.length > 0 ? <HBar items={completedByTech} /> : empty}
            </Section>
            <Section title="Prozentualer Anteil" sub="Wer hat wie viel erledigt">
              {completedByTechPct.length > 0 ? <HBar items={completedByTechPct} maxOverride={100} /> : empty}
            </Section>
          </div>

          <div className="rp-grid-3">
            <Section title={`Nach Standort – ${monthLabel}`}>
              {completedByArea.length > 0 ? <HBar items={completedByArea} /> : empty}
            </Section>
            <Section title={`Nach Kategorie – ${monthLabel}`}>
              {completedByCategory.length > 0 ? <HBar items={completedByCategory} /> : empty}
            </Section>
            <Section title={`Nach Priorität – ${monthLabel}`}>
              {(() => {
                const colors: Record<string, string> = { [Priority.Hoch]: '#dc3545', [Priority.Mittel]: '#fd7e14', [Priority.Niedrig]: '#198754' };
                const counts: Record<string, number> = {};
                filteredCompleted.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
                const items = Object.entries(counts)
                  .sort((a, b) => { const o: Record<string,number> = {[Priority.Hoch]:0,[Priority.Mittel]:1,[Priority.Niedrig]:2}; return (o[a[0]]??9)-(o[b[0]]??9); })
                  .map(([label, value]) => ({ label, value, color: colors[label] ?? '#6c757d' }));
                return items.length > 0 ? <HBar items={items} /> : empty;
              })()}
            </Section>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsView;
