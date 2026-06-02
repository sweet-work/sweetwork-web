/* Cadence — per-task notes + checklist, stored locally (frontend-first).
   The backend Todo only carries content/dates/status, so the memo and the
   checklist live in localStorage keyed by task id until a backend field exists. */

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskDetail {
  memo: string;
  checklist: ChecklistItem[];
}

const KEY = (id: number) => `cadence:taskDetail:${id}`;

export const EMPTY_DETAIL: TaskDetail = { memo: "", checklist: [] };

/* Read one task's detail. Returns a fresh empty detail when nothing is stored
   (or when called server-side, where localStorage is absent). */
export function loadDetail(id: number): TaskDetail {
  if (typeof window === "undefined") return { ...EMPTY_DETAIL };
  try {
    const raw = window.localStorage.getItem(KEY(id));
    if (!raw) return { ...EMPTY_DETAIL };
    const parsed = JSON.parse(raw) as Partial<TaskDetail>;
    return {
      memo: typeof parsed.memo === "string" ? parsed.memo : "",
      checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
    };
  } catch {
    return { ...EMPTY_DETAIL };
  }
}

/* Persist a task's detail. An empty memo + empty checklist clears the entry
   so localStorage doesn't fill up with blanks. */
export function saveDetail(id: number, detail: TaskDetail): void {
  if (typeof window === "undefined") return;
  try {
    if (!detail.memo && detail.checklist.length === 0) {
      window.localStorage.removeItem(KEY(id));
    } else {
      window.localStorage.setItem(KEY(id), JSON.stringify(detail));
    }
  } catch {
    /* storage full or blocked — detail just won't persist this session */
  }
}

/* Drop a task's stored detail (used when the task itself is deleted). */
export function clearDetail(id: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY(id));
  } catch {
    /* ignore */
  }
}

/* Checklist progress for the card badge: done count + total. */
export function checklistProgress(detail: TaskDetail): { done: number; total: number } {
  return {
    done: detail.checklist.filter((c) => c.done).length,
    total: detail.checklist.length,
  };
}

/* A short id for a new checklist item. */
export function newItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for environments without crypto.randomUUID.
  return "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
