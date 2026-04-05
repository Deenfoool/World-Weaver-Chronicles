import GameLayout from "./components/game/GameLayout";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { clearAuthSession, getAuthSession, setAuthSession } from "./lib/telegram";
import { apiRequest } from "./lib/queryClient";
import AdminConsolePage from "./components/game/AdminConsolePage";

type AuthTab = "login" | "register";

function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [tab, setTab] = useState<AuthTab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (tab === "login" ? "Вход" : "Регистрация"), [tab]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === "register" && password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    try {
      setIsLoading(true);
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await apiRequest("POST", endpoint, { username, password });
      const data = (await response.json()) as { user?: { id: string; username: string; isAdmin?: boolean } };
      if (!data?.user?.id || !data.user.username) {
        throw new Error("Invalid auth response");
      }
      setAuthSession({
        userId: data.user.id,
        username: data.user.username,
        isAdmin: Boolean(data.user.isAdmin),
      });
      onAuthed();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка авторизации";
      setError(message.includes(":") ? message.split(":").slice(1).join(":").trim() : message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[radial-gradient(circle_at_15%_10%,rgba(214,170,80,0.12),transparent_42%),radial-gradient(circle_at_90%_85%,rgba(80,110,170,0.14),transparent_40%),linear-gradient(180deg,#0b111d,#060910)]">
      <div className="w-full max-w-md glass-panel rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-[0.24em] text-primary/75 mb-2">World Weaver Chronicles</p>
        <h1 className="text-3xl font-serif text-white mb-4">{title}</h1>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab("login")} className={`flex-1 py-2 rounded border text-xs uppercase tracking-wider ${tab === "login" ? "border-primary/50 text-primary bg-primary/15" : "border-white/15 text-muted-foreground bg-black/35"}`}>Вход</button>
          <button onClick={() => setTab("register")} className={`flex-1 py-2 rounded border text-xs uppercase tracking-wider ${tab === "register" ? "border-primary/50 text-primary bg-primary/15" : "border-white/15 text-muted-foreground bg-black/35"}`}>Регистрация</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Логин"
            autoComplete="username"
            className="w-full rounded border border-white/15 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Пароль"
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            className="w-full rounded border border-white/15 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
            required
          />
          {tab === "register" && (
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="Подтвердите пароль"
              autoComplete="new-password"
              className="w-full rounded border border-white/15 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
              required
            />
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button type="submit" disabled={isLoading} className={`rpg-button w-full py-2 ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}>
            {isLoading ? "Обработка..." : tab === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
          <a href="/privacy.html" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
            Privacy
          </a>
          <a href="/terms.html" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
            Terms
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok) throw new Error(`Auth check failed: ${response.status}`);
        const data = (await response.json()) as { user?: { id: string; username: string; isAdmin?: boolean } };
        if (!data?.user?.id || !data.user.username) throw new Error("Invalid auth payload");
        setAuthSession({
          userId: data.user.id,
          username: data.user.username,
          isAdmin: Boolean(data.user.isAdmin),
        });
        if (!cancelled) setIsAuthed(true);
      } catch (_e) {
        clearAuthSession();
        if (!cancelled) setIsAuthed(false);
      } finally {
        if (!cancelled) setIsCheckingAuth(false);
      }
    };

    const local = getAuthSession();
    if (!local) {
      setIsCheckingAuth(false);
      setIsAuthed(false);
      return () => {
        cancelled = true;
      };
    }
    void verify();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[linear-gradient(180deg,#0b111d,#060910)]">
        <p className="text-sm text-primary/85 uppercase tracking-[0.18em]">Loading session...</p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <AuthScreen
        onAuthed={() => {
          setIsAuthed(true);
        }}
      />
    );
  }

  if (isAdminRoute) {
    return <AdminConsolePage />;
  }

  return <GameLayout />;
}

export default App;
