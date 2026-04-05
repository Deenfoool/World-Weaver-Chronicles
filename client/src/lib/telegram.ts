declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        disableVerticalSwipes?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        initDataUnsafe?: {
          user?: {
            id?: number;
          };
        };
      };
    };
  }
}

export type AuthSession = {
  userId: string;
  username: string;
  isAdmin: boolean;
};

export const AUTH_SESSION_KEY = "wwc_auth_session";

export function initTelegramWebApp() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;

  webApp.ready();
  webApp.expand();
  webApp.disableVerticalSwipes?.();
  webApp.setHeaderColor?.("#111318");
  webApp.setBackgroundColor?.("#111318");
}

export function getTelegramUserId(): string | null {
  const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (id) return String(id);

  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.userId === "string" && parsed.userId.length > 0) {
      return parsed.userId;
    }
  } catch (_e) {
    return null;
  }

  return null;
}

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed || typeof parsed.userId !== "string" || typeof parsed.username !== "string") return null;
    return {
      userId: parsed.userId,
      username: parsed.username,
      isAdmin: Boolean(parsed.isAdmin),
    };
  } catch (_e) {
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}
