/* Cadence — API client for the backend on Render. */

// Same-origin proxy path; next.config.ts rewrites /api/* → the Render API (avoids CORS).
export const API_BASE = "/api";

/** Shape returned by POST /login and POST /signup. */
export interface AuthResponse {
  id: number;
  name: string;
}

/** POST /login with { email }. Returns null when the email is unknown (HTTP 401). */
export async function login(email: string): Promise<AuthResponse | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/login`, {
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

/** POST /signup with { email, name }. */
export async function signup(email: string, name: string): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) throw new Error("계정 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
  return res.json();
}
