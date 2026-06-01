"use client";
/* Cadence — Login screen. Company-email only; unknown emails are created on the spot. */
import { useState, type FormEvent } from "react";
import { Icon, Mark } from "./primitives";

export default function Login({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!ok) {
      setErr("회사 이메일 형식을 확인해 주세요");
      return;
    }
    onLogin(email);
  }

  return (
    <div className="login-wrap">
      <form className="login-card fade-in" onSubmit={submit}>
        <Mark size={46} radius={13} />
        <h1>회사 이메일로 시작하기</h1>
        <p className="sub">비밀번호는 필요 없어요. 처음이라면 이메일로 바로 계정을 만들어 드려요.</p>

        <div className="input">
          <label htmlFor="email">회사 이메일</label>
          <div className="field">
            <Icon name="mail" size={17} />
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              autoComplete="off"
              onChange={(e) => {
                setEmail(e.target.value);
                setErr("");
              }}
            />
          </div>
        </div>
        {err && <div className="err">{err}</div>}

        <button type="submit" className="btn btn-primary">
          계속하기 <Icon name="arrow-right" size={17} />
        </button>

        <p className="hint">로그인하면 팀의 공유 to-do와 일정에 접근할 수 있어요.</p>
      </form>
    </div>
  );
}
