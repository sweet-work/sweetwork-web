"use client";
/* Cadence — per-member view: progress status on top, personal weekly report below.
   Real backend members (numeric ids) load all tasks from GET /todos?user_id= and
   this week's 금주 담당 일감 from GET /reports/weekly/todos?user_id=;
   seed teammates fall back to the in-memory task list. */
import { useEffect, useState } from "react";
import { Avatar } from "./primitives";
import { TaskRow } from "./Dashboard";
import WeeklyReport from "./WeeklyReport";
import {
  getTodos,
  getWeeklyStats,
  getWeeklyReportTodos,
  updateTodoStatus,
  type WeeklyStats,
  type TodoStatus,
} from "@/lib/api";
import { personById, type Task, type CurrentUser, type Member, type Status } from "@/lib/data";

// Backend status enum → local Status (POSTPONED has no local equivalent → 예정).
const STATUS_FROM_API: Record<string, Status> = {
  TODO: "todo",
  IN_PROGRESS: "progress",
  DONE: "done",
  POSTPONED: "todo",
};

// Local Status → backend status enum (for PATCH /todos/{id}/status).
const STATUS_TO_API: Record<Status, TodoStatus> = {
  todo: "TODO",
  progress: "IN_PROGRESS",
  done: "DONE",
};

// "2026-06-01" → "2026.06.01" for the week-range label.
const ymd = (s: string) => s.replaceAll("-", ".");

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
    // login_user_id = the signed-in user (team scope); user_id = the teammate we're viewing.
    getTodos(Number(currentUser.id), userId)
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
  }, [userId, memberId, currentUser.id]);

  // This-week task counts for a real member (GET /reports/weekly). null until loaded.
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  useEffect(() => {
    if (userId == null) {
      setStats(null);
      return;
    }
    let alive = true;
    getWeeklyStats(userId)
      .then((s) => {
        if (alive) setStats(s);
      })
      .catch(() => {
        if (alive) setStats(null);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // 금주 담당 일감(GET /reports/weekly/todos): 이번 주와 겹치는 모든 상태의 일감. null = 로딩 전.
  const [weekTodos, setWeekTodos] = useState<Task[] | null>(null);
  useEffect(() => {
    if (userId == null) {
      setWeekTodos(null);
      return;
    }
    let alive = true;
    getWeeklyReportTodos(userId)
      .then((res) => {
        if (!alive) return;
        setWeekTodos(
          res.todos.map((it) => ({
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
        if (alive) setWeekTodos([]);
      });
    return () => {
      alive = false;
    };
  }, [userId, memberId]);

  // 실 팀원: 체크 시 상태를 토글하고(완료 ↔ 진행 중) API로 저장, 로컬 목록도 즉시 반영.
  // 금주 일감 목록(weekTodos)과 전체 목록(realTasks)을 함께 갱신해 화면을 일관되게 유지한다.
  // 시드 팀원: 기존 전역 토글(onToggle)을 그대로 사용.
  function toggleReal(id: number) {
    const current = (weekTodos ?? []).find((t) => t.id === id) ?? (realTasks ?? []).find((t) => t.id === id);
    if (!current) return;
    const next: Status = current.status === "done" ? "progress" : "done";
    const apply = (s: Status) => {
      setWeekTodos((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, status: s } : t)) : prev));
      setRealTasks((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, status: s } : t)) : prev));
    };
    apply(next);
    // 저장 실패 시 원래 상태로 되돌린다.
    updateTodoStatus(id, STATUS_TO_API[next]).catch(() => apply(current.status));
  }

  const handleToggle = userId != null ? toggleReal : onToggle;

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

  // 이번 주 진행 상태 패널: 실 사용자는 주간 통계 API, 시드 팀원은 보유 일감에서 계산.
  const cDone = stats ? stats.completed_count : done.length;
  const cProg = stats ? stats.in_progress_count : prog.length;
  const cTodo = stats ? stats.planned_count : todo.length;
  const cTotal = cDone + cProg + cTodo;
  const w = (n: number) => (cTotal ? (n / cTotal) * 100 : 0) + "%";

  // 금주 담당 일감: 실 팀원은 전용 API(GET /reports/weekly/todos) 결과를 그대로 사용.
  // 시드 팀원은 보유 일감 중 이번 주(월~일)와 겹치는 것만 추려서 사용.
  const weekTasks =
    userId != null
      ? weekTodos ?? []
      : stats
        ? mine.filter((t) => {
            const start = t.date;
            const end = t.endDate ?? t.date;
            return start <= stats.week_end && end >= stats.week_start;
          })
        : mine;

  // Show what's live first: not-done before done, earlier dates first.
  const ordered = [...weekTasks].sort(
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

      {/* ── 이번 주 진행 상태 (GET /reports/weekly) ── */}
      <div className="section-head">
        <h2>이번 주 진행 상태</h2>
        <span className="count">
          {stats ? `${ymd(stats.week_start)} – ${ymd(stats.week_end)}` : `${cTotal}건`}
        </span>
      </div>
      <div className="panel">
        <div className="report-metrics" style={{ margin: "2px 0 16px" }}>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-done)" }}>
              {cDone}
            </div>
            <div className="l">완료</div>
          </div>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-progress)" }}>
              {cProg}
            </div>
            <div className="l">진행 중</div>
          </div>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-todo)" }}>
              {cTodo}
            </div>
            <div className="l">예정</div>
          </div>
        </div>
        <span className="bar-track" style={{ height: 9 }}>
          <i style={{ width: w(cDone), background: "var(--status-done)" }} />
          <i style={{ width: w(cProg), background: "var(--status-progress)" }} />
          <i style={{ width: w(cTodo), background: "var(--status-todo)" }} />
        </span>
      </div>

      <div className="section-head" style={{ marginTop: 24 }}>
        <h2>금주 담당 일감</h2>
        <span className="count">{ordered.length}건</span>
      </div>
      <div className="task-list">
        {ordered.length ? (
          ordered.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={handleToggle} currentUser={currentUser} />
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
      <WeeklyReport userId={userId} personName={person.name} tasks={mine} currentUser={currentUser} />
    </div>
  );
}
