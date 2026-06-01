"use client";
/* Cadence — Board view: loads team tasks from GET /todos, member filter + status columns. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Avatar } from "./primitives";
import {
  getTodos,
  updateTodoStatus,
  updateTodo,
  deleteTodo,
  type TodoBoardItem,
  type TodoStatus,
} from "@/lib/api";
import { dday, ddayColor, ddayLabel, fmtRange, STATUS } from "@/lib/data";

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
  dragging,
  menuOpen,
  onDragStart,
  onDragEnd,
  onToggleMenu,
  onEdit,
  onDelete,
}: {
  task: BoardTask;
  dragging: boolean;
  menuOpen: boolean;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onToggleMenu: (id: number) => void;
  onEdit: (task: BoardTask) => void;
  onDelete: (task: BoardTask) => void;
}) {
  const diff = dday(task.endDate ?? task.date);
  const showD = task.status !== "done" && diff <= 7;
  return (
    <div
      className={"t-card" + (dragging ? " dragging" : "")}
      draggable
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
  draggingId,
  menuFor,
  isOver,
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
  draggingId: number | null;
  menuFor: number | null;
  isOver: boolean;
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
            dragging={draggingId === t.id}
            menuOpen={menuFor === t.id}
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

const HINT_STYLE = { fontSize: 13, color: "var(--fg-3)", padding: "40px 4px", textAlign: "center" } as const;

// refreshKey changes whenever a task is added so the board reloads fresh server data.
export default function BoardView({ refreshKey = 0 }: { refreshKey?: number }) {
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

  // Delete a task: DELETE on the backend, then drop it from the board.
  async function handleDeleteConfirm(id: number) {
    await deleteTodo(id);
    setTasks((cur) => cur && cur.filter((t) => t.id !== id));
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
            draggingId={draggingId}
            menuFor={menuFor}
            isOver={overCol === c && draggingId != null}
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
