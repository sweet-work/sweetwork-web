"use client";
import BoardView from "@/components/BoardView";
import { useApp } from "@/components/AppContext";

export default function BoardPage() {
  // tasks.length bumps when a task is added, which tells the board to reload from the API.
  const { tasks } = useApp();
  return <BoardView refreshKey={tasks.length} />;
}
