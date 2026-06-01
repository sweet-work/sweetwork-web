import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppContext";

export const metadata: Metadata = {
  title: "Cadence — 팀 일감 공유",
  description: "회의 없이도 팀이 무엇을 하고 있는지 한눈에 — 공유 to-do, 캘린더, 보드, 주간 보고.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="light">
      <body>
        <div id="root">
          <AppProvider>{children}</AppProvider>
        </div>
      </body>
    </html>
  );
}
