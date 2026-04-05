import { useGameStore } from '../../game/store';
import { T } from '../../game/translations';
import { Settings, Save, LogOut } from 'lucide-react';
import { clearAuthSession, getAuthSession } from '@/lib/telegram';
import AdminPanel from './AdminPanel';

export default function SettingsPanel() {
  const { settings, setLanguage, setVoiceSetting, setTutorialEnabled, resetTutorial, saveGame, resetGame } = useGameStore();
  const l = settings.language;
  const isAdmin = Boolean(getAuthSession()?.isAdmin);

  return (
    <div className="p-4 space-y-6">
      <h3 className="font-serif text-primary uppercase tracking-widest text-sm mb-4 border-b border-border/50 pb-2 flex items-center gap-2">
        <Settings className="w-4 h-4"/> {T.settings_title[l]}
      </h3>

      <div className="space-y-4">
        <div className="bg-black/30 border border-white/5 rounded p-4">
          <label className="text-sm text-muted-foreground block mb-3">{T.settings_lang[l]}</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setLanguage('en')}
              className={`flex-1 py-2 rounded text-sm transition-colors border ${l === 'en' ? 'bg-primary/20 text-primary border-primary' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'}`}
            >
              English
            </button>
            <button 
              onClick={() => setLanguage('ru')}
              className={`flex-1 py-2 rounded text-sm transition-colors border ${l === 'ru' ? 'bg-primary/20 text-primary border-primary' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'}`}
            >
              Русский
            </button>
          </div>
        </div>

        <div className="bg-black/30 border border-white/5 rounded p-4">
          <label className="text-sm text-muted-foreground block mb-3">{T.settings_tutorial[l]}</label>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2">
              <span className="text-sm text-white">{T.settings_tutorial_enable[l]}</span>
              <button
                onClick={() => setTutorialEnabled(!settings.tutorial.enabled)}
                className={`min-w-[74px] px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border transition-colors ${
                  settings.tutorial.enabled
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-white/5 text-muted-foreground border-white/10'
                }`}
              >
                {settings.tutorial.enabled ? T.settings_on[l] : T.settings_off[l]}
              </button>
            </div>
            <button
              onClick={() => resetTutorial()}
              className="w-full text-xs uppercase tracking-wider px-3 py-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
            >
              {T.settings_tutorial_reset[l]}
            </button>
          </div>
        </div>

        <div className="bg-black/30 border border-white/5 rounded p-4">
          <label className="text-sm text-muted-foreground block mb-3">{T.settings_voice[l]}</label>
          <div className="space-y-3">
            {([
              ['lore', T.settings_voice_lore[l]],
              ['quests', T.settings_voice_quests[l]],
              ['npcDialogue', T.settings_voice_npc[l]],
            ] as const).map(([key, label]) => {
              const enabled = settings.voice[key];
              return (
                <div key={key} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-sm text-white">{label}</span>
                  <button
                    onClick={() => setVoiceSetting(key, !enabled)}
                    className={`min-w-[74px] px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border transition-colors ${
                      enabled
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-white/5 text-muted-foreground border-white/10'
                    }`}
                  >
                    {enabled ? T.settings_on[l] : T.settings_off[l]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-black/30 border border-white/5 rounded p-4 flex flex-col gap-3">
          <button 
            onClick={() => {
              saveGame();
              alert(l === 'ru' ? 'Игра сохранена!' : 'Game saved!');
            }}
            className="w-full rpg-button flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> {T.settings_save[l]}
          </button>
          
          <button 
            onClick={() => {
              if(confirm(l === 'ru' ? 'Удалить аккаунт и начать заново с выбора класса?' : 'Delete game account and restart from class selection?')) resetGame();
            }}
            className="w-full rpg-button border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive/10 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> {T.settings_reset[l]}
          </button>

          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
              clearAuthSession();
              window.location.reload();
            }}
            className="w-full rpg-button border-white/20 text-white hover:bg-white/10 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> {l === 'ru' ? 'Выйти из аккаунта' : 'Log out'}
          </button>
        </div>

        {isAdmin && <AdminPanel />}
      </div>
    </div>
  );
}
