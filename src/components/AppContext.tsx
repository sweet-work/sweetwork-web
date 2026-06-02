"use client";
/* Cadence — app provider: auth gate, theme, shared task state, app shell. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Login from "./Login";
import { Sidebar, TopBar, NewTaskModal, type NewTaskInput } from "./AppShell";
import { createTodo, getMyTeamMembers } from "@/lib/api";
import { tasks as seedTasks, memberFromUser, type CurrentUser, type Member, type Status, type Task } from "@/lib/data";

interface AppContextValue {
  currentUser: CurrentUser;
  // The signed-in user's team roster (GET /teams/members), including the user themselves.
  members: Member[];
  tasks: Task[];
  toggleTask: (id: number) => void;
  addTask: (t: NewTaskInput) => Promise<void>;
}

// Map the backend's status enum onto our local Status (POSTPONED has no local equivalent → todo).
const STATUS_FROM_API: Record<string, Status> = {
  TODO: "todo",
  IN_PROGRESS: "progress",
  DONE: "done",
  POSTPONED: "todo",
};

const AppContext = createContext<AppContextValue | null>(null);

// Where we remember the signed-in user across refreshes.
const USER_KEY = "cadence-user";

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [theme, setTheme] = useState("light");
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [modal, setModal] = useState(false);
  // Becomes true once we've checked storage for a saved session — avoids a Login flash on refresh.
  const [ready, setReady] = useState(false);

  // Restore a signed-in user persisted on this device.
  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved) as CurrentUser);
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    setReady(true);
  }, []);

  // Load the signed-in user's team roster for the sidebar (includes the user themselves).
  useEffect(() => {
    if (!user) {
      setMembers([]);
      return;
    }
    let alive = true;
    getMyTeamMembers(Number(user.id))
      .then((list) => {
        if (!alive) return;
        setMembers(list.map((u) => memberFromUser(u.id, u.name)));
        // Backfill the team onto sessions restored before we persisted it (every roster
        // row carries the same team), so the team weekly report has a team_id to use.
        if (user.teamId == null && list.length > 0) {
          const next: CurrentUser = { ...user, teamId: list[0].team_id, teamName: list[0].team_name };
          localStorage.setItem(USER_KEY, JSON.stringify(next));
          setUser(next);
        }
      })
      .catch(() => {
        if (alive) setMembers([]);
      });
    return () => {
      alive = false;
    };
  }, [user]);

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

  function logout() {
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  function toggleTask(id: number) {
    setTasks((ts) =>
      ts.map((t) =>
        t.id === id ? { ...t, status: t.status === "done" ? "progress" : "done" } : t
      )
    );
  }
  // Persist via POST /todos (backend always creates it in TODO status), then add
  // the server's record to local state.
  async function addTask(t: NewTaskInput) {
    if (!user) return;
    const created = await createTodo({
      user_id: Number(user.id),
      content: t.title,
      start_date: t.date,
      end_date: t.endDate ?? t.date,
    });
    setTasks((ts) => [
      {
        // Backend ids restart from 1 and would clash with the seed tasks' ids on the
        // board, so use a collision-free local id for the React key / toggle.
        id: Date.now(),
        title: created.content,
        member: user.id,
        date: created.start_date,
        endDate: created.end_date > created.start_date ? created.end_date : undefined,
        status: STATUS_FROM_API[created.status] ?? "todo",
        pinned: false,
      },
      ...ts,
    ]);
  }

  // Wait until we've checked storage so a saved session doesn't flash the Login screen.
  if (!ready) return null;

  if (!user) {
    return (
      <Login
        onLogin={(email, data) => {
          const next: CurrentUser = {
            id: String(data.id),
            email,
            name: data.name,
            initials: data.name.slice(0, 2).toUpperCase(),
            color: "#6AA823",
            teamId: data.team_id ?? undefined,
            teamName: data.team_name ?? undefined,
          };
          localStorage.setItem(USER_KEY, JSON.stringify(next));
          setUser(next);
        }}
      />
    );
  }

  return (
    <AppContext.Provider value={{ currentUser: user, members, tasks, toggleTask, addTask }}>
      <div className="app">
        <Sidebar currentUser={user} members={members} />
        <div className="main">
          <TopBar
            user={user}
            theme={theme}
            toggleTheme={toggleTheme}
            onNewTask={() => setModal(true)}
            onLogout={logout}
          />
          <div className="content">{children}</div>
        </div>
        {modal && <NewTaskModal onClose={() => setModal(false)} onAdd={addTask} />}
      </div>
    </AppContext.Provider>
  );
}
