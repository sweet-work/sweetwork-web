"use client";
import BoardView from "@/components/BoardView";
import { useApp } from "@/components/AppContext";

export default function BoardPage() {
  const { tasks, currentUser } = useApp();
  return <BoardView tasks={tasks} currentUser={currentUser} />;
}
