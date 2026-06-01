"use client";
/* Cadence — Board view: loads team tasks from GET /todos, member filter + status columns. */
import { useEffect, useMemo, useState } from "react";
import { Icon, Avatar } from "./primitives";
import { getTodos, type TodoBoardItem } from "@/lib/api";
import { dday, ddayColor, ddayLabel, fmtRange, STATUS, type Status } from "@/lib/data";

type Person = { id: string; name: string; initials: string; color: string };

interface BoardTask {
  id: number;
  title: string;
  date: string;
  endDate?: string;
  status: Status;
  member: Person;
}

// Stable avatar color per user id so a person looks the same across renders.
const AVATAR_COLORS = ["#6AA823", "#3F6FE5", "#4E9A6B", "#C2891C", "#8A8275", "#B0561F", "#7A5ACF"];

// Backend status enum → the board's three columns (보류 is shown in the 예정 column).
const COLUMN_OF: Record<string, Status> = {
  TODO: "todo",
  POSTPONED: "todo",
  IN_PROGRESS: "progress",
  DONE: "done",
};

function personOf(it: TodoBoardItem): Person {
  return {
    id: String(it.user_id),
    name: it.user_name,
    initials: it.user_name.slice(0, 2).toUpperCase(),
    color: AVATAR_COLORS[it.user_id % AVATAR_COLORS.length],
  };
}

function toBoardTask(it: TodoBoardItem): BoardTask {
  return {
    id: it.id,
    title: it.content,
    date: it.start_date,
    // Treat a same-day range as a single day so fmtRange shows just one date.
    endDate: it.end_date > it.start_date ? it.end_date : undefined,
    status: COLUMN_OF[it.status] ?? "todo",
    member: personOf(it),
  };
}

function BoardCard({ task }: { task: BoardTask }) {
  const diff = dday(task.endDate ?? task.date);
  const showD = task.status !== "done" && diff <= 7;
  return (
    <div className="t-card">
      <div className="ttop">
        <span className="ttl">{task.title}</span>
      </div>
      <div className="tbot">
        <Avatar member={task.member} size={22} />
        <span className="date">
          <Icon name="calendar" size={13} />
          {fmtRange(task.date, task.endDate)}
        </span>
        <span style={{ flex: 1 }} />
        {showD && (
          <span className="dday-chip" style={{ background: ddayColor(diff) }}>
            {ddayLabel(diff)}
          </span>
        )}
      </div>
    </div>
  );
}

function BoardColumn({ status, tasks }: { status: Status; tasks: BoardTask[] }) {
  const meta = STATUS[status];
  return (
    <div className="board-col">
      <div className="col-head">
        <span className="dot" style={{ background: meta.color }} />
        <span className="t">{meta.label}</span>
        <span className="n">{tasks.length}</span>
      </div>
      <div className="col-cards">
        {tasks.map((t) => (
          <BoardCard key={t.id} task={t} />
        ))}
        {tasks.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--fg-3)", padding: "10px 4px", textAlign: "center" }}>
            비어 있음
          </div>
        )}
      </div>
    </div>
  );
}

const HINT_STYLE = { fontSize: 13, color: "var(--fg-3)", padding: "40px 4px", textAlign: "center" } as const;

// refreshKey changes whenever a task is added so the board reloads fresh server data.
export default function BoardView({ refreshKey = 0 }: { refreshKey?: number }) {
  const [tasks, setTasks] = useState<BoardTask[] | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let alive = true;
    setErr("");
    getTodos()
      .then((res) => {
        if (!alive) return;
        const all = [...res.TODO, ...res.IN_PROGRESS, ...res.DONE, ...res.POSTPONED];
        setTasks(all.map(toBoardTask));
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : "일감을 불러오지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  // Distinct people present on the board, for the filter chips.
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    (tasks ?? []).forEach((t) => map.set(t.member.id, t.member));
    return [...map.values()];
  }, [tasks]);

  if (err) return <div className="fade-in" style={HINT_STYLE}>{err}</div>;
  if (!tasks) return <div className="fade-in" style={HINT_STYLE}>일감을 불러오는 중…</div>;

  const shown = filter === "all" ? tasks : tasks.filter((t) => t.member.id === filter);
  const cols: Status[] = ["todo", "progress", "done"];

  return (
    <div className="fade-in">
      <div className="filter-bar">
        <button className={"chip all" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>
          전체
        </button>
        {people.map((m) => (
          <button
            key={m.id}
            className={"chip" + (filter === m.id ? " active" : "")}
            onClick={() => setFilter(m.id)}
          >
            <Avatar member={m} size={20} /> {m.name}
          </button>
        ))}
      </div>

      <div className="board">
        {cols.map((c) => (
          <BoardColumn key={c} status={c} tasks={shown.filter((t) => t.status === c)} />
        ))}
      </div>
    </div>
  );
}
