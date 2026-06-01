"use client";
/* Cadence — Calendar view: D-day strip + navigable month grid with spanning task bars. */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Icon } from "./primitives";
import { holidayName } from "@/lib/holidays";
import { getCalendarTodos, type TodoCalendarItem } from "@/lib/api";
import {
  WEEKDAYS,
  STATUS,
  TODAY,
  TODAY_STR,
  taskEnd,
  dday,
  ddayColor,
  ddayLabel,
  fmtRange,
  type Task,
} from "@/lib/data";

// Backend status enum → event bar color (POSTPONED reuses the board's amber/warn).
const EV_COLOR: Record<string, string> = {
  TODO: "var(--status-todo)",
  IN_PROGRESS: "var(--status-progress)",
  DONE: "var(--status-done)",
  POSTPONED: "var(--warn)",
};

// How many stacked bars fit in a cell before the rest collapse into a "+N건" note.
const LANE_CAP = 3;

// Local YYYY-MM-DD for a Date (avoids UTC shifts from toISOString).
function fmtDs(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Cell {
  ds: string;
  day: number;
  out: boolean;
}

// One task's slice within a single week: which columns it covers, whether the
// true start/end fall in this week, and the lane (row) it was packed into.
interface Seg {
  task: TodoCalendarItem;
  startCol: number;
  endCol: number;
  isStart: boolean;
  isEnd: boolean;
  lane: number;
}

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

// refreshKey changes whenever a task is added so the month reloads fresh server data.
export default function CalendarView({ tasks, refreshKey = 0 }: { tasks: Task[]; refreshKey?: number }) {
  const pinned = tasks.filter((t) => t.pinned).sort((a, b) => dday(taskEnd(a)) - dday(taskEnd(b)));

  // Displayed month; starts on the app's "today" so it lines up with the seeded tasks.
  const [cursor, setCursor] = useState({ year: TODAY.getFullYear(), month: TODAY.getMonth() });
  const { year, month } = cursor;

  // Tasks for the displayed month, loaded from GET /todos/calendar.
  const [items, setItems] = useState<TodoCalendarItem[]>([]);
  const [calErr, setCalErr] = useState("");

  useEffect(() => {
    let alive = true;
    setCalErr("");
    // API months are 1-based; `month` is 0-based here.
    getCalendarTodos(year, month + 1)
      .then((res) => {
        if (alive) setItems(res);
      })
      .catch((e) => {
        if (alive) setCalErr(e instanceof Error ? e.message : "캘린더 일감을 불러오지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, [year, month, refreshKey]);

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

  // Build the month grid as real dates (including the adjacent-month days that pad
  // the first/last weeks), so a task spanning a month boundary still draws across them.
  const weeks = useMemo(() => {
    const startOffset = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const cells: Cell[] = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(year, month, 1 - startOffset + i);
      cells.push({ ds: fmtDs(d), day: d.getDate(), out: d.getMonth() !== month });
    }
    const out: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [year, month]);

  // For each week, lay tasks out as horizontal bars packed onto lanes so a multi-day
  // task reads as one continuous bar (broken only at week boundaries).
  const layouts = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0].ds;
      const weekEnd = week[6].ds;
      const segs: Seg[] = [];
      items
        .filter((it) => it.start_date <= weekEnd && it.end_date >= weekStart)
        .forEach((it) => {
          let startCol = -1;
          let endCol = -1;
          for (let c = 0; c < 7; c++) {
            if (week[c].ds >= it.start_date && week[c].ds <= it.end_date) {
              if (startCol === -1) startCol = c;
              endCol = c;
            }
          }
          if (startCol === -1) return;
          segs.push({
            task: it,
            startCol,
            endCol,
            isStart: it.start_date >= weekStart,
            isEnd: it.end_date <= weekEnd,
            lane: 0,
          });
        });
      // Greedy lane packing: earliest start first, longer spans first to fill rows tightly.
      segs.sort((a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol));
      const laneEnd: number[] = [];
      segs.forEach((s) => {
        let lane = 0;
        while (lane < laneEnd.length && laneEnd[lane] >= s.startCol) lane++;
        s.lane = lane;
        laneEnd[lane] = s.endCol;
      });
      // Count per-day tasks that overflowed past the lane cap.
      const overflow = new Array(7).fill(0);
      segs.forEach((s) => {
        if (s.lane >= LANE_CAP) for (let c = s.startCol; c <= s.endCol; c++) overflow[c]++;
      });
      return { visible: segs.filter((s) => s.lane < LANE_CAP), overflow };
    });
  }, [weeks, items]);

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

      {calErr && (
        <div style={{ fontSize: 12.5, color: "var(--danger)", padding: "0 2px 10px" }}>{calErr}</div>
      )}

      <div className="cal">
        <div className="cal-week head">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => {
          const { visible, overflow } = layouts[wi];
          return (
            <div className="cal-week body" key={wi}>
              {week.map((c, ci) => {
                const isToday = c.ds === TODAY_STR;
                const holiday = holidayName(c.ds);
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
                    <div className="chead">
                      <span className="dnum">{c.day}</span>
                      {holiday && <span className="cal-holiday">{holiday}</span>}
                    </div>
                    {overflow[ci] > 0 && <div className="cal-more">+{overflow[ci]}건</div>}
                  </div>
                );
              })}
              <div className="cal-events">
                {visible.map((s) => (
                  <div
                    key={`${s.task.id}-${s.startCol}`}
                    className="cal-bar"
                    data-start={s.isStart}
                    data-end={s.isEnd}
                    title={`${s.task.content} · ${s.task.user_name} (${fmtRange(
                      s.task.start_date,
                      s.task.end_date > s.task.start_date ? s.task.end_date : undefined
                    )})`}
                    style={
                      {
                        gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`,
                        gridRow: s.lane + 1,
                        "--ev": EV_COLOR[s.task.status] ?? STATUS.todo.color,
                      } as CSSProperties
                    }
                  >
                    {s.isStart ? s.task.content : `↳ ${s.task.content}`}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
