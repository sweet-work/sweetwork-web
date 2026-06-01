"use client";
/* Cadence — app provider: auth gate, theme, shared task state, app shell. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Login from "./Login";
import { Sidebar, TopBar, NewTaskModal, type NewTaskInput } from "./AppShell";
import { tasks as seedTasks, type CurrentUser, type Task } from "@/lib/data";

interface AppContextValue {
  currentUser: CurrentUser;
  tasks: Task[];
  toggleTask: (id: number) => void;
  addTask: (t: NewTaskInput) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
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
    if (!user) return;
    setTasks((ts) => [{ id: Date.now(), pinned: false, member: user.id, ...t }, ...ts]);
  }

  if (!user) {
    return (
      <Login
        onLogin={(email) =>
          setUser({
            id: email,
            email,
            name: email.split("@")[0],
            initials: email.slice(0, 2).toUpperCase(),
            color: "#6AA823",
          })
        }
      />
    );
  }

  return (
    <AppContext.Provider value={{ currentUser: user, tasks, toggleTask, addTask }}>
      <div className="app">
        <Sidebar currentUser={user} />
        <div className="main">
          <TopBar theme={theme} toggleTheme={toggleTheme} onNewTask={() => setModal(true)} />
          <div className="content">{children}</div>
        </div>
        {modal && <NewTaskModal onClose={() => setModal(false)} onAdd={addTask} />}
      </div>
    </AppContext.Provider>
  );
}
