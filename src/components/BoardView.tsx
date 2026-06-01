"use client";
/* Cadence — Board view: member filter + status columns. */
import { useState } from "react";
import { Icon, Avatar } from "./primitives";
import {
  members,
  personById,
  dday,
  ddayColor,
  ddayLabel,
  fmtRange,
  taskEnd,
  STATUS,
  type Status,
  type Task,
  type CurrentUser,
} from "@/lib/data";

function BoardCard({ task, currentUser }: { task: Task; currentUser: CurrentUser }) {
  const m = personById(task.member, currentUser);
  const diff = dday(taskEnd(task));
  const showD = task.status !== "done" && diff <= 7;
  return (
    <div className="t-card">
      <div className="ttop">
        <span className="ttl">{task.title}</span>
      </div>
      <div className="tbot">
        <Avatar member={m} size={22} />
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

function BoardColumn({
  status,
  tasks,
  currentUser,
}: {
  status: Status;
  tasks: Task[];
  currentUser: CurrentUser;
}) {
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
          <BoardCard key={t.id} task={t} currentUser={currentUser} />
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

export default function BoardView({ tasks, currentUser }: { tasks: Task[]; currentUser: CurrentUser }) {
  const [filter, setFilter] = useState("all");
  const shown = filter === "all" ? tasks : tasks.filter((t) => t.member === filter);
  const cols: Status[] = ["todo", "progress", "done"];

  return (
    <div className="fade-in">
      <div className="filter-bar">
        <button className={"chip all" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>
          전체
        </button>
        {members.map((m) => (
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
          <BoardColumn key={c} status={c} tasks={shown.filter((t) => t.status === c)} currentUser={currentUser} />
        ))}
      </div>
    </div>
  );
}
