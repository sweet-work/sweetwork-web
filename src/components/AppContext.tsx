"use client";
/* Cadence — app provider: auth gate, theme, shared task state, app shell. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Login from "./Login";
import { Sidebar, TopBar, NewTaskModal, type NewTaskInput } from "./AppShell";
import {
  createTodo,
  getMyTeamMembers,
  getNotifications,
  getUnreadCount,
  readNotification,
  readAllNotifications,
  logout as apiLogout,
  onAuthExpired,
  type NotificationItem,
} from "@/lib/api";
import { tasks as seedTasks, memberFromUser, type CurrentUser, type Member, type Status, type Task } from "@/lib/data";

interface AppContextValue {
  currentUser: CurrentUser;
  // The signed-in user's team roster (GET /teams/members), including the user themselves.
  members: Member[];
  tasks: Task[];
  toggleTask: (id: number) => void;
  addTask: (t: NewTaskInput) => Promise<void>;
  // A task the board should open (set when a notification is tapped). Board clears it once consumed.
  focusTaskId: number | null;
  clearFocusTask: () => void;
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
  // In-app notifications + unread badge count for the TopBar bell.
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // A task id the board should open, set when a notification is tapped (see openTask).
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);
  // Mobile only: whether the off-canvas sidebar drawer is open (ignored on desktop, where the sidebar is always visible).
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // Becomes true once we've checked storage for a saved session — avoids a Login flash on refresh.
  const [ready, setReady] = useState(false);

  // Close the mobile drawer whenever the route changes (e.g. after tapping a nav item).
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // While the drawer is open, lock background scroll so only the drawer scrolls.
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

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

  // If the session can't be refreshed (refresh token expired/rejected), drop to login.
  useEffect(() => {
    return onAuthExpired(() => {
      localStorage.removeItem(USER_KEY);
      setUser(null);
    });
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

  // Pull the full notification list + unread count (on login, and when the panel opens).
  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const uid = Number(user.id);
    try {
      const [list, count] = await Promise.all([getNotifications(uid), getUnreadCount(uid)]);
      setNotifications(list);
      setUnreadCount(count);
    } catch {
      /* keep the last good state; a later poll/open will retry */
    }
  }, [user]);

  // Load notifications once on login, then poll just the unread count (cheap) every 60s while
  // the tab is visible — avoids re-pulling the whole list and waking the slow backend in the bg.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    const uid = Number(user.id);
    let alive = true;
    (async () => {
      try {
        const [list, count] = await Promise.all([getNotifications(uid), getUnreadCount(uid)]);
        if (!alive) return;
        setNotifications(list);
        setUnreadCount(count);
      } catch {
        /* surface nothing; the badge just stays at its last value */
      }
    })();
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      getUnreadCount(uid)
        .then((c) => {
          if (alive) setUnreadCount(c);
        })
        .catch(() => {});
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user]);

  // Mark one alert read — optimistic, rolled back if the PATCH fails.
  async function markNotificationRead(id: number) {
    if (!user) return;
    const target = notifications.find((n) => n.id === id);
    if (!target || target.status === "READ") return;
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, status: "READ" as const } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await readNotification(id, Number(user.id));
    } catch {
      setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, status: "UNREAD" as const } : n)));
      setUnreadCount((c) => c + 1);
    }
  }

  // Mark every alert read — optimistic, rolled back if the PATCH fails.
  async function markAllNotificationsRead() {
    if (!user || unreadCount === 0) return;
    const prev = notifications;
    const prevCount = unreadCount;
    setNotifications((ns) => ns.map((n) => ({ ...n, status: "READ" as const })));
    setUnreadCount(0);
    try {
      await readAllNotifications(Number(user.id));
    } catch {
      setNotifications(prev);
      setUnreadCount(prevCount);
    }
  }

  // Tapped a notification: remember its task and head to the board, which opens that task's detail.
  function openTask(todoId: number) {
    setFocusTaskId(todoId);
    router.push("/board");
  }

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
    apiLogout().catch(() => {}); // best-effort server-side invalidation; tokens cleared regardless
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
          const u = data.user;
          const next: CurrentUser = {
            id: String(u.id),
            email,
            name: u.name,
            initials: u.name.slice(0, 2).toUpperCase(),
            color: "#6AA823",
            teamId: u.team_id ?? undefined,
            teamName: u.team_name ?? undefined,
          };
          localStorage.setItem(USER_KEY, JSON.stringify(next));
          setUser(next);
        }}
      />
    );
  }

  return (
    <AppContext.Provider
      value={{ currentUser: user, members, tasks, toggleTask, addTask, focusTaskId, clearFocusTask: () => setFocusTaskId(null) }}
    >
      <div className={"app" + (navOpen ? " nav-open" : "")}>
        <Sidebar currentUser={user} members={members} onClose={() => setNavOpen(false)} />
        {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
        <div className="main">
          <TopBar
            user={user}
            theme={theme}
            toggleTheme={toggleTheme}
            onNewTask={() => setModal(true)}
            onLogout={logout}
            onMenu={() => setNavOpen(true)}
            notif={{
              items: notifications,
              unread: unreadCount,
              onRead: markNotificationRead,
              onReadAll: markAllNotificationsRead,
              onRefresh: refreshNotifications,
              onOpenTask: openTask,
            }}
          />
          <div className="content">{children}</div>
        </div>
        {modal && <NewTaskModal onClose={() => setModal(false)} onAdd={addTask} />}
      </div>
    </AppContext.Provider>
  );
}
