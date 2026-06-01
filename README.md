# Cadence

회의나 메시지 없이도 팀이 지금 무엇을 하고 있는지 한눈에 보는 **팀 일감 공유 도구**.
일감(내용 + 날짜)을 등록하면 공유 to-do · 캘린더 · 보드로 모두에게 보이고, 중요한 날짜는 D-day로 떠 있으며, 한 주의 일감을 AI 주간 보고로 정리해 줍니다.

[Cadence 디자인 시스템](https://claude.ai/design)의 `ui_kits/cadence-app` 프로토타입을 Next.js + TypeScript로 옮긴 구현입니다.

## 기능

- **회사 이메일 로그인** — 비밀번호 없이 이메일 한 줄. 처음 보는 이메일은 그 자리에서 계정 생성.
- **대시보드** — 고정한 중요 일정 D-day 스트립, 오늘의 일감, 곧 다가오는 일감, 이번 주 팀 현황.
- **보드** — 예정 / 진행 중 / 완료 컬럼, 멤버별 필터.
- **캘린더** — 2026년 5월 월 그리드, 상태별 색으로 표시된 일정.
- **주간 보고** — 그 주의 일감으로 만든 (시뮬레이션) AI 주간 보고.
- **일감 추가** — 모달에서 내용·날짜·담당자·상태를 입력하면 바로 반영.
- **라이트 / 다크 테마** — 상단 바에서 토글, `localStorage`에 저장.

> 데모는 결정적으로 보이도록 "오늘 = 2026-05-11"로 고정되어 있고, 상태는 메모리에만 있으며, 주간 보고의 "AI"는 타임아웃으로 흉내 냅니다. 실제 AI로 연결하려면 `WeeklyReport.tsx`의 `setTimeout`을 실제 호출로 바꾸면 됩니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

아무 이메일(`you@company.com`)이나 입력하면 로그인됩니다.

```bash
npm run build && npm run start   # 프로덕션 빌드
```

## 구조

| 경로 | 역할 |
|---|---|
| `src/app/layout.tsx` · `page.tsx` | App Router 진입점 — 전역 스타일 로드, `CadenceApp` 렌더 |
| `src/styles/tokens.css` | 디자인 토큰 (라이트/다크 색, 타입 스케일, 간격, 반경, 모션) |
| `src/styles/kit.css` | 토큰 위에 올린 앱 컴포넌트 스타일 |
| `src/lib/data.ts` | 멤버·일감 더미 데이터, 상태 맵, D-day 헬퍼 |
| `src/components/primitives.tsx` | 공용 프리미티브: `Icon`(Lucide), `Avatar`, `StatusBadge`, `Mark`(로고) |
| `src/components/Login.tsx` | 로그인 화면 |
| `src/components/AppShell.tsx` | `Sidebar`, `TopBar`, `NewTaskModal` |
| `src/components/Dashboard.tsx` | 대시보드 + `DdayCard`, `TaskRow` |
| `src/components/BoardView.tsx` | 보드 컬럼 + 멤버 필터 |
| `src/components/CalendarView.tsx` | 월 그리드 |
| `src/components/WeeklyReport.tsx` | AI 주간 보고 |
| `src/components/CadenceApp.tsx` | 루트: 인증 게이트, 테마, 라우팅, 일감 상태 |

## 스택

Next.js 16 (App Router) · React 19 · TypeScript · `lucide-react` 아이콘 · Pretendard / IBM Plex Mono (CDN).
