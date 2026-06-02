"use client";
import { use } from "react";
import MemberDetail from "@/components/MemberDetail";
import { useApp } from "@/components/AppContext";

export default function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { tasks, toggleTask, currentUser, members } = useApp();
  return (
    <MemberDetail
      memberId={id}
      tasks={tasks}
      members={members}
      currentUser={currentUser}
      onToggle={toggleTask}
    />
  );
}
