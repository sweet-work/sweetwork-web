"use client";
import CalendarView from "@/components/CalendarView";
import { useApp } from "@/components/AppContext";

export default function CalendarPage() {
  // tasks.length bumps when a task is added, telling the calendar to reload from the API.
  const { tasks } = useApp();
  return <CalendarView refreshKey={tasks.length} />;
}
