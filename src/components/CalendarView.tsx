"use client";
/* Cadence — Calendar view: D-day strip + navigable month grid with task events. */
import { useMemo, useState, type CSSProperties } from "react";
import { Icon } from "./primitives";
import { holidayName } from "@/lib/holidays";
import {
  WEEKDAYS,
  STATUS,
  TODAY,
  TODAY_STR,
  datesInRange,
  taskEnd,
  dday,
  ddayColor,
  ddayLabel,
  fmtRange,
  type Task,
} from "@/lib/data";

function DdayCard({ task }: { task: Task }) {
  const diff = dday(taskEnd(task));
  const color = ddayColor(diff);
  return (
    <div className="dday-card" style={{ "--bar": color } as CSSProperties}>
      <div className="num" style={{ color }}>
        {ddayLabel(diff)}
      </div>
      <div className="lab">{task.ddayLabel || task.title}</div>
      <div className="date">{fmtRange(task.date, task.endDate)}</div>
    </div>
  );
}

export default function CalendarView({ tasks }: { tasks: Task[] }) {
  const pinned = tasks.filter((t) => t.pinned).sort((a, b) => dday(taskEnd(a)) - dday(taskEnd(b)));

  // Displayed month; starts on the app's "today" so it lines up with the seeded tasks.
  const [cursor, setCursor] = useState({ year: TODAY.getFullYear(), month: TODAY.getMonth() });
  const { year, month } = cursor;

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function goToday() {
    setCursor({ year: TODAY.getFullYear(), month: TODAY.getMonth() });
  }

  const monthLabel = `${year}년 ${month + 1}월`;

  const byDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      datesInRange(t.date, taskEnd(t)).forEach((ds) => {
        (map[ds] = map[ds] || []).push(t);
      });
    });
    return map;
  }, [tasks]);

  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { out: boolean; day: number }[] = [];
  // leading (prev month)
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ out: true, day: prevDays - i });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ out: false, day: d });
  while (cells.length % 7 !== 0) cells.push({ out: true, day: cells.length - daysInMonth - startOffset + 1 });

  const weeks: { out: boolean; day: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="fade-in">
      <div className="section-head">
        <h2>중요 일정</h2>
        <span className="count">D-day</span>
      </div>
      <div className="dday-strip">
        {pinned.map((t) => (
          <DdayCard key={t.id} task={t} />
        ))}
      </div>

      <div className="cal-nav">
        <div className="cal-month">{monthLabel}</div>
        <button className="btn btn-secondary btn-sm" onClick={goToday}>
          오늘
        </button>
        <span style={{ flex: 1 }} />
        <button className="icon-btn" onClick={() => shiftMonth(-1)} title="이전 달">
          <Icon name="chevron-left" size={18} />
        </button>
        <button className="icon-btn" onClick={() => shiftMonth(1)} title="다음 달">
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      <div className="cal">
      <div className="cal-week head">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>
            {w}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div className="cal-week" key={wi}>
          {week.map((c, ci) => {
            const ds = !c.out ? dateStr(c.day) : null;
            const evs = ds ? byDate[ds] || [] : [];
            const isToday = ds === TODAY_STR;
            const holiday = ds ? holidayName(ds) : null;
            return (
              <div
                key={ci}
                className={
                  "cal-cell" +
                  (ci === 0 ? " sun" : ci === 6 ? " sat" : "") +
                  (holiday ? " holiday" : "") +
                  (c.out ? " out" : "") +
                  (isToday ? " today" : "")
                }
              >
                <span className="dnum">{c.day}</span>
                {holiday && <div className="cal-holiday">{holiday}</div>}
                {evs.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="cal-event"
                    style={{ "--ev": STATUS[t.status].color } as CSSProperties}
                  >
                    {t.title}
                  </div>
                ))}
                {evs.length > 3 && <div className="cal-more">+{evs.length - 3}건 더</div>}
              </div>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}
