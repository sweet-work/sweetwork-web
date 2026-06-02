"use client";
/* Cadence — Login screen. Company-email only; unknown emails are created on the spot. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, Mark } from "./primitives";
import { login, signup, getTeams, createTeam, type AuthResponse, type Team } from "@/lib/api";

// Where we remember the last email used to sign in, so we can pre-fill it next time.
const LAST_EMAIL_KEY = "cadence-last-email";

/* Team picker styled like a .field, with a "+ 팀 추가하기" action pinned to the top of the
   dropdown so a new team can be created inline when the desired one isn't listed. */
function TeamSelect({
  teams,
  value,
  onChange,
  onCreate,
  disabled,
}: {
  teams: Team[];
  value: Team | null;
  onChange: (team: Team) => void;
  onCreate: (name: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const wrap = useRef<HTMLDivElement>(null);

  // Close (and reset create mode) when clicking anywhere outside the picker.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setDraft("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function submitNew() {
    const name = draft.trim();
    if (!name) return;
    onCreate(name);
    setCreating(false);
    setDraft("");
    setOpen(false);
  }

  return (
    <div className="team-select" ref={wrap}>
      <button
        type="button"
        className={"field team-trigger" + (open ? " open" : "")}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="users" size={17} />
        <span className={"team-value" + (value ? "" : " placeholder")}>
          {value ? value.name : "팀을 선택하세요"}
        </span>
        <Icon name="chevron-down" size={16} className="team-caret" />
      </button>

      {open && (
        <div className="team-menu">
          {creating ? (
            <div className="team-create">
              <input
                autoFocus
                placeholder="새 팀 이름"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitNew();
                  } else if (e.key === "Escape") {
                    setCreating(false);
                    setDraft("");
                  }
                }}
              />
              <div className="team-create-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setCreating(false);
                    setDraft("");
                  }}
                >
                  취소
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={submitNew}>
                  추가
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="team-add" onClick={() => setCreating(true)}>
              <Icon name="plus" size={15} /> 팀 추가하기
            </button>
          )}

          <div className="team-options">
            {teams.map((t) => (
              <button
                type="button"
                key={t.id}
                className={"team-option" + (t.id === value?.id ? " selected" : "")}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
              >
                {t.name}
                {t.id === value?.id && <Icon name="check" size={15} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Login({
  onLogin,
}: {
  onLogin: (email: string, data: AuthResponse) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [team, setTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
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

  // Load the team list from the backend once we ask the user for a name (sign-up step).
  useEffect(() => {
    if (!needsName) return;
    let cancelled = false;
    getTeams()
      .then((list) => {
        if (!cancelled) setTeams(list);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "팀 목록을 불러오지 못했어요.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsName]);

  // Create a brand-new team on the backend, add it to the list, and select it.
  async function addTeam(rawName: string) {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    // Reuse an existing team with the same name instead of creating a duplicate.
    const existing = teams.find((t) => t.name === trimmed);
    if (existing) {
      setTeam(existing);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const created = await createTeam(trimmed);
      setTeams((prev) => (prev.some((t) => t.id === created.id) ? prev : [...prev, created]));
      setTeam(created);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "팀 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

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

    if (needsName && !team) {
      setErr("팀을 선택해 주세요");
      return;
    }

    setLoading(true);
    setErr("");
    try {
      if (needsName) {
        const data = await signup(email, name.trim(), team!.id);
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

        {needsName && (
          <div className="input">
            <label>팀</label>
            <TeamSelect
              teams={teams}
              value={team}
              onChange={(t) => {
                setTeam(t);
                setErr("");
              }}
              onCreate={addTeam}
              disabled={loading}
            />
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
