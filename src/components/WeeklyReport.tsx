"use client";
/* Cadence — Weekly report.
   - teamId → real team AI report via POST /reports/weekly/team.
   - userId → real personal AI report via POST /reports/weekly.
   - neither (seed teammates) → a simulated summary built from the week's tasks. */
import { useState } from "react";
import { Icon } from "./primitives";
import {
  createWeeklyReport,
  createTeamWeeklyReport,
  type WeeklyReportResponse,
  type TeamWeeklyReportResponse,
} from "@/lib/api";
import { personById, fmtRange, type Task, type CurrentUser } from "@/lib/data";

// "2026-06-01" → "2026.06.01" for the report header range.
const ymd = (s: string) => s.replaceAll("-", ".");

export default function WeeklyReport({
  userId,
  teamId,
  personName,
  tasks,
  currentUser,
}: {
  // Backend ids → real AI report (team takes priority). Omit both for the simulated fallback.
  userId?: number;
  teamId?: number;
  // Name shown in the headings (the report's owner) for personal reports.
  personName?: string;
  tasks: Task[];
  currentUser: CurrentUser;
}) {
  if (teamId != null) return <ApiWeeklyReport key="team" mode={{ kind: "team", teamId }} />;
  if (userId != null) return <ApiWeeklyReport key="user" mode={{ kind: "user", userId, personName }} />;
  return <SimWeeklyReport tasks={tasks} currentUser={currentUser} personName={personName} />;
}

/* ───────────────────────── AI report (POST /reports/weekly[/team]) ───────────────────────── */

// One list row, normalized across personal/team responses (owner only set for team).
interface SecItem {
  content: string;
  display_date: string;
  owner?: string;
}
// Normalized view model so personal + team responses share one render path.
interface ReportVM {
  pill: string;
  heading: string;
  weekStart: string;
  weekEnd: string;
  count: number;
  done: number;
  prog: number;
  planned: number;
  summary: string;
  insight: string;
  completed: { title: string; items: SecItem[] };
  next: { title: string; items: SecItem[] };
}

function countByStatus(todos: { status: string }[]) {
  const done = todos.filter((t) => t.status === "DONE").length;
  const prog = todos.filter((t) => t.status === "IN_PROGRESS").length;
  return { done, prog, planned: todos.length - done - prog };
}

function personalVM(r: WeeklyReportResponse): ReportVM {
  const c = countByStatus(r.todos);
  const items = (s: WeeklyReportResponse["completed_work"]): SecItem[] =>
    s.items.map((it) => ({ content: it.content, display_date: it.display_date }));
  return {
    pill: "AI 개인 주간 보고",
    heading: `${r.user_name}님의 이번 주 업무 요약`,
    weekStart: r.week_start,
    weekEnd: r.week_end,
    count: r.todos.length,
    ...c,
    summary: r.summary,
    insight: r.insight,
    completed: { title: r.completed_work.title, items: items(r.completed_work) },
    next: { title: r.next_week_plan.title, items: items(r.next_week_plan) },
  };
}

function teamVM(r: TeamWeeklyReportResponse): ReportVM {
  const c = countByStatus(r.todos);
  const items = (s: TeamWeeklyReportResponse["completed_work"]): SecItem[] =>
    s.items.map((it) => ({ content: it.content, display_date: it.display_date, owner: it.user_name }));
  return {
    pill: "AI 팀 주간 보고",
    heading: `${r.team_name} 팀의 이번 주 업무 요약`,
    weekStart: r.week_start,
    weekEnd: r.week_end,
    count: r.todos.length,
    ...c,
    summary: r.summary,
    insight: r.insight,
    completed: { title: r.completed_work.title, items: items(r.completed_work) },
    next: { title: r.next_week_plan.title, items: items(r.next_week_plan) },
  };
}

function ApiSection({ title, items, color, next }: { title: string; items: SecItem[]; color: string; next?: boolean }) {
  return (
    <div className={"report-section" + (next ? " next" : "")}>
      <h3>
        <span className="bar" style={{ background: color }} />
        {title}
      </h3>
      <ul>
        {items.length ? (
          items.map((it, i) => (
            <li key={i}>
              {it.content}{" "}
              <span style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                · {it.owner ? `${it.owner} · ` : ""}
                {it.display_date}
              </span>
            </li>
          ))
        ) : (
          <li style={{ color: "var(--fg-3)" }}>해당하는 일감이 없어요</li>
        )}
      </ul>
    </div>
  );
}

type ReportMode =
  | { kind: "user"; userId: number; personName?: string }
  | { kind: "team"; teamId: number };

function ApiWeeklyReport({ mode }: { mode: ReportMode }) {
  const [vm, setVm] = useState<ReportVM | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    if (loading) return;
    setLoading(true);
    setErr("");
    try {
      const next =
        mode.kind === "team"
          ? teamVM(await createTeamWeeklyReport(mode.teamId))
          : personalVM(await createWeeklyReport(mode.userId));
      setVm(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "주간 보고 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (!vm) {
    const who = mode.kind === "team" ? "우리 팀" : mode.personName ?? null;
    return (
      <div className="report-wrap fade-in">
        <div className="report-card">
          <div className="report-empty">
            <div className="ic-wrap">
              <Icon name="sparkles" size={26} />
            </div>
            <h2>{who ? `${who}의 이번 주 업무를 정리해 드려요` : "이번 주 업무를 보고서로 정리해 드려요"}</h2>
            <p>
              맡은 일감을 바탕으로 완료·진행·다음 주 계획을
              <br />
              AI가 자동으로 작성합니다.
            </p>
            {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> 생성 중…
                </>
              ) : (
                <>
                  <Icon name="sparkles" size={16} /> 주간 보고 생성
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-wrap fade-in">
      <div className="report-card">
        <div className="rhead">
          <span className="pill">
            <Icon name="sparkles" size={13} /> {vm.pill}
          </span>
        </div>
        <h1>{vm.heading}</h1>
        <div className="rmeta">
          {ymd(vm.weekStart)} — {ymd(vm.weekEnd)} · 일감 {vm.count}건
        </div>

        <div className="report-metrics">
          <div className="metric">
            <div className="v" style={{ color: "var(--status-done)" }}>
              {vm.done}
            </div>
            <div className="l">완료</div>
          </div>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-progress)" }}>
              {vm.prog}
            </div>
            <div className="l">진행 중</div>
          </div>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-todo)" }}>
              {vm.planned}
            </div>
            <div className="l">예정</div>
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-1)", margin: "0 0 4px" }}>{vm.summary}</p>
        {vm.insight && (
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-2)", margin: "8px 0 0" }}>
            <Icon
              name="lightbulb"
              size={14}
              style={{ verticalAlign: "-2px", marginRight: 5, color: "var(--accent)" }}
            />
            {vm.insight}
          </p>
        )}

        <ApiSection title={vm.completed.title} items={vm.completed.items} color="var(--status-done)" />
        <ApiSection title={vm.next.title} items={vm.next.items} color="var(--accent)" next />

        <div style={{ display: "flex", gap: 9, marginTop: 24 }}>
          <button className="btn btn-secondary btn-sm" onClick={generate} disabled={loading}>
            {loading ? <span className="spinner" /> : <Icon name="rotate-cw" size={15} />} 다시 생성
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Simulated fallback (no backend id) ───────────────────────── */

function SimSection({
  title,
  items,
  color,
  next,
  currentUser,
}: {
  title: string;
  items: Task[];
  color: string;
  next?: boolean;
  currentUser: CurrentUser;
}) {
  return (
    <div className={"report-section" + (next ? " next" : "")}>
      <h3>
        <span className="bar" style={{ background: color }} />
        {title}
      </h3>
      <ul>
        {items.map((t) => (
          <li key={t.id}>
            {t.title}{" "}
            <span style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              · {personById(t.member, currentUser)?.name} · {fmtRange(t.date, t.endDate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimWeeklyReport({
  tasks,
  currentUser,
  personName,
}: {
  tasks: Task[];
  currentUser: CurrentUser;
  personName?: string;
}) {
  const [state, setState] = useState<"empty" | "loading" | "done">("empty");

  const done = tasks.filter((t) => t.status === "done");
  const prog = tasks.filter((t) => t.status === "progress");
  const todo = tasks.filter((t) => t.status === "todo");

  function generate() {
    setState("loading");
    setTimeout(() => setState("done"), 1700);
  }

  if (state !== "done") {
    return (
      <div className="report-wrap fade-in">
        <div className="report-card">
          <div className="report-empty">
            <div className="ic-wrap">
              <Icon name="sparkles" size={26} />
            </div>
            <h2>
              {personName ? `${personName}님의 이번 주 업무를 정리해 드려요` : "이번 주 업무를 보고서로 정리해 드려요"}
            </h2>
            <p>
              {personName ? `${personName}님이 맡은 일감을` : "등록된 일감을"} 바탕으로 완료·진행·다음 주 계획을
              <br />
              정해진 양식에 맞춰 자동으로 작성합니다.
            </p>
            <button className="btn btn-primary" onClick={generate} disabled={state === "loading"}>
              {state === "loading" ? (
                <>
                  <span className="spinner" /> 생성 중…
                </>
              ) : (
                <>
                  <Icon name="sparkles" size={16} /> 주간 보고 생성
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-wrap fade-in">
      <div className="report-card">
        <div className="rhead">
          <span className="pill">
            <Icon name="sparkles" size={13} /> AI 개인 주간 보고
          </span>
        </div>
        <h1>{personName ? `${personName}님의 이번 주 업무 요약` : "이번 주 업무 요약"}</h1>
        <div className="rmeta">일감 {tasks.length}건</div>

        <div className="report-metrics">
          <div className="metric">
            <div className="v" style={{ color: "var(--status-done)" }}>
              {done.length}
            </div>
            <div className="l">완료</div>
          </div>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-progress)" }}>
              {prog.length}
            </div>
            <div className="l">진행 중</div>
          </div>
          <div className="metric">
            <div className="v" style={{ color: "var(--status-todo)" }}>
              {todo.length}
            </div>
            <div className="l">예정</div>
          </div>
        </div>

        <SimSection title="이번 주 완료한 일" items={done} color="var(--status-done)" currentUser={currentUser} />
        <SimSection title="진행 중인 일" items={prog} color="var(--status-progress)" currentUser={currentUser} />
        <SimSection title="다음 주 계획" items={todo} color="var(--accent)" next currentUser={currentUser} />

        <div style={{ display: "flex", gap: 9, marginTop: 24 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setState("empty")}>
            <Icon name="rotate-cw" size={15} /> 다시 생성
          </button>
        </div>
      </div>
    </div>
  );
}
