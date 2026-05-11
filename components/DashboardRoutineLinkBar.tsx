import React, { useMemo } from 'react';
import { Role, RoutineDayCompletion, RoutineSchedule, User } from '../types';
import {
  getRoutineAssigneeDisplayName,
  getRoutinePool,
  isRoutineDueOnCalendarDay,
  isScheduleVisibleForUser,
  localISODate,
} from '../utils/routineHelpers';
import { ROUTINE_TEAL } from '../utils/routineUiPalette';

export interface DashboardRoutineLinkBarProps {
  schedules: Array<RoutineSchedule & { recurrence?: any }>;
  users: User[];
  userRole: Role;
  userName: string;
  completions: RoutineDayCompletion[];
  rpHolidayYmdList?: string[];
  onOpenRoutines: () => void;
}

const DashboardRoutineLinkBar: React.FC<DashboardRoutineLinkBarProps> = ({
  schedules,
  users,
  userRole,
  userName,
  completions,
  rpHolidayYmdList = [],
  onOpenRoutines,
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

  if (totalDue === 0) return null;

  const label =
    openCount > 0
      ? `${openCount} Serienaufträge heute offen`
      : 'Alle fälligen Serienaufträge heute erledigt';

  const taskNamesLine = openCount > 0 && openTaskTitles.length > 0 ? openTaskTitles.join(' · ') : '';

  return (
    <div className="dash-routine-link-bar-wrap" style={{ maxWidth: 1800, marginTop: 12 }}>
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
          border: 1px solid ${ROUTINE_TEAL.border};
          background: ${ROUTINE_TEAL.bg};
          color: ${ROUTINE_TEAL.dark};
          font-family: inherit;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.02em;
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
          box-shadow: 0 0 0 2px ${ROUTINE_TEAL.border};
        }
        .dash-routine-link-bar__icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: ${ROUTINE_TEAL.accent};
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .dash-routine-link-bar__icon .ti {
          font-size: 20px;
          line-height: 1;
        }
        .dash-routine-link-bar__text {
          flex: 1;
          min-width: 0;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .dash-routine-link-bar__title {
          line-height: 1.2;
        }
        .dash-routine-link-bar__sub {
          font-size: 11px;
          font-weight: 400;
          color: #0f6e56;
          line-height: 1.3;
          letter-spacing: 0.01em;
        }
        .dash-routine-link-bar__chevron {
          flex-shrink: 0;
          opacity: 0.85;
        }
        .dash-routine-link-bar__chevron .ti {
          font-size: 22px;
          line-height: 1;
        }
      `}</style>
      <button
        type="button"
        className="dash-routine-link-bar"
        onClick={onOpenRoutines}
        aria-label={
          taskNamesLine ? `${label}. ${taskNamesLine}. Zu Serienaufträge wechseln.` : `${label}. Zu Serienaufträge wechseln.`
        }
      >
        <span className="dash-routine-link-bar__icon" aria-hidden>
          <i className="ti ti-repeat" />
        </span>
        <span className="dash-routine-link-bar__text">
          <span className="dash-routine-link-bar__title">{label}</span>
          {taskNamesLine ? <span className="dash-routine-link-bar__sub">{taskNamesLine}</span> : null}
        </span>
        <span className="dash-routine-link-bar__chevron" aria-hidden>
          <i className="ti ti-chevron-right" />
        </span>
      </button>
    </div>
  );
};

export default DashboardRoutineLinkBar;
