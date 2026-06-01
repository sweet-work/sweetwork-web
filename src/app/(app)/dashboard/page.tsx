"use client";
import Dashboard from "@/components/Dashboard";
import { useApp } from "@/components/AppContext";

export default function DashboardPage() {
  const { tasks, toggleTask, currentUser } = useApp();
  return <Dashboard tasks={tasks} onToggle={toggleTask} currentUser={currentUser} />;
}
