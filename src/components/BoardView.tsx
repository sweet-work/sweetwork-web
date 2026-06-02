"use client";
/* Cadence — Board view: loads team tasks from GET /todos, member filter + status columns. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Avatar } from "./primitives";
import {
  getTodos,
  updateTodoStatus,
  updateTodo,
  deleteTodo,
  getChecklists,
  createChecklist,
  updateChecklistStatus,
  deleteChecklist,
  type TodoBoardItem,
  type TodoStatus,
  type Checklist,
  type ChecklistStatus,
} from "@/lib/api";
import { dday, ddayColor, ddayLabel, fmtRange, STATUS } from "@/lib/data";
import { loadDetail, saveDetail, clearDetail, type TaskDetail } from "@/lib/taskDetail";

// Done/total for a checklist (card badge + modal progress bar).
function progressOf(list: Checklist[]): { done: number; total: number } {
  return { done: list.filter((c) => c.status === "COMPLETE").length, total: list.length };
}

type Person = { id: string; name: string; initials: string; color: string };

// The board has its own four columns (보류 = on-hold), distinct from the shared 3-state
// `Status` used by the calendar/dashboard — so adding 보류 here doesn't ripple into those views.
type BoardCol = "todo" | "progress" | "postponed" | "done";

interface BoardTask {
  id: number;
  title: string;
  date: string;
  endDate?: string;
  status: BoardCol;
  member: Person;
}

// Stable avatar color per user id so a person looks the same across renders.
const AVATAR_COLORS = ["#6AA823", "#3F6FE5", "#4E9A6B", "#C2891C", "#8A8275", "#B0561F", "#7A5ACF"];

// Backend status enum → board column (one-to-one now that 보류 has its own column).
const COLUMN_OF: Record<string, BoardCol> = {
  TODO: "todo",
  POSTPONED: "postponed",
  IN_PROGRESS: "progress",
  DONE: "done",
};

// Board column → backend status to send on drop.
const STATUS_OF: Record<BoardCol, TodoStatus> = {
  todo: "TODO",
  progress: "IN_PROGRESS",
  postponed: "POSTPONED",
  done: "DONE",
};

// Column header meta — reuses the shared STATUS palette, plus a 보류 entry (amber/warn).
const COL_META: Record<BoardCol, { label: string; color: string }> = {
  todo: { label: STATUS.todo.label, color: STATUS.todo.color },
  progress: { label: STATUS.progress.label, color: STATUS.progress.color },
  postponed: { label: "보류", color: "var(--warn)" },
  done: { label: STATUS.done.label, color: STATUS.done.color },
};

// Left-to-right column order on the board.
const COLS: BoardCol[] = ["todo", "progress", "postponed", "done"];

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

function BoardCard({
  task,
  checklist,
  hasMemo,
  dragging,
  menuOpen,
  onOpen,
  onDragStart,
  onDragEnd,
  onToggleMenu,
  onEdit,
  onDelete,
}: {
  task: BoardTask;
  checklist: Checklist[];
  hasMemo: boolean;
  dragging: boolean;
  menuOpen: boolean;
  onOpen: (task: BoardTask) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onToggleMenu: (id: number) => void;
  onEdit: (task: BoardTask) => void;
  onDelete: (task: BoardTask) => void;
}) {
  const diff = dday(task.endDate ?? task.date);
  const showD = task.status !== "done" && diff <= 7;
  // Card-level signals: checklist progress (from the API) + a memo dot (localStorage).
  const prog = progressOf(checklist);
  return (
    <div
      className={"t-card" + (dragging ? " dragging" : "")}
      draggable
      // A real drag suppresses the click, so a plain click opens the detail.
      onClick={() => onOpen(task)}
      onDragStart={(e) => {
        // Carry the task id so the drop target knows what moved (and enable the move cursor).
        e.dataTransfer.setData("text/plain", String(task.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="ttop">
        <span className="ttl">{task.title}</span>
        <div className="card-menu">
          <button
            className="icon-btn card-menu-btn"
            title="일감 설정"
            // Don't let the button start a card drag.
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(task.id);
            }}
          >
            <Icon name="ellipsis" size={16} />
          </button>
          {menuOpen && (
            <div className="menu-pop" onMouseDown={(e) => e.stopPropagation()}>
              <button
                className="menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
              >
                <Icon name="pencil" size={15} /> 수정
              </button>
              <button
                className="menu-item danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task);
                }}
              >
                <Icon name="trash-2" size={15} /> 삭제
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Content meta — thin checklist progress bar + a memo dot. Only renders when
          there's a checklist or memo, so plain cards stay a tidy two rows. */}
      {(prog.total > 0 || hasMemo) && (
        <div className="card-meta">
          {prog.total > 0 && (
            <>
              <span className={"mini-bar" + (prog.done === prog.total ? " done" : "")}>
                <span style={{ width: `${(prog.done / prog.total) * 100}%` }} />
              </span>
              <span className="mini-count">{prog.done}/{prog.total}</span>
            </>
          )}
          {hasMemo && <Icon name="align-left" size={13} className="meta-ic" />}
        </div>
      )}
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

function BoardColumn({
  status,
  tasks,
  checklists,
  details,
  draggingId,
  menuFor,
  isOver,
  onOpen,
  onDragStartCard,
  onDragEndCard,
  onToggleMenu,
  onEdit,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  status: BoardCol;
  tasks: BoardTask[];
  checklists: Record<number, Checklist[]>;
  details: Record<number, TaskDetail>;
  draggingId: number | null;
  menuFor: number | null;
  isOver: boolean;
  onOpen: (task: BoardTask) => void;
  onDragStartCard: (id: number) => void;
  onDragEndCard: () => void;
  onToggleMenu: (id: number) => void;
  onEdit: (task: BoardTask) => void;
  onDelete: (task: BoardTask) => void;
  onDragOver: (status: BoardCol) => void;
  onDragLeave: () => void;
  onDrop: (status: BoardCol) => void;
}) {
  const meta = COL_META[status];
  return (
    <div
      className={"board-col" + (isOver ? " drop-over" : "")}
      onDragOver={(e) => {
        // preventDefault is required for the column to count as a valid drop target.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(status);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(status);
      }}
    >
      <div className="col-head">
        <span className="dot" style={{ background: meta.color }} />
        <span className="t">{meta.label}</span>
        <span className="n">{tasks.length}</span>
      </div>
      <div className="col-cards">
        {tasks.map((t) => (
          <BoardCard
            key={t.id}
            task={t}
            checklist={checklists[t.id] ?? []}
            hasMemo={!!details[t.id]?.memo}
            dragging={draggingId === t.id}
            menuOpen={menuFor === t.id}
            onOpen={onOpen}
            onDragStart={onDragStartCard}
            onDragEnd={onDragEndCard}
            onToggleMenu={onToggleMenu}
            onEdit={onEdit}
            onDelete={onDelete}
          />
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

// Edit modal — mirrors NewTaskModal's layout, pre-filled with the task's current values.
function EditTaskModal({
  task,
  onClose,
  onSave,
}: {
  task: BoardTask;
  onClose: () => void;
  onSave: (content: string, start: string, end: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  const [endDate, setEndDate] = useState(task.endDate ?? task.date);
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
      await onSave(title.trim(), date, endDate < date ? date : endDate);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "일감 수정에 실패했어요.");
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <h2>일감 수정</h2>
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
                // Skip the Enter that commits an in-progress Korean IME composition.
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter") save();
                }}
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
            {saving ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete confirmation — a small modal so the action isn't a one-click mistake.
function DeleteConfirm({
  task,
  onClose,
  onConfirm,
}: {
  task: BoardTask;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "일감 삭제에 실패했어요.");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="mhead">
          <h2>일감 삭제</h2>
          <button className="icon-btn" onClick={onClose} style={{ width: 30, height: 30, border: 0 }}>
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="mbody">
          <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5, margin: 0 }}>
            <b style={{ color: "var(--fg-1)" }}>{task.title}</b> 일감을 삭제할까요?
            <br />
            삭제하면 되돌릴 수 없어요.
          </p>
          {err && <div className="err">{err}</div>}
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn btn-danger" onClick={confirm} disabled={busy}>
            {busy ? "삭제 중…" : "삭제하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Detail modal — opens on a card click. Title/dates are edited via the ✎ (reuses
// EditTaskModal); the memo persists to localStorage and the checklist is backed by the API.
function TaskDetailModal({
  task,
  checklist,
  memo,
  loading,
  onClose,
  onMemoChange,
  onAddItem,
  onToggleItem,
  onRemoveItem,
  onEdit,
  onDelete,
}: {
  task: BoardTask;
  checklist: Checklist[];
  memo: string;
  loading: boolean;
  onClose: () => void;
  onMemoChange: (memo: string) => void;
  onAddItem: (content: string) => Promise<void>;
  onToggleItem: (item: Checklist) => Promise<void>;
  onRemoveItem: (item: Checklist) => Promise<void>;
  onEdit: (task: BoardTask) => void;
  onDelete: (task: BoardTask) => void;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [clErr, setClErr] = useState("");
  const meta = COL_META[task.status];
  const diff = dday(task.endDate ?? task.date);
  // Stable order so optimistic toggles/adds don't reshuffle the list.
  const items = [...checklist].sort((a, b) => a.id - b.id);
  const prog = progressOf(checklist);

  async function addItem() {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    setClErr("");
    try {
      await onAddItem(text);
      setDraft("");
    } catch (e) {
      setClErr(e instanceof Error ? e.message : "체크리스트 추가에 실패했어요.");
    } finally {
      setAdding(false);
    }
  }
  async function toggleItem(item: Checklist) {
    setClErr("");
    try {
      await onToggleItem(item);
    } catch (e) {
      setClErr(e instanceof Error ? e.message : "체크리스트 상태 변경에 실패했어요.");
    }
  }
  async function removeItem(item: Checklist) {
    setClErr("");
    try {
      await onRemoveItem(item);
    } catch (e) {
      setClErr(e instanceof Error ? e.message : "체크리스트 삭제에 실패했어요.");
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Hero header — the task title is the headline; the ✎/✕ actions sit top-right. */}
        <div className="mhead dt-head">
          <div className="dt-head-text">
            <span className="dt-eyebrow">일감 상세</span>
            <h2 className="dt-title">{task.title}</h2>
          </div>
          <div className="dt-head-actions">
            <button className="icon-btn" title="제목·일정 수정" onClick={() => onEdit(task)} style={{ width: 30, height: 30, border: 0 }}>
              <Icon name="pencil" size={16} />
            </button>
            <button className="icon-btn" onClick={onClose} style={{ width: 30, height: 30, border: 0 }}>
              <Icon name="x" size={17} />
            </button>
          </div>
        </div>
        <div className="mbody">
          {/* Status / owner / schedule summary (title now lives in the hero header) */}
          <div className="dt-meta">
            <span className="badge" style={{ background: meta.color + "1f", color: meta.color }}>
              <span className="dot" style={{ background: meta.color }} />
              {meta.label}
            </span>
            <span className="dt-owner">
              <Avatar member={task.member} size={20} /> {task.member.name}
            </span>
            <span className="dt-date">
              <Icon name="calendar" size={13} />
              {fmtRange(task.date, task.endDate)}
            </span>
            {task.status !== "done" && (
              <span className="dday-chip" style={{ background: ddayColor(diff) }}>
                {ddayLabel(diff)}
              </span>
            )}
          </div>

          {/* Free-text memo */}
          <div className="dt-section">
            <div className="dt-section-head">
              <Icon name="align-left" size={15} /> 메모
            </div>
            <textarea
              className="dt-memo"
              placeholder="진행 상황이나 참고할 내용을 자유롭게 적어요…"
              value={memo}
              onChange={(e) => onMemoChange(e.target.value)}
            />
          </div>

          {/* Checklist of sub-tasks — backed by the todo's checklist endpoints */}
          <div className="dt-section">
            <div className="dt-section-head">
              <Icon name="check-square" size={15} /> 체크리스트
              {prog.total > 0 && <span className="dt-count">{prog.done}/{prog.total}</span>}
            </div>
            {prog.total > 0 && (
              <div className="dt-progress">
                <span style={{ width: `${(prog.done / prog.total) * 100}%` }} />
              </div>
            )}
            {loading ? (
              <div style={{ fontSize: 13, color: "var(--fg-3)", padding: "8px 4px" }}>불러오는 중…</div>
            ) : (
              <ul className="dt-checklist">
                {items.map((c) => {
                  const done = c.status === "COMPLETE";
                  return (
                    <li key={c.id} className={done ? "done" : ""}>
                      <button className="dt-check" onClick={() => toggleItem(c)}>
                        <Icon name={done ? "check-square" : "square"} size={17} />
                      </button>
                      <span className="dt-item-text">{c.content}</span>
                      <button className="dt-remove" title="항목 삭제" onClick={() => removeItem(c)}>
                        <Icon name="x" size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="dt-add">
              <Icon name="plus" size={15} />
              <input
                placeholder="여기에 추가 항목을 입력해주세요"
                value={draft}
                disabled={adding}
                onChange={(e) => setDraft(e.target.value)}
                // Ignore the Enter that commits a Korean IME composition, else the just-
                // committed last char leaks into the next item.
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter") addItem();
                }}
              />
            </div>
            {clErr && <div className="err" style={{ marginTop: 8 }}>{clErr}</div>}
          </div>
        </div>
        <div className="mfoot" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-ghost danger-text" onClick={() => onDelete(task)}>
            <Icon name="trash-2" size={15} /> 삭제
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

const HINT_STYLE = { fontSize: 13, color: "var(--fg-3)", padding: "40px 4px", textAlign: "center" } as const;

// refreshKey changes whenever a task is added so the board reloads fresh server data.
// loginUserId scopes the board to the signed-in user's team (GET /todos?login_user_id=).
export default function BoardView({
  refreshKey = 0,
  loginUserId,
}: {
  refreshKey?: number;
  loginUserId: string;
}) {
  const [tasks, setTasks] = useState<BoardTask[] | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<BoardCol | null>(null);
  const [moveErr, setMoveErr] = useState("");
  // Which card's "..." menu is open, and the task being edited / deleted.
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [editTask, setEditTask] = useState<BoardTask | null>(null);
  const [deleteTask, setDeleteTask] = useState<BoardTask | null>(null);
  // Locally-stored memo per task id, API-backed checklists per task id, and the open detail.
  const [details, setDetails] = useState<Record<number, TaskDetail>>({});
  const [checklists, setChecklists] = useState<Record<number, Checklist[]>>({});
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close an open card menu when clicking anywhere outside it.
  useEffect(() => {
    if (menuFor == null) return;
    function onDocClick() {
      setMenuFor(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuFor]);

  useEffect(() => {
    let alive = true;
    setErr("");
    getTodos(Number(loginUserId))
      .then((res) => {
        if (!alive) return;
        const all = [...res.TODO, ...res.IN_PROGRESS, ...res.DONE, ...res.POSTPONED];
        setTasks(all.map(toBoardTask));
        // Hydrate each task's locally-stored memo for the card's memo dot.
        const map: Record<number, TaskDetail> = {};
        all.forEach((it) => {
          map[it.id] = loadDetail(it.id);
        });
        setDetails(map);
        // Pull each task's checklist for the card progress badges (best-effort per task).
        Promise.all(
          all.map((it) =>
            getChecklists(it.id)
              .then((cl) => [it.id, cl] as const)
              .catch(() => [it.id, [] as Checklist[]] as const)
          )
        ).then((entries) => {
          if (alive) setChecklists(Object.fromEntries(entries));
        });
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : "일감을 불러오지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, [refreshKey, loginUserId]);

  // Drop a card onto a column: optimistically move it, then PATCH the backend.
  function handleDrop(toCol: BoardCol) {
    const id = draggingId;
    setDraggingId(null);
    setOverCol(null);
    if (id == null) return;

    const task = tasks?.find((t) => t.id === id);
    if (!task || task.status === toCol) return; // no-op when dropped on its own column

    const prev = task.status;
    setMoveErr("");
    // Optimistic update so the card moves instantly.
    setTasks((cur) => cur && cur.map((t) => (t.id === id ? { ...t, status: toCol } : t)));

    updateTodoStatus(id, STATUS_OF[toCol]).catch((e) => {
      // Roll back on failure and surface the error.
      setTasks((cur) => cur && cur.map((t) => (t.id === id ? { ...t, status: prev } : t)));
      setMoveErr(e instanceof Error ? e.message : "일감 상태 변경에 실패했어요.");
    });
  }

  // Save an edit: PUT the new content/dates, then update the card in place.
  async function handleEditSave(id: number, content: string, start: string, end: string) {
    await updateTodo(id, { content, start_date: start, end_date: end });
    setTasks((cur) =>
      cur &&
      cur.map((t) =>
        t.id === id
          ? { ...t, title: content, date: start, endDate: end > start ? end : undefined }
          : t
      )
    );
  }

  // Delete a task: DELETE on the backend, then drop it (and its stored detail) from the board.
  async function handleDeleteConfirm(id: number) {
    await deleteTodo(id);
    clearDetail(id);
    setTasks((cur) => cur && cur.filter((t) => t.id !== id));
    setDetails((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
    setChecklists((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
  }

  // Persist a task's memo to localStorage and the in-memory map.
  function handleMemoChange(id: number, memo: string) {
    saveDetail(id, { memo });
    setDetails((cur) => ({ ...cur, [id]: { memo } }));
  }

  // Open the detail modal and refresh that task's checklist from the API.
  function openDetail(id: number) {
    setDetailId(id);
    setDetailLoading(true);
    getChecklists(id)
      .then((cl) => setChecklists((cur) => ({ ...cur, [id]: cl })))
      .catch(() => {
        /* keep whatever the board-load fetch already gave us */
      })
      .finally(() => setDetailLoading(false));
  }

  // Add a checklist item, then append the server-created item to the map.
  async function addChecklist(todoId: number, content: string) {
    const created = await createChecklist(todoId, content);
    setChecklists((cur) => ({ ...cur, [todoId]: [...(cur[todoId] ?? []), created] }));
  }

  // Toggle an item's status optimistically; roll back if the PATCH fails.
  async function toggleChecklist(todoId: number, item: Checklist) {
    const next: ChecklistStatus = item.status === "COMPLETE" ? "INCOMPLETE" : "COMPLETE";
    setChecklists((cur) => ({
      ...cur,
      [todoId]: (cur[todoId] ?? []).map((c) => (c.id === item.id ? { ...c, status: next } : c)),
    }));
    try {
      await updateChecklistStatus(todoId, item.id, next);
    } catch (e) {
      setChecklists((cur) => ({
        ...cur,
        [todoId]: (cur[todoId] ?? []).map((c) => (c.id === item.id ? { ...c, status: item.status } : c)),
      }));
      throw e;
    }
  }

  // Remove an item optimistically; re-add it (display re-sorts by id) if the DELETE fails.
  async function removeChecklist(todoId: number, item: Checklist) {
    setChecklists((cur) => ({
      ...cur,
      [todoId]: (cur[todoId] ?? []).filter((c) => c.id !== item.id),
    }));
    try {
      await deleteChecklist(todoId, item.id);
    } catch (e) {
      setChecklists((cur) => ({ ...cur, [todoId]: [...(cur[todoId] ?? []), item] }));
      throw e;
    }
  }

  // Distinct people present on the board, for the filter chips.
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    (tasks ?? []).forEach((t) => map.set(t.member.id, t.member));
    return [...map.values()];
  }, [tasks]);

  if (err) return <div className="fade-in" style={HINT_STYLE}>{err}</div>;
  if (!tasks) return <div className="fade-in" style={HINT_STYLE}>일감을 불러오는 중…</div>;

  const shown = filter === "all" ? tasks : tasks.filter((t) => t.member.id === filter);

  return (
    <div className="fade-in" ref={rootRef}>
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

      {moveErr && (
        <div style={{ fontSize: 12.5, color: "var(--danger, #c0392b)", padding: "0 4px 10px" }}>{moveErr}</div>
      )}

      <div className="board">
        {COLS.map((c) => (
          <BoardColumn
            key={c}
            status={c}
            tasks={shown.filter((t) => t.status === c)}
            checklists={checklists}
            details={details}
            draggingId={draggingId}
            menuFor={menuFor}
            isOver={overCol === c && draggingId != null}
            onOpen={(t) => openDetail(t.id)}
            onDragStartCard={setDraggingId}
            onDragEndCard={() => {
              setDraggingId(null);
              setOverCol(null);
            }}
            onToggleMenu={(id) => setMenuFor((cur) => (cur === id ? null : id))}
            onEdit={(t) => {
              setMenuFor(null);
              setEditTask(t);
            }}
            onDelete={(t) => {
              setMenuFor(null);
              setDeleteTask(t);
            }}
            onDragOver={setOverCol}
            onDragLeave={() => setOverCol(null)}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {detailId != null && tasks.find((t) => t.id === detailId) && (
        <TaskDetailModal
          task={tasks.find((t) => t.id === detailId)!}
          checklist={checklists[detailId] ?? []}
          memo={details[detailId]?.memo ?? ""}
          loading={detailLoading && checklists[detailId] === undefined}
          onClose={() => setDetailId(null)}
          onMemoChange={(memo) => handleMemoChange(detailId, memo)}
          onAddItem={(content) => addChecklist(detailId, content)}
          onToggleItem={(item) => toggleChecklist(detailId, item)}
          onRemoveItem={(item) => removeChecklist(detailId, item)}
          onEdit={(t) => setEditTask(t)}
          onDelete={(t) => {
            setDetailId(null);
            setDeleteTask(t);
          }}
        />
      )}

      {editTask && (
        <EditTaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={(content, start, end) => handleEditSave(editTask.id, content, start, end)}
        />
      )}
      {deleteTask && (
        <DeleteConfirm
          task={deleteTask}
          onClose={() => setDeleteTask(null)}
          onConfirm={() => handleDeleteConfirm(deleteTask.id)}
        />
      )}
    </div>
  );
}
