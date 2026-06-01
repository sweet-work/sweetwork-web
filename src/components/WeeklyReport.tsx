"use client";
/* Cadence — Weekly report. Simulated AI generation from the week's tasks. */
import { useState } from "react";
import { Icon } from "./primitives";
import { personById, fmtRange, type Task, type CurrentUser } from "@/lib/data";

type ReportState = "empty" | "loading" | "done";

function Section({
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

export default function WeeklyReport({ tasks, currentUser }: { tasks: Task[]; currentUser: CurrentUser }) {
  const [state, setState] = useState<ReportState>("empty");

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
            <h2>이번 주 업무를 보고서로 정리해 드려요</h2>
            <p>
              등록된 일감을 바탕으로 완료·진행·다음 주 계획을
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
            <Icon name="sparkles" size={13} /> AI 주간 보고
          </span>
        </div>
        <h1>이번 주 팀 업무 요약</h1>
        <div className="rmeta">2026.05.05 — 2026.05.11 · 5명 · 일감 {tasks.length}건</div>

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

        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-1)", margin: "0 0 4px" }}>
          이번 주, 팀은 총 <b>{tasks.length}개</b>의 일감을 다뤘고 그중 <b>{done.length}개</b>를 완료했어요. 결제
          모듈과 배포 작업이 중심이었고, 다음 주에는 분기 보고서 제출과 보안 점검이 예정되어 있어요.
        </p>

        <Section title="이번 주 완료한 일" items={done} color="var(--status-done)" currentUser={currentUser} />
        <Section title="진행 중인 일" items={prog} color="var(--status-progress)" currentUser={currentUser} />
        <Section title="다음 주 계획" items={todo} color="var(--accent)" next currentUser={currentUser} />

        <div style={{ display: "flex", gap: 9, marginTop: 24 }}>
          <button className="btn btn-secondary btn-sm">
            <Icon name="copy" size={15} /> 복사
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setState("empty")}>
            <Icon name="rotate-cw" size={15} /> 다시 생성
          </button>
        </div>
      </div>
    </div>
  );
}
