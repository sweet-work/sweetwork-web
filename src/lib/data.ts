/* Cadence — fake data + D-day helpers, typed. */

export type Status = "todo" | "progress" | "done";

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Task {
  id: number;
  title: string;
  member: string;
  date: string; // YYYY-MM-DD (start of range)
  endDate?: string; // YYYY-MM-DD (end of range; absent = single day)
  status: Status;
  pinned: boolean;
  ddayLabel?: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  color: string;
  // The user's team, from login/signup — used for the team weekly report.
  teamId?: number;
  teamName?: string;
}

// "Today" — the real current date (normalized to local midnight so D-day math is clean).
const _now = new Date();
export const TODAY = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
export const TODAY_STR = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(
  TODAY.getDate()
).padStart(2, "0")}`;

export const members: Member[] = [
  { id: "mk", name: "민경", initials: "MK", color: "#6AA823" },
  { id: "jh", name: "정현", initials: "JH", color: "#3F6FE5" },
  { id: "sy", name: "수영", initials: "SY", color: "#4E9A6B" },
  { id: "dw", name: "도원", initials: "DW", color: "#8A8275" },
  { id: "yj", name: "예진", initials: "YJ", color: "#C2891C" },
];

export const tasks: Task[] = [
  { id: 1, title: "결제 모듈 API 연동 마무리", member: "mk", date: "2026-05-12", status: "progress", pinned: false },
  { id: 2, title: "스프린트 데모 준비", member: "jh", date: "2026-05-13", status: "progress", pinned: true, ddayLabel: "스프린트 데모" },
  { id: 3, title: "온보딩 화면 디자인 리뷰", member: "sy", date: "2026-05-11", status: "todo", pinned: false },
  { id: 4, title: "분기 보고서 제출", member: "mk", date: "2026-05-16", status: "todo", pinned: true, ddayLabel: "분기 보고서 제출" },
  { id: 5, title: "로그인 버그 핫픽스 배포", member: "jh", date: "2026-05-08", status: "done", pinned: false },
  { id: 6, title: "주간 회의록 정리", member: "sy", date: "2026-05-08", status: "done", pinned: false },
  { id: 7, title: "DB 마이그레이션 스크립트 작성", member: "dw", date: "2026-05-13", status: "progress", pinned: false },
  { id: 8, title: "신규 팀원 계정 세팅", member: "dw", date: "2026-05-11", status: "todo", pinned: false },
  { id: 9, title: "랜딩 페이지 카피 검수", member: "yj", date: "2026-05-14", status: "todo", pinned: false },
  { id: 10, title: "캘린더 뷰 QA", member: "sy", date: "2026-05-15", status: "todo", pinned: false },
  { id: 11, title: "고객사 피드백 반영", member: "mk", date: "2026-05-09", status: "done", pinned: false },
  { id: 12, title: "디자인 토큰 문서화", member: "yj", date: "2026-05-12", status: "progress", pinned: false },
  { id: 13, title: "보안 점검 체크리스트", member: "dw", date: "2026-05-20", status: "todo", pinned: true, ddayLabel: "보안 점검" },
];

export const STATUS: Record<Status, { label: string; color: string; soft: string }> = {
  todo: { label: "예정", color: "var(--status-todo)", soft: "var(--status-todo-soft)" },
  progress: { label: "진행 중", color: "var(--status-progress)", soft: "var(--status-progress-soft)" },
  done: { label: "완료", color: "var(--status-done)", soft: "var(--status-done-soft)" },
};

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function memberById(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

/* Resolve a task owner by id — checks the seed team, then falls back to the logged-in user
   (who owns the tasks they create themselves). */
export function personById(
  id: string,
  currentUser?: CurrentUser | null
): Member | CurrentUser | undefined {
  return members.find((m) => m.id === id) ?? (currentUser?.id === id ? currentUser : undefined);
}

export function dday(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - TODAY.getTime()) / 86400000); // negative = past, 0 = today
}

export function ddayLabel(diff: number): string {
  if (diff === 0) return "D-DAY";
  if (diff > 0) return "D-" + diff;
  return "D+" + Math.abs(diff);
}

export function ddayColor(diff: number): string {
  if (diff <= 1) return "var(--dday-now)";
  if (diff <= 3) return "var(--dday-soon)";
  if (diff <= 7) return "var(--dday-near)";
  return "var(--dday-far)";
}

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${WEEKDAYS[d.getDay()]})`;
}

/* Display a task's schedule — single day, or "start ~ end" when it spans a range. */
export function fmtRange(start: string, end?: string): string {
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} ~ ${fmtDate(end)}`;
}

/* A task's deadline is the end of its range (or its single date). D-day counts to this. */
export function taskEnd(task: Task): string {
  return task.endDate ?? task.date;
}

/* Every YYYY-MM-DD from start to end, inclusive — used to spread a task across calendar days. */
export function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
