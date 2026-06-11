"use client";
/* Cadence — Calendar view: D-day strip + navigable month grid with spanning task bars.
   A bar click opens a read-only detail modal; a long-press / HTML5 drag moves the task's
   date range onto the dropped day. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon, Avatar } from "./primitives";
import { holidayName } from "@/lib/holidays";
import {
  getCalendarTodos,
  getChecklists,
  getTodos,
  updateTodo,
  type Checklist,
  type TodoCalendarItem,
} from "@/lib/api";
import { loadDetail } from "@/lib/taskDetail";
import {
  WEEKDAYS,
  STATUS,
  TODAY,
  TODAY_STR,
  AVATAR_COLORS,
  dday,
  ddayColor,
  ddayLabel,
  fmtRange,
} from "@/lib/data";

// Backend status enum → bar color + Korean label (POSTPONED reuses the board's amber/warn).
const STATUS_META: Record<string, { label: string; color: string }> = {
  TODO: { label: STATUS.todo.label, color: STATUS.todo.color },
  IN_PROGRESS: { label: STATUS.progress.label, color: STATUS.progress.color },
  DONE: { label: STATUS.done.label, color: STATUS.done.color },
  POSTPONED: { label: "보류", color: "var(--warn)" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.TODO;
}

// How many stacked bars fit in a cell before the rest collapse into a "+N건" note.
const LANE_CAP = 3;

// Local YYYY-MM-DD for a Date (avoids UTC shifts from toISOString).
function fmtDs(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Shift a YYYY-MM-DD string by a whole number of days (negative = earlier).
function addDays(ds: string, n: number): string {
  const d = new Date(ds + "T00:00:00");
  d.setDate(d.getDate() + n);
  return fmtDs(d);
}

// Whole-day distance from `a` to `b` (positive when b is later).
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000,
  );
}

// Build the Avatar shape (name/initials/color) for a task owner — color is stable per user id.
function ownerOf(item: TodoCalendarItem) {
  return {
    name: item.user_name,
    initials: item.user_name.slice(0, 2).toUpperCase(),
    color: AVATAR_COLORS[item.user_id % AVATAR_COLORS.length],
  };
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

// Resolve the YYYY-MM-DD of the day cell under a viewport point. Works for both the
// HTML5 drag (mouse coords) and the touch drag (finger coords): a bar lives inside
// .cal-events inside .cal-week.body, so `closest` still finds the owning week — then
// the column is derived from the x position, giving the precise day under the pointer.
function dsAt(x: number, y: number, weeks: Cell[][]): string | null {
  const body = document.elementFromPoint(x, y)?.closest<HTMLElement>(".cal-week.body");
  if (!body) return null;
  const wi = Number(body.dataset.wi);
  const rect = body.getBoundingClientRect();
  const col = Math.max(0, Math.min(6, Math.floor(((x - rect.left) / rect.width) * 7)));
  return weeks[wi]?.[col]?.ds ?? null;
}

function DdayCard({ item }: { item: TodoCalendarItem }) {
  const diff = dday(item.end_date);
  const color = ddayColor(diff);
  return (
    <div className="dday-card" style={{ "--bar": color } as CSSProperties}>
      <div className="num" style={{ color }}>
        {ddayLabel(diff)}
      </div>
      <div className="lab">{item.content}</div>
      <div className="date">{fmtRange(item.start_date, item.end_date > item.start_date ? item.end_date : undefined)}</div>
    </div>
  );
}

// Read-only detail modal — opens on a bar click. Confirms the task's status, owner,
// schedule and (if any) memo/checklist; no editing happens here.
function CalendarDetailModal({
  item,
  checklist,
  memo,
  loading,
  onClose,
}: {
  item: TodoCalendarItem;
  checklist: Checklist[];
  memo: string;
  loading: boolean;
  onClose: () => void;
}) {
  const meta = statusMeta(item.status);
  const single = item.end_date <= item.start_date;
  const diff = dday(item.end_date);
  const span = daysBetween(item.start_date, item.end_date) + 1; // inclusive day count
  const items = [...checklist].sort((a, b) => a.id - b.id);
  const done = items.filter((c) => c.status === "COMPLETE").length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead dt-head">
          <div className="dt-head-text">
            <span className="dt-eyebrow">일감 상세</span>
            <h2 className="dt-title">{item.content}</h2>
          </div>
          <div className="dt-head-actions">
            <button className="icon-btn" onClick={onClose} style={{ width: 30, height: 30, border: 0 }}>
              <Icon name="x" size={17} />
            </button>
          </div>
        </div>
        <div className="mbody">
          <div className="dt-meta">
            <span className="badge" style={{ background: meta.color + "1f", color: meta.color }}>
              <span className="dot" style={{ background: meta.color }} />
              {meta.label}
            </span>
            <span className="dt-owner">
              <Avatar member={ownerOf(item)} size={20} /> {item.user_name}
            </span>
            <span className="dt-date">
              <Icon name="calendar" size={13} />
              {fmtRange(item.start_date, single ? undefined : item.end_date)}
            </span>
            {item.status !== "DONE" && (
              <span className="dday-chip" style={{ background: ddayColor(diff) }}>
                {ddayLabel(diff)}
              </span>
            )}
          </div>

          {/* Plain facts — duration; a one-day task just reads "하루". */}
          <div className="dt-section">
            <div className="dt-section-head">
              <Icon name="clock" size={15} /> 기간
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--fg-2)" }}>
              {single ? "하루 일정" : `${span}일간`}
            </p>
          </div>

          {/* Memo (read-only) — only rendered when the task has one stored locally. */}
          {memo.trim() && (
            <div className="dt-section">
              <div className="dt-section-head">
                <Icon name="align-left" size={15} /> 메모
              </div>
              <p className="dt-memo-readonly">{memo}</p>
            </div>
          )}

          {/* Checklist (read-only) — items shown with their done state, no editing. */}
          <div className="dt-section">
            <div className="dt-section-head">
              <Icon name="check-square" size={15} /> 체크리스트
              {items.length > 0 && <span className="dt-count">{done}/{items.length}</span>}
            </div>
            {items.length > 0 && (
              <div className="dt-progress">
                <span style={{ width: `${(done / items.length) * 100}%` }} />
              </div>
            )}
            {loading ? (
              <div style={{ fontSize: 13, color: "var(--fg-3)", padding: "8px 4px" }}>불러오는 중…</div>
            ) : items.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--fg-3)", padding: "4px 4px" }}>등록된 체크리스트가 없어요.</div>
            ) : (
              <ul className="dt-checklist">
                {items.map((c) => {
                  const checked = c.status === "COMPLETE";
                  return (
                    <li key={c.id} className={checked ? "done" : ""}>
                      <span className="dt-check">
                        <Icon name={checked ? "check-square" : "square"} size={17} />
                      </span>
                      <span className="dt-item-text">{c.content}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// Day-list modal — opens when a date cell is clicked, listing every task overlapping
// that day (useful when a busy cell collapsed some into "+N건"). A row opens the detail.
function DayTasksModal({
  ds,
  tasks,
  onPick,
  onClose,
}: {
  ds: string;
  tasks: TodoCalendarItem[];
  onPick: (item: TodoCalendarItem) => void;
  onClose: () => void;
}) {
  const d = new Date(ds + "T00:00:00");
  const heading = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="mhead">
          <h2>{heading}</h2>
          <button className="icon-btn" onClick={onClose} style={{ width: 30, height: 30, border: 0 }}>
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="mbody">
          <div className="day-list">
            {tasks.map((it) => {
              const meta = statusMeta(it.status);
              const diff = dday(it.end_date);
              const single = it.end_date <= it.start_date;
              return (
                <button key={it.id} className="day-row" onClick={() => onPick(it)}>
                  <span className="dot" style={{ background: meta.color }} />
                  <span className="day-row-main">
                    <span className="day-row-title">{it.content}</span>
                    <span className="day-row-sub">
                      <Avatar member={ownerOf(it)} size={16} /> {it.user_name}
                      <span className="day-row-date">
                        <Icon name="calendar" size={12} />
                        {fmtRange(it.start_date, single ? undefined : it.end_date)}
                      </span>
                    </span>
                  </span>
                  {it.status !== "DONE" && (
                    <span className="dday-chip" style={{ background: ddayColor(diff) }}>
                      {ddayLabel(diff)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// How many upcoming deadlines to surface in the "중요 일정" strip.
const IMPORTANT_LIMIT = 6;

// refreshKey changes whenever a task is added so the views reload fresh server data.
export default function CalendarView({
  refreshKey = 0,
  loginUserId,
}: {
  refreshKey?: number;
  loginUserId: string;
}) {
  // Displayed month; starts on the real "today".
  const [cursor, setCursor] = useState({ year: TODAY.getFullYear(), month: TODAY.getMonth() });
  const { year, month } = cursor;

  // Tasks for the displayed month, loaded from GET /todos/calendar.
  const [items, setItems] = useState<TodoCalendarItem[]>([]);
  const [calErr, setCalErr] = useState("");

  // Nearest upcoming deadlines across the whole team — the "중요 일정" strip.
  const [important, setImportant] = useState<TodoCalendarItem[]>([]);

  // Drag-to-reschedule state: the task in hand, the day under the pointer, and any move error.
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overDs, setOverDs] = useState<string | null>(null);
  const [moveErr, setMoveErr] = useState("");

  // Day-list popup: the clicked date (its tasks are derived from `items`).
  const [dayDs, setDayDs] = useState<string | null>(null);

  // Read-only detail modal: the opened task + its (async) checklist + local memo.
  const [detailItem, setDetailItem] = useState<TodoCalendarItem | null>(null);
  const [detailChecklist, setDetailChecklist] = useState<Checklist[]>([]);
  const [detailMemo, setDetailMemo] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  // Bumped after a successful move so the "중요 일정" strip reflects the new deadline.
  const [moveTick, setMoveTick] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  // Live mirrors for the once-registered touch controller (it can't close over fresh state).
  const itemsRef = useRef<TodoCalendarItem[]>(items);
  itemsRef.current = items;
  const grabDsRef = useRef<string | null>(null); // day the drag was started from
  const moveTaskRef = useRef<(id: number, deltaDays: number) => void>(() => {});

  useEffect(() => {
    let alive = true;
    getTodos(Number(loginUserId))
      .then((res) => {
        if (!alive) return;
        // Active (not done / not on-hold) tasks whose deadline is today or later, soonest first.
        const upcoming = [...res.TODO, ...res.IN_PROGRESS]
          .filter((it) => dday(it.end_date) >= 0)
          .sort((a, b) => dday(a.end_date) - dday(b.end_date))
          .slice(0, IMPORTANT_LIMIT);
        setImportant(upcoming);
      })
      .catch(() => {
        // The strip just stays empty if this fails; the month grid surfaces its own error.
      });
    return () => {
      alive = false;
    };
  }, [refreshKey, loginUserId, moveTick]);

  useEffect(() => {
    let alive = true;
    setCalErr("");
    // API months are 1-based; `month` is 0-based here.
    getCalendarTodos(Number(loginUserId), year, month + 1)
      .then((res) => {
        if (alive) setItems(res);
      })
      .catch((e) => {
        if (alive) setCalErr(e instanceof Error ? e.message : "캘린더 일감을 불러오지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, [year, month, refreshKey, loginUserId]);

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
  // The touch controller reads the live weeks through this ref (registered once).
  const weeksRef = useRef<Cell[][]>(weeks);
  weeksRef.current = weeks;

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

  // Open the read-only detail and (re)load that task's checklist + local memo.
  function openDetail(item: TodoCalendarItem) {
    setDetailItem(item);
    setDetailMemo(loadDetail(item.id).memo);
    setDetailChecklist([]);
    setDetailLoading(true);
    getChecklists(item.id)
      .then(setDetailChecklist)
      .catch(() => {
        /* leave the checklist empty if it can't load — the rest of the detail still shows */
      })
      .finally(() => setDetailLoading(false));
  }

  // Shift a task's whole range by `deltaDays` (optimistic), then PUT it; roll back on failure.
  // Shared by the HTML5 drag (desktop) and the touch drag (mobile).
  function moveTask(id: number, deltaDays: number) {
    if (!deltaDays) return; // dropped on the same day it was grabbed from
    const task = itemsRef.current.find((t) => t.id === id);
    if (!task) return;
    const newStart = addDays(task.start_date, deltaDays);
    const newEnd = addDays(task.end_date, deltaDays);
    const prevStart = task.start_date;
    const prevEnd = task.end_date;
    setMoveErr("");
    setItems((cur) =>
      cur.map((t) => (t.id === id ? { ...t, start_date: newStart, end_date: newEnd } : t)),
    );
    updateTodo(id, { content: task.content, start_date: newStart, end_date: newEnd })
      .then(() => setMoveTick((n) => n + 1))
      .catch((e) => {
        setItems((cur) =>
          cur.map((t) => (t.id === id ? { ...t, start_date: prevStart, end_date: prevEnd } : t)),
        );
        setMoveErr(e instanceof Error ? e.message : "일감 일정 이동에 실패했어요.");
      });
  }
  // Keep the touch controller's reference to moveTask current across renders.
  useEffect(() => {
    moveTaskRef.current = moveTask;
  });

  // Touch drag-and-drop (mobile). HTML5 drag events don't fire from touch, so we run a
  // long-press → drag → drop gesture by hand (mirrors the board): hold a bar briefly so a
  // normal swipe still scrolls, then a floating clone follows the finger and the day cell
  // under it becomes the drop target. Native listeners (passive:false) hold the page still
  // mid-drag; everything mutable is read through refs.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const LONG_PRESS = 180; // ms to hold before a drag starts
    const MOVE_SLOP = 9; // px of pre-drag movement that means "scrolling, not dragging"
    const EDGE = 72; // auto-scroll band at the top/bottom of the viewport

    type Drag = {
      id: number;
      grabDs: string | null;
      startX: number;
      startY: number;
      offX: number;
      offY: number;
      dragging: boolean;
      timer: number;
      ghost: HTMLElement | null;
      bar: HTMLElement;
    };
    let st: Drag | null = null;

    function placeGhost(x: number, y: number) {
      if (!st?.ghost) return;
      st.ghost.style.left = `${x - st.offX}px`;
      st.ghost.style.top = `${y - st.offY}px`;
    }

    // Long-press fired: lift the bar into a floating clone that tracks the finger.
    function beginDrag() {
      if (!st) return;
      st.dragging = true;
      const rect = st.bar.getBoundingClientRect();
      const ghost = st.bar.cloneNode(true) as HTMLElement;
      ghost.classList.add("drag-ghost");
      ghost.style.width = `${rect.width}px`;
      st.ghost = ghost;
      document.body.appendChild(ghost);
      placeGhost(st.startX, st.startY);
      setDraggingId(st.id); // dims the original bar (.dragging)
      navigator.vibrate?.(12);
    }

    function cleanup() {
      if (st?.timer) clearTimeout(st.timer);
      st?.ghost?.remove();
      st = null;
      setDraggingId(null);
      setOverDs(null);
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const bar = (e.target as HTMLElement).closest<HTMLElement>(".cal-bar");
      if (!bar?.dataset.id) return;
      const t = e.touches[0];
      const rect = bar.getBoundingClientRect();
      st = {
        id: Number(bar.dataset.id),
        grabDs: dsAt(t.clientX, t.clientY, weeksRef.current),
        startX: t.clientX,
        startY: t.clientY,
        offX: t.clientX - rect.left,
        offY: t.clientY - rect.top,
        dragging: false,
        ghost: null,
        bar,
        timer: window.setTimeout(beginDrag, LONG_PRESS),
      };
    }

    function onMove(e: TouchEvent) {
      if (!st) return;
      const t = e.touches[0];
      if (!st.dragging) {
        // Moved before the long-press fired ⇒ a scroll, not a drag: bail and let it scroll.
        if (Math.abs(t.clientX - st.startX) > MOVE_SLOP || Math.abs(t.clientY - st.startY) > MOVE_SLOP) {
          cleanup();
        }
        return;
      }
      e.preventDefault(); // hold the page still while a bar is in hand
      placeGhost(t.clientX, t.clientY);
      setOverDs(dsAt(t.clientX, t.clientY, weeksRef.current));
      // Auto-scroll near the edges so the months below/above stay reachable.
      if (t.clientY < EDGE) window.scrollBy(0, -10);
      else if (t.clientY > window.innerHeight - EDGE) window.scrollBy(0, 10);
    }

    function onEnd(e: TouchEvent) {
      if (!st) return;
      if (st.dragging) {
        e.preventDefault(); // cancel the click that would otherwise open the detail
        const t = e.changedTouches[0];
        const ds = dsAt(t.clientX, t.clientY, weeksRef.current);
        if (ds && st.grabDs) moveTaskRef.current(st.id, daysBetween(st.grabDs, ds));
      }
      cleanup();
    }

    root.addEventListener("touchstart", onStart, { passive: false });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd, { passive: false });
    root.addEventListener("touchcancel", cleanup);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", cleanup);
      st?.ghost?.remove();
    };
  }, []);

  // HTML5 drag (desktop): track the hovered day, then move on drop.
  function onCalDragOver(e: React.DragEvent) {
    if (draggingId == null) return;
    e.preventDefault(); // required for the grid to count as a valid drop target
    e.dataTransfer.dropEffect = "move";
    setOverDs(dsAt(e.clientX, e.clientY, weeksRef.current));
  }
  function onCalDrop(e: React.DragEvent) {
    if (draggingId == null) return;
    e.preventDefault();
    const ds = dsAt(e.clientX, e.clientY, weeksRef.current);
    if (ds && grabDsRef.current) moveTask(draggingId, daysBetween(grabDsRef.current, ds));
    setDraggingId(null);
    setOverDs(null);
    grabDsRef.current = null;
  }

  return (
    <div className="fade-in" ref={rootRef}>
      <div className="section-head">
        <h2>중요 일정</h2>
        <span className="count">다가오는 마감</span>
      </div>
      {important.length > 0 ? (
        <div className="dday-strip">
          {important.map((it) => (
            <DdayCard key={it.id} item={it} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--fg-3)", padding: "2px 2px 22px" }}>
          다가오는 일정이 없어요.
        </div>
      )}

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

      <div style={{ fontSize: 12, color: "var(--fg-3)", padding: "0 2px 8px" }}>
        일정을 클릭하면 상세 정보를, 길게 눌러 드래그하면 날짜를 옮길 수 있어요.
      </div>

      {calErr && (
        <div style={{ fontSize: 12.5, color: "var(--danger)", padding: "0 2px 10px" }}>{calErr}</div>
      )}
      {moveErr && (
        <div style={{ fontSize: 12.5, color: "var(--danger)", padding: "0 2px 10px" }}>{moveErr}</div>
      )}

      <div className="cal" onDragOver={onCalDragOver} onDrop={onCalDrop}>
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
            <div className="cal-week body" data-wi={wi} key={wi}>
              {week.map((c, ci) => {
                const isToday = c.ds === TODAY_STR;
                const holiday = holidayName(c.ds);
                const hasTasks = items.some((it) => it.start_date <= c.ds && it.end_date >= c.ds);
                return (
                  <div
                    key={ci}
                    className={
                      "cal-cell" +
                      (ci === 0 ? " sun" : ci === 6 ? " sat" : "") +
                      (holiday ? " holiday" : "") +
                      (c.out ? " out" : "") +
                      (isToday ? " today" : "") +
                      (hasTasks ? " has-tasks" : "") +
                      (draggingId != null && c.ds === overDs ? " drop-over" : "")
                    }
                    // Clicking the day (empty area, not a bar) lists every task that day.
                    onClick={() => hasTasks && setDayDs(c.ds)}
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
                    className={"cal-bar" + (draggingId === s.task.id ? " dragging" : "")}
                    data-id={s.task.id}
                    data-start={s.isStart}
                    data-end={s.isEnd}
                    draggable
                    title={`${s.task.content} · ${s.task.user_name} (${fmtRange(
                      s.task.start_date,
                      s.task.end_date > s.task.start_date ? s.task.end_date : undefined
                    )})`}
                    onClick={() => openDetail(s.task)}
                    onDragStart={(e) => {
                      // Carry the task id (enables the move cursor) and remember the grabbed day.
                      e.dataTransfer.setData("text/plain", String(s.task.id));
                      e.dataTransfer.effectAllowed = "move";
                      grabDsRef.current = dsAt(e.clientX, e.clientY, weeksRef.current) ?? s.task.start_date;
                      setDraggingId(s.task.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverDs(null);
                      grabDsRef.current = null;
                    }}
                    style={
                      {
                        gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`,
                        gridRow: s.lane + 1,
                        "--ev": statusMeta(s.task.status).color,
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

      {dayDs && (
        <DayTasksModal
          ds={dayDs}
          tasks={items
            .filter((it) => it.start_date <= dayDs && it.end_date >= dayDs)
            .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date))}
          onPick={(item) => {
            setDayDs(null);
            openDetail(item);
          }}
          onClose={() => setDayDs(null)}
        />
      )}

      {detailItem && (
        <CalendarDetailModal
          item={detailItem}
          checklist={detailChecklist}
          memo={detailMemo}
          loading={detailLoading}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}
