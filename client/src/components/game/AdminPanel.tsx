import { useMemo, useState } from 'react';
import { useGameStore } from '../../game/store';
import { ALL_QUESTS, ENEMIES, ITEMS, LOCATIONS, WEATHER } from '../../game/constants';
import type { GameStateStatus, Quest, WeatherType } from '../../game/types';

type AdminTab = 'player' | 'world' | 'economy' | 'quests' | 'combat';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function addItemToInventory(
  inventory: { itemId: string; quantity: number }[],
  itemId: string,
  quantity: number,
) {
  const amount = Math.max(1, Math.floor(quantity));
  const existing = inventory.find((entry) => entry.itemId === itemId);
  if (existing) {
    return inventory.map((entry) =>
      entry.itemId === itemId ? { ...entry, quantity: entry.quantity + amount } : entry,
    );
  }
  return [...inventory, { itemId, quantity: amount }];
}

export default function AdminPanel() {
  const state = useGameStore();
  const setFogOfWar = useGameStore((s) => s.setFogOfWar);
  const l = state.settings.language;
  const [tab, setTab] = useState<AdminTab>('player');
  const [statusText, setStatusText] = useState<string>('');

  const [playerForm, setPlayerForm] = useState(() => ({
    level: state.player.level,
    xp: state.player.xp,
    xpToNext: state.player.xpToNext,
    skillPoints: state.player.skillPoints,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    energy: state.player.energy,
    maxEnergy: state.player.maxEnergy,
    gold: state.player.gold,
    carryCapacity: state.player.carryCapacity,
  }));
  const [grantItemId, setGrantItemId] = useState<string>(Object.keys(ITEMS)[0] || '');
  const [grantItemQty, setGrantItemQty] = useState<number>(1);

  const [worldForm, setWorldForm] = useState(() => ({
    locationId: state.currentLocationId,
    weather: state.currentWeather as WeatherType,
    weatherDuration: state.weatherDuration,
    day: state.gameTime.day,
    hour: state.gameTime.hour,
  }));

  const hubIds = useMemo(() => Object.keys(state.worldEconomy.hubs), [state.worldEconomy.hubs]);
  const [selectedHubId, setSelectedHubId] = useState<string>(hubIds[0] || state.currentLocationId);
  const selectedHub = state.worldEconomy.hubs[selectedHubId];
  const [hubForm, setHubForm] = useState(() => ({
    level: selectedHub?.level || 1,
    wealth: selectedHub?.wealth || 100,
    stability: selectedHub?.stability || 50,
    supply: selectedHub?.supply || 50,
    demand: selectedHub?.demand || 50,
    playerRelation: selectedHub?.playerRelation || 0,
    treasury: selectedHub?.treasury || 100,
    tradeTurnover: selectedHub?.tradeTurnover || 100,
    marketMode: selectedHub?.marketMode || 'stable',
    destroyed: selectedHub?.destroyed || false,
  }));
  const [eventType, setEventType] = useState<'war' | 'caravan_attack' | 'crisis' | 'prosperity' | 'black_market_opened'>('war');
  const [eventIntensity, setEventIntensity] = useState<number>(50);

  const [newQuestId, setNewQuestId] = useState<string>(Object.keys(ALL_QUESTS)[0] || '');
  const [newQuestMode, setNewQuestMode] = useState<'offered' | 'active'>('offered');
  const [managedQuestId, setManagedQuestId] = useState<string>(state.quests[0]?.id || '');

  const [enemyId, setEnemyId] = useState<string>(Object.keys(ENEMIES)[0] || '');

  const setAndPersist = (recipe: (current: ReturnType<typeof useGameStore.getState>) => Partial<ReturnType<typeof useGameStore.getState>>) => {
    useGameStore.setState((current) => recipe(current as ReturnType<typeof useGameStore.getState>));
    useGameStore.getState().saveGame();
  };

  const refreshHubForm = (hubId: string) => {
    const hub = useGameStore.getState().worldEconomy.hubs[hubId];
    if (!hub) return;
    setHubForm({
      level: hub.level,
      wealth: hub.wealth,
      stability: hub.stability,
      supply: hub.supply,
      demand: hub.demand,
      playerRelation: hub.playerRelation,
      treasury: hub.treasury,
      tradeTurnover: hub.tradeTurnover,
      marketMode: hub.marketMode,
      destroyed: hub.destroyed,
    });
  };

  const onApplyPlayer = () => {
    setAndPersist((current) => {
      const nextMaxHp = Math.max(1, Math.floor(playerForm.maxHp));
      const nextHp = clamp(Math.floor(playerForm.hp), 0, nextMaxHp);
      const nextMaxEnergy = Math.max(1, Math.floor(playerForm.maxEnergy));
      const nextEnergy = clamp(Math.floor(playerForm.energy), 0, nextMaxEnergy);
      return {
        player: {
          ...current.player,
          level: Math.max(1, Math.floor(playerForm.level)),
          xp: Math.max(0, Math.floor(playerForm.xp)),
          xpToNext: Math.max(1, Math.floor(playerForm.xpToNext)),
          skillPoints: Math.max(0, Math.floor(playerForm.skillPoints)),
          hp: nextHp,
          maxHp: nextMaxHp,
          energy: nextEnergy,
          maxEnergy: nextMaxEnergy,
          gold: Math.max(0, Math.floor(playerForm.gold)),
          carryCapacity: Math.max(1, Number(playerForm.carryCapacity)),
        },
      };
    });
    setStatusText(l === 'ru' ? 'Параметры игрока обновлены.' : 'Player stats updated.');
  };

  const onGrantItem = () => {
    if (!grantItemId || !ITEMS[grantItemId]) return;
    setAndPersist((current) => ({
      player: {
        ...current.player,
        inventory: addItemToInventory(current.player.inventory, grantItemId, grantItemQty),
      },
    }));
    setStatusText(l === 'ru' ? 'Предмет добавлен в инвентарь.' : 'Item added to inventory.');
  };

  const onApplyWorld = () => {
    const targetLocation = LOCATIONS[worldForm.locationId];
    if (!targetLocation) return;
    const nextHour = clamp(Math.floor(worldForm.hour), 0, 23);
    const nextDay = Math.max(1, Math.floor(worldForm.day));
    const nextTotal = (nextDay - 1) * 24 + nextHour;
    const nextStatus: GameStateStatus = targetLocation.type === 'hub' ? 'hub' : 'exploring';
    setAndPersist((current) => ({
      currentLocationId: targetLocation.id,
      currentWeather: worldForm.weather,
      weatherDuration: Math.max(0, Math.floor(worldForm.weatherDuration)),
      gameTime: {
        day: nextDay,
        hour: nextHour,
        totalHours: Math.max(0, nextTotal),
      },
      status: nextStatus,
      player: {
        ...current.player,
        discoveredLocations: Array.from(new Set([...(current.player.discoveredLocations || []), targetLocation.id])),
      },
    }));
    setStatusText(l === 'ru' ? 'Мир обновлен (локация/время/погода).' : 'World updated (location/time/weather).');
  };

  const onApplyHub = () => {
    if (!selectedHubId) return;
    setAndPersist((current) => {
      const hub = current.worldEconomy.hubs[selectedHubId];
      if (!hub) return {};
      return {
        worldEconomy: {
          ...current.worldEconomy,
          hubs: {
            ...current.worldEconomy.hubs,
            [selectedHubId]: {
              ...hub,
              level: clamp(Math.floor(hubForm.level), 1, 5),
              wealth: clamp(Math.floor(hubForm.wealth), 0, 5000),
              stability: clamp(Math.floor(hubForm.stability), 0, 100),
              supply: clamp(Math.floor(hubForm.supply), 0, 100),
              demand: clamp(Math.floor(hubForm.demand), 0, 100),
              playerRelation: clamp(Math.floor(hubForm.playerRelation), -100, 100),
              treasury: clamp(Math.floor(hubForm.treasury), 0, 100000),
              tradeTurnover: clamp(Math.floor(hubForm.tradeTurnover), 0, 100000),
              marketMode: hubForm.marketMode as typeof hub.marketMode,
              destroyed: hubForm.destroyed,
              levelUpStreak: 0,
              levelDownStreak: 0,
            },
          },
        },
      };
    });
    setStatusText(l === 'ru' ? 'Экономика хаба обновлена.' : 'Hub economy updated.');
  };

  const onPushEconomyEvent = () => {
    if (!selectedHubId) return;
    setAndPersist((current) => {
      const event = {
        id: `admin_evt_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        tick: current.worldEconomy.tick,
        type: eventType,
        hubId: selectedHubId,
        intensity: clamp(Math.floor(eventIntensity), 1, 100),
      };
      return {
        worldEconomy: {
          ...current.worldEconomy,
          events: [...current.worldEconomy.events, event].slice(-24),
        },
      };
    });
    setStatusText(l === 'ru' ? 'Экономическое событие добавлено.' : 'Economy event appended.');
  };

  const onCreateQuest = () => {
    const template = ALL_QUESTS[newQuestId];
    if (!template) return;
    setAndPersist((current) => {
      if (current.quests.some((q) => q.id === newQuestId && !q.isCompleted)) return {};
      const quest = JSON.parse(JSON.stringify(template)) as Quest;
      quest.offerState = newQuestMode;
      quest.isCompleted = false;
      quest.isTurnInReady = false;
      if (newQuestMode === 'offered') {
        quest.goals = quest.goals.map((goal) => ({ ...goal, currentCount: 0 }));
      }
      return {
        quests: [...current.quests, quest],
      };
    });
    setStatusText(l === 'ru' ? 'Квест добавлен в журнал.' : 'Quest added to journal.');
  };

  const onQuestSetTurnIn = () => {
    if (!managedQuestId) return;
    setAndPersist((current) => ({
      quests: current.quests.map((q) =>
        q.id === managedQuestId ? { ...q, isTurnInReady: true, offerState: 'active' } : q,
      ),
    }));
    setStatusText(l === 'ru' ? 'Квест помечен как готовый к сдаче.' : 'Quest marked turn-in ready.');
  };

  const onQuestComplete = () => {
    if (!managedQuestId) return;
    setAndPersist((current) => ({
      quests: current.quests.map((q) =>
        q.id === managedQuestId
          ? { ...q, isCompleted: true, isTurnInReady: false, offerState: 'resolved' }
          : q,
      ),
    }));
    setStatusText(l === 'ru' ? 'Квест завершен вручную.' : 'Quest completed manually.');
  };

  const onQuestRemove = () => {
    if (!managedQuestId) return;
    setAndPersist((current) => ({
      quests: current.quests.filter((q) => q.id !== managedQuestId),
    }));
    setStatusText(l === 'ru' ? 'Квест удален из журнала.' : 'Quest removed from journal.');
  };

  const onStartDebugCombat = () => {
    const enemyTemplate = ENEMIES[enemyId];
    if (!enemyTemplate) return;
    setAndPersist(() => ({
      status: 'combat',
      currentEnemy: {
        ...enemyTemplate,
        energy: enemyTemplate.maxEnergy,
        isBlocking: false,
        statusEffects: [],
        phaseIndex: 0,
        damageMod: 1,
        defenseMod: 1,
      },
      combatLogs: [
        l === 'ru'
          ? `Админ-режим: бой запущен против ${enemyTemplate.name.ru}.`
          : `Admin mode: combat started against ${enemyTemplate.name.en}.`,
      ],
      isPlayerBlocking: false,
      combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
      combatCombo: 0,
      combatAdrenaline: 0,
    }));
    setStatusText(l === 'ru' ? 'Боевой тест запущен.' : 'Combat debug started.');
  };

  const onStopCombat = () => {
    setAndPersist(() => ({
      status: LOCATIONS[useGameStore.getState().currentLocationId]?.type === 'hub' ? 'hub' : 'exploring',
      currentEnemy: null,
      combatLogs: [],
      isPlayerBlocking: false,
      combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
      combatCombo: 0,
      combatAdrenaline: 0,
    }));
    setStatusText(l === 'ru' ? 'Бой принудительно остановлен.' : 'Combat force-stopped.');
  };

  return (
    <div className="bg-black/30 border border-primary/30 rounded p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-serif text-primary uppercase tracking-wider text-sm">
          {l === 'ru' ? 'Админ-панель' : 'Admin Panel'}
        </h4>
        <p className="text-[11px] text-muted-foreground">
          {l === 'ru' ? 'Изменения сохраняются сразу в сейв.' : 'Changes are persisted to save immediately.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['player', l === 'ru' ? 'Игрок' : 'Player'],
          ['world', l === 'ru' ? 'Мир' : 'World'],
          ['economy', l === 'ru' ? 'Экономика' : 'Economy'],
          ['quests', l === 'ru' ? 'Квесты' : 'Quests'],
          ['combat', l === 'ru' ? 'Бой' : 'Combat'],
        ] as Array<[AdminTab, string]>).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded text-[10px] uppercase tracking-wider border transition-colors ${
              tab === id
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-black/35 text-muted-foreground border-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'player' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {([
              ['level', playerForm.level],
              ['xp', playerForm.xp],
              ['xpToNext', playerForm.xpToNext],
              ['skillPoints', playerForm.skillPoints],
              ['hp', playerForm.hp],
              ['maxHp', playerForm.maxHp],
              ['energy', playerForm.energy],
              ['maxEnergy', playerForm.maxEnergy],
              ['gold', playerForm.gold],
            ] as const).map(([key, value]) => (
              <label key={key} className="text-xs text-muted-foreground space-y-1">
                <span>{key}</span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setPlayerForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
                />
              </label>
            ))}
            <label className="text-xs text-muted-foreground space-y-1 col-span-2">
              <span>carryCapacity</span>
              <input
                type="number"
                step="0.5"
                value={playerForm.carryCapacity}
                onChange={(e) => setPlayerForm((prev) => ({ ...prev, carryCapacity: Number(e.target.value) }))}
                className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              />
            </label>
          </div>
          <button onClick={onApplyPlayer} className="rpg-button px-4 py-2 text-xs">
            {l === 'ru' ? 'Применить статы игрока' : 'Apply player stats'}
          </button>

          <div className="rounded border border-white/10 bg-black/30 p-3 space-y-2">
            <p className="text-xs text-primary uppercase tracking-wider">{l === 'ru' ? 'Выдать предмет' : 'Grant item'}</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2">
              <select
                value={grantItemId}
                onChange={(e) => setGrantItemId(e.target.value)}
                className="rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              >
                {Object.values(ITEMS).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name[l]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={grantItemQty}
                onChange={(e) => setGrantItemQty(Number(e.target.value))}
                className="rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              />
              <button onClick={onGrantItem} className="rpg-button px-3 py-1.5 text-xs">
                {l === 'ru' ? 'Выдать' : 'Grant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'world' && (
        <div className="space-y-3">
          <div className="rounded border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-2">
            <p className="text-xs text-primary uppercase tracking-wider">
              {l === 'ru' ? 'Туман войны' : 'Fog of War'}
            </p>
            <button
              onClick={() => {
                setFogOfWar(!state.settings.world.fogOfWar);
                setStatusText(
                  state.settings.world.fogOfWar
                    ? (l === 'ru' ? 'Туман войны выключен.' : 'Fog of war disabled.')
                    : (l === 'ru' ? 'Туман войны включен.' : 'Fog of war enabled.'),
                );
              }}
              className={`px-3 py-1.5 rounded border text-xs uppercase tracking-wider ${
                state.settings.world.fogOfWar
                  ? 'border-primary/40 text-primary bg-primary/15'
                  : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
              }`}
            >
              {state.settings.world.fogOfWar ? (l === 'ru' ? 'Вкл' : 'On') : (l === 'ru' ? 'Выкл' : 'Off')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground space-y-1">
              <span>{l === 'ru' ? 'Локация' : 'Location'}</span>
              <select
                value={worldForm.locationId}
                onChange={(e) => setWorldForm((prev) => ({ ...prev, locationId: e.target.value }))}
                className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              >
                {Object.values(LOCATIONS).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name[l]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>{l === 'ru' ? 'Погода' : 'Weather'}</span>
              <select
                value={worldForm.weather}
                onChange={(e) => setWorldForm((prev) => ({ ...prev, weather: e.target.value as WeatherType }))}
                className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              >
                {Object.values(WEATHER).map((wx) => (
                  <option key={wx.id} value={wx.id}>
                    {wx.name[l]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>{l === 'ru' ? 'День' : 'Day'}</span>
              <input
                type="number"
                min={1}
                value={worldForm.day}
                onChange={(e) => setWorldForm((prev) => ({ ...prev, day: Number(e.target.value) }))}
                className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              />
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>{l === 'ru' ? 'Час (0-23)' : 'Hour (0-23)'}</span>
              <input
                type="number"
                min={0}
                max={23}
                value={worldForm.hour}
                onChange={(e) => setWorldForm((prev) => ({ ...prev, hour: Number(e.target.value) }))}
                className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              />
            </label>
            <label className="text-xs text-muted-foreground space-y-1 md:col-span-2">
              <span>{l === 'ru' ? 'Длительность погоды (часы)' : 'Weather duration (hours)'}</span>
              <input
                type="number"
                min={0}
                value={worldForm.weatherDuration}
                onChange={(e) => setWorldForm((prev) => ({ ...prev, weatherDuration: Number(e.target.value) }))}
                className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              />
            </label>
          </div>
          <button onClick={onApplyWorld} className="rpg-button px-4 py-2 text-xs">
            {l === 'ru' ? 'Применить мир' : 'Apply world settings'}
          </button>
        </div>
      )}

      {tab === 'economy' && (
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground space-y-1 block">
            <span>{l === 'ru' ? 'Хаб' : 'Hub'}</span>
            <select
              value={selectedHubId}
              onChange={(e) => {
                setSelectedHubId(e.target.value);
                refreshHubForm(e.target.value);
              }}
              className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
            >
              {hubIds.map((hubId) => (
                <option key={hubId} value={hubId}>
                  {LOCATIONS[hubId]?.name?.[l] || hubId}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            {([
              ['level', hubForm.level],
              ['wealth', hubForm.wealth],
              ['stability', hubForm.stability],
              ['supply', hubForm.supply],
              ['demand', hubForm.demand],
              ['playerRelation', hubForm.playerRelation],
              ['treasury', hubForm.treasury],
              ['tradeTurnover', hubForm.tradeTurnover],
            ] as const).map(([key, value]) => (
              <label key={key} className="text-xs text-muted-foreground space-y-1">
                <span>{key}</span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setHubForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
                />
              </label>
            ))}
            <label className="text-xs text-muted-foreground space-y-1">
              <span>marketMode</span>
              <select
                value={hubForm.marketMode}
                onChange={(e) =>
                  setHubForm((prev) => ({
                    ...prev,
                    marketMode: e.target.value as 'stable' | 'scarcity' | 'surplus' | 'black_market',
                  }))}
                className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              >
                <option value="stable">stable</option>
                <option value="scarcity">scarcity</option>
                <option value="surplus">surplus</option>
                <option value="black_market">black_market</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>destroyed</span>
              <button
                onClick={() => setHubForm((prev) => ({ ...prev, destroyed: !prev.destroyed }))}
                className={`w-full rounded border px-2 py-1.5 text-xs ${
                  hubForm.destroyed
                    ? 'border-destructive/40 text-destructive bg-destructive/10'
                    : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                }`}
              >
                {hubForm.destroyed ? 'true' : 'false'}
              </button>
            </label>
          </div>

          <button onClick={onApplyHub} className="rpg-button px-4 py-2 text-xs">
            {l === 'ru' ? 'Применить параметры хаба' : 'Apply hub parameters'}
          </button>

          <div className="rounded border border-white/10 bg-black/30 p-3 space-y-2">
            <p className="text-xs text-primary uppercase tracking-wider">{l === 'ru' ? 'Ручное событие' : 'Manual economy event'}</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2">
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as typeof eventType)}
                className="rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              >
                <option value="war">war</option>
                <option value="caravan_attack">caravan_attack</option>
                <option value="crisis">crisis</option>
                <option value="prosperity">prosperity</option>
                <option value="black_market_opened">black_market_opened</option>
              </select>
              <input
                type="number"
                min={1}
                max={100}
                value={eventIntensity}
                onChange={(e) => setEventIntensity(Number(e.target.value))}
                className="rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
              />
              <button onClick={onPushEconomyEvent} className="rpg-button px-3 py-1.5 text-xs">
                {l === 'ru' ? 'Добавить' : 'Push'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'quests' && (
        <div className="space-y-3">
          <div className="rounded border border-white/10 bg-black/30 p-3 space-y-2">
            <p className="text-xs text-primary uppercase tracking-wider">{l === 'ru' ? 'Добавить квест' : 'Add quest'}</p>
            <select
              value={newQuestId}
              onChange={(e) => setNewQuestId(e.target.value)}
              className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
            >
              {Object.values(ALL_QUESTS).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name[l]}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setNewQuestMode('offered')}
                className={`px-3 py-1.5 rounded border text-xs ${newQuestMode === 'offered' ? 'border-primary/40 text-primary bg-primary/15' : 'border-white/10 text-muted-foreground'}`}
              >
                offered
              </button>
              <button
                onClick={() => setNewQuestMode('active')}
                className={`px-3 py-1.5 rounded border text-xs ${newQuestMode === 'active' ? 'border-primary/40 text-primary bg-primary/15' : 'border-white/10 text-muted-foreground'}`}
              >
                active
              </button>
            </div>
            <button onClick={onCreateQuest} className="rpg-button px-4 py-2 text-xs">
              {l === 'ru' ? 'Добавить в журнал' : 'Add to journal'}
            </button>
          </div>

          <div className="rounded border border-white/10 bg-black/30 p-3 space-y-2">
            <p className="text-xs text-primary uppercase tracking-wider">{l === 'ru' ? 'Управление квестом' : 'Manage quest'}</p>
            <select
              value={managedQuestId}
              onChange={(e) => setManagedQuestId(e.target.value)}
              className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
            >
              {state.quests.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name[l]} [{q.offerState || 'active'}]{q.isCompleted ? ' (done)' : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-2 flex-wrap">
              <button onClick={onQuestSetTurnIn} className="rpg-button px-3 py-1.5 text-xs">
                {l === 'ru' ? 'Готов к сдаче' : 'Turn-in ready'}
              </button>
              <button onClick={onQuestComplete} className="rpg-button px-3 py-1.5 text-xs">
                {l === 'ru' ? 'Завершить' : 'Complete'}
              </button>
              <button onClick={onQuestRemove} className="rpg-button px-3 py-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                {l === 'ru' ? 'Удалить' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'combat' && (
        <div className="space-y-3">
          <select
            value={enemyId}
            onChange={(e) => setEnemyId(e.target.value)}
            className="w-full rounded border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-white"
          >
            {Object.values(ENEMIES).map((enemy) => (
              <option key={enemy.id} value={enemy.id}>
                {enemy.name[l]} (lvl {enemy.level})
              </option>
            ))}
          </select>
          <div className="flex gap-2 flex-wrap">
            <button onClick={onStartDebugCombat} className="rpg-button px-4 py-2 text-xs">
              {l === 'ru' ? 'Старт боя' : 'Start combat'}
            </button>
            <button onClick={onStopCombat} className="rpg-button px-4 py-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
              {l === 'ru' ? 'Остановить бой' : 'Stop combat'}
            </button>
          </div>
        </div>
      )}

      {statusText && <p className="text-xs text-primary/85">{statusText}</p>}

      <div className="pt-1">
        <a
          href="/admin"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded border border-primary/35 px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
        >
          {l === 'ru' ? 'Открыть admin-страницу' : 'Open admin page'}
        </a>
      </div>
    </div>
  );
}
