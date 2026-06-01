"use client";
/* Cadence — app shell: Sidebar, TopBar, NewTaskModal. */
import { useState } from "react";
import { Icon, Avatar, Mark } from "./primitives";
import {
  members,
  STATUS,
  type CurrentUser,
  type Status,
} from "@/lib/data";

export type View = "dashboard" | "board" | "calendar" | "report";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "대시보드", icon: "layout-dashboard" },
  { id: "board", label: "보드", icon: "columns-3" },
  { id: "calendar", label: "캘린더", icon: "calendar-days" },
  { id: "report", label: "주간 보고", icon: "sparkles" },
];

export function Sidebar({
  view,
  setView,
  currentUser,
}: {
  view: View;
  setView: (v: View) => void;
  currentUser: CurrentUser;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Mark size={32} radius={9} />
        <span className="name">Cadence</span>
      </div>

      {NAV.map((n) => (
        <button
          key={n.id}
          className={"nav-item" + (view === n.id ? " active" : "")}
          onClick={() => setView(n.id)}
        >
          <Icon name={n.icon} size={18} />
          {n.label}
        </button>
      ))}

      <div className="nav-label">팀</div>
      <div className="member-list">
        {members.map((m) => (
          <div key={m.id} className="member-row">
            <Avatar member={m} size={22} />
            {m.name}
          </div>
        ))}
      </div>

      <div className="spacer" />
      <div className="member-row" style={{ cursor: "default" }}>
        <Avatar member={currentUser} size={22} />
        <span
          style={{
            color: "var(--fg-1)",
            fontWeight: 550,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentUser.email}
        </span>
      </div>
    </aside>
  );
}

const TITLES: Record<View, { t: string; s: string }> = {
  dashboard: { t: "대시보드", s: "오늘의 일감과 다가오는 일정" },
  board: { t: "보드", s: "상태별로 보는 팀 일감" },
  calendar: { t: "캘린더", s: "한 달 일정 한눈에 보기" },
  report: { t: "주간 보고", s: "AI가 정리하는 이번 주 업무" },
};

export function TopBar({
  view,
  theme,
  toggleTheme,
  onNewTask,
}: {
  view: View;
  theme: string;
  toggleTheme: () => void;
  onNewTask: () => void;
}) {
  const meta = TITLES[view];
  return (
    <header className="topbar">
      <div>
        <div className="page-title">{meta.t}</div>
        <div className="sub">{meta.s}</div>
      </div>
      <div className="grow" />
      <button className="icon-btn" onClick={toggleTheme} title="테마 전환">
        <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
      </button>
      <button className="btn btn-primary btn-sm" onClick={onNewTask}>
        <Icon name="plus" size={16} /> 일감 추가
      </button>
    </header>
  );
}

export interface NewTaskInput {
  title: string;
  date: string;
  member: string;
  status: Status;
}

export function NewTaskModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (t: NewTaskInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("2026-05-14");
  const [member, setMember] = useState(members[0].id);
  const [status, setStatus] = useState<Status>("todo");
  const statuses: Status[] = ["todo", "progress", "done"];

  function save() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), date, member, status });
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <h2>일감 추가</h2>
          <button className="icon-btn" onClick={onClose} style={{ width: 30, height: 30, border: 0 }}>
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="mbody">
          <div className="input">
            <label>일감 내용</label>
            <div className="field">
              <Icon name="check-square" size={17} />
              <input
                autoFocus
                placeholder="무엇을 진행하나요?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
          </div>
          <div className="input">
            <label>날짜</label>
            <div className="field">
              <Icon name="calendar" size={17} />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="input">
            <label>담당자</label>
            <div className="seg-pick">
              {members.slice(0, 3).map((m) => (
                <button key={m.id} className={member === m.id ? "active" : ""} onClick={() => setMember(m.id)}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <div className="input">
            <label>상태</label>
            <div className="seg-pick">
              {statuses.map((s) => {
                const meta = STATUS[s];
                return (
                  <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>
                    <span className="dot" style={{ background: meta.color }} /> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn btn-primary" onClick={save}>
            추가하기
          </button>
        </div>
      </div>
    </div>
  );
}
