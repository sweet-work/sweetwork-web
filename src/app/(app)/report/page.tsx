"use client";
import WeeklyReport from "@/components/WeeklyReport";
import { useApp } from "@/components/AppContext";

export default function ReportPage() {
  const { tasks, currentUser } = useApp();

  // The report page is the team weekly report; it needs the user's team id.
  if (currentUser.teamId == null) {
    return (
      <div className="report-wrap fade-in">
        <div className="report-card">
          <div className="report-empty">
            <h2>소속된 팀이 없어요</h2>
            <p>팀 주간 보고는 팀에 소속된 뒤에 생성할 수 있어요.</p>
          </div>
        </div>
      </div>
    );
  }

  return <WeeklyReport teamId={currentUser.teamId} tasks={tasks} currentUser={currentUser} />;
}
