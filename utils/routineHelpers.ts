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

export function isRoutineDueOnCalendarDay(
  schedule: RoutineSchedule & { recurrence?: any },
  day: Date
): boolean {
  if (!schedule.enabled) return false;
  if (!String(schedule.area || '').trim()) return false;
  const rec = (schedule as any).recurrence;
  if (!rec || rec.type === 'daily') return true;

  if (rec.type === 'weekly') {
    const intervalWeeks = Math.max(1, Number(rec.intervalWeeks || 1));
    const anchor = new Date(1970, 0, 5);
    anchor.setHours(0, 0, 0, 0);
    const t = new Date(day);
    t.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((t.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
    const weeksSince = Math.floor(diffDays / 7);
    return weeksSince % intervalWeeks === 0;
  }

  if (rec.type === 'weekdays') {
    const intervalWeeks = Math.max(1, Number(rec.intervalWeeks || 1));
    const weekdays = Array.isArray(rec.weekdays) ? (rec.weekdays as WeekdayKey[]) : [];
    if (!weekdays.includes(weekdayKeyForDate(day))) return false;
    const anchor = new Date(1970, 0, 5);
    anchor.setHours(0, 0, 0, 0);
    const t = new Date(day);
    t.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((t.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
    const weeksSince = Math.floor(diffDays / 7);
    return weeksSince % intervalWeeks === 0;
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

/** Alle lokalen Kalendertage (YYYY-MM-DD) im Jahr, an denen der Auftrag laut Intervall fällig ist. */
export function getDueDatesInYear(
  schedule: RoutineSchedule & { recurrence?: any },
  year: number
): string[] {
  const out: string[] = [];
  const d = new Date(year, 0, 1);
  d.setHours(0, 0, 0, 0);
  const end = new Date(year, 11, 31);
  end.setHours(0, 0, 0, 0);
  while (d.getTime() <= end.getTime()) {
    const cur = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (isRoutineDueOnCalendarDay(schedule, cur)) {
      out.push(localISODate(cur));
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}
