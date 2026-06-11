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

// ---- Auth tokens ----
// The backend now issues a JWT pair on login/signup; the access token authorizes every
// protected call, and the refresh token mints a new pair when the access token expires.
// Tokens live in memory and are mirrored to localStorage so a refresh survives reloads.
const TOKENS_KEY = "cadence-tokens";
let accessToken: string | null = null;
let refreshTokenValue: string | null = null;

if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (raw) {
      const t = JSON.parse(raw) as { access_token?: string; refresh_token?: string };
      accessToken = t.access_token ?? null;
      refreshTokenValue = t.refresh_token ?? null;
    }
  } catch {
    /* corrupt entry — start unauthenticated */
  }
}

/** Store a fresh token pair (called after login/signup/refresh). */
export function setAuthTokens(access: string, refresh: string) {
  accessToken = access;
  refreshTokenValue = refresh;
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify({ access_token: access, refresh_token: refresh }));
  } catch {
    /* storage unavailable — keep the in-memory copy */
  }
}

/** Forget the stored tokens (on logout, or when the refresh token is rejected). */
export function clearAuthTokens() {
  accessToken = null;
  refreshTokenValue = null;
  try {
    localStorage.removeItem(TOKENS_KEY);
  } catch {
    /* ignore */
  }
}

// Fired when the session can't be recovered (refresh token expired/invalid) so the app
// can drop the user back to the login screen.
const authExpiredListeners = new Set<() => void>();

/** Subscribe to "session expired" so the UI can sign the user out. Returns an unsubscribe fn. */
export function onAuthExpired(fn: () => void): () => void {
  authExpiredListeners.add(fn);
  return () => {
    authExpiredListeners.delete(fn);
  };
}

/** Raw fetch with just the in-flight counter (no auth, no refresh) — used for the token calls. */
async function rawFetch(input: string, init?: RequestInit): Promise<Response> {
  inFlight++;
  emitLoading();
  try {
    return await globalThis.fetch(input, init);
  } finally {
    inFlight--;
    emitLoading();
  }
}

// Attach the bearer token (if any) without clobbering caller-supplied headers.
function withAuth(init?: RequestInit): RequestInit {
  if (!accessToken) return init ?? {};
  return {
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Bearer ${accessToken}` },
  };
}

// A single in-flight refresh shared by every call that 401s at the same time.
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!refreshTokenValue) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await rawFetch(`${API_BASE}/token/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshTokenValue }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as AuthResponse;
        setAuthTokens(data.access_token, data.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

/** fetch wrapper: in-flight counter for the progress bar + bearer auth with one
    transparent refresh-and-retry when the access token has expired. */
async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  let res = await rawFetch(input, withAuth(init));
  // Only protected calls can recover via refresh; the auth endpoints handle their own 401s.
  const isAuthCall = input.includes("/login") || input.includes("/signup") || input.includes("/token/refresh");
  if (res.status === 401 && accessToken && !isAuthCall) {
    if (await tryRefresh()) {
      res = await rawFetch(input, withAuth(init));
    } else {
      clearAuthTokens();
      authExpiredListeners.forEach((fn) => fn());
    }
  }
  return res;
}

/** The signed-in user, nested inside every auth response.
    team_id/team_name may be null when the user has no team yet. */
export interface AuthUser {
  id: number;
  name: string;
  team_id?: number | null;
  team_name?: string | null;
}

/** Shape returned by POST /login, POST /signup, and POST /token/refresh:
    a JWT pair plus the signed-in user. */
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

/** Thrown by login() on HTTP 401. The backend returns the same "Invalid credentials"
    for an unknown email and a wrong password, so the UI can't tell them apart — it
    offers account creation as the next step. */
export class InvalidCredentialsError extends Error {
  constructor(message = "이메일 또는 비밀번호가 올바르지 않아요.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/** A team as returned by GET /teams and POST /teams. */
export interface Team {
  id: number;
  name: string;
}

/** GET /teams — the teams shown in the sign-up team picker. */
export async function getTeams(): Promise<Team[]> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/teams`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("팀 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** POST /teams with { name } — creates a new team and returns it (id + name). */
export async function createTeam(name: string): Promise<Team> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("팀 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** A teammate as returned by GET /teams/members. */
export interface TeamMember {
  id: number;
  email: string;
  name: string;
  team_id: number;
  team_name: string;
}

/** GET /teams/members?user_id= — the members sharing the given user's team. */
export async function getMyTeamMembers(userId: number): Promise<TeamMember[]> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/teams/members?user_id=${userId}`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("팀원 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** POST /login with { email, password }. Returns the token pair + user (tokens are
    stored for subsequent calls). Throws InvalidCredentialsError on HTTP 401. */
export async function login(email: string, password: string): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (res.status === 401) throw new InvalidCredentialsError();
  if (!res.ok) throw new Error("로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
  const data: AuthResponse = await res.json();
  setAuthTokens(data.access_token, data.refresh_token);
  return data;
}

/** POST /signup with { email, password, name, team_id } — registers the user under the
    chosen team and signs them in (tokens are stored for subsequent calls). */
export async function signup(
  email: string,
  password: string,
  name: string,
  teamId: number,
): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, team_id: teamId }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("계정 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
  const data: AuthResponse = await res.json();
  setAuthTokens(data.access_token, data.refresh_token);
  return data;
}

/** POST /logout — best-effort invalidation of the refresh token on the server.
    Always clears the local tokens, even if the network call fails. */
export async function logout(): Promise<void> {
  const token = refreshTokenValue;
  try {
    if (token) {
      await rawFetch(`${API_BASE}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: token }),
      });
    }
  } catch {
    /* server unreachable — local sign-out below still happens */
  } finally {
    clearAuthTokens();
  }
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

/** GET /todos — kanban board for the logged-in user's team.
    loginUserId(필수)로 같은 팀 일감만 조회하고, userId를 주면 그 팀원 일감만 좁혀서 조회. */
export async function getTodos(loginUserId: number, userId?: number): Promise<TodoBoardResponse> {
  const params = new URLSearchParams({ login_user_id: String(loginUserId) });
  if (userId != null) params.set("user_id", String(userId));
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos?${params.toString()}`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("일감을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** One task as returned by GET /todos/calendar. Same shape as the board item. */
export type TodoCalendarItem = TodoBoardItem;

/** GET /todos/calendar — tasks overlapping the given month, scoped to the login user's team. */
export async function getCalendarTodos(
  loginUserId: number,
  year: number,
  month: number,
): Promise<TodoCalendarItem[]> {
  let res: Response;
  try {
    res = await apiFetch(
      `${API_BASE}/todos/calendar?login_user_id=${loginUserId}&year=${year}&month=${month}`,
    );
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

/** Checklist status — INCOMPLETE: 미완료, COMPLETE: 완료. */
export type ChecklistStatus = "INCOMPLETE" | "COMPLETE";

/** One checklist item under a todo, as returned by the checklist endpoints. */
export interface Checklist {
  id: number;
  todo_id: number;
  content: string;
  status: ChecklistStatus;
  created_at: string;
}

/** GET /todos/{todoId}/checklists — the todo's checklist items. */
export async function getChecklists(todoId: number): Promise<Checklist[]> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos/${todoId}/checklists`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("체크리스트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** POST /todos/{todoId}/checklists with { content } — adds an item (created as INCOMPLETE). */
export async function createChecklist(todoId: number, content: string): Promise<Checklist> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos/${todoId}/checklists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("체크리스트 추가에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** PATCH /todos/{todoId}/checklists/{checklistId}/status — toggles an item's status. */
export async function updateChecklistStatus(
  todoId: number,
  checklistId: number,
  status: ChecklistStatus,
): Promise<Checklist> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos/${todoId}/checklists/${checklistId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("체크리스트 상태 변경에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** DELETE /todos/{todoId}/checklists/{checklistId} — removes a checklist item. */
export async function deleteChecklist(todoId: number, checklistId: number): Promise<void> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/todos/${todoId}/checklists/${checklistId}`, { method: "DELETE" });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("체크리스트 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
}

/** Shape returned by GET /reports/weekly — one user's this-week task counts.
    week_start/end are Asia/Seoul Monday~Sunday. */
export interface WeeklyStats {
  user_id: number;
  user_name: string;
  week_start: string;
  week_end: string;
  completed_count: number;
  in_progress_count: number;
  planned_count: number;
}

/** GET /reports/weekly?user_id= — the user's completed/in-progress/planned counts this week. */
export async function getWeeklyStats(userId: number): Promise<WeeklyStats> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/reports/weekly?user_id=${userId}`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("주간 현황을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** One task overlapping this week, as returned by GET /reports/weekly/todos. */
export interface WeeklyReportTodo {
  id: number;
  content: string;
  memo?: string | null;
  status: string;
  start_date: string;
  end_date: string;
}

/** GET /reports/weekly/todos response — this-week tasks (all statuses) for one user.
    week_start/end are Asia/Seoul Monday~Sunday. */
export interface WeeklyReportTodosResponse {
  user_id: number;
  user_name: string;
  week_start: string;
  week_end: string;
  todos: WeeklyReportTodo[];
}

/** GET /reports/weekly/todos?user_id= — 이번 주(월~일)와 겹치는 모든 상태의 담당 일감. */
export async function getWeeklyReportTodos(userId: number): Promise<WeeklyReportTodosResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/reports/weekly/todos?user_id=${userId}`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("금주 담당 일감을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** One task line inside an AI weekly-report section. display_date is pre-formatted (e.g. "06.02 (화)"). */
export interface WeeklyReportSectionItem {
  content: string;
  memo?: string | null;
  start_date: string;
  end_date: string;
  display_date: string;
}

/** A titled group of tasks within the AI weekly report. */
export interface WeeklyReportSection {
  title: string;
  items: WeeklyReportSectionItem[];
}

/** One todo included in the AI weekly report (used for the count metrics). */
export interface WeeklyReportTodo {
  id: number;
  content: string;
  memo?: string | null;
  status: string;
  start_date: string;
  end_date: string;
}

/** Shape returned by POST /reports/weekly — an AI-generated personal weekly report. */
export interface WeeklyReportResponse {
  user_id: number;
  user_name: string;
  week_start: string;
  week_end: string;
  summary: string;
  insight: string;
  completed_work: WeeklyReportSection;
  next_week_plan: WeeklyReportSection;
  todos: WeeklyReportTodo[];
}

/** POST /reports/weekly { user_id } — generates the user's AI weekly report (slow: an LLM call). */
export async function createWeeklyReport(userId: number): Promise<WeeklyReportResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/reports/weekly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("주간 보고 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** Team report section item — like the personal one, plus the owning teammate. */
export interface TeamWeeklyReportSectionItem extends WeeklyReportSectionItem {
  user_id: number;
  user_name: string;
}

/** A titled group of team tasks within the AI weekly report. */
export interface TeamWeeklyReportSection {
  title: string;
  items: TeamWeeklyReportSectionItem[];
}

/** One team todo included in the report (count metrics + owner). */
export interface TeamWeeklyReportTodo extends WeeklyReportTodo {
  user_id: number;
  user_name: string;
}

/** Shape returned by POST /reports/weekly/team — an AI-generated team weekly report. */
export interface TeamWeeklyReportResponse {
  team_id: number;
  team_name: string;
  week_start: string;
  week_end: string;
  summary: string;
  insight: string;
  completed_work: TeamWeeklyReportSection;
  next_week_plan: TeamWeeklyReportSection;
  todos: TeamWeeklyReportTodo[];
}

/** POST /reports/weekly/team { team_id } — generates the team's AI weekly report (slow: an LLM call). */
export async function createTeamWeeklyReport(teamId: number): Promise<TeamWeeklyReportResponse> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/reports/weekly/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("팀 주간 보고 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** Notification category — all alerts are task-deadline reminders. */
export type NotificationType = "DUE_3_DAYS_BEFORE" | "DUE_1_DAY_BEFORE" | "DUE_TODAY" | "OVERDUE";

/** One in-app notification, as returned by the notification endpoints. */
export interface NotificationItem {
  id: number;
  todo_id: number;
  user_id: number;
  type: NotificationType;
  channel: "IN_APP";
  title: string;
  message: string;
  due_date: string; // YYYY-MM-DD
  status: "UNREAD" | "READ";
  read_at: string | null; // ISO datetime, set when read
  created_at: string; // ISO datetime
}

/** GET /notifications?user_id=&status= — the user's in-app alerts (optionally filtered by status). */
export async function getNotifications(
  userId: number,
  status?: "UNREAD" | "READ",
): Promise<NotificationItem[]> {
  const params = new URLSearchParams({ user_id: String(userId) });
  if (status) params.set("status", status);
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/notifications?${params.toString()}`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("알림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** GET /notifications/unread-count?user_id= — count of the user's unread in-app alerts. */
export async function getUnreadCount(userId: number): Promise<number> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/notifications/unread-count?user_id=${userId}`);
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("알림 개수를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  const data: { user_id: number; unread_count: number } = await res.json();
  return data.unread_count;
}

/** PATCH /notifications/{id}/read?user_id= — marks a single alert as read. */
export async function readNotification(
  notificationId: number,
  userId: number,
): Promise<NotificationItem> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/notifications/${notificationId}/read?user_id=${userId}`, {
      method: "PATCH",
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("알림 읽음 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}

/** PATCH /notifications/read-all?user_id= — marks all of the user's alerts read (204 No Content). */
export async function readAllNotifications(userId: number): Promise<void> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/notifications/read-all?user_id=${userId}`, { method: "PATCH" });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("알림 읽음 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
}
