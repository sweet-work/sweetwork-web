"use client";
/* Cadence — Calendar view: month grid (May 2026) with task events. */
import { useMemo, type CSSProperties } from "react";
import { WEEKDAYS, STATUS, TODAY_STR, datesInRange, taskEnd, type Task } from "@/lib/data";

export default function CalendarView({ tasks }: { tasks: Task[] }) {
  const year = 2026;
  const month = 4; // May (0-indexed)

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
    <div className="fade-in cal">
      <div className="cal-week head">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i === 0 ? "sun" : ""}>
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
            return (
              <div
                key={ci}
                className={"cal-cell" + (c.out ? " out" : "") + (isToday ? " today" : "")}
              >
                <span className="dnum">{c.day}</span>
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
  );
}
