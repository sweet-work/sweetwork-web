"use client";
/* Cadence — Dashboard: D-day strip + today's tasks + team activity. */
import type { CSSProperties } from "react";
import { Icon, Avatar, StatusBadge } from "./primitives";
import {
  members,
  memberById,
  dday,
  ddayColor,
  ddayLabel,
  fmtDate,
  WEEKDAYS,
  TODAY_STR,
  type Task,
} from "@/lib/data";

function DdayCard({ task }: { task: Task }) {
  const diff = dday(task.date);
  const color = ddayColor(diff);
  return (
    <div className="dday-card" style={{ "--bar": color } as CSSProperties}>
      <div className="num" style={{ color }}>
        {ddayLabel(diff)}
      </div>
      <div className="lab">{task.ddayLabel || task.title}</div>
      <div className="date">
        {task.date.replace(/-/g, ".")} ({WEEKDAYS[new Date(task.date + "T00:00:00").getDay()]})
      </div>
    </div>
  );
}

export function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: number) => void }) {
  const m = memberById(task.member);
  const done = task.status === "done";
  return (
    <div className={"task-row" + (done ? " is-done" : "")}>
      <button
        className={"task-check" + (done ? " done" : "")}
        onClick={() => onToggle(task.id)}
        title={done ? "완료 해제" : "완료로 표시"}
      >
        {done && <Icon name="check" size={13} />}
      </button>
      <span className="ttl">{task.title}</span>
      <div className="right">
        {!done && <StatusBadge status={task.status} />}
        <Avatar member={m} size={24} />
        <span className="date">{fmtDate(task.date)}</span>
      </div>
    </div>
  );
}

export default function Dashboard({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (id: number) => void;
}) {
  const pinned = tasks.filter((t) => t.pinned).sort((a, b) => dday(a.date) - dday(b.date));

  // Today's + upcoming (next 4 days), not done — the "what's live now" list.
  const today = tasks.filter((t) => t.date === TODAY_STR);
  const upcoming = tasks
    .filter((t) => t.date > TODAY_STR && dday(t.date) <= 4 && t.status !== "done")
    .sort((a, b) => a.date.localeCompare(b.date));

  // Per-member weekly progress.
  const stats = members
    .map((m) => {
      const mine = tasks.filter((t) => t.member === m.id);
      const done = mine.filter((t) => t.status === "done").length;
      const prog = mine.filter((t) => t.status === "progress").length;
      return { m, total: mine.length, done, prog, todo: mine.length - done - prog };
    })
    .filter((s) => s.total > 0);

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

      <div className="dash-grid">
        <div>
          <div className="section-head">
            <h2>오늘의 일감</h2>
            <span className="count">{today.length}건</span>
          </div>
          <div className="task-list">
            {today.length ? (
              today.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} />)
            ) : (
              <div className="task-row" style={{ color: "var(--fg-3)", justifyContent: "center" }}>
                오늘 등록된 일감이 없어요
              </div>
            )}
          </div>

          <div className="section-head" style={{ marginTop: 24 }}>
            <h2>곧 다가오는 일감</h2>
            <span className="count">{upcoming.length}건</span>
          </div>
          <div className="task-list">
            {upcoming.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={onToggle} />
            ))}
          </div>
        </div>

        <div>
          <div className="section-head">
            <h2>이번 주 팀 현황</h2>
          </div>
          <div className="panel">
            {stats.map((s) => {
              const pct = Math.round((s.done / s.total) * 100);
              return (
                <div className="stat-row" key={s.m.id}>
                  <Avatar member={s.m} size={26} />
                  <span className="nm">{s.m.name}</span>
                  <span className="bar-track">
                    <i style={{ width: (s.done / s.total) * 100 + "%", background: "var(--status-done)" }} />
                    <i style={{ width: (s.prog / s.total) * 100 + "%", background: "var(--status-progress)" }} />
                    <i style={{ width: (s.todo / s.total) * 100 + "%", background: "var(--status-todo)" }} />
                  </span>
                  <span className="pct">{pct}%</span>
                </div>
              );
            })}
            <div className="mini-legend">
              <span>
                <span className="dot" style={{ background: "var(--status-done)" }} />
                완료
              </span>
              <span>
                <span className="dot" style={{ background: "var(--status-progress)" }} />
                진행 중
              </span>
              <span>
                <span className="dot" style={{ background: "var(--status-todo)" }} />
                예정
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
