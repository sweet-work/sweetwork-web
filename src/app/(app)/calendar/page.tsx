"use client";
import CalendarView from "@/components/CalendarView";
import { useApp } from "@/components/AppContext";

export default function CalendarPage() {
  const { tasks } = useApp();
  return <CalendarView tasks={tasks} />;
}
