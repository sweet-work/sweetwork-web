"use client";
/* Cadence — app shell: Sidebar, TopBar, NewTaskModal. */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Avatar, Mark } from "./primitives";
import {
  members,
  STATUS,
  TODAY_STR,
  type CurrentUser,
  type Status,
} from "@/lib/data";

export type View = "dashboard" | "board" | "calendar" | "report";

const NAV: { id: View; label: string; icon: string }[] = [
  // 대시보드 탭은 아직 사용하지 않아 네비게이션에서 숨김 (라우트/페이지는 유지).
  { id: "board", label: "보드", icon: "columns-3" },
  { id: "calendar", label: "캘린더", icon: "calendar-days" },
  { id: "report", label: "AI 주간 보고 생성", icon: "sparkles" },
];

/* Resolve the active view from the current pathname (e.g. "/board" → "board"). */
export function viewFromPath(pathname: string): View {
  const seg = pathname.split("/")[1];
  return (NAV.some((n) => n.id === seg) ? seg : "dashboard") as View;
}

export function Sidebar({ currentUser }: { currentUser: CurrentUser }) {
  const active = viewFromPath(usePathname());
  return (
    <aside className="sidebar">
      <div className="brand">
        <Mark size={32} radius={9} />
        <span className="name">Cadence</span>
      </div>

      {NAV.map((n) => (
        <Link
          key={n.id}
          href={`/${n.id}`}
          className={"nav-item" + (active === n.id ? " active" : "")}
        >
          <Icon name={n.icon} size={18} />
          {n.label}
        </Link>
      ))}

      <div className="nav-label">우리 팀</div>
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
  report: { t: "AI 주간 보고 생성", s: "AI가 정리하는 이번 주 업무" },
};

export function TopBar({
  theme,
  toggleTheme,
  onNewTask,
}: {
  theme: string;
  toggleTheme: () => void;
  onNewTask: () => void;
}) {
  const meta = TITLES[viewFromPath(usePathname())];
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
  endDate?: string;
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
  const [date, setDate] = useState(TODAY_STR);
  const [endDate, setEndDate] = useState(TODAY_STR);
  const [status, setStatus] = useState<Status>("todo");
  const statuses: Status[] = ["todo", "progress", "done"];

  // Keep the range valid: the end never precedes the start.
  function changeStart(v: string) {
    setDate(v);
    if (endDate < v) setEndDate(v);
  }

  function save() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), date, endDate: endDate > date ? endDate : undefined, status });
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
            <label>시작일</label>
            <div className="field">
              <Icon name="calendar" size={17} />
              <input type="date" value={date} onChange={(e) => changeStart(e.target.value)} />
            </div>
          </div>
          <div className="input">
            <label>종료일</label>
            <div className="field">
              <Icon name="calendar" size={17} />
              <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
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
