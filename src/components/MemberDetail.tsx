"use client";
/* Cadence — per-member view: progress status on top, personal weekly report below.
   Real backend members (numeric ids) load their tasks from GET /todos?user_id=;
   seed teammates fall back to the in-memory task list. */
import { useEffect, useState } from "react";
import { Avatar } from "./primitives";
import { TaskRow } from "./Dashboard";
import WeeklyReport from "./WeeklyReport";
import { getTodos } from "@/lib/api";
import { personById, type Task, type CurrentUser, type Member, type Status } from "@/lib/data";

// Backend status enum → local Status (POSTPONED has no local equivalent → 예정).
const STATUS_FROM_API: Record<string, Status> = {
  TODO: "todo",
  IN_PROGRESS: "progress",
  DONE: "done",
  POSTPONED: "todo",
};

export default function MemberDetail({
  memberId,
  tasks,
  members,
  currentUser,
  onToggle,
}: {
  memberId: string;
  tasks: Task[];
  members: Member[];
  currentUser: CurrentUser;
  onToggle: (id: number) => void;
}) {
  // Real backend members have a numeric id; seed teammates ("mk" 등) keep the local path.
  const userId = /^\d+$/.test(memberId) ? Number(memberId) : undefined;
  // Resolve who we're viewing: the real team roster first, then seed team / self.
  const person = members.find((m) => m.id === memberId) ?? personById(memberId, currentUser);

  // A real member's tasks come from the API (null = not yet loaded); seed members use props.
  const [realTasks, setRealTasks] = useState<Task[] | null>(null);
  useEffect(() => {
    if (userId == null) {
      setRealTasks(null);
      return;
    }
    let alive = true;
    getTodos(userId)
      .then((board) => {
        if (!alive) return;
        const all = [...board.TODO, ...board.IN_PROGRESS, ...board.DONE, ...board.POSTPONED];
        setRealTasks(
          all.map((it) => ({
            id: it.id,
            title: it.content,
            member: memberId,
            date: it.start_date,
            endDate: it.end_date > it.start_date ? it.end_date : undefined,
            status: STATUS_FROM_API[it.status] ?? "todo",
            pinned: false,
          }))
        );
      })
      .catch(() => {
        if (alive) setRealTasks([]);
      });
    return () => {
      alive = false;
    };
  }, [userId, memberId]);

  const mine = userId != null ? realTasks ?? [] : tasks.filter((t) => t.member === memberId);

  if (!person) {
    return (
      <div className="member-detail fade-in">
        <div className="panel" style={{ textAlign: "center", color: "var(--fg-3)" }}>
          팀원을 찾을 수 없어요.
        </div>
      </div>
    );
  }

  const done = mine.filter((t) => t.status === "done");
  const prog = mine.filter((t) => t.status === "progress");
  const todo = mine.filter((t) => t.status === "todo");
  const total = mine.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const w = (n: number) => (total ? (n / total) * 100 : 0) + "%";

  // Show what's live first: not-done before done, earlier dates first.
  const ordered = [...mine].sort(
    (a, b) =>
      Number(a.status === "done") - Number(b.status === "done") || a.date.localeCompare(b.date)
  );

  return (
    <div className="member-detail fade-in">
      <div className="member-hero">
        <Avatar member={person} size={46} />
        <div className="who">
          <h1>{person.name}</h1>
          <p>
            맡은 일감 {total}건 · 완료율 {pct}%
          </p>
        </div>
      </div>

      {/* ── 진행 상태 ── */}
      <div className="section-head">
        <h2>진행 상태</h2>
        <span className="count">{total}건</span>
      </div>
      <div className="panel">
        <div className="report-metrics" style={{ margin: "2px 0 16px" }}>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-done)" }}>
              {done.length}
            </div>
            <div className="l">완료</div>
          </div>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-progress)" }}>
              {prog.length}
            </div>
            <div className="l">진행 중</div>
          </div>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-todo)" }}>
              {todo.length}
            </div>
            <div className="l">예정</div>
          </div>
        </div>
        <span className="bar-track" style={{ height: 9 }}>
          <i style={{ width: w(done.length), background: "var(--status-done)" }} />
          <i style={{ width: w(prog.length), background: "var(--status-progress)" }} />
          <i style={{ width: w(todo.length), background: "var(--status-todo)" }} />
        </span>
      </div>

      <div className="section-head" style={{ marginTop: 24 }}>
        <h2>금주 담당 일감</h2>
      </div>
      <div className="task-list">
        {ordered.length ? (
          ordered.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={onToggle} currentUser={currentUser} />
          ))
        ) : (
          <div className="task-row" style={{ color: "var(--fg-3)", justifyContent: "center" }}>
            등록된 일감이 없어요
          </div>
        )}
      </div>

      {/* ── 개인 주간 보고 ── */}
      <div className="section-head" style={{ marginTop: 28 }}>
        <h2>개인 주간 보고 생성</h2>
      </div>
      <WeeklyReport tasks={mine} currentUser={currentUser} person={{ name: person.name }} />
    </div>
  );
}
