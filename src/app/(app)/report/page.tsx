"use client";
import WeeklyReport from "@/components/WeeklyReport";
import { useApp } from "@/components/AppContext";

export default function ReportPage() {
  const { tasks, currentUser } = useApp();
  return <WeeklyReport tasks={tasks} currentUser={currentUser} />;
}
