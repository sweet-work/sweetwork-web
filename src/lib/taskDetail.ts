/* Cadence — per-task free-text memo, stored locally (frontend-first).
   The backend Todo carries content/dates/status and the checklist lives on its own
   endpoints; only the memo has no backend field, so it stays in localStorage by task id. */

export interface TaskDetail {
  memo: string;
}

const KEY = (id: number) => `cadence:taskDetail:${id}`;

export const EMPTY_DETAIL: TaskDetail = { memo: "" };

/* Read one task's memo. Returns a fresh empty detail when nothing is stored
   (or when called server-side, where localStorage is absent). */
export function loadDetail(id: number): TaskDetail {
  if (typeof window === "undefined") return { ...EMPTY_DETAIL };
  try {
    const raw = window.localStorage.getItem(KEY(id));
    if (!raw) return { ...EMPTY_DETAIL };
    const parsed = JSON.parse(raw) as Partial<TaskDetail>;
    return { memo: typeof parsed.memo === "string" ? parsed.memo : "" };
  } catch {
    return { ...EMPTY_DETAIL };
  }
}

/* Persist a task's memo. An empty memo clears the entry so localStorage
   doesn't fill up with blanks. */
export function saveDetail(id: number, detail: TaskDetail): void {
  if (typeof window === "undefined") return;
  try {
    if (!detail.memo) {
      window.localStorage.removeItem(KEY(id));
    } else {
      window.localStorage.setItem(KEY(id), JSON.stringify({ memo: detail.memo }));
    }
  } catch {
    /* storage full or blocked — memo just won't persist this session */
  }
}

/* Drop a task's stored memo (used when the task itself is deleted). */
export function clearDetail(id: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY(id));
  } catch {
    /* ignore */
  }
}
