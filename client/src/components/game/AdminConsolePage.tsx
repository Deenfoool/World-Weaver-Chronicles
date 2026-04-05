import { useEffect, useState } from 'react';
import { clearAuthSession, getAuthSession, setAuthSession } from '@/lib/telegram';
import { useGameStore } from '@/game/store';
import AdminPanel from './AdminPanel';

export default function AdminConsolePage() {
  const { loadSave, settings } = useGameStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    loadSave();
  }, [loadSave]);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) throw new Error(`Auth check failed: ${response.status}`);
        const data = (await response.json()) as { user?: { id: string; username: string; isAdmin?: boolean } };
        if (!data?.user?.id || !data.user.username) throw new Error('Invalid auth payload');
        setAuthSession({
          userId: data.user.id,
          username: data.user.username,
          isAdmin: Boolean(data.user.isAdmin),
        });
        if (!cancelled) setIsAllowed(Boolean(data.user.isAdmin));
      } catch (_e) {
        clearAuthSession();
        if (!cancelled) setIsAllowed(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };
    void verify();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
        <p className="text-sm text-primary/85 uppercase tracking-[0.18em]">Checking admin session...</p>
      </div>
    );
  }

  const session = getAuthSession();

  if (!session) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-primary/30 bg-black/70 p-5 space-y-3">
          <h1 className="text-2xl font-serif text-primary uppercase tracking-wider">Admin Console</h1>
          <p className="text-sm text-muted-foreground">
            {settings.language === 'ru'
              ? 'Нет активной сессии. Сначала войдите в игру.'
              : 'No active session. Please sign in to the game first.'}
          </p>
          <a href="/" className="inline-block rpg-button px-4 py-2 text-xs">
            {settings.language === 'ru' ? 'Перейти к входу' : 'Go to login'}
          </a>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-black/70 p-5 space-y-3">
          <h1 className="text-2xl font-serif text-destructive uppercase tracking-wider">Admin Console</h1>
          <p className="text-sm text-muted-foreground">
            {settings.language === 'ru'
              ? 'Доступ запрещен: требуется админ-аккаунт.'
              : 'Access denied: admin account required.'}
          </p>
          <a href="/" className="inline-block rpg-button px-4 py-2 text-xs">
            {settings.language === 'ru' ? 'Вернуться в игру' : 'Back to game'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_10%_10%,rgba(214,170,80,0.10),transparent_36%),linear-gradient(180deg,#0a0d13,#06080d)] text-white p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-primary/75">World Weaver Chronicles</p>
          <h1 className="font-serif text-2xl md:text-3xl text-primary uppercase tracking-wider">Admin Console</h1>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="rpg-button px-4 py-2 text-xs">
            {settings.language === 'ru' ? 'В игру' : 'Open game'}
          </a>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
              clearAuthSession();
              window.location.href = '/';
            }}
            className="rpg-button px-4 py-2 text-xs border-white/20 text-white hover:bg-white/10"
          >
            {settings.language === 'ru' ? 'Выйти' : 'Log out'}
          </button>
        </div>
      </div>

      <AdminPanel />
    </div>
  );
}
