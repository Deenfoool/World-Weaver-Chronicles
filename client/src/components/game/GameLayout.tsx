import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameStore } from '../../game/store';
import { LOCATIONS, WEATHER, ITEMS, CLASSES, SKILLS } from '../../game/constants';
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, Save, Shield, Sword, Heart, Coins, User, Backpack, Map as MapIcon, Settings as SettingsIcon, Swords, Star, Hammer, Tent, Cloud, Sun, CloudRain, CloudLightning, Snowflake, Zap, Weight, BookMarked, Sparkles, Scale } from 'lucide-react';
import CombatScreen from './CombatScreen';
import LocationScreen from './LocationScreen';
import InventoryPanel from './InventoryPanel';
import SkillsPanel from './SkillsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { T } from '../../game/translations';
import { CharacterCreationBonuses } from '../../game/store';
import { WorldEconomyEvent } from '../../game/types';
import { playVoiceText } from '../../game/voice';
import { playLoop, playSfx, stopLoop } from '../../game/audio';

const QuestsPanelLazy = lazy(() => import('./QuestsPanel'));
const SettingsPanelLazy = lazy(() => import('./SettingsPanel'));
const CraftingPanelLazy = lazy(() => import('./CraftingPanel'));
const BestiaryPanelLazy = lazy(() => import('./BestiaryPanel'));
const FactionJournalPanelLazy = lazy(() => import('./FactionJournalPanel'));

function LazyFallback() {
  return <div className="p-4 text-xs text-muted-foreground">Loading panel...</div>;
}

type PreloadTask = {
  id: string;
  label: string;
  run: () => Promise<void>;
};

type EconomyNotice = {
  id: string;
  eventType: WorldEconomyEvent['type'];
  hubId: string;
  title: string;
  body: string;
  tone: 'good' | 'bad' | 'neutral';
  createdAtMs: number;
  expiresAtMs: number;
};

function buildEconomyNotice(
  event: WorldEconomyEvent,
  lang: 'en' | 'ru',
  resolveHubName: (hubId: string) => string,
): Omit<EconomyNotice, 'id' | 'createdAtMs' | 'expiresAtMs' | 'eventType' | 'hubId'> | null {
  const hubName = resolveHubName(event.hubId);
  switch (event.type) {
    case 'hub_founded':
      return {
        title: lang === 'ru' ? 'Новый хаб основан' : 'New Hub Founded',
        body: lang === 'ru' ? `${hubName} появился на карте.` : `${hubName} has appeared on the map.`,
        tone: 'good',
      };
    case 'hub_destroyed':
      return {
        title: lang === 'ru' ? 'Хаб уничтожен' : 'Hub Destroyed',
        body: lang === 'ru' ? `${hubName} пал из-за деградации экономики.` : `${hubName} collapsed under economic degradation.`,
        tone: 'bad',
      };
    case 'war':
      return {
        title: lang === 'ru' ? 'Война в регионе' : 'War in the Region',
        body: lang === 'ru' ? `${hubName}: сбои производства и рост рисков.` : `${hubName}: production disruptions and rising risk.`,
        tone: 'bad',
      };
    case 'crisis':
      return {
        title: lang === 'ru' ? 'Экономический кризис' : 'Economic Crisis',
        body: lang === 'ru' ? `${hubName} уходит в дефицит.` : `${hubName} is sliding into scarcity.`,
        tone: 'bad',
      };
    case 'caravan_attack':
      return {
        title: lang === 'ru' ? 'Караваны под ударом' : 'Caravans Under Attack',
        body: lang === 'ru' ? `Маршруты у ${hubName} стали опаснее.` : `Trade routes near ${hubName} became more dangerous.`,
        tone: 'bad',
      };
    case 'black_market_opened':
      return {
        title: lang === 'ru' ? 'Окно чёрного рынка' : 'Black Market Window',
        body: lang === 'ru' ? `${hubName}: теневая торговля активна.` : `${hubName}: shadow trade is now active.`,
        tone: 'neutral',
      };
    case 'prosperity':
      return {
        title: lang === 'ru' ? 'Экономический подъём' : 'Economic Prosperity',
        body: lang === 'ru' ? `${hubName} на волне роста и стабильности.` : `${hubName} is surging with growth and stability.`,
        tone: 'good',
      };
    case 'retaliation':
      return {
        title: lang === 'ru' ? 'Ответные меры' : 'Retaliation',
        body: lang === 'ru' ? `${hubName}: последствия прошлых решений ударили по региону.` : `${hubName}: delayed consequences of earlier choices struck the region.`,
        tone: 'bad',
      };
    case 'aid_arrival':
      return {
        title: lang === 'ru' ? 'Прибыла помощь' : 'Aid Arrived',
        body: lang === 'ru' ? `${hubName}: прибыли ресурсы восстановления.` : `${hubName}: reconstruction aid has arrived.`,
        tone: 'good',
      };
    case 'tariff_relief':
      return {
        title: lang === 'ru' ? 'Снижение тарифов' : 'Tariff Relief',
        body: lang === 'ru' ? `${hubName}: торговое давление ослабло.` : `${hubName}: trade pressure has eased.`,
        tone: 'neutral',
      };
    default:
      return null;
  }
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function preloadAudio(src: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.oncanplaythrough = () => resolve();
    audio.onerror = () => resolve();
    audio.src = src;
    audio.load();
    setTimeout(resolve, 1500);
  });
}

function buildPreloadTasks(): PreloadTask[] {
  const tasks: PreloadTask[] = [];
  const locationImages = Array.from(new Set(Object.values(LOCATIONS).map((l) => l.image).filter(Boolean)));
  locationImages.forEach((src, idx) => {
    tasks.push({ id: `loc-img-${idx}`, label: `Image ${src}`, run: () => preloadImage(src) });
  });

  Object.values(LOCATIONS).forEach((loc) => {
    (loc.npcs || []).forEach((npcId) => {
      tasks.push({ id: `npc-full-${npcId}`, label: `NPC ${npcId}`, run: () => preloadImage(`/images/npcs/${npcId}.png`) });
      tasks.push({ id: `npc-mini-${npcId}`, label: `NPC mini ${npcId}`, run: () => preloadImage(`/images/npcs/mini/${npcId}_mini.png`) });
    });
  });

  tasks.push({
    id: 'data-core',
    label: 'Core game data',
    run: async () => {
      void Object.keys(LOCATIONS).length;
      void Object.keys(CLASSES).length;
      void Object.keys(SKILLS).length;
      await Promise.resolve();
    },
  });

  tasks.push({
    id: 'audio-manifest',
    label: 'Audio manifest',
    run: async () => {
      const resp = await fetch('/assets/audio/audio_manifest.json').catch(() => null);
      if (!resp || !resp.ok) return;
      const manifest = await resp.json().catch(() => null);
      if (!manifest || typeof manifest !== 'object') return;
      const sounds = (manifest as Record<string, any>).sounds;
      const paths = Object.values((sounds && typeof sounds === 'object') ? sounds : {})
        .map((entry: any) => (typeof entry?.path === 'string' ? entry.path : null))
        .filter(Boolean)
        .slice(0, 16) as string[];
      await Promise.all(paths.map((p) => preloadAudio(String(p).startsWith('/') ? String(p) : `/${String(p)}`)));
    },
  });

  return tasks;
}

type CreationOption = {
  id: string;
  title: { en: string; ru: string };
  description: { en: string; ru: string };
  effectHint?: { en: string; ru: string };
  bonuses?: CharacterCreationBonuses;
  classId?: 'warrior' | 'ranger' | 'alchemist';
};

type CreationQuestion = {
  id: string;
  title: { en: string; ru: string };
  options: CreationOption[];
};

type TutorialStepConfig = {
  id: string;
  title: string;
  body: string;
  details: string[];
  mobileTab: string;
  desktopTab: string;
  selector?: string;
};

type CombatTutorialButtonStep = {
  id: string;
  selector: string;
  label: string;
  description: string;
};

export default function GameLayout() {
  const { player, gameTime, loadSave, chooseClass, advanceTutorialStep, skipTutorial, markTutorialHintSeen, currentLocationId, currentWeather, status, settings, worldEconomy, startTutorialCombat, stopTutorialCombat } = useGameStore();
  const [activeTab, setActiveTab] = useState('world'); 
  const [desktopTab, setDesktopTab] = useState('character');
  const [desktopCharacterPanel, setDesktopCharacterPanel] = useState<'character' | 'skills'>('character');
  const [desktopInventoryPanel, setDesktopInventoryPanel] = useState<'inventory' | 'crafting'>('inventory');
  const [desktopCodexPanel, setDesktopCodexPanel] = useState<'reputation' | 'bestiary'>('reputation');
  const prevMobileTabRef = useRef<string | null>(null);
  const prevDesktopTabRef = useRef<string | null>(null);
  const [introStep, setIntroStep] = useState(0);
  const [creationUnlocked, setCreationUnlocked] = useState(false);
  const [creationStep, setCreationStep] = useState(0);
  const [creationAnswers, setCreationAnswers] = useState<Record<string, string>>({});
  const [heroName, setHeroName] = useState('');
  const [heroNameTouched, setHeroNameTouched] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadDone, setPreloadDone] = useState(false);
  const [preloadStarted, setPreloadStarted] = useState(false);
  const [preloadTipIndex, setPreloadTipIndex] = useState(0);
  const [economyNotices, setEconomyNotices] = useState<EconomyNotice[]>([]);
  const [combatTutorialIndex, setCombatTutorialIndex] = useState(0);
  const [tutorialAnchorRect, setTutorialAnchorRect] = useState<DOMRect | null>(null);
  const tutorialCardRef = useRef<HTMLDivElement | null>(null);
  const [tutorialCardRect, setTutorialCardRect] = useState<{ width: number; height: number }>({ width: 340, height: 280 });
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  }));
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const l = settings.language;
  const gameTimeLabel = l === 'ru'
    ? `День ${gameTime.day}, ${String(gameTime.hour).padStart(2, '0')}:00`
    : `Day ${gameTime.day}, ${String(gameTime.hour).padStart(2, '0')}:00`;
  const preloadStartedRef = useRef(false);
  const economyEventsBootstrappedRef = useRef(false);
  const seenEconomyEventIdsRef = useRef<Set<string>>(new Set());

  const normalizeHeroName = (value: string) => value.trim().replace(/\s+/g, ' ');
  const isHeroNameValid = (value: string) => {
    const n = normalizeHeroName(value);
    if (n.length < 2 || n.length > 24) return false;
    return /^[A-Za-zА-Яа-яЁё0-9 '\-]+$/.test(n);
  };

  useEffect(() => {
    loadSave();
  }, []);

  useEffect(() => {
    if (player.classId) return;
    if (preloadStartedRef.current) return;
    preloadStartedRef.current = true;
    setPreloadStarted(true);
    const tasks = buildPreloadTasks();
    if (tasks.length === 0) {
      setPreloadProgress(100);
      setPreloadDone(true);
      return;
    }

    let completed = 0;
    const run = async () => {
      for (const task of tasks) {
        await task.run().catch(() => undefined);
        completed += 1;
        setPreloadProgress(Math.round((completed / tasks.length) * 100));
      }
      setPreloadDone(true);
    };

    run();
  }, [player.classId]);

  useEffect(() => {
    if (player.classId) return;
    if (preloadDone) return;
    const id = window.setInterval(() => {
      setPreloadTipIndex((prev) => (prev + 1) % 5);
    }, 3200);
    return () => window.clearInterval(id);
  }, [player.classId, preloadDone]);

  useEffect(() => {
    if (player.classId) return;
    if (heroNameTouched) return;
    if (heroName.length > 0) return;
    const fallback = player.name && player.name !== 'Traveler'
      ? player.name
      : l === 'ru'
        ? 'Странник'
        : 'Traveler';
    setHeroName(fallback);
  }, [player.classId, player.name, heroNameTouched, heroName.length, l]);

  useEffect(() => {
    const onResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobileViewport(window.innerWidth < 768);
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const nav = navigator as Navigator & { deviceMemory?: number };

    const evaluateLowFx = () => {
      const lowMem = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
      const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
      const mobileScreen = window.innerWidth < 768;
      const shouldEnable = media.matches || (mobileScreen && (lowMem || lowCpu));
      root.classList.toggle('low-fx', shouldEnable);
    };

    evaluateLowFx();
    media.addEventListener('change', evaluateLowFx);
    window.addEventListener('resize', evaluateLowFx);
    return () => {
      media.removeEventListener('change', evaluateLowFx);
      window.removeEventListener('resize', evaluateLowFx);
      root.classList.remove('low-fx');
    };
  }, []);

  useEffect(() => {
    const events = worldEconomy?.events || [];
    if (!economyEventsBootstrappedRef.current) {
      events.forEach((event) => seenEconomyEventIdsRef.current.add(event.id));
      economyEventsBootstrappedRef.current = true;
      return;
    }
    const freshEvents = events.filter((event) => !seenEconomyEventIdsRef.current.has(event.id));
    if (freshEvents.length === 0) return;
    freshEvents.forEach((event) => seenEconomyEventIdsRef.current.add(event.id));
    const newNotices = freshEvents
      .map((event) => {
        const base = buildEconomyNotice(event, l, (hubId) => LOCATIONS[hubId]?.name?.[l] || hubId);
        if (!base) return null;
        const now = Date.now();
        return {
          id: event.id,
          eventType: event.type,
          hubId: event.hubId,
          title: base.title,
          body: base.body,
          tone: base.tone,
          createdAtMs: now,
          expiresAtMs: now + 3000,
        } satisfies EconomyNotice;
      })
      .filter((notice): notice is EconomyNotice => Boolean(notice));
    if (newNotices.length === 0) return;
    setEconomyNotices((prev) => {
      const next = [...prev];
      newNotices.forEach((notice) => {
        const now = Date.now();
        const existingIdx = next.findIndex(
          (item) => item.hubId === notice.hubId && item.eventType === notice.eventType && item.expiresAtMs > now,
        );
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            ...notice,
            expiresAtMs: Math.max(next[existingIdx].expiresAtMs, notice.expiresAtMs),
          };
        } else {
          next.push(notice);
        }
      });
      return next.slice(-4);
    });
  }, [worldEconomy.events, l]);

  useEffect(() => {
    if (economyNotices.length === 0) return;
    const now = Date.now();
    const nearestExpiry = Math.min(...economyNotices.map((n) => n.expiresAtMs));
    const delay = Math.max(0, nearestExpiry - now);
    const timer = window.setTimeout(() => {
      const current = Date.now();
      setEconomyNotices((prev) => prev.filter((notice) => notice.expiresAtMs > current));
    }, delay + 10);
    return () => window.clearTimeout(timer);
  }, [economyNotices]);

  const location = LOCATIONS[currentLocationId];

  useEffect(() => {
    const loc = LOCATIONS[currentLocationId];
    if (!loc) return;
    const ambienceByType: Record<string, string> = {
      hub: 'amb_town_day_loop',
      road: 'amb_ruins_loop',
      explore: 'amb_forest_loop',
      camp: 'amb_swamp_loop',
    };
    const ambienceId = ambienceByType[loc.type] || 'amb_forest_loop';
    void playLoop(ambienceId, 'ambience', status === 'combat' ? 0.2 : 1);

    if (currentWeather === 'rain') {
      void playLoop('weather_rain_loop', 'weather', 0.9);
    } else if (currentWeather === 'storm') {
      void playLoop('weather_storm_loop', 'weather', 1);
    } else if (currentWeather === 'snow' || currentWeather === 'fog') {
      void playLoop('weather_wind_cold_loop', 'weather', 0.85);
    } else {
      stopLoop('weather');
    }

    return () => {
      stopLoop('ambience');
      stopLoop('weather');
    };
  }, [currentLocationId, currentWeather, status]);

  useEffect(() => {
    if (currentWeather !== 'storm') return;
    const timer = window.setInterval(() => {
      if (Math.random() < 0.35) {
        void playSfx(Math.random() < 0.5 ? 'thunder_strike_1' : 'thunder_strike_2', 0.85);
      }
    }, 3500);
    return () => window.clearInterval(timer);
  }, [currentWeather]);
  
  const bgStyle = {
    backgroundImage: `linear-gradient(to bottom, rgba(15, 18, 25, 0.6), rgba(15, 18, 25, 0.95)), url(${location.image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };

  const renderWorld = () => (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {status === 'combat' ? <CombatScreen /> : <LocationScreen location={location} status={status} />}
    </div>
  );

  const tutorialSteps: TutorialStepConfig[] = [
    {
      id: 'tutorial_welcome',
      title: l === 'ru' ? 'Добро пожаловать в хроники' : 'Welcome to the chronicles',
      body:
        l === 'ru'
          ? 'Покажу все основные экраны и кнопки по шагам. Окна будут открываться автоматически.'
          : 'I will walk through all major screens and buttons step by step, auto-opening each screen.',
      details: l === 'ru'
        ? ['Кнопка "Далее" сразу ведет к следующему экрану.', 'Можно пропускать шаг или всё обучение.']
        : ['The Next button immediately moves to the next screen.', 'You can skip one step or the whole tutorial.'],
      mobileTab: 'world',
      desktopTab: 'character',
      selector: '[data-tutorial-id="nav-world"]',
    },
    {
      id: 'tutorial_world',
      title: l === 'ru' ? 'Экран мира' : 'World Screen',
      body:
        l === 'ru'
          ? 'Здесь проходит основной геймплей: локация, события, NPC, переходы и контекстные действия.'
          : 'Main gameplay lives here: location, events, NPCs, travel, and contextual actions.',
      details: l === 'ru'
        ? ['Кнопка "Действия" — взаимодействия в текущей точке.', 'Иконка карты в углу — быстрый переход к путешествиям.']
        : ['Actions opens interactions in the current location.', 'The map icon in the corner quickly opens travel.'],
      mobileTab: 'world',
      desktopTab: 'character',
      selector: '[data-tutorial-id="travel-icon"]',
    },
    {
      id: 'tutorial_combat',
      title: l === 'ru' ? 'Боевая панель' : 'Combat Panel',
      body:
        l === 'ru'
          ? 'Практический бой: сейчас откроем реальное сражение и разберём каждую кнопку по очереди.'
          : 'Practical combat: we now open a real fight and explain each button step by step.',
      details: l === 'ru'
        ? ['Атака/блок/предмет/навык расходуют энергию.', 'Следите за HP, статусами и кулдаунами — это ключ к победе.']
        : ['Attack/block/item/skill consume energy.', 'Track HP, statuses, and cooldowns to win consistently.'],
      mobileTab: 'world',
      desktopTab: 'character',
    },
    {
      id: 'tutorial_character',
      title: l === 'ru' ? 'Персонаж' : 'Character',
      body:
        l === 'ru'
          ? 'Экран героя показывает базовые статы, выживаемость и текущую сборку.'
          : 'The character screen shows your core stats, survivability, and current build.',
      details: l === 'ru'
        ? ['Смотрите урон, защиту, энергию и груз.', 'Проверяйте снаряжение и текущие бонусы.']
        : ['Check damage, defense, energy, and carry load.', 'Review equipment and active stat bonuses.'],
      mobileTab: 'character',
      desktopTab: 'character',
      selector: '[data-tutorial-id="nav-character"]',
    },
    {
      id: 'tutorial_inventory',
      title: l === 'ru' ? 'Инвентарь' : 'Inventory',
      body:
        l === 'ru'
          ? 'Здесь хранится добыча, расходники и материалы. Управляйте весом и слотами.'
          : 'This is where loot, consumables, and materials are managed. Watch your carry load and slots.',
      details: l === 'ru'
        ? ['Фильтры и сортировка ускоряют поиск предметов.', 'Используйте предметы и следите за перегрузом.']
        : ['Filters and sorting speed up item management.', 'Use items and keep overload under control.'],
      mobileTab: 'inventory',
      desktopTab: 'inventory',
      selector: '[data-tutorial-id="nav-inventory"]',
    },
    {
      id: 'tutorial_quests',
      title: l === 'ru' ? 'Задания' : 'Quests',
      body:
        l === 'ru'
          ? 'Журнал заданий показывает активные цели, сроки и награды, включая события экономики.'
          : 'The quest journal tracks active objectives, timers, and rewards, including economy events.',
      details: l === 'ru'
        ? ['Открывайте контракт и выбирайте ветку решения.', 'Сдавайте задания, чтобы менять состояние мира.']
        : ['Open a contract and choose a branch.', 'Turn in quests to influence world state.'],
      mobileTab: 'quests',
      desktopTab: 'quests',
      selector: '[data-tutorial-id="nav-quests"]',
    },
    {
      id: 'tutorial_skills',
      title: l === 'ru' ? 'Навыки' : 'Skills',
      body:
        l === 'ru'
          ? 'Древо навыков определяет боевой стиль персонажа: пассивы, активы и синергии.'
          : 'The skill tree defines your combat style through passives, actives, and synergies.',
      details: l === 'ru'
        ? ['Тратьте очки умений осознанно: сборка важнее случайных кликов.', 'Проверяйте требования и ветки перед изучением.']
        : ['Spend skill points intentionally; build coherence matters.', 'Check branch requirements before learning.'],
      mobileTab: 'skills',
      desktopTab: 'skills',
    },
    {
      id: 'tutorial_crafting',
      title: l === 'ru' ? 'Ремесло' : 'Crafting',
      body:
        l === 'ru'
          ? 'В ремесле создаются зелья и предметы из найденных материалов и рецептов.'
          : 'Crafting creates potions and gear from gathered materials and recipes.',
      details: l === 'ru'
        ? ['Проверяйте нехватку ингредиентов перед крафтом.', 'Новые рецепты открывают более сильные циклы подготовки.']
        : ['Check ingredient shortages before crafting.', 'New recipes unlock stronger preparation loops.'],
      mobileTab: 'crafting',
      desktopTab: 'crafting',
    },
    {
      id: 'tutorial_reputation',
      title: l === 'ru' ? 'Репутация' : 'Reputation',
      body:
        l === 'ru'
          ? 'Здесь видно отношение хабов к вам и отложенные последствия решений.'
          : 'Here you track hub relations and delayed consequences of your choices.',
      details: l === 'ru'
        ? ['Следите за порогами репутации — они влияют на экономику.', 'Таймлайн помогает понять, почему меняются цены и риски.']
        : ['Track reputation thresholds because they impact economy behavior.', 'Timeline explains why prices and risks shift.'],
      mobileTab: 'reputation',
      desktopTab: 'reputation',
      selector: '[data-tutorial-id="reputation-thresholds"]',
    },
    {
      id: 'tutorial_bestiary',
      title: l === 'ru' ? 'Бестиарий и Кодекс' : 'Bestiary & Codex',
      body:
        l === 'ru'
          ? 'Бестиарий хранит знания о врагах, NPC, локациях и предметах, которые вы уже открыли.'
          : 'The codex stores knowledge about enemies, NPCs, locations, and discovered items.',
      details: l === 'ru'
        ? ['Используйте поиск по разделам.', 'Неизвестные записи откроются после взаимодействий в мире.']
        : ['Use section search to navigate entries quickly.', 'Unknown entries unlock after world interactions.'],
      mobileTab: 'bestiary',
      desktopTab: 'bestiary',
    },
    {
      id: 'tutorial_settings',
      title: l === 'ru' ? 'Настройки' : 'Settings',
      body:
        l === 'ru'
          ? 'Финальный шаг: язык, озвучка и управление обучением настраиваются здесь.'
          : 'Final step: language, voice, and tutorial controls are configured here.',
      details: l === 'ru'
        ? ['Можно отключить/включить озвучку по каналам.', 'При необходимости перезапустите обучение из настроек.']
        : ['Voice channels can be toggled independently.', 'You can restart tutorial from settings anytime.'],
      mobileTab: 'settings',
      desktopTab: 'settings',
      selector: '[data-tutorial-id="open-settings"]',
    },
    {
      id: 'tutorial_hub_control',
      title: l === 'ru' ? 'Управление хабом (Совет)' : 'Hub Control (Council)',
      body:
        l === 'ru'
          ? 'Это окно совета хаба: через него вы вручную влияете на экономику и отношения.'
          : 'This is the council hub-control modal where you directly influence economy and relations.',
      details: l === 'ru'
        ? [
          '1) Выберите хаб в верхнем списке.',
          '2) Введите сумму для инвестиции.',
          '3) Кнопки: Инвест. (рост), Диплом. (отношения), Рейд (давление), Саботаж (дестабилизация).',
        ]
        : [
          '1) Select a hub in the top dropdown.',
          '2) Enter an investment amount.',
          '3) Buttons: Invest (growth), Diplomacy (relations), Raid (pressure), Sabotage (destabilization).',
        ],
      mobileTab: 'world',
      desktopTab: 'character',
    },
  ];

  const tutorial = settings.tutorial;
  const tutorialLastIndex = tutorialSteps.length - 1;
  const tutorialStepIndex = Math.max(0, Math.min(tutorialLastIndex, tutorial.step || 0));
  const tutorialStep = tutorialSteps[tutorialStepIndex];
  const showTutorialOverlay = !!player.classId && tutorial.enabled && !tutorial.completed && tutorialStepIndex <= tutorialLastIndex;
  const combatTutorialSteps: CombatTutorialButtonStep[] = [
    {
      id: 'attack',
      selector: '[data-tutorial-id="combat-attack"]',
      label: l === 'ru' ? 'Атака' : 'Attack',
      description: l === 'ru'
        ? 'Основной урон по врагу. Используйте для завершения цепочек и добивания.'
        : 'Primary damage action. Use it to progress fights and finish enemies.',
    },
    {
      id: 'block',
      selector: '[data-tutorial-id="combat-block"]',
      label: l === 'ru' ? 'Блок' : 'Block',
      description: l === 'ru'
        ? 'Снижает входящий урон и помогает пережить сильный вражеский ход.'
        : 'Reduces incoming damage and helps survive heavy enemy turns.',
    },
    {
      id: 'skill',
      selector: '[data-tutorial-id="combat-skill"]',
      label: l === 'ru' ? 'Навык' : 'Skill',
      description: l === 'ru'
        ? 'Активирует классовые эффекты. Смотрите расход энергии и кулдауны.'
        : 'Triggers class abilities. Watch energy cost and cooldowns.',
    },
    {
      id: 'item',
      selector: '[data-tutorial-id="combat-item"]',
      label: l === 'ru' ? 'Предмет' : 'Item',
      description: l === 'ru'
        ? 'Использование зелий/боевых расходников в критический момент.'
        : 'Use potions and combat consumables at critical moments.',
    },
    {
      id: 'flee',
      selector: '[data-tutorial-id="combat-flee"]',
      label: l === 'ru' ? 'Отступление' : 'Flee',
      description: l === 'ru'
        ? 'Аварийный выход из боя с риском потерь; применяйте как крайний вариант.'
        : 'Emergency retreat with penalties; use as a last resort.',
    },
    {
      id: 'combo',
      selector: '[data-tutorial-id="combat-combo"]',
      label: l === 'ru' ? 'Комбо' : 'Combo',
      description: l === 'ru'
        ? 'Комбо растёт при последовательных агрессивных действиях и увеличивает урон. Срыв темпа обнуляет бонус.'
        : 'Combo grows through consecutive offensive actions and boosts damage. Losing tempo resets the bonus.',
    },
  ];
  const isCombatTutorialStep = tutorialStep?.id === 'tutorial_combat';
  const combatTutorialDone = combatTutorialIndex >= combatTutorialSteps.length - 1;
  const tutorialSelector = showTutorialOverlay
    ? (isCombatTutorialStep ? combatTutorialSteps[combatTutorialIndex]?.selector : tutorialStep?.selector)
    : undefined;

  useEffect(() => {
    if (!showTutorialOverlay || !tutorialStep) return;
    if (tutorialStep.mobileTab) setActiveTab(tutorialStep.mobileTab);
    if (tutorialStep.desktopTab) setDesktopTab(tutorialStep.desktopTab);
  }, [showTutorialOverlay, tutorialStep]);

  useEffect(() => {
    if (!isCombatTutorialStep) {
      setCombatTutorialIndex(0);
    }
  }, [isCombatTutorialStep, tutorialStepIndex]);

  useEffect(() => {
    if (!showTutorialOverlay || !isCombatTutorialStep) return;
    setActiveTab('world');
    startTutorialCombat();
    return () => {
      stopTutorialCombat();
    };
  }, [showTutorialOverlay, isCombatTutorialStep, startTutorialCombat, stopTutorialCombat]);

  useEffect(() => {
    if (!showTutorialOverlay || !tutorialSelector) {
      setTutorialAnchorRect(null);
      return;
    }
    const resolveRect = () => {
      const el = document.querySelector(tutorialSelector) as HTMLElement | null;
      if (!el) {
        setTutorialAnchorRect(null);
        return;
      }
      setTutorialAnchorRect(el.getBoundingClientRect());
    };
    resolveRect();
    const id = window.setInterval(resolveRect, 350);
    return () => window.clearInterval(id);
  }, [showTutorialOverlay, tutorialSelector, activeTab, desktopTab, isMobileViewport]);

  const handleNextTutorialClick = () => {
    if (isCombatTutorialStep && !combatTutorialDone) {
      setCombatTutorialIndex((prev) => Math.min(prev + 1, combatTutorialSteps.length - 1));
      return;
    }
    if (isCombatTutorialStep) stopTutorialCombat();
    advanceTutorialStep();
  };

  const handleSkipTutorialStep = () => {
    if (isCombatTutorialStep) stopTutorialCombat();
    advanceTutorialStep();
  };

  const handleSkipTutorialAll = () => {
    if (isCombatTutorialStep) stopTutorialCombat();
    skipTutorial();
  };
  const tutorialRenderTitle = isCombatTutorialStep
    ? `${tutorialStep.title}: ${combatTutorialSteps[combatTutorialIndex]?.label || ''}`
    : tutorialStep.title;
  const tutorialRenderDetails = isCombatTutorialStep
    ? [combatTutorialSteps[combatTutorialIndex]?.description || '', ...(tutorialStep.details || [])]
    : tutorialStep.details;

  useEffect(() => {
    if (!showTutorialOverlay) return;
    const el = tutorialCardRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setTutorialCardRect({ width: rect.width, height: rect.height });
    };
    updateSize();
    const id = window.setInterval(updateSize, 250);
    return () => window.clearInterval(id);
  }, [showTutorialOverlay, tutorialStepIndex, combatTutorialIndex, isMobileViewport]);

  const tutorialCardPosition = useMemo(() => {
    const margin = 8;
    const cardW = tutorialCardRect.width || 340;
    const cardH = tutorialCardRect.height || 280;
    const vw = viewportSize.width;
    const vh = viewportSize.height;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    if (!tutorialAnchorRect) {
      return {
        left: clamp(vw - cardW - 12, margin, Math.max(margin, vw - cardW - margin)),
        top: clamp(88, margin, Math.max(margin, vh - cardH - margin)),
      };
    }
    const candidates = [
      { left: tutorialAnchorRect.right + 12, top: tutorialAnchorRect.top - 4 },
      { left: tutorialAnchorRect.left - cardW - 12, top: tutorialAnchorRect.top - 4 },
      { left: tutorialAnchorRect.left, top: tutorialAnchorRect.bottom + 12 },
      { left: tutorialAnchorRect.left, top: tutorialAnchorRect.top - cardH - 12 },
    ].map((pos) => ({
      left: clamp(pos.left, margin, Math.max(margin, vw - cardW - margin)),
      top: clamp(pos.top, margin, Math.max(margin, vh - cardH - margin)),
    }));
    const intersects = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) =>
      !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const anchorBox = {
      left: tutorialAnchorRect.left - 6,
      top: tutorialAnchorRect.top - 6,
      right: tutorialAnchorRect.right + 6,
      bottom: tutorialAnchorRect.bottom + 6,
    };
    for (const c of candidates) {
      const cardBox = { left: c.left, top: c.top, right: c.left + cardW, bottom: c.top + cardH };
      if (!intersects(cardBox, anchorBox)) return c;
    }
    return candidates[0];
  }, [tutorialAnchorRect, tutorialCardRect, viewportSize]);

  useEffect(() => {
    if (!showTutorialOverlay || !tutorialStep) return;
    if ((tutorial.seenHints || []).includes(tutorialStep.id)) return;
    markTutorialHintSeen(tutorialStep.id);
  }, [showTutorialOverlay, tutorialStep, tutorial.seenHints, markTutorialHintSeen]);

  const introLore = [
    {
      title: l === 'ru' ? 'Когда небо треснуло' : 'When The Sky Cracked',
      text:
        l === 'ru'
          ? 'Сначала это называли просто бурей. Потом — Рунным Расколом. Башни рассыпались в пепел, реки сменили русла, а дороги начали вести не туда, куда помнили карты.\n\nОкхейвен выжил чудом: крепостные стены держатся на старой клятве стражей, а рынки — на упрямстве тех, кто не согласился исчезнуть.'
          : 'At first they called it a storm. Later, the Runebreak. Towers turned to ash, rivers changed their beds, and roads stopped leading where maps remembered.\n\nOakhaven survived by miracle: its walls stand on old warden oaths, and its markets on the stubbornness of people who refused to vanish.',
    },
    {
      title: l === 'ru' ? 'Кто ты среди обломков' : 'Who You Are Among Ruins',
      text:
        l === 'ru'
          ? 'Ты не избранный из песен и не наследник трона. Ты тот, кто остаётся на ногах после последнего удара.\n\nДля караванов ты — тень у костра на перевале. Для чудовищ — имя, которое звучит перед тем, как гаснет факел.'
          : 'You are no chosen hero from songs, no heir to a throne. You are the one still standing after the last blow.\n\nFor caravans, you are a shadow by the passfire. For monsters, your name is what they hear before the torch dies.',
    },
    {
      title: l === 'ru' ? 'Что поставлено на кон' : 'What Is At Stake',
      text:
        l === 'ru'
          ? 'Каждый сорванный заказ — это пустые амбары. Каждый незащищённый путь — это ещё один погребальный костёр.\n\nТы воюешь не за славу. Ты воюешь, чтобы дети в Окхейвене снова различали тишину и страх.'
          : 'Every failed contract means empty granaries. Every unguarded road means another funeral pyre.\n\nYou do not fight for glory. You fight so children in Oakhaven can once again tell silence from fear.',
    },
    {
      title: l === 'ru' ? 'Память о старом ордене' : 'Memory Of The Old Order',
      text:
        l === 'ru'
          ? 'До королей и гербов были Хранители — воины, следопыты и алхимики, державшие равновесие между дикой магией и человеком.\n\nИх руны давно стерлись, но их ремесло живёт в тех, кто выбирает путь клинка, пути следа или пути колбы.'
          : 'Before kings and heraldry, there were Wardens — warriors, scouts, and alchemists who kept balance between wild magic and humankind.\n\nTheir runes are gone, but their craft remains in those who choose blade, trail, or flask.',
    },
    {
      title: l === 'ru' ? 'Твоя клятва начинается сейчас' : 'Your Oath Begins Now',
      text:
        l === 'ru'
          ? 'С этого шага твоя история перестаёт быть слухом и становится следом в летописи.\n\nТвои ответы определят не только числа в листе героя, но и то, как о тебе будут говорить у ворот, в кузнице и у походного огня.'
          : 'From this step on, your story stops being rumor and becomes a mark in the chronicle.\n\nYour answers will shape not just numbers on a hero sheet, but how people speak of you at the gate, in the forge, and by campfire.',
    },
  ];

  useEffect(() => {
    if (prevMobileTabRef.current !== null && prevMobileTabRef.current !== activeTab) {
      void playSfx('ui_tab_switch');
    }
    prevMobileTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (prevDesktopTabRef.current !== null && prevDesktopTabRef.current !== desktopTab) {
      void playSfx('ui_tab_switch');
    }
    prevDesktopTabRef.current = desktopTab;
  }, [desktopTab]);

  useEffect(() => {
    if (player.classId) return;
    if (!settings.voice.lore) return;
    const line = introLore[introStep];
    if (!line) return;
    playVoiceText('lore', line.text, l, settings.voice.lore);
  }, [introStep, player.classId, settings.voice.lore, l]);

  const creationQuestions: CreationQuestion[] = [
    {
      id: 'parents',
      title: { en: 'Who were your parents?', ru: 'Кем были ваши родители?' },
      options: [
        {
          id: 'parents_soldier',
          title: { en: 'Frontier veterans', ru: 'Ветераны пограничья' },
          description: {
            en: 'You were raised by people who slept in armor and taught you that fear is managed, not defeated.',
            ru: 'Тебя растили люди, спавшие в доспехе и учившие: страх не побеждают, им управляют.',
          },
          effectHint: { en: 'Legacy: stronger body and guard stance.', ru: 'Наследие: крепкое тело и стойка защитника.' },
          bonuses: { maxHp: 8, baseDefense: 1 },
        },
        {
          id: 'parents_hunters',
          title: { en: 'Forest hunters', ru: 'Лесные охотники' },
          description: {
            en: 'You learned to read bent grass, broken branches, and when to strike before dusk swallows the trail.',
            ru: 'Ты учился читать примятую траву, сломанные ветви и бить первым, пока сумрак не съел след.',
          },
          effectHint: { en: 'Legacy: sharper damage and field carrying craft.', ru: 'Наследие: более острый урон и походная сноровка.' },
          bonuses: { baseDamageMin: 1, baseDamageMax: 1, carryCapacity: 4 },
        },
        {
          id: 'parents_alchemists',
          title: { en: 'Traveling alchemists', ru: 'Странствующие алхимики' },
          description: {
            en: 'Your cradle smelled of herbs and embers. You learned that every poison has a rhythm, every cure a price.',
            ru: 'Твоя колыбель пахла травами и углями. Ты рано понял: у каждого яда свой ритм, у каждого лекарства своя цена.',
          },
          effectHint: { en: 'Legacy: broader energy reserve and trader coin.', ru: 'Наследие: больше энергии и купеческая монета.' },
          bonuses: { maxEnergy: 7, gold: 20 },
        },
        {
          id: 'parents_nobles',
          title: { en: 'Fallen minor nobles', ru: 'Обедневшие дворяне' },
          description: {
            en: 'You inherited discipline, old manuscripts, and the habit of planning three moves ahead in every dispute.',
            ru: 'Тебе достались дисциплина, старые рукописи и привычка просчитывать спор на три хода вперёд.',
          },
          effectHint: { en: 'Legacy: tactical talent and a hidden reserve fund.', ru: 'Наследие: тактический талант и скрытый резерв золота.' },
          bonuses: { skillPoints: 1, gold: 25 },
        },
      ],
    },
    {
      id: 'upbringing',
      title: { en: 'Where did you grow up?', ru: 'Где вы росли?' },
      options: [
        {
          id: 'up_village',
          title: { en: 'Remote village', ru: 'Глухая деревня' },
          description: {
            en: 'Long winters forged patience. Work began before sunrise, and everyone carried more than they should.',
            ru: 'Долгие зимы выковали терпение. Работа начиналась до рассвета, и каждый нёс больше, чем должен.',
          },
          effectHint: { en: 'Path trait: endurance and pack discipline.', ru: 'Черта пути: выносливость и дисциплина ноши.' },
          bonuses: { maxHp: 6, carryCapacity: 5 },
        },
        {
          id: 'up_city',
          title: { en: 'Crowded city', ru: 'Шумный город' },
          description: {
            en: 'In tight alleys and market noise, you learned speed, bargaining, and how to survive on little rest.',
            ru: 'В тесных переулках и рыночном гуле ты научился скорости, торгу и жизни почти без отдыха.',
          },
          effectHint: { en: 'Path trait: greater energy flow and coin sense.', ru: 'Черта пути: больший запас энергии и чувство цены.' },
          bonuses: { maxEnergy: 6, gold: 18 },
        },
        {
          id: 'up_estate',
          title: { en: 'Old estate', ru: 'Старое поместье' },
          description: {
            en: 'Behind cracked marble and quiet tutors, you studied dueling forms and the weight of responsibility.',
            ru: 'Среди треснувшего мрамора и молчаливых наставников ты изучал формы дуэли и цену ответственности.',
          },
          effectHint: { en: 'Path trait: disciplined defense and learned focus.', ru: 'Черта пути: дисциплинированная защита и обученная концентрация.' },
          bonuses: { baseDefense: 1, skillPoints: 1 },
        },
        {
          id: 'up_camp',
          title: { en: 'Mercenary camp', ru: 'Лагерь наёмников' },
          description: {
            en: 'Steel songs, rough jokes, and drills in mud. You grew where hesitation was the only unforgivable sin.',
            ru: 'Песни стали, грубые шутки и тренировки в грязи. Ты вырос там, где промедление считалось главным грехом.',
          },
          effectHint: { en: 'Path trait: higher striking pressure.', ru: 'Черта пути: усиленное давление в атаке.' },
          bonuses: { baseDamageMin: 1, baseDamageMax: 2 },
        },
      ],
    },
    {
      id: 'path',
      title: { en: 'Who did you become?', ru: 'Кем вы стали?' },
      options: [
        {
          id: 'path_blade',
          title: { en: 'Shieldblade trainee', ru: 'Ученик щитоносца' },
          description: {
            en: 'You stood on the training circle until your shoulders burned, learning to hold a line when others break.',
            ru: 'Ты стоял в учебном круге, пока плечи не горели, и учился держать строй там, где другие ломаются.',
          },
          effectHint: { en: 'Calling: Warrior. Skills favor guard and front-line survival.', ru: 'Призвание: Воин. Навыки тяготеют к защите и линии фронта.' },
          classId: 'warrior',
          bonuses: { baseDefense: 1, maxHp: 4 },
        },
        {
          id: 'path_scout',
          title: { en: 'Trail scout', ru: 'Следопыт-разведчик' },
          description: {
            en: 'You became the first to move and the last to be seen, mapping danger before danger maps you.',
            ru: 'Ты стал тем, кто выходит первым и исчезает последним, отмечая опасность раньше, чем она отметит тебя.',
          },
          effectHint: { en: 'Calling: Ranger. Skills favor mobility, tempo, and utility.', ru: 'Призвание: Следопыт. Навыки тяготеют к мобильности и темпу.' },
          classId: 'ranger',
          bonuses: { maxEnergy: 5, carryCapacity: 3 },
        },
        {
          id: 'path_brewer',
          title: { en: 'Apprentice brewer', ru: 'Ученик алхимика' },
          description: {
            en: 'You learned to turn shards, venom, and ash into solutions no blade could ever provide.',
            ru: 'Ты научился превращать осколки, яд и пепел в решения, на которые не способен ни один клинок.',
          },
          effectHint: { en: 'Calling: Alchemist. Skills favor mixtures, statuses, and resource play.', ru: 'Призвание: Алхимик. Навыки тяготеют к смесям, эффектам и ресурсу.' },
          classId: 'alchemist',
          bonuses: { maxEnergy: 4, skillPoints: 1 },
        },
      ],
    },
    {
      id: 'vow',
      title: { en: 'What oath drives you now?', ru: 'Какая клятва ведёт вас?' },
      options: [
        {
          id: 'vow_people',
          title: { en: 'Protect the common folk', ru: 'Защищать простой народ' },
          description: {
            en: 'You put your name between homes and the dark, even when no bard will ever sing of it.',
            ru: 'Ты ставишь своё имя между домами и тьмой, даже если об этом никто не сложит балладу.',
          },
          effectHint: { en: 'Oath mark: sturdier body and steadier defense.', ru: 'Печать клятвы: крепче тело и надёжнее защита.' },
          bonuses: { maxHp: 7, baseDefense: 1 },
        },
        {
          id: 'vow_knowledge',
          title: { en: 'Recover lost knowledge', ru: 'Вернуть утраченные знания' },
          description: {
            en: 'You chase forbidden archives and buried runes, believing understanding can end the cycle.',
            ru: 'Ты ищешь запретные архивы и погребённые руны, веря, что понимание способно разорвать круг.',
          },
          effectHint: { en: 'Oath mark: sharper mind and deeper energy control.', ru: 'Печать клятвы: острее разум и глубже контроль энергии.' },
          bonuses: { skillPoints: 1, maxEnergy: 5 },
        },
        {
          id: 'vow_wealth',
          title: { en: 'Build your fortune', ru: 'Собрать состояние' },
          description: {
            en: 'You swore never again to be powerless in trade, supply, or bargaining with desperate nobles.',
            ru: 'Ты поклялся больше не быть бессильным в торге, снабжении и переговорах с отчаявшимися лордами.',
          },
          effectHint: { en: 'Oath mark: stronger logistics and starting capital.', ru: 'Печать клятвы: лучше логистика и стартовый капитал.' },
          bonuses: { gold: 35, carryCapacity: 4 },
        },
        {
          id: 'vow_vengeance',
          title: { en: 'Avenge the fallen', ru: 'Отомстить за павших' },
          description: {
            en: 'You carry names carved on steel. Every strike is a promise kept in blood and ash.',
            ru: 'Ты носишь имена, вырезанные на стали. Каждый удар — обещание, сдержанное в крови и пепле.',
          },
          effectHint: { en: 'Oath mark: heavier offensive pressure.', ru: 'Печать клятвы: более тяжёлый напор в атаке.' },
          bonuses: { baseDamageMin: 1, baseDamageMax: 2 },
        },
      ],
    },
  ];

  if (!player.classId) {
    const loreFinished = introStep >= introLore.length;
    const canEnterCreation = preloadDone;
    const currentQuestion = creationQuestions[creationStep];
    const loadingTips =
      l === 'ru'
        ? [
            'Совет: кровотечение и яд суммируются по разным источникам.',
            'Совет: репутация у торговца снижает цены покупки.',
            'Совет: перегруз снижает урон, шанс побега и восстановление энергии.',
            'Совет: фазовые боссы меняют поведение по мере потери HP.',
            'Совет: активные навыки и ульты имеют кулдауны, планируйте ротацию.',
          ]
        : [
            'Tip: bleeding and poison stack from different sources.',
            'Tip: merchant reputation lowers your buy prices.',
            'Tip: overload lowers damage, flee chance, and energy recovery.',
            'Tip: phase bosses change behavior as their HP drops.',
            'Tip: active skills and ultimates have cooldowns, plan your rotation.',
          ];
    const selectedOptions = creationQuestions
      .map((q) => q.options.find((opt) => opt.id === creationAnswers[q.id]))
      .filter(Boolean) as CreationOption[];
    const selectedPath = selectedOptions.find((opt) => opt.classId)?.classId || 'warrior';
    const accumulatedBonuses = selectedOptions.reduce<CharacterCreationBonuses>(
      (acc, opt) => ({
        maxHp: (acc.maxHp || 0) + (opt.bonuses?.maxHp || 0),
        maxEnergy: (acc.maxEnergy || 0) + (opt.bonuses?.maxEnergy || 0),
        baseDamageMin: (acc.baseDamageMin || 0) + (opt.bonuses?.baseDamageMin || 0),
        baseDamageMax: (acc.baseDamageMax || 0) + (opt.bonuses?.baseDamageMax || 0),
        baseDefense: (acc.baseDefense || 0) + (opt.bonuses?.baseDefense || 0),
        carryCapacity: (acc.carryCapacity || 0) + (opt.bonuses?.carryCapacity || 0),
        gold: (acc.gold || 0) + (opt.bonuses?.gold || 0),
        skillPoints: (acc.skillPoints || 0) + (opt.bonuses?.skillPoints || 0),
      }),
      {},
    );
    const classPreview = CLASSES[selectedPath];
    const heroNameError =
      heroNameTouched && !isHeroNameValid(heroName)
        ? l === 'ru'
          ? 'Введите имя 2-24 символа (буквы, цифры, пробел, апостроф, дефис).'
          : 'Enter a name 2-24 chars (letters, digits, space, apostrophe, hyphen).'
        : '';
    const canCreateCharacter = isHeroNameValid(heroName);

    const chooseAnswer = (questionId: string, optionId: string) => {
      setCreationAnswers((prev) => ({ ...prev, [questionId]: optionId }));
      setCreationStep((prev) => prev + 1);
    };

    return (
      <div className="h-[100dvh] w-full text-foreground font-sans flex overflow-hidden fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(130,90,40,0.25),_rgba(10,10,15,0.95))]">
        <div className="m-auto w-full max-w-5xl p-4 md:p-8">
          <div className="rpg-panel p-6 md:p-8">
            {!loreFinished ? (
              <div className="max-w-3xl mx-auto">
                <p className="text-center text-xs uppercase tracking-[0.2em] text-primary/80 mb-3">
                  {l === 'ru' ? 'Вступление' : 'Prologue'}
                </p>
                <h1 className="text-3xl md:text-5xl font-serif text-primary mb-3 uppercase tracking-widest text-center">
                  {introLore[introStep].title}
                </h1>
                <p className="text-center text-sm md:text-base text-muted-foreground mb-8 leading-relaxed whitespace-pre-line">
                  {introLore[introStep].text}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIntroStep((v) => v + 1)}
                    className="rpg-button px-6 py-3"
                  >
                    {T.intro_next[l]}
                  </button>
                  <button
                    onClick={() => setIntroStep(introLore.length)}
                    className="rpg-button px-6 py-3 border-white/30 text-white hover:bg-white/10"
                  >
                    {T.intro_skip[l]}
                  </button>
                </div>
              </div>
            ) : !creationUnlocked ? (
              <div className="max-w-3xl mx-auto text-center">
                <p className="text-center text-xs uppercase tracking-[0.2em] text-primary/80 mb-3">
                  {l === 'ru' ? 'Подготовка мира' : 'Preparing The World'}
                </p>
                <h1 className="text-3xl md:text-5xl font-serif text-primary mb-3 uppercase tracking-widest">
                  {l === 'ru' ? 'Загрузка хроник' : 'Loading Chronicles'}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  {l === 'ru'
                    ? 'Мы подгружаем изображения, игровые данные и аудио-ресурсы, чтобы старт был плавным.'
                    : 'We are preloading images, gameplay data, and audio resources for a smooth start.'}
                </p>
                <div className="rounded-lg border border-primary/25 bg-black/35 p-4 mb-4">
                  <div className="flex justify-between text-xs text-primary/85 mb-2">
                    <span>{preloadStarted ? (l === 'ru' ? 'Прогресс' : 'Progress') : l === 'ru' ? 'Ожидание' : 'Pending'}</span>
                    <span>{preloadProgress}%</span>
                  </div>
                  <Progress value={preloadProgress} className="h-2 bg-black/60" />
                </div>
                <div className="min-h-[60px] rounded border border-white/10 bg-black/30 p-3 mb-6">
                  <p className="text-xs text-muted-foreground">{loadingTips[preloadTipIndex]}</p>
                </div>
                {!canEnterCreation ? (
                  <p className="text-xs text-primary/80 animate-pulse">{l === 'ru' ? 'Идет подготовка ресурсов...' : 'Preparing resources...'}</p>
                ) : (
                  <button onClick={() => setCreationUnlocked(true)} className="rpg-button px-6 py-3">
                    {l === 'ru' ? 'Нажмите, чтобы продолжить' : 'Press To Continue'}
                  </button>
                )}
              </div>
            ) : creationStep < creationQuestions.length ? (
              <div className="max-w-4xl mx-auto">
                <p className="text-center text-xs uppercase tracking-[0.2em] text-primary/80 mb-3">
                  {l === 'ru'
                    ? `Создание персонажа ${creationStep + 1}/${creationQuestions.length}`
                    : `Character Creation ${creationStep + 1}/${creationQuestions.length}`}
                </p>
                <h1 className="text-2xl md:text-4xl font-serif text-primary mb-6 uppercase tracking-widest text-center">
                  {currentQuestion.title[l]}
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentQuestion.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => chooseAnswer(currentQuestion.id, opt.id)}
                      className="text-left p-4 rounded border border-primary/30 bg-black/40 hover:bg-black/60 hover:border-primary transition-all"
                    >
                      <h3 className="font-serif text-lg text-white mb-1">{opt.title[l]}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{opt.description[l]}</p>
                      {opt.effectHint && (
                        <p className="text-[11px] text-primary/80 mt-2 italic">
                          {l === 'ru' ? 'Отголосок судьбы: ' : 'Fate echo: '}
                          {opt.effectHint[l]}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
                {creationStep > 0 && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={() => setCreationStep((v) => Math.max(0, v - 1))}
                      className="rpg-button px-6 py-2 border-white/30 text-white hover:bg-white/10"
                    >
                      {l === 'ru' ? 'Назад' : 'Back'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl md:text-5xl font-serif text-primary mb-2 uppercase tracking-widest text-center">
                  {l === 'ru' ? 'Итог биографии' : 'Biography Result'}
                </h1>
                <p className="text-center text-sm text-muted-foreground mb-5">
                  {l === 'ru'
                    ? 'Ваши ответы определили стартовый класс и модификаторы персонажа.'
                    : 'Your answers determined your starting class and stat modifiers.'}
                </p>
                <div className="rounded border border-primary/30 bg-black/40 p-4 mb-4">
                  <h3 className="font-serif text-xl text-white mb-1">{classPreview.name[l]}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{classPreview.description[l]}</p>
                  <div className="mb-3 space-y-1">
                    {selectedOptions.map((opt) => (
                      <p key={opt.id} className="text-[11px] text-primary/85 italic">
                        • {opt.title[l]} — {opt.effectHint?.[l] || opt.description[l]}
                      </p>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-primary/90">
                    <p>HP: {classPreview.baseStats.maxHp + (accumulatedBonuses.maxHp || 0)}</p>
                    <p>{T.combat_energy[l]}: {classPreview.baseStats.maxEnergy + (accumulatedBonuses.maxEnergy || 0)}</p>
                    <p>{T.stat_dmg[l]}: {classPreview.baseStats.baseDamage[0] + (accumulatedBonuses.baseDamageMin || 0)}-{classPreview.baseStats.baseDamage[1] + (accumulatedBonuses.baseDamageMax || 0)}</p>
                    <p>{T.stat_def[l]}: {classPreview.baseStats.baseDefense + (accumulatedBonuses.baseDefense || 0)}</p>
                    <p>{T.stat_capacity[l]}: {classPreview.baseStats.carryCapacity + (accumulatedBonuses.carryCapacity || 0)}</p>
                    <p>{l === 'ru' ? 'Стартовое золото' : 'Starting gold'}: {25 + (accumulatedBonuses.gold || 0)}</p>
                  </div>
                </div>
                <div className="rounded border border-white/15 bg-black/35 p-4 mb-4">
                  <label className="block text-xs uppercase tracking-widest text-primary/80 mb-2">
                    {l === 'ru' ? 'Имя героя' : 'Hero Name'}
                  </label>
                  <input
                    value={heroName}
                    onChange={(e) => {
                      setHeroNameTouched(true);
                      setHeroName(e.target.value);
                    }}
                    maxLength={32}
                    placeholder={l === 'ru' ? 'Введите имя' : 'Enter a name'}
                    className="w-full bg-black/60 border border-primary/30 rounded px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  />
                  <p className={`text-[11px] mt-2 ${heroNameError ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {heroNameError ||
                      (l === 'ru'
                        ? `Будет сохранено как: ${normalizeHeroName(heroName).slice(0, 24) || '—'}`
                        : `Will be saved as: ${normalizeHeroName(heroName).slice(0, 24) || '—'}`)}
                  </p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setCreationStep(creationQuestions.length - 1)}
                    className="rpg-button px-6 py-3 border-white/30 text-white hover:bg-white/10"
                  >
                    {l === 'ru' ? 'Изменить выбор' : 'Adjust choices'}
                  </button>
                  <button
                    onClick={() => chooseClass(selectedPath, accumulatedBonuses, normalizeHeroName(heroName))}
                    disabled={!canCreateCharacter}
                    className={`rpg-button px-6 py-3 ${!canCreateCharacter ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {l === 'ru' ? 'Создать персонажа' : 'Create Character'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full text-foreground font-sans flex overflow-hidden fixed inset-0" style={bgStyle}>
      {/* Desktop Left Panel (Hidden on mobile) */}
      <aside className="hidden md:flex w-[400px] glass-panel border-r border-primary/20 flex-col shrink-0 h-full z-20 shadow-[6px_0_26px_rgba(0,0,0,0.56)]">
        {/* Header */}
        <div className="p-4 border-b border-primary/20 bg-black/35 flex justify-between items-center shrink-0">
          <h1 className="text-2xl font-serif text-primary tracking-widest font-bold uppercase drop-shadow-md">
            Eternal Quest
          </h1>
          <div className="flex items-center gap-2 text-primary font-bold bg-black/40 px-3 py-1 rounded-full border border-primary/20">
            <Coins className="w-4 h-4" /> {player.gold}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={desktopTab} onValueChange={setDesktopTab} className="flex-1 flex flex-col min-h-0 mt-2">
          <div className="px-4 shrink-0">
            <TabsList className="grid w-full grid-cols-5 bg-black/50 border border-white/5 h-12">
              <TabsTrigger value="character" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><User className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="inventory" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><Backpack className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="quests" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><MapIcon className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="codex" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><BookMarked className="w-4 h-4"/></TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"><SettingsIcon className="w-4 h-4"/></TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="flex-1 mt-2">
            <TabsContent value="character" className="m-0">
              <div className="px-4 pt-2 pb-1 flex gap-2">
                <button onClick={() => setDesktopCharacterPanel('character')} className={`px-3 py-1 text-xs rounded border ${desktopCharacterPanel === 'character' ? 'border-primary/50 text-primary bg-primary/15' : 'border-white/10 text-muted-foreground'}`}>{T.nav_character[l]}</button>
                <button onClick={() => setDesktopCharacterPanel('skills')} className={`px-3 py-1 text-xs rounded border ${desktopCharacterPanel === 'skills' ? 'border-primary/50 text-primary bg-primary/15' : 'border-white/10 text-muted-foreground'}`}>{T.nav_skills[l]}</button>
              </div>
              {desktopCharacterPanel === 'character' ? <CharacterPanel player={player} l={l} /> : <SkillsPanel />}
            </TabsContent>
            <TabsContent value="inventory" className="m-0">
              <div className="px-4 pt-2 pb-1 flex gap-2">
                <button onClick={() => setDesktopInventoryPanel('inventory')} className={`px-3 py-1 text-xs rounded border ${desktopInventoryPanel === 'inventory' ? 'border-primary/50 text-primary bg-primary/15' : 'border-white/10 text-muted-foreground'}`}>{T.nav_inventory[l]}</button>
                <button onClick={() => setDesktopInventoryPanel('crafting')} className={`px-3 py-1 text-xs rounded border ${desktopInventoryPanel === 'crafting' ? 'border-primary/50 text-primary bg-primary/15' : 'border-white/10 text-muted-foreground'}`}>{T.nav_crafting[l]}</button>
              </div>
              {desktopInventoryPanel === 'inventory' ? (
                <InventoryPanel />
              ) : (
                <Suspense fallback={<LazyFallback />}>
                  <CraftingPanelLazy />
                </Suspense>
              )}
            </TabsContent>
            <TabsContent value="quests" className="m-0">
              <Suspense fallback={<LazyFallback />}>
                <QuestsPanelLazy />
              </Suspense>
            </TabsContent>
            <TabsContent value="codex" className="m-0">
              <div className="px-4 pt-2 pb-1 flex gap-2">
                <button onClick={() => setDesktopCodexPanel('reputation')} className={`px-3 py-1 text-xs rounded border ${desktopCodexPanel === 'reputation' ? 'border-primary/50 text-primary bg-primary/15' : 'border-white/10 text-muted-foreground'}`}>{l === 'ru' ? 'Репутация' : 'Reputation'}</button>
                <button onClick={() => setDesktopCodexPanel('bestiary')} className={`px-3 py-1 text-xs rounded border ${desktopCodexPanel === 'bestiary' ? 'border-primary/50 text-primary bg-primary/15' : 'border-white/10 text-muted-foreground'}`}>{l === 'ru' ? 'Бестиарий' : 'Bestiary'}</button>
              </div>
              {desktopCodexPanel === 'reputation' ? (
                <Suspense fallback={<LazyFallback />}>
                  <FactionJournalPanelLazy />
                </Suspense>
              ) : (
                <Suspense fallback={<LazyFallback />}>
                  <BestiaryPanelLazy />
                </Suspense>
              )}
            </TabsContent>
            <TabsContent value="settings" className="m-0">
              <Suspense fallback={<LazyFallback />}>
                <SettingsPanelLazy />
              </Suspense>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-full bg-black/20 min-w-0">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/40 to-black/90 z-0"></div>
        
        {/* Mobile Top Bar */}
        <div className="md:hidden p-3 border-b border-primary/20 bg-black/82 flex justify-between items-center shrink-0 relative z-10 backdrop-blur-xl">
           <div className="flex flex-col flex-1 max-w-[60%]">
             <div className="flex items-center gap-2">
               <Heart className="w-3.5 h-3.5 text-destructive shrink-0" />
               <Progress value={(player.hp / player.maxHp) * 100} className="w-full max-w-[100px] h-1.5 bg-black/50" />
               <span className="text-[10px] text-white font-mono">{player.hp}/{player.maxHp}</span>
             </div>
             <div className="flex items-center gap-2 mt-1.5">
               <span className="text-[9px] text-accent-foreground font-bold shrink-0 w-3.5 text-center">XP</span>
               <Progress value={(player.xp / player.xpToNext) * 100} className="w-full max-w-[100px] h-1 bg-black/50" />
             </div>
             <div className="flex items-center gap-2 mt-1.5">
               <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
               <Progress value={(player.energy / player.maxEnergy) * 100} className="w-full max-w-[100px] h-1 bg-black/50 [&>div]:bg-blue-500" />
             </div>
           </div>
           <div className="flex flex-col items-end gap-1">
             <div className="flex items-center gap-2">
               <div className="flex items-center gap-1.5 text-primary font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-xs">
                 <Coins className="w-3.5 h-3.5" /> {player.gold}
               </div>
               <div className="w-6 h-6 rounded bg-black/60 border border-white/10 flex items-center justify-center">
                  {currentWeather === 'clear' && <Sun className="w-3.5 h-3.5 text-yellow-400" />}
                  {currentWeather === 'rain' && <CloudRain className="w-3.5 h-3.5 text-blue-400" />}
                  {currentWeather === 'storm' && <CloudLightning className="w-3.5 h-3.5 text-purple-400" />}
                  {currentWeather === 'snow' && <Snowflake className="w-3.5 h-3.5 text-white" />}
                  {currentWeather === 'fog' && <Cloud className="w-3.5 h-3.5 text-gray-400" />}
               </div>
               <button
                 onClick={() => setActiveTab('settings')}
                 data-tutorial-id="open-settings"
                 className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${
                   activeTab === 'settings'
                     ? 'bg-primary/20 border-primary/45 text-primary pulse-gold'
                     : 'bg-black/60 border-white/10 text-muted-foreground hover:text-white'
                 }`}
                 aria-label={l === 'ru' ? 'Открыть настройки' : 'Open settings'}
               >
                 <SettingsIcon className="w-3.5 h-3.5" />
               </button>
             </div>
             <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{T.stat_level[l]} {player.level}</div>
             <div className="text-[10px] text-primary/85 uppercase tracking-wider">{gameTimeLabel}</div>
           </div>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 relative z-10 overflow-hidden flex flex-col">
           {/* Desktop Top Weather */}
           <div className="hidden md:flex absolute top-0 right-0 p-4 z-50 items-center gap-4">
             <div className="px-3 py-1.5 rounded border border-primary/25 bg-black/60 text-[11px] uppercase tracking-wider text-primary/90">
               {gameTimeLabel}
             </div>
             <div className="flex items-center gap-2 group relative cursor-help">
                <div className="w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center backdrop-blur-md">
                   {currentWeather === 'clear' && <Sun className="w-5 h-5 text-yellow-400" />}
                   {currentWeather === 'rain' && <CloudRain className="w-5 h-5 text-blue-400" />}
                   {currentWeather === 'storm' && <CloudLightning className="w-5 h-5 text-purple-400" />}
                   {currentWeather === 'snow' && <Snowflake className="w-5 h-5 text-white" />}
                   {currentWeather === 'fog' && <Cloud className="w-5 h-5 text-gray-400" />}
                </div>
                {WEATHER[currentWeather] && (
                  <div className="absolute top-full right-0 mt-2 w-48 p-3 bg-black border border-white/20 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-sm">
                    <p className="font-bold text-primary mb-1">{WEATHER[currentWeather].name[l]}</p>
                    <p className="text-muted-foreground">{WEATHER[currentWeather].description[l]}</p>
                  </div>
                )}
             </div>
           </div>

           {economyNotices.length > 0 && (
             <div className="absolute top-16 right-3 md:right-4 z-[70] w-[min(92vw,360px)] space-y-2 pointer-events-none">
               {economyNotices.map((notice) => (
                 <div
                   key={notice.id}
                   className={`rounded-lg border backdrop-blur-xl px-3 py-2 shadow-xl animate-in ${
                     notice.tone === 'good'
                       ? 'border-emerald-500/30 bg-emerald-950/45'
                       : notice.tone === 'bad'
                         ? 'border-destructive/35 bg-black/80'
                         : 'border-primary/30 bg-black/75'
                   }`}
                 >
                   <p
                     className={`text-[10px] uppercase tracking-[0.16em] mb-1 ${
                       notice.tone === 'good'
                         ? 'text-emerald-300'
                         : notice.tone === 'bad'
                           ? 'text-destructive'
                           : 'text-primary/90'
                     }`}
                   >
                     {l === 'ru' ? 'Экономическое уведомление' : 'Economy Notification'}
                   </p>
                   <p className="text-xs text-white font-semibold">{notice.title}</p>
                   <p className="text-[11px] text-muted-foreground leading-snug">{notice.body}</p>
                 </div>
               ))}
             </div>
           )}

           {/* Desktop always shows world. Mobile shows based on activeTab. */}
           <div className="hidden md:flex flex-1 h-full overflow-hidden p-8">
             {renderWorld()}
           </div>
           
           <div className="md:hidden flex-1 h-full overflow-hidden">
             {activeTab === 'world' && renderWorld()}
             {activeTab === 'character' && <ScrollArea className="h-full"><CharacterPanel player={player} l={l} /></ScrollArea>}
             {activeTab === 'inventory' && <ScrollArea className="h-full"><InventoryPanel /></ScrollArea>}
             {activeTab === 'quests' && (
               <ScrollArea className="h-full">
                 <Suspense fallback={<LazyFallback />}>
                   <QuestsPanelLazy />
                 </Suspense>
               </ScrollArea>
             )}
             {activeTab === 'skills' && <ScrollArea className="h-full"><SkillsPanel /></ScrollArea>}
             {activeTab === 'crafting' && (
               <ScrollArea className="h-full">
                 <Suspense fallback={<LazyFallback />}>
                   <CraftingPanelLazy />
                 </Suspense>
               </ScrollArea>
             )}
             {activeTab === 'reputation' && (
               <ScrollArea className="h-full">
                 <Suspense fallback={<LazyFallback />}>
                   <FactionJournalPanelLazy />
                 </Suspense>
               </ScrollArea>
             )}
             {activeTab === 'bestiary' && (
               <ScrollArea className="h-full">
                 <Suspense fallback={<LazyFallback />}>
                   <BestiaryPanelLazy />
                 </Suspense>
               </ScrollArea>
             )}
             {activeTab === 'settings' && (
               <ScrollArea className="h-full">
                 <Suspense fallback={<LazyFallback />}>
                   <SettingsPanelLazy />
                 </Suspense>
               </ScrollArea>
             )}
           </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden shrink-0 mobile-nav-surface grid grid-cols-4 px-1.5 relative z-20 pb-2 pt-1 gap-1">
           <NavBtn tutorialId="nav-world" icon={<Swords className="w-4 h-4"/>} label={T.action_explore[l].split(' ')[0]} isActive={activeTab === 'world'} onClick={() => setActiveTab('world')} />
           <NavBtn tutorialId="nav-character" icon={<User className="w-4 h-4"/>} label={T.nav_character[l]} isActive={activeTab === 'character'} onClick={() => setActiveTab('character')} />
           <NavBtn tutorialId="nav-inventory" icon={<Backpack className="w-4 h-4"/>} label={T.nav_inventory[l]} isActive={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
           <NavBtn tutorialId="nav-quests" icon={<MapIcon className="w-4 h-4"/>} label={T.nav_quests[l]} isActive={activeTab === 'quests'} onClick={() => setActiveTab('quests')} />
        </div>

        {showTutorialOverlay && tutorialStep && (
          <>
            {tutorialAnchorRect && (
              <div
                className="pointer-events-none fixed z-[118] rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] animate-pulse"
                style={{
                  top: tutorialAnchorRect.top - 4,
                  left: tutorialAnchorRect.left - 4,
                  width: tutorialAnchorRect.width + 8,
                  height: tutorialAnchorRect.height + 8,
                }}
              />
            )}
            <div
              className="fixed z-[120] w-[min(92vw,360px)] pointer-events-auto"
              style={{
                top: tutorialCardPosition.top,
                left: tutorialCardPosition.left,
              }}
            >
            <div ref={tutorialCardRef} className="rounded-xl border border-primary/30 bg-black/88 backdrop-blur-xl p-4 shadow-2xl">
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80 mb-2">
                {l === 'ru' ? `Обучение ${tutorialStepIndex + 1}/${tutorialSteps.length}` : `Tutorial ${tutorialStepIndex + 1}/${tutorialSteps.length}`}
              </p>
              <h3 className="font-serif text-lg text-white mb-2">{tutorialRenderTitle}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{tutorialStep.body}</p>
              <div className="space-y-1.5 mb-4">
                {tutorialRenderDetails.map((detail, idx) => (
                  <p key={`${tutorialStep.id}_${idx}`} className="text-[11px] text-primary/85">
                    • {detail}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleNextTutorialClick}
                  className="rpg-button px-4 py-2 text-xs"
                >
                  {isCombatTutorialStep && !combatTutorialDone
                    ? (l === 'ru' ? 'След. кнопка' : 'Next combat button')
                    : tutorialStepIndex === tutorialLastIndex
                    ? l === 'ru'
                      ? 'Завершить'
                      : 'Finish'
                    : l === 'ru'
                      ? 'Далее'
                      : 'Next'}
                </button>
                <button
                  onClick={handleSkipTutorialStep}
                  className="rpg-button px-4 py-2 text-xs border-white/20 text-white hover:bg-white/10"
                >
                  {l === 'ru' ? 'Пропустить шаг' : 'Skip step'}
                </button>
                <button
                  onClick={handleSkipTutorialAll}
                  className="rpg-button px-4 py-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  {l === 'ru' ? 'Пропустить обучение' : 'Skip tutorial'}
                </button>
              </div>
            </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function NavBtn({ icon, label, isActive, onClick, tutorialId }: { icon: ReactNode; label: string; isActive: boolean; onClick: () => void; tutorialId: string }) {
  return (
    <button 
      data-tutorial-id={tutorialId}
      data-active={isActive ? 'true' : 'false'}
      onClick={() => {
        void playSfx('ui_tab_switch', 0.9);
        onClick();
      }}
      className="mobile-nav-btn"
    >
      {icon}
      <span className={`text-[9px] uppercase tracking-wider font-bold truncate w-full px-1 ${isActive ? 'text-primary' : ''}`}>{label}</span>
    </button>
  );
}

function CharacterPanel({ player, l }: { player: any; l: 'en' | 'ru' }) {
  const [section, setSection] = useState<'overview' | 'attributes' | 'skills'>('overview');
  const totalWeight = player.inventory.reduce((sum: number, inv: any) => {
    const item = ITEMS[inv.itemId];
    if (!item) return sum;
    return sum + item.weight * inv.quantity;
  }, 0);
  const equippedWeapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
  const equippedArmor = player.equipment.armor ? ITEMS[player.equipment.armor] : null;

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border border-primary/25 bg-[linear-gradient(145deg,rgba(18,24,38,0.95),rgba(9,11,17,0.95))] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex justify-between items-start border-b border-white/10 pb-3 mb-4">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-primary/75">
              {l === 'ru' ? 'Лист героя' : 'Hero Ledger'}
            </p>
            <h2 className="text-3xl font-serif text-white">{player.name}</h2>
            <p className="text-sm text-primary uppercase tracking-wider">
              {T.stat_level[l]} {player.level}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">
              {(player.classId && CLASSES[player.classId]?.name?.[l]) || 'Unknown'} / Prestige {player.prestigeLevel || 0}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {l === 'ru' ? 'Очки навыков' : 'Skill Points'}
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/15 border border-primary/30 text-primary font-bold">
              <Sparkles className="w-4 h-4" />
              {player.skillPoints}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSection('overview')}
            className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
              section === 'overview'
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-black/35 text-muted-foreground border-white/10 hover:text-white'
            }`}
          >
            {l === 'ru' ? 'Обзор' : 'Overview'}
          </button>
          <button
            onClick={() => setSection('attributes')}
            className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
              section === 'attributes'
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-black/35 text-muted-foreground border-white/10 hover:text-white'
            }`}
          >
            {l === 'ru' ? 'Атрибуты' : 'Attributes'}
          </button>
          <button
            onClick={() => setSection('skills')}
            className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
              section === 'skills'
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-black/35 text-muted-foreground border-white/10 hover:text-white'
            }`}
          >
            {l === 'ru' ? 'Навыки' : 'Skills'}
          </button>
        </div>

        {section === 'overview' && (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-destructive"><Heart className="w-3 h-3"/> HP</span>
                  <span className="text-white">{player.hp} / {player.maxHp}</span>
                </div>
                <Progress value={(player.hp / player.maxHp) * 100} className="h-2 bg-black/50" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-accent-foreground">XP</span>
                  <span className="text-white">{player.xp} / {player.xpToNext}</span>
                </div>
                <Progress value={(player.xp / player.xpToNext) * 100} className="h-1.5 bg-black/50" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-blue-300 flex items-center gap-1"><Zap className="w-3 h-3"/>{T.stat_energy[l]}</span>
                  <span className="text-white">{player.energy} / {player.maxEnergy}</span>
                </div>
                <Progress value={(player.energy / player.maxEnergy) * 100} className="h-1.5 bg-black/50 [&>div]:bg-blue-500" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-orange-300 flex items-center gap-1"><Tent className="w-3 h-3"/>{T.stat_fatigue[l]}</span>
                  <span className="text-white">{Math.floor(player.fatigue || 0)} / 100</span>
                </div>
                <Progress value={Math.floor(player.fatigue || 0)} className="h-1.5 bg-black/50 [&>div]:bg-orange-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="flex flex-col items-center justify-center p-3 bg-black/30 border border-white/5 rounded">
                <Sword className="w-5 h-5 text-primary mb-1" />
                <span className="text-xs text-muted-foreground uppercase">{T.stat_dmg[l]}</span>
                <span className="text-lg text-white font-bold">{player.stats.baseDamage[0]}-{player.stats.baseDamage[1]}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 bg-black/30 border border-white/5 rounded">
                <Shield className="w-5 h-5 text-primary mb-1" />
                <span className="text-xs text-muted-foreground uppercase">{T.stat_def[l]}</span>
                <span className="text-lg text-white font-bold">{player.stats.baseDefense}</span>
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2 p-3 bg-black/30 border border-white/5 rounded">
                <Weight className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">{T.stat_weight[l]}:</span>
                <span className="text-sm text-white font-bold">{totalWeight.toFixed(1)} / {player.carryCapacity.toFixed(1)}</span>
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2 p-3 bg-black/30 border border-white/5 rounded">
                <MapIcon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">{T.stat_discovered[l]}:</span>
                <span className="text-sm text-white font-bold">{(player.discoveredLocations || ['town_oakhaven']).length}</span>
              </div>
            </div>
          </>
        )}

        {section === 'attributes' && (
          <div className="space-y-3">
            <div className="rounded border border-primary/20 bg-black/35 p-3">
              <h4 className="text-xs uppercase tracking-widest text-primary mb-2">{l === 'ru' ? 'Боевой профиль' : 'Combat Profile'}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p>{l === 'ru' ? 'Базовый урон' : 'Base damage'}: <span className="text-white font-semibold">{player.stats.baseDamage[0]}-{player.stats.baseDamage[1]}</span></p>
                <p>{l === 'ru' ? 'Базовая защита' : 'Base defense'}: <span className="text-white font-semibold">{player.stats.baseDefense}</span></p>
                <p>{l === 'ru' ? 'Макс. HP' : 'Max HP'}: <span className="text-white font-semibold">{player.maxHp}</span></p>
                <p>{l === 'ru' ? 'Макс. энергия' : 'Max energy'}: <span className="text-white font-semibold">{player.maxEnergy}</span></p>
                <p>{l === 'ru' ? 'Грузоподъёмность' : 'Carry capacity'}: <span className="text-white font-semibold">{player.carryCapacity.toFixed(1)}</span></p>
                <p>{l === 'ru' ? 'Золото' : 'Gold'}: <span className="text-white font-semibold">{player.gold}</span></p>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-black/30 p-3">
              <h4 className="text-xs uppercase tracking-widest text-white/90 mb-2">{l === 'ru' ? 'Снаряжение' : 'Equipment'}</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{l === 'ru' ? 'Оружие' : 'Weapon'}</span>
                  <span className="text-white font-semibold">{equippedWeapon?.name?.[l] || (l === 'ru' ? 'Не экипировано' : 'Not equipped')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{l === 'ru' ? 'Броня' : 'Armor'}</span>
                  <span className="text-white font-semibold">{equippedArmor?.name?.[l] || (l === 'ru' ? 'Не экипировано' : 'Not equipped')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === 'skills' && (
          <div className="rounded border border-primary/20 bg-black/35 p-2">
            <SkillsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
