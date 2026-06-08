"use client";
/* Cadence — notification center: TopBar bell + unread badge + dropdown / mobile sheet.
   Presentational only; the signed-in user's alerts and handlers are passed in from
   AppProvider (keeps this file free of the AppContext import → no circular dependency). */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./primitives";
import { fmtDate } from "@/lib/data";
import type { NotificationItem, NotificationType } from "@/lib/api";

// Each alert type maps onto the design system's D-day urgency ramp (calm → hot).
const TYPE_META: Record<NotificationType, { label: string; color: string }> = {
  DUE_3_DAYS_BEFORE: { label: "D-3", color: "var(--dday-soon)" },
  DUE_1_DAY_BEFORE: { label: "D-1", color: "var(--dday-now)" },
  DUE_TODAY: { label: "D-DAY", color: "var(--dday-now)" },
  OVERDUE: { label: "지남", color: "var(--danger)" },
};

// "방금 전 / N분 전 / N시간 전 / N일 전", falling back to the date once it's a week old.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const min = Math.floor(Math.max(0, Date.now() - then) / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return fmtDate(iso.slice(0, 10));
}

export default function NotificationCenter({
  items,
  unread,
  onRead,
  onReadAll,
  onRefresh,
  onOpenTask,
}: {
  items: NotificationItem[];
  unread: number;
  onRead: (id: number) => void;
  onReadAll: () => void;
  // Re-pull the list when the panel opens (the badge count is kept fresh by polling).
  onRefresh: () => void;
  // Mark read (if needed) + jump to the related task on the board.
  onOpenTask: (todoId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Refresh the list each time the panel opens.
  useEffect(() => {
    if (open) onRefresh();
  }, [open, onRefresh]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleClick(n: NotificationItem) {
    if (n.status === "UNREAD") onRead(n.id);
    setOpen(false);
    onOpenTask(n.todo_id);
  }

  return (
    <div className="notif" ref={rootRef}>
      <button
        className="icon-btn notif-bell"
        title="알림"
        aria-label={unread > 0 ? `읽지 않은 알림 ${unread}개` : "알림"}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={unread > 0 ? "bell-ring" : "bell"} size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <>
          {/* Mobile-only scrim behind the bottom sheet (CSS-hidden on desktop). */}
          <div className="notif-scrim" onClick={() => setOpen(false)} />
          <div className="notif-panel" role="dialog" aria-label="알림">
            <div className="notif-head">
              <span className="notif-title">알림</span>
              {unread > 0 && <span className="notif-pill">{unread}</span>}
              <span style={{ flex: 1 }} />
              <button className="notif-readall" onClick={onReadAll} disabled={unread === 0}>
                <Icon name="check-check" size={15} /> 모두 읽음
              </button>
            </div>
            <div className="notif-list">
              {items.length === 0 ? (
                <div className="notif-empty">
                  <Icon name="bell-off" size={26} />
                  <p>지금은 챙길 마감이 없어요</p>
                </div>
              ) : (
                items.map((n) => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.DUE_TODAY;
                  const isUnread = n.status === "UNREAD";
                  return (
                    <button
                      key={n.id}
                      className={"notif-item" + (isUnread ? " unread" : "")}
                      onClick={() => handleClick(n)}
                    >
                      <span className="notif-bar" style={{ background: meta.color }} />
                      <span className="notif-chip" style={{ background: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="notif-body">
                        <span className="notif-item-title">{n.title}</span>
                        <span className="notif-msg">{n.message}</span>
                        <span className="notif-foot">
                          <Icon name="calendar" size={12} /> {fmtDate(n.due_date)}
                          <span className="notif-dot-sep">·</span>
                          {relativeTime(n.created_at)}
                        </span>
                      </span>
                      {isUnread && <span className="notif-unread-dot" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
