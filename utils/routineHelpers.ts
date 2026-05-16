import { Role, RoutineSchedule, User, WeekdayKey } from '../types';

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
  schedule: RoutineSchedule & { recurrence?: any },
  nominalYmd: string,
  rpHolidays: Set<string>
): string {
  const rec = (schedule as any).recurrence;
  if (!rec || rec.type === 'daily') return nominalYmd;
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
  const eligibleUsers = users
    .filter((u) => u.isActive && u.role === schedule.targetRole)
    .map((u) => u.name)
    .sort((a, b) => a.localeCompare(b, 'de'));
  const assignees = Array.isArray(schedule.assignees) && schedule.assignees.length > 0 ? schedule.assignees : [];
  return assignees.length > 0 ? eligibleUsers.filter((n) => assignees.includes(n)) : eligibleUsers;
}

/**
 * Anzeige-Logik: Bei Rotation wurde nach dem Erzeugen des Tickets der Cursor bereits erhöht —
 * wer „heute dran“ ist, steckt dann in der vorherigen Pool-Position.
 */
export function getRoutineAssigneeDisplayName(
  schedule: RoutineSchedule,
  pool: string[],
  todayYmd: string
): string {
  if (schedule.assignment?.type === 'fixed') {
    const name = schedule.assignment.userName;
    return pool.includes(name) ? name : '—';
  }
  if (pool.length === 0) return '—';
  const c = Math.max(0, Number(schedule.rotationCursor || 0));
  if (schedule.assignment?.type === 'rotate' && schedule.lastGenerated === todayYmd) {
    const prev = (c - 1 + pool.length) % pool.length;
    return pool[prev];
  }
  return pool[c % pool.length];
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
