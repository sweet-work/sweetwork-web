"use client";
/* Cadence — Login screen. Company-email only; unknown emails are created on the spot. */
import { useEffect, useState, type FormEvent } from "react";
import { Icon, Mark } from "./primitives";
import { login, signup, type AuthResponse } from "@/lib/api";

// Where we remember the last email used to sign in, so we can pre-fill it next time.
const LAST_EMAIL_KEY = "cadence-last-email";

export default function Login({
  onLogin,
}: {
  onLogin: (email: string, data: AuthResponse) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  // Revealed when the email isn't registered yet and we need a name to create the account.
  const [needsName, setNeedsName] = useState(false);
  // "Remember email" — when on, we persist the email for next time.
  const [remember, setRemember] = useState(false);

  // Pre-fill with the last email used on this device, and tick "remember" if we had one.
  useEffect(() => {
    const saved = localStorage.getItem(LAST_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  // Persist (or forget) the email based on the checkbox.
  function rememberEmail(value: string) {
    if (remember) localStorage.setItem(LAST_EMAIL_KEY, value);
    else localStorage.removeItem(LAST_EMAIL_KEY);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!ok) {
      setErr("회사 이메일 형식을 확인해 주세요");
      return;
    }

    if (needsName && !name.trim()) {
      setErr("이름을 입력해 주세요");
      return;
    }

    setLoading(true);
    setErr("");
    try {
      if (needsName) {
        const data = await signup(email, name.trim());
        rememberEmail(email);
        onLogin(email, data);
        return;
      }

      const existing = await login(email);
      if (existing) {
        rememberEmail(email);
        onLogin(email, existing);
        return;
      }
      // New email — ask for a name, then submit again to sign up.
      setNeedsName(true);
      setLoading(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "로그인에 실패했어요.");
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card fade-in" onSubmit={submit}>
        <Mark size={46} radius={13} />
        <h1>{needsName ? "처음 오셨네요!" : "회사 이메일로 시작하기"}</h1>
        <p className="sub">
          {needsName
            ? "팀원들에게 표시될 이름을 알려주세요. 바로 계정을 만들어 드릴게요."
            : "비밀번호는 필요 없어요. 처음이라면 이메일로 바로 계정을 만들어 드려요."}
        </p>

        <div className="input">
          <label htmlFor="email">회사 이메일</label>
          <div className="field">
            <Icon name="mail" size={17} />
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              autoComplete="email"
              disabled={loading || needsName}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr("");
              }}
            />
          </div>
        </div>

        {!needsName && (
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              disabled={loading}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>이메일 기억하기</span>
          </label>
        )}

        {needsName && (
          <div className="input">
            <label htmlFor="name">이름</label>
            <div className="field">
              <Icon name="user" size={17} />
              <input
                id="name"
                type="text"
                placeholder="홍길동"
                value={name}
                autoComplete="off"
                autoFocus
                disabled={loading}
                onChange={(e) => {
                  setName(e.target.value);
                  setErr("");
                }}
              />
            </div>
          </div>
        )}

        {err && <div className="err">{err}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading
            ? needsName
              ? "계정 만드는 중…"
              : "확인 중…"
            : (
              <>
                {needsName ? "계정 만들기" : "계속하기"} <Icon name="arrow-right" size={17} />
              </>
            )}
        </button>

        <p className="hint">로그인하면 팀의 공유 to-do와 일정에 접근할 수 있어요.</p>
      </form>
    </div>
  );
}
