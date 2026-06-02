"use client";
/* Cadence — app shell: Sidebar, TopBar, NewTaskModal. */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Avatar, Mark } from "./primitives";
import TopProgressBar from "./TopProgressBar";
import { members, personById, TODAY_STR, type CurrentUser } from "@/lib/data";

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
  const pathname = usePathname();
  const active = viewFromPath(pathname);
  const activeMember = pathname.startsWith("/member/") ? pathname.split("/")[2] : null;
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
          <Link
            key={m.id}
            href={`/member/${m.id}`}
            className={"member-row" + (activeMember === m.id ? " active" : "")}
          >
            <Avatar member={m} size={22} />
            {m.name}
          </Link>
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
  user,
  theme,
  toggleTheme,
  onNewTask,
  onLogout,
}: {
  user: CurrentUser;
  theme: string;
  toggleTheme: () => void;
  onNewTask: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  let meta = TITLES[viewFromPath(pathname)];
  if (pathname.startsWith("/member/")) {
    const p = personById(pathname.split("/")[2], user);
    meta = { t: p ? `${p.name}님의 현황` : "팀원 현황", s: "진행 상태와 개인 주간 보고" };
  }
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
      <div className="profile">
        <Avatar member={user} size={28} />
        <span className="profile-name">{user.name}</span>
        <button className="icon-btn" onClick={onLogout} title="로그아웃">
          <Icon name="log-out" size={18} />
        </button>
      </div>
      <TopProgressBar />
    </header>
  );
}

export interface NewTaskInput {
  title: string;
  date: string;
  endDate?: string;
}

export function NewTaskModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (t: NewTaskInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(TODAY_STR);
  const [endDate, setEndDate] = useState(TODAY_STR);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Keep the range valid: the end never precedes the start.
  function changeStart(v: string) {
    setDate(v);
    if (endDate < v) setEndDate(v);
  }

  async function save() {
    if (saving || !title.trim()) return;
    setSaving(true);
    setErr("");
    try {
      await onAdd({ title: title.trim(), date, endDate: endDate > date ? endDate : undefined });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "일감 등록에 실패했어요.");
      setSaving(false);
    }
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
          <div className="form-row">
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
          </div>
          {err && <div className="err">{err}</div>}
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "등록 중…" : "추가하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
