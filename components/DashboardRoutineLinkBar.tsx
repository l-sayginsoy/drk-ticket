import React, { useMemo } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User } from '../types';
import {
  getRoutineAssigneeDisplayName,
  getRoutinePool,
  isRoutineDueOnCalendarDay,
  isScheduleVisibleForUser,
  localISODate,
} from '../utils/routineHelpers';

export interface DashboardRoutineLinkBarProps {
  overdueTitles?: string[];
  schedules: Array<RoutineSchedule & { recurrence?: any }>;
  users: User[];
  userRole: Role;
  userName: string;
  completions: RoutineDayCompletion[];
  rpHolidayYmdList?: string[];
  onOpenRoutines: () => void;
  /** Kein äußerer Wrapper, Button ist direktes Flex-Child */
  inline?: boolean;
}

const DashboardRoutineLinkBar: React.FC<DashboardRoutineLinkBarProps> = ({
  schedules,
  overdueTitles = [],
  users,
  userRole,
  userName,
  completions,
  rpHolidayYmdList = [],
  onOpenRoutines,
  inline = false,
}) => {
  const todayYmd = useMemo(() => localISODate(new Date()), []);
  const rpHolidaySet = useMemo(() => new Set(rpHolidayYmdList), [rpHolidayYmdList]);

  const completionSet = useMemo(() => {
    const s = new Set<string>();
    completions.forEach((c) => {
      if (c.date === todayYmd) s.add(c.scheduleId);
    });
    return s;
  }, [completions, todayYmd]);

  const { totalDue, openCount, openTaskTitles } = useMemo(() => {
    const list = (schedules || []).filter((sch) => isScheduleVisibleForUser(sch, userRole, userName, users));
    const dueToday = list.filter((sch) => isRoutineDueOnCalendarDay(sch, new Date(), rpHolidaySet));

    if (userRole === Role.Admin) {
      const total = dueToday.length;
      const openList = dueToday.filter((sch) => !completionSet.has(sch.id));
      const open = openList.length;
      const titles = openList.map((sch) => (sch.title || 'Serientermin').trim()).filter(Boolean);
      return { totalDue: total, openCount: open, openTaskTitles: titles };
    }

    let total = 0;
    let open = 0;
    const openTitles: string[] = [];
    dueToday.forEach((sch) => {
      const pool = getRoutinePool(sch, users);
      const assignee = getRoutineAssigneeDisplayName(sch, pool, todayYmd);
      if (assignee !== userName) return;
      total += 1;
      if (!completionSet.has(sch.id)) {
        open += 1;
        const t = (sch.title || 'Serientermin').trim();
        if (t) openTitles.push(t);
      }
    });
    return { totalDue: total, openCount: open, openTaskTitles: openTitles };
  }, [schedules, users, userRole, userName, todayYmd, completionSet, rpHolidaySet]);

  if (totalDue === 0 && overdueTitles.length === 0) return null;

  const label =
    openCount > 0
      ? `Serienaufträge: ${openCount} heute offen`
      : overdueTitles.length > 0
        ? 'Serienaufträge: Heute keine offenen Aufträge'
        : 'Alle fälligen Serienaufträge heute erledigt';

  const taskNamesLine = [...new Set([...openTaskTitles, ...overdueTitles])];

  const styles = (
    <style>{`
      .dash-routine-link-bar-wrap { width: 100%; box-sizing: border-box; }
      .dash-routine-link-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        box-sizing: border-box;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid var(--border-active);
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-family: inherit;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0;
        cursor: pointer;
        text-align: left;
        transition: filter 0.15s ease, box-shadow 0.15s ease;
      }
      .dash-routine-link-bar:hover {
        filter: brightness(0.98);
        box-shadow: 0 1px 0 rgba(8, 80, 65, 0.08);
      }
      .dash-routine-link-bar:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--border-active);
      }
      .dash-routine-link-bar__icon {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: transparent;
        color: #d97706;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .dash-routine-link-bar__icon .ti { font-size: 26px; line-height: 1; }
      .dash-routine-link-bar__text {
        flex: 1;
        min-width: 0;
        text-align: left;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
      .dash-routine-link-bar__title { line-height: 1.2; }
      .dash-routine-link-bar__sub {
        font-size: 13px;
        font-weight: 400;
        color: var(--text-secondary);
        line-height: 1.3;
        letter-spacing: 0.01em;
        max-width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .dash-routine-link-bar__chevron { flex-shrink: 0; opacity: 0.85; }
      .dash-routine-link-bar__chevron .ti { font-size: 22px; line-height: 1; }
    `}</style>
  );

  const btn = (
    <button
      type="button"
      className="dash-routine-link-bar"
      style={inline ? { flex: '1 1 0%', minWidth: 0 } : undefined}
      onClick={onOpenRoutines}
      aria-label={
        taskNamesLine.length > 0 ? `${label}. ${overdueTitles.length} überfällig. ${taskNamesLine.join(', ')}. Zu Serienaufträge wechseln.` : `${label}. Zu Serienaufträge wechseln.`
      }
    >
      <span className="dash-routine-link-bar__icon" aria-hidden>
        <i className="ti ti-repeat" />
      </span>
      <span className="dash-routine-link-bar__text">
        <span className="dash-routine-link-bar__title">
          {label}
          {overdueTitles.length > 0 && <span style={{ color: 'var(--accent-danger)' }}> · {overdueTitles.length} überfällig</span>}
        </span>
        {taskNamesLine.length > 0 ? (
          <span className="dash-routine-link-bar__sub" title={taskNamesLine.join(" · ")}>
            {taskNamesLine.map((name, i) => (
              <span key={i}>
                {i > 0 && <span style={{ color: '#bbb', margin: '0 6px' }}>•</span>}
                {name}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <span className="dash-routine-link-bar__chevron" aria-hidden>
        <span style={{ fontSize: 12, marginRight: 6 }}>Ansehen</span><i className="ti ti-arrow-right" />
      </span>
    </button>
  );

  if (inline) return <>{styles}{btn}</>;

  return (
    <div className="dash-routine-link-bar-wrap" style={{ maxWidth: 1800, marginTop: 12 }}>
      {styles}
      {btn}
    </div>
  );
};

export default DashboardRoutineLinkBar;
