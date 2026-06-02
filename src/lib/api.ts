/* Cadence — API client for the backend on Render. */

// Same-origin proxy path; next.config.ts rewrites /api/* → the Render API (avoids CORS).
export const API_BASE = "/api";

// ---- Global loading signal ----
// Every request goes through apiFetch, which keeps a count of in-flight calls so a
// shared top progress bar can show whenever the app is waiting on the (slow) backend.
let inFlight = 0;
const loadingListeners = new Set<(active: boolean) => void>();

function emitLoading() {
  const active = inFlight > 0;
  loadingListeners.forEach((fn) => fn(active));
}

/** Subscribe to API loading state (active = at least one request in flight). Returns an unsubscribe fn. */
export function onApiLoading(fn: (active: boolean) => void): () => void {
  loadingListeners.add(fn);
  return () => {
    loadingListeners.delete(fn);
  };
}

/** fetch wrapper that maintains the in-flight counter for the global progress bar. */
async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  inFlight++;
  emitLoading();
  try {
    return await globalThis.fetch(input, init);
  } finally {
    inFlight--;
    emitLoading();
  }
}

/** Shape returned by POST /login and POST /signup. */
export interface AuthResponse {
  id: number;
  name: string;
}

/** POST /login with { email }. Returns null when the email is unknown (HTTP 401). */
export async function login(email: string): Promise<AuthResponse | null> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (res.status === 401) return null; // not registered yet
  if (!res.ok) throw new Error("로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** POST /signup with { email, name }. An optional team is sent along for the user's profile. */
export async function signup(email: string, name: string, team?: string): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(team ? { email, name, team } : { email, name }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("계정 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** Body for POST /todos. Dates are "YYYY-MM-DD". */
export interface TodoCreate {
  user_id: number;
  content: string;
  start_date: string;
  end_date: string;
}

/** Shape returned by POST /todos. status is one of TODO/IN_PROGRESS/DONE/POSTPONED. */
export interface TodoResponse {
  id: number;
  user_id: number;
  content: string;
  status: string;
  start_date: string;
  end_date: string;
}

/** POST /todos — registers a new task (backend creates it in TODO status). */
export async function createTodo(input: TodoCreate): Promise<TodoResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("일감 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** One task as returned by GET /todos (grouped board view). */
export interface TodoBoardItem {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  status: string;
  start_date: string;
  end_date: string;
}

/** GET /todos response — tasks grouped by status. */
export interface TodoBoardResponse {
  TODO: TodoBoardItem[];
  IN_PROGRESS: TodoBoardItem[];
  DONE: TodoBoardItem[];
  POSTPONED: TodoBoardItem[];
}

/** GET /todos — kanban board. Pass userId to scope to one user; omit for the whole team. */
export async function getTodos(userId?: number): Promise<TodoBoardResponse> {
  const qs = userId == null ? "" : `?user_id=${userId}`;
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos${qs}`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("일감을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** One task as returned by GET /todos/calendar. Same shape as the board item. */
export type TodoCalendarItem = TodoBoardItem;

/** GET /todos/calendar?year=&month= — tasks overlapping the given month. */
export async function getCalendarTodos(year: number, month: number): Promise<TodoCalendarItem[]> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos/calendar?year=${year}&month=${month}`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("캘린더 일감을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** Status values accepted by PATCH /todos/{id}/status. */
export type TodoStatus = "TODO" | "IN_PROGRESS" | "DONE" | "POSTPONED";

/** PATCH /todos/{id}/status — changes a task's status. */
export async function updateTodoStatus(id: number, status: TodoStatus): Promise<TodoResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("일감 상태 변경에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** Body for PUT /todos/{id}. All fields required; dates are "YYYY-MM-DD". */
export interface TodoUpdate {
  content: string;
  start_date: string;
  end_date: string;
}

/** PUT /todos/{id} — edits a task's content and date range. */
export async function updateTodo(id: number, input: TodoUpdate): Promise<TodoResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("일감 수정에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** DELETE /todos/{id} — removes a task. */
export async function deleteTodo(id: number): Promise<void> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos/${id}`, { method: "DELETE" });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("일감 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
}
