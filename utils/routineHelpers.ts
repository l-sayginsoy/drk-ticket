import { Role, RoutineDayCompletion, RoutineSchedule, User, WeekdayKey } from '../types';

/** ISO-Kalenderwochennummer (1–53) für ein YYYY-MM-DD-Datum. */
export function isoWeekNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7; // Mo=1 … So=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function weekdayKeyForDate(d: Date): WeekdayKey {
  const day = d.getDay();
  switch (day) {
    case 1:
      return 'mo';
    case 2:
      return 'di';
    case 3:
      return 'mi';
    case 4:
      return 'do';
    case 5:
      return 'fr';
    case 6:
      return 'sa';
    default:
      return 'so';
  }
}

/** Montag = 0 … Sonntag = 6 (Kalenderwoche ab Montag, lokal) */
export function mondayBasedWeekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function weekdayKeyToMondayIndex(k: WeekdayKey): number {
  const order: Record<WeekdayKey, number> = {
    mo: 0,
    di: 1,
    mi: 2,
    do: 3,
    fr: 4,
    sa: 5,
    so: 6,
  };
  return order[k];
}

/**
 * Gibt das Referenzdatum für die "Arbeitswoche" zurück.
 * Sa/So → nächster Montag (neue Woche beginnt), sonst heute.
 * Damit werden am Wochenende die Chips der kommenden Woche angezeigt und
 * Erledigungen der abgelaufenen Woche erscheinen nicht mehr als abgehakt.
 */
export function workWeekRefDate(today: Date): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=So, 6=Sa
  if (dow === 6) d.setDate(d.getDate() + 2); // Sa → Mo
  if (dow === 0) d.setDate(d.getDate() + 1); // So → Mo
  return d;
}

/**
 * Lokales Datum (YYYY-MM-DD) für einen Wochentag in derselben Kalenderwoche wie `anyDateInWeek`
 * (Woche ab Montag, wie mondayBasedWeekdayIndex).
 */
export function ymdForWeekdayInWeekContaining(weekdayKey: WeekdayKey, anyDateInWeek: Date): string {
  const ref = new Date(anyDateInWeek);
  ref.setHours(0, 0, 0, 0);
  const idxToday = mondayBasedWeekdayIndex(ref);
  const idxTarget = weekdayKeyToMondayIndex(weekdayKey);
  ref.setDate(ref.getDate() + (idxTarget - idxToday));
  return localISODate(ref);
}

/** Lokales Kalenderdatum YYYY-MM-DD */
export function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function mondayOfDate(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Optionales erstes Wiederholungsdatum (YYYY-MM-DD). Fehlt es, gilt Legacy-Verhalten wo nötig. */
export function scheduleStartYmd(schedule: RoutineSchedule & { startDate?: string | null }): string | null {
  const s = (schedule as any).startDate;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function hasExplicitStart(schedule: RoutineSchedule & { startDate?: string | null }): boolean {
  return scheduleStartYmd(schedule) !== null;
}

/** Verschiebt ein nominales Datum auf den nächsten Werktag (Mo–Fr, nicht RP-Feiertag). */
export function shiftNominalToNextRpBusinessDay(nominalYmd: string, rpHolidays: Set<string>): string {
  const d = parseYmdLocal(nominalYmd);
  for (let i = 0; i < 21; i++) {
    const dow = d.getDay();
    const s = localISODate(d);
    if (dow !== 0 && dow !== 6 && !rpHolidays.has(s)) return s;
    d.setDate(d.getDate() + 1);
  }
  return nominalYmd;
}

function effectiveYmdAfterHolidays(
  _schedule: RoutineSchedule & { recurrence?: any },
  nominalYmd: string,
  rpHolidays: Set<string>
): string {
  // Immer auf nächsten Werktag (Mo–Fr) verschieben – auch bei daily/kein Recurrence-Typ,
  // da die Einrichtung ausschließlich Mo–Fr arbeitet.
  return shiftNominalToNextRpBusinessDay(nominalYmd, rpHolidays);
}

/** Nominaler Fälligkeitstag (ohne Feiertags-Verschiebung). */
export function isNominalRoutineDay(schedule: RoutineSchedule & { recurrence?: any }, day: Date): boolean {
  if (!schedule.enabled) return false;
  if (!String(schedule.area || '').trim()) return false;

  const dayStr = localISODate(day);
  const startYmd = scheduleStartYmd(schedule);
  const rec = (schedule as any).recurrence;

  if (!rec || rec.type === 'daily') {
    if (!startYmd) return true;
    return dayStr >= startYmd;
  }

  if (rec.type === 'weekly') {
    const intervalWeeks = Math.max(1, Number(rec.intervalWeeks || 1));
    if (!hasExplicitStart(schedule)) {
      const anchor = new Date(1970, 0, 5);
      anchor.setHours(0, 0, 0, 0);
      const t = new Date(day);
      t.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((t.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const weeksSince = Math.floor(diffDays / 7);
      return weeksSince % intervalWeeks === 0;
    }
    if (!startYmd || dayStr < startYmd) return false;
    const start = parseYmdLocal(startYmd);
    if (day.getDay() !== start.getDay()) return false;
    const w0 = mondayOfDate(start);
    const w1 = mondayOfDate(day);
    const weekDiff = Math.round((w1.getTime() - w0.getTime()) / (1000 * 60 * 60 * 24) / 7);
    return weekDiff >= 0 && weekDiff % intervalWeeks === 0;
  }

  if (rec.type === 'weekdays') {
    const intervalWeeks = Math.max(1, Number(rec.intervalWeeks || 1));
    const weekdays = Array.isArray(rec.weekdays) ? (rec.weekdays as WeekdayKey[]) : [];
    if (!weekdays.includes(weekdayKeyForDate(day))) return false;
    if (!hasExplicitStart(schedule)) {
      const anchor = new Date(1970, 0, 5);
      anchor.setHours(0, 0, 0, 0);
      const t = new Date(day);
      t.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((t.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const weeksSince = Math.floor(diffDays / 7);
      return weeksSince % intervalWeeks === 0;
    }
    if (!startYmd || dayStr < startYmd) return false;
    const start = parseYmdLocal(startYmd);
    const w0 = mondayOfDate(start);
    const w1 = mondayOfDate(day);
    const weekDiff = Math.round((w1.getTime() - w0.getTime()) / (1000 * 60 * 60 * 24) / 7);
    return weekDiff >= 0 && weekDiff % intervalWeeks === 0;
  }

  if (rec.type === 'monthly') {
    if (!startYmd) return false;
    const intervalMonths = Math.max(1, Number(rec.intervalMonths || 1));
    const dom = Math.max(1, Math.min(31, Number(rec.dayOfMonth || 1)));
    const anchor = parseYmdLocal(startYmd);
    const y = day.getFullYear();
    const m = day.getMonth();
    const monthsSince = (y - anchor.getFullYear()) * 12 + (m - anchor.getMonth());
    if (monthsSince < 0) return false;
    if (monthsSince % intervalMonths !== 0) return false;
    const dim = daysInMonth(y, m);
    const expect = Math.min(dom, dim);
    if (day.getDate() !== expect) return false;
    return dayStr >= startYmd;
  }

  if (rec.type === 'yearly') {
    if (!startYmd) return false;
    if (dayStr < startYmd) return false;
    const month = Math.max(1, Math.min(12, Number(rec.month || 1)));
    const dom = Math.max(1, Math.min(31, Number(rec.day || 1)));
    const y = day.getFullYear();
    const dim = daysInMonth(y, month - 1);
    const expect = Math.min(dom, dim);
    if (day.getMonth() + 1 !== month || day.getDate() !== expect) return false;
    return true;
  }

  return false;
}

/**
 * Kalendertag, an dem das Ticket fällig wird: nominales Muster + ggf. Verschiebung (Sa/So/RP-Feiertag).
 * `rpHolidays`: YYYY-MM-DD (lokal), z. B. aus feiertage-api.de für Rheinland-Pfalz.
 */
export function isRoutineDueOnCalendarDay(
  schedule: RoutineSchedule & { recurrence?: any; startDate?: string | null },
  day: Date,
  rpHolidays: Set<string> = new Set()
): boolean {
  if (!schedule.enabled || !String(schedule.area || '').trim()) return false;

  const dayStr = localISODate(day);
  const lookback = 21;
  for (let i = 0; i <= lookback; i++) {
    const nd = new Date(day);
    nd.setDate(nd.getDate() - i);
    nd.setHours(0, 0, 0, 0);
    if (!isNominalRoutineDay(schedule, nd)) continue;
    const nominalStr = localISODate(nd);
    const effective = effectiveYmdAfterHolidays(schedule, nominalStr, rpHolidays);
    if (effective === dayStr) return true;
  }
  return false;
}

export function getRoutinePool(schedule: RoutineSchedule, users: User[]): string[] {
  const eligibleNames = new Set(
    users.filter((u) => u.isActive && u.role === schedule.targetRole).map((u) => u.name)
  );
  const assignees = Array.isArray(schedule.assignees) && schedule.assignees.length > 0 ? schedule.assignees : [];
  if (assignees.length > 0) {
    // Reihenfolge aus schedule.assignees beibehalten (vom Editor gesetzt), nur aktive filtern
    return assignees.filter((n) => eligibleNames.has(n));
  }
  // Kein expliziter Pool → alle aktiven in der Rolle, alphabetisch
  return [...eligibleNames].sort((a, b) => a.localeCompare(b, 'de'));
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

function weeksBetweenMondays(a: Date, b: Date): number {
  return Math.round((mondayOfDate(b).getTime() - mondayOfDate(a).getTime()) / (7 * 86400000));
}

/** Nominaler Termin, der (nach Wochenend-/Feiertags-Verschiebung) auf `ymd` fällt. */
function nominalDayFor(schedule: RoutineSchedule & { recurrence?: any }, ymd: string, rpHolidays: Set<string>): Date | null {
  const day = parseYmdLocal(ymd);
  for (let i = 0; i <= 21; i++) {
    const nd = new Date(day);
    nd.setDate(nd.getDate() - i);
    if (!isNominalRoutineDay(schedule, nd)) continue;
    if (effectiveYmdAfterHolidays(schedule, localISODate(nd), rpHolidays) === ymd) return nd;
  }
  return null;
}

/**
 * Laufende Nummer eines Termins (rein aus dem Datum berechnet). Grundlage der festen Rotation:
 * jeder Termin hat genau eine Nummer → Person = pool[(Nummer + rotationOffset) % Pool-Größe].
 * Dadurch sehen alle Geräte dieselbe Person, und wer tatsächlich abhakt, verschiebt nichts.
 */
export function routineOccurrenceIndex(
  schedule: RoutineSchedule & { recurrence?: any; startDate?: string | null },
  ymd: string,
  rpHolidays: Set<string> = new Set()
): number {
  const nominal = nominalDayFor(schedule, ymd, rpHolidays) ?? parseYmdLocal(ymd);
  const rec = (schedule as any).recurrence;
  const startYmd = scheduleStartYmd(schedule);
  const epoch = new Date(1970, 0, 5);
  const anchor = startYmd ? parseYmdLocal(startYmd) : epoch;
  if (!rec || rec.type === 'daily') {
    return weeksBetweenMondays(epoch, nominal) * 5 + Math.min(mondayBasedWeekdayIndex(nominal), 4);
  }
  if (rec.type === 'weekly') {
    return Math.floor(weeksBetweenMondays(anchor, nominal) / Math.max(1, Number(rec.intervalWeeks || 1)));
  }
  if (rec.type === 'weekdays') {
    const order: WeekdayKey[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
    const days = (Array.isArray(rec.weekdays) ? (rec.weekdays as WeekdayKey[]) : [])
      .slice()
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const per = Math.max(1, days.length);
    const cycle = Math.floor(weeksBetweenMondays(anchor, nominal) / Math.max(1, Number(rec.intervalWeeks || 1)));
    return cycle * per + Math.max(0, days.indexOf(weekdayKeyForDate(nominal)));
  }
  if (rec.type === 'monthly') {
    const months = (nominal.getFullYear() - anchor.getFullYear()) * 12 + (nominal.getMonth() - anchor.getMonth());
    return Math.floor(months / Math.max(1, Number(rec.intervalMonths || 1)));
  }
  if (rec.type === 'yearly') return nominal.getFullYear() - anchor.getFullYear();
  return 0;
}

/** Wer ist für den Termin am `dateYmd` zuständig? Auf allen Geräten identisch. */
export function getRoutineAssigneeDisplayName(
  schedule: RoutineSchedule,
  pool: string[],
  dateYmd: string,
  rpHolidays: Set<string> = new Set()
): string {
  if (schedule.assignment?.type === 'fixed') {
    const name = schedule.assignment.userName;
    return pool.includes(name) ? name : '—';
  }
  if (pool.length === 0) return '—';
  const ymd = dateYmd || localISODate(new Date());
  if ((schedule.assignment as any)?.type === 'calendar-week') {
    const offset = Number((schedule.assignment as any).weekOffset ?? 0);
    return pool[mod(isoWeekNumber(ymd) + offset, pool.length)];
  }
  const offset = Number(schedule.rotationOffset ?? 0);
  return pool[mod(routineOccurrenceIndex(schedule, ymd, rpHolidays) + offset, pool.length)];
}

/** Offset so wählen, dass der Termin am `ymd` an pool[poolIndex] geht. */
export function rotationOffsetFor(
  schedule: RoutineSchedule,
  poolIndex: number,
  poolSize: number,
  ymd: string,
  rpHolidays: Set<string> = new Set()
): number {
  if (poolSize <= 0) return 0;
  return mod(poolIndex - routineOccurrenceIndex(schedule, ymd, rpHolidays), poolSize);
}

/** Termin, für den die Zuständig-Spalte gilt: heute fällig/offenes Fenster, sonst nächster Termin. */
export function relevantDueDate(
  schedule: RoutineSchedule & { recurrence?: any; startDate?: string | null },
  todayYmd: string,
  completions: RoutineDayCompletion[],
  rpHolidays: Set<string> = new Set()
): string | null {
  const today = parseYmdLocal(todayYmd);
  if (isRoutineDueOnCalendarDay(schedule, today, rpHolidays)) return todayYmd;
  return findWindowDueDate(schedule, todayYmd, completions, rpHolidays) ?? nextDueDateFrom(schedule, today, rpHolidays);
}

/**
 * EINZIGE Regel für „vergessen" (Warnblock, Sidebar-Zähler und Liste nutzen dieselbe Funktion):
 * der letzte Termin VOR heute, dessen Abhak-Fenster abgelaufen ist, ohne Erledigung und ohne Quittierung.
 * Ein verspäteter Haken zwischen Termin und heute zählt als erledigt.
 */
export function getMissedDueDate(
  schedule: RoutineSchedule & { recurrence?: any; startDate?: string | null },
  todayYmd: string,
  completions: RoutineDayCompletion[],
  rpHolidays: Set<string>,
  acknowledged: Set<string>,
  warnStartYmd?: string
): string | null {
  if (!schedule.enabled) return null;
  const yesterday = parseYmdLocal(todayYmd);
  yesterday.setDate(yesterday.getDate() - 1);
  const prev = lastDueDateUpTo(schedule, yesterday, rpHolidays);
  if (!prev) return null;
  if (warnStartYmd && prev < warnStartYmd) return null;
  const windowEnd = parseYmdLocal(prev);
  windowEnd.setDate(windowEnd.getDate() + getRoutineWindowDays(schedule) - 1);
  if (todayYmd <= localISODate(windowEnd)) return null;
  if (acknowledged.has(`${schedule.id}|${prev}`)) return null;
  const relevant = completions
    .filter((c) => c.scheduleId === schedule.id && c.date >= prev && c.date < todayYmd)
    .map((c) => ({ ...c, date: prev }));
  if (routineDayStatus(schedule, prev, relevant).complete) return null;
  return prev;
}

export function isScheduleVisibleForUser(
  schedule: RoutineSchedule,
  userRole: Role,
  userName: string,
  users: User[]
): boolean {
  if (!schedule.enabled) return false;
  if (userRole === Role.Admin) return true;
  if (schedule.targetRole !== userRole) return false;
  const poolAll = users
    .filter((u) => u.isActive && u.role === schedule.targetRole)
    .map((u) => u.name)
    .sort((a, b) => a.localeCompare(b, 'de'));
  const assignees = Array.isArray(schedule.assignees) && schedule.assignees.length > 0 ? schedule.assignees : [];
  if (assignees.length === 0) return true;
  return assignees.includes(userName) && poolAll.includes(userName);
}

/** Alle Kalendertage im Jahr, an denen die Serie (inkl. Feiertags-Verschiebung) fällig ist. */
/** Nächster Fälligkeitstag ab (einschließlich) `fromDate`. Max 400 Tage Lookahead. */
export function nextDueDateFrom(
  schedule: RoutineSchedule & { recurrence?: any; startDate?: string | null },
  fromDate: Date,
  rpHolidays: Set<string> = new Set()
): string | null {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 400; i++) {
    if (isRoutineDueOnCalendarDay(schedule, d, rpHolidays)) return localISODate(d);
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/** Letzter Fälligkeitstag bis (einschließlich) `toDate`. Max 400 Tage Lookback. */
export function lastDueDateUpTo(
  schedule: RoutineSchedule & { recurrence?: any; startDate?: string | null },
  toDate: Date,
  rpHolidays: Set<string> = new Set()
): string | null {
  const d = new Date(toDate);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 400; i++) {
    if (isRoutineDueOnCalendarDay(schedule, d, rpHolidays)) return localISODate(d);
    d.setDate(d.getDate() - 1);
  }
  return null;
}

export function getDueDatesInYear(
  schedule: RoutineSchedule & { recurrence?: any; startDate?: string | null },
  year: number,
  rpHolidays: Set<string> = new Set()
): string[] {
  const out: string[] = [];
  const d = new Date(year, 0, 1);
  d.setHours(0, 0, 0, 0);
  const end = new Date(year, 11, 31);
  end.setHours(0, 0, 0, 0);
  while (d.getTime() <= end.getTime()) {
    const cur = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (isRoutineDueOnCalendarDay(schedule, cur, rpHolidays)) {
      out.push(localISODate(cur));
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Erledigungs-Status eines Termins an einem Tag – inkl. Unter-Aufgaben (Checkliste).
 * - Ohne Subtasks: complete = es existiert mindestens ein Completion-Record für den Tag.
 * - Mit Subtasks: complete = ALLE Subtasks haben einen Record; partial = einige.
 */
export function routineDayStatus(
  schedule: RoutineSchedule & { subtasks?: { id: string; label: string }[] },
  dateYmd: string,
  completions: RoutineDayCompletion[]
): { done: number; total: number; complete: boolean; anyDone: boolean; doneSubtaskIds: Set<string> } {
  const recs = (completions || []).filter((c) => c.scheduleId === schedule.id && c.date === dateYmd);
  const subtasks = schedule.subtasks || [];
  if (subtasks.length === 0) {
    const complete = recs.length > 0;
    return { done: complete ? 1 : 0, total: 1, complete, anyDone: complete, doneSubtaskIds: new Set() };
  }
  const doneSubtaskIds = new Set(recs.map((c) => c.subtaskId).filter(Boolean) as string[]);
  const done = subtasks.filter((s) => doneSubtaskIds.has(s.id)).length;
  return { done, total: subtasks.length, complete: done === subtasks.length, anyDone: done > 0, doneSubtaskIds };
}

/** Anzahl Tage, die eine monatliche/jährliche Aufgabe nach dem Fälligkeitstag noch abklickbar ist. */
export function getRoutineWindowDays(schedule: RoutineSchedule & { recurrence?: any }): number {
  const rec: any = (schedule as any).recurrence;
  if (!rec) return 1;
  if (rec.type === 'monthly' || rec.type === 'yearly') return 7;
  return 1;
}

/**
 * Für Aufgaben mit Mehrtagefenster (monatlich/jährlich): Sucht den jüngsten Fälligkeitstag
 * innerhalb des Fensters [today-6 … today-1], der noch nicht abgehakt ist.
 * Gibt null zurück, wenn heute der Fälligkeitstag ist (normaler due-Pfad) oder kein offener
 * Termin im Fenster liegt.
 */
export function findWindowDueDate(
  schedule: RoutineSchedule & { recurrence?: any; startDate?: string | null },
  todayYmd: string,
  completions: RoutineDayCompletion[],
  rpHolidays: Set<string> = new Set()
): string | null {
  const windowDays = getRoutineWindowDays(schedule);
  if (windowDays <= 1) return null;
  for (let daysBack = 1; daysBack < windowDays; daysBack++) {
    const d = parseYmdLocal(todayYmd);
    d.setDate(d.getDate() - daysBack);
    d.setHours(0, 0, 0, 0);
    if (!isRoutineDueOnCalendarDay(schedule, d, rpHolidays)) continue;
    const checkYmd = localISODate(d);
    const isDone = completions.some(c => c.scheduleId === schedule.id && c.date === checkYmd);
    if (!isDone) return checkYmd;
  }
  return null;
}
