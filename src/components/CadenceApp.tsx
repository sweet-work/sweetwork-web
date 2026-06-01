"use client";
/* Cadence — root app: auth gate, theme, view routing, task state. */
import { useEffect, useState } from "react";
import Login from "./Login";
import { Sidebar, TopBar, NewTaskModal, type View, type NewTaskInput } from "./AppShell";
import Dashboard from "./Dashboard";
import BoardView from "./BoardView";
import CalendarView from "./CalendarView";
import WeeklyReport from "./WeeklyReport";
import { tasks as seedTasks, type CurrentUser, type Task } from "@/lib/data";

export default function CadenceApp() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [theme, setTheme] = useState("light");
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cadence-theme");
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cadence-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function toggleTask(id: number) {
    setTasks((ts) =>
      ts.map((t) =>
        t.id === id ? { ...t, status: t.status === "done" ? "progress" : "done" } : t
      )
    );
  }
  function addTask(t: NewTaskInput) {
    setTasks((ts) => [{ id: Date.now(), pinned: false, ...t }, ...ts]);
  }

  if (!user) {
    return (
      <Login
        onLogin={(email) =>
          setUser({
            email,
            name: email.split("@")[0],
            initials: email.slice(0, 2).toUpperCase(),
            color: "#C75D3C",
          })
        }
      />
    );
  }

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} currentUser={user} />
      <div className="main">
        <TopBar view={view} theme={theme} toggleTheme={toggleTheme} onNewTask={() => setModal(true)} />
        <div className="content">
          {view === "dashboard" && <Dashboard tasks={tasks} onToggle={toggleTask} />}
          {view === "board" && <BoardView tasks={tasks} />}
          {view === "calendar" && <CalendarView tasks={tasks} />}
          {view === "report" && <WeeklyReport tasks={tasks} />}
        </div>
      </div>
      {modal && <NewTaskModal onClose={() => setModal(false)} onAdd={addTask} />}
    </div>
  );
}
