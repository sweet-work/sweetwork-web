This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 디렉토리 구조

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 전체 레이아웃 (폰트, 메타데이터)
│   ├── page.tsx            # 홈 페이지 (/) - 대시보드 진입 링크
│   ├── globals.css         # 전역 스타일
│   └── dashboard/
│       └── page.tsx        # 대시보드 페이지 (/dashboard)
└── lib/
    └── notion.ts           # 노션 API 클라이언트 및 데이터 조회 함수
```

### 주요 파일

| 파일 | 설명 |
|------|------|
| `src/app/page.tsx` | 홈 화면. 대시보드로 이동하는 링크 제공 |
| `src/app/dashboard/page.tsx` | 노션 데이터를 조회하여 프로젝트 수 / 멤버 수 표시 |
| `src/lib/notion.ts` | `getProjectCount()`, `getUserCount()` 함수 정의 |

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일을 생성하고 아래 값을 입력합니다.

```bash
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_notion_database_id
```

> `.env.local` 파일은 보안상 Git에서 추적하지 않습니다.
> 실제 키 값은 팀 노션 공유 문서에서 확인할 수 있습니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인할 수 있습니다.

### 4. 프로덕션 빌드

```bash
# 빌드
npm run build

# 빌드 결과 실행
npm start
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
