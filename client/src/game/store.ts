import { create } from 'zustand';
import { Player, Quest, GameStateStatus, SaveData, Enemy, Language, WeatherType, DamageType, StatusEffectInstance, StatusEffectType, GameSettings, VoiceChannel, CodexUnlocks, WorldEconomyEvent, WorldEconomyState } from './types';
import { INITIAL_QUESTS, LOCATIONS, ENEMIES, ITEMS, ALL_QUESTS, WEATHER, SKILLS, RECIPES, CLASSES, MERCHANTS } from './constants';
import { getTelegramUserId } from '@/lib/telegram';

type CombatTarget = 'self' | 'enemy';
export interface CharacterCreationBonuses {
  maxHp?: number;
  maxEnergy?: number;
  baseDamageMin?: number;
  baseDamageMax?: number;
  baseDefense?: number;
  carryCapacity?: number;
  gold?: number;
  skillPoints?: number;
}

type CombatEnemy = Enemy & {
  energy: number;
  isBlocking: boolean;
  statusEffects: StatusEffectInstance[];
  phaseIndex: number;
  damageMod: number;
  defenseMod: number;
};

interface GameState {
  player: Player;
  currentLocationId: string;
  currentWeather: WeatherType;
  weatherDuration: number;
  quests: Quest[];
  codexUnlocks: CodexUnlocks;
  worldEconomy: WorldEconomyState;
  status: GameStateStatus;
  settings: GameSettings;

  currentEnemy: CombatEnemy | null;
  combatLogs: string[];
  isPlayerBlocking: boolean;
  combatStyle: { attack: number; block: number; item: number; skill: number };
  combatCombo: number;
  combatAdrenaline: number;

  loadSave: () => void;
  saveGame: () => void;
  resetGame: () => void;
  setLanguage: (lang: Language) => void;
  setVoiceSetting: (channel: VoiceChannel, enabled: boolean) => void;
  setTutorialEnabled: (enabled: boolean) => void;
  advanceTutorialStep: () => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
  markTutorialHintSeen: (hintId: string) => void;
  chooseClass: (classId: string, bonuses?: CharacterCreationBonuses, heroName?: string) => void;
  travelTo: (locationId: string) => void;
  explore: () => void;
  rest: () => void;
  camp: () => void;
  breakCamp: () => void;
  acceptQuest: (questId: string, npcId?: string) => void;
  chooseEventQuestBranch: (questId: string, branch: 'support' | 'punish' | 'support_a' | 'support_b' | 'neutral') => void;
  turnInQuest: (questId: string, npcId?: string) => void;
  unlockCodexEntry: (section: keyof CodexUnlocks, id: string) => void;
  raidCaravan: (hubId: string) => void;
  investInHub: (hubId: string, goldAmount: number) => void;
  runDiplomacy: (hubId: string) => void;
  sabotageHub: (hubId: string) => void;

  attack: () => void;
  block: () => void;
  useSkill: (skillId: string) => void;
  useCombatItem: (itemId: string, target: CombatTarget) => void;
  useItem: (itemId: string) => void;
  useSecondWind: () => void;
  flee: () => void;
  endCombat: () => void;

  buyItem: (itemId: string, price: number) => void;
  sellItem: (itemId: string, price: number) => void;
  getBuyPrice: (merchantId: string, itemId: string, basePrice: number) => number;
  getSellPrice: (merchantId: string, itemId: string, basePrice: number) => number;
  equipItem: (itemId: string, slot: 'weapon' | 'armor') => void;
  learnRecipe: (itemId: string) => void;
  craftItem: (recipeId: string) => void;
  learnSkill: (skillId: string) => void;
  tickWeather: () => void;
}

const STARTING_PLAYER: Player = {
  name: 'Traveler',
  classId: null,
  specializationId: 'duelist',
  prestigeLevel: 0,
  questPerks: [],
  level: 1,
  xp: 0,
  xpToNext: 100,
  skillPoints: 0,
  learnedSkills: {},
  cooldowns: {},
  knownRecipes: [],
  merchantReputation: { merchant_oakhaven: 0 },
  backpackSlots: { potion: 12, material: 24 },
  statusEffects: [],
  hp: 50,
  maxHp: 50,
  energy: 60,
  maxEnergy: 60,
  fatigue: 0,
  discoveredLocations: ['town_oakhaven'],
  carryCapacity: 35,
  gold: 25,
  inventory: [],
  equipment: {},
  stats: { baseDamage: [1, 3], baseDefense: 0 },
};

const SAVE_KEY = 'eternal_quest_save';
const DEFAULT_SETTINGS: GameSettings = {
  language: 'en',
  voice: {
    lore: true,
    quests: true,
    npcDialogue: true,
  },
  tutorial: {
    enabled: true,
    completed: false,
    step: 0,
    seenHints: [],
  },
};
const DEFAULT_CODEX_UNLOCKS: CodexUnlocks = {
  items: [],
  locations: ['town_oakhaven'],
  npcs: [],
  enemies: [],
};
const HUB_LEVEL_THRESHOLDS = [0, 140, 320, 560, 860, 1120] as const;
const LEVEL_UP_STREAK_REQUIRED = 3;
const LEVEL_DOWN_STREAK_REQUIRED = 2;
const DESTRUCTION_WEALTH_THRESHOLD = 40;
const DESTRUCTION_STREAK_REQUIRED = 4;
const ECONOMY_EVENT_LIMIT = 16;
const ENERGY_COSTS = { attack: 15, flee: 20, item: 10, throw: 12 };
const COMBO_MAX = 5;
const ADRENALINE_MAX = 100;
const SECOND_WIND_COST = 50;
const FATIGUE_MAX = 100;
const HUB_BLUEPRINTS = [
  {
    id: 'hub_emberwatch',
    connectTo: 'road_south',
    location: {
      id: 'hub_emberwatch',
      name: { en: 'Emberwatch', ru: 'Эмбервотч' },
      description: {
        en: 'A fortified caravan bastion raised from ash roads.',
        ru: 'Укреплённый караванный бастион, поднятый на пепельных дорогах.',
      },
      type: 'hub',
      image: '/images/town-hub.png',
      connectedLocations: ['road_south'],
      npcs: [],
      craftingStations: ['campfire'],
      merchantPriceMod: 1.07,
      allowedWeather: ['clear', 'rain', 'fog'],
    },
    merchant: {
      id: 'merchant_emberwatch',
      name: { en: 'Quartermaster Rook', ru: 'Квартирмейстер Рук' },
      locationId: 'hub_emberwatch',
      inventory: [
        { itemId: 'potion_small', price: 16 },
        { itemId: 'potion_energy', price: 38 },
        { itemId: 'iron_ore', price: 24 },
        { itemId: 'hard_wood', price: 20 },
      ],
    },
  },
] as const;

function uniqueIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((x): x is string => typeof x === 'string' && x.length > 0)));
}

function normalizeCodexUnlocks(input: unknown, player: Player): CodexUnlocks {
  const discoveredLocations = uniqueIds(player.discoveredLocations).length > 0
    ? uniqueIds(player.discoveredLocations)
    : ['town_oakhaven'];
  const raw = (input || {}) as Partial<CodexUnlocks>;
  return {
    items: uniqueIds(raw.items),
    locations: Array.from(new Set([...DEFAULT_CODEX_UNLOCKS.locations, ...discoveredLocations, ...uniqueIds(raw.locations)])),
    npcs: uniqueIds(raw.npcs),
    enemies: uniqueIds(raw.enemies),
  };
}

function unlockCodex(codex: CodexUnlocks, section: keyof CodexUnlocks, id: string): CodexUnlocks {
  if (!id) return codex;
  if (codex[section].includes(id)) return codex;
  return { ...codex, [section]: [...codex[section], id] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function appendEconomyEvent(
  worldEconomy: WorldEconomyState,
  event: Omit<WorldEconomyEvent, 'id' | 'tick'> & { tick?: number },
): WorldEconomyState {
  const tick = event.tick ?? worldEconomy.tick;
  const nextEvent: WorldEconomyEvent = {
    id: `${event.type}_${event.hubId}_${tick}_${Math.floor(Math.random() * 100000)}`,
    tick,
    ...event,
  };
  const events = [...(worldEconomy.events || []), nextEvent].slice(-ECONOMY_EVENT_LIMIT);
  return { ...worldEconomy, events };
}

function resolveHubLevel(wealth: number): number {
  let level = 0;
  for (let i = 0; i < HUB_LEVEL_THRESHOLDS.length; i += 1) {
    if (wealth >= HUB_LEVEL_THRESHOLDS[i]) level = i;
  }
  return level;
}

function resolveHubKind(hubId: string): "faction" | "alliance" | "community" {
  if (hubId === 'town_oakhaven') return 'faction';
  if (hubId.startsWith('hub_')) return 'alliance';
  return 'community';
}

function findLocationDistance(fromId: string, toId: string): number | null {
  if (fromId === toId) return 0;
  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; dist: number }> = [{ id: fromId, dist: 0 }];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    const loc = LOCATIONS[next.id];
    if (!loc) continue;
    for (const neighbor of loc.connectedLocations || []) {
      if (visited.has(neighbor)) continue;
      if (neighbor === toId) return next.dist + 1;
      visited.add(neighbor);
      queue.push({ id: neighbor, dist: next.dist + 1 });
    }
  }
  return null;
}

function ensureBidirectionalConnection(a: string, b: string) {
  const from = LOCATIONS[a];
  const to = LOCATIONS[b];
  if (!from || !to) return;
  if (!from.connectedLocations.includes(b)) from.connectedLocations.push(b);
  if (!to.connectedLocations.includes(a)) to.connectedLocations.push(a);
}

function injectHubBlueprint(hubId: string) {
  const blueprint = HUB_BLUEPRINTS.find((b) => b.id === hubId);
  if (!blueprint) return;
  if (!LOCATIONS[hubId]) {
    (LOCATIONS as Record<string, any>)[hubId] = {
      ...blueprint.location,
      connectedLocations: [...blueprint.location.connectedLocations],
    };
  }
  ensureBidirectionalConnection(blueprint.connectTo, hubId);
  if (!MERCHANTS[blueprint.merchant.id]) {
    (MERCHANTS as Record<string, any>)[blueprint.merchant.id] = JSON.parse(JSON.stringify(blueprint.merchant));
  }
}

function applySpawnedHubBlueprints(spawnedHubIds: string[]) {
  spawnedHubIds.forEach((hubId) => injectHubBlueprint(hubId));
}

function buildDefaultTradeRoutes(hubIds: string[]) {
  const routes: WorldEconomyState['tradeRoutes'] = {};
  for (let i = 0; i < hubIds.length; i += 1) {
    for (let j = i + 1; j < hubIds.length; j += 1) {
      const fromHubId = hubIds[i];
      const toHubId = hubIds[j];
      const distance = findLocationDistance(fromHubId, toHubId);
      if (distance === null) continue;
      const id = `${fromHubId}__${toHubId}`;
      routes[id] = {
        id,
        fromHubId,
        toHubId,
        distance,
        flow: clamp(68 - distance * 8, 18, 85),
        risk: clamp(18 + distance * 7, 8, 88),
      };
    }
  }
  return routes;
}

function buildDefaultHubRelations(hubIds: string[]) {
  const relations: WorldEconomyState['hubRelations'] = {};
  for (let i = 0; i < hubIds.length; i += 1) {
    for (let j = i + 1; j < hubIds.length; j += 1) {
      const a = hubIds[i];
      const b = hubIds[j];
      const id = `${a}__${b}`;
      relations[id] = {
        hubAId: a,
        hubBId: b,
        status: 'neutral',
        strength: 0,
      };
    }
  }
  return relations;
}

function rebuildTradeRoutes(worldEconomy: WorldEconomyState): WorldEconomyState {
  const hubIds = Object.keys(worldEconomy.hubs);
  const baseRoutes = buildDefaultTradeRoutes(hubIds);
  const tradeRoutes = Object.entries(baseRoutes).reduce<WorldEconomyState['tradeRoutes']>((acc, [routeId, route]) => {
    const prev = worldEconomy.tradeRoutes[routeId];
    acc[routeId] = prev
      ? { ...route, flow: prev.flow, risk: prev.risk }
      : route;
    return acc;
  }, {});
  const baseRelations = buildDefaultHubRelations(hubIds);
  const hubRelations = Object.entries(baseRelations).reduce<WorldEconomyState['hubRelations']>((acc, [key, rel]) => {
    const prev = worldEconomy.hubRelations[key];
    acc[key] = prev ? { ...rel, status: prev.status, strength: prev.strength } : rel;
    return acc;
  }, {});
  return { ...worldEconomy, tradeRoutes, hubRelations };
}

function hubRelationKey(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function updateHubRelation(
  worldEconomy: WorldEconomyState,
  hubAId: string,
  hubBId: string,
  deltaStrength: number,
): WorldEconomyState {
  const key = hubRelationKey(hubAId, hubBId);
  const current = worldEconomy.hubRelations[key];
  if (!current) return worldEconomy;
  const strength = clamp(current.strength + deltaStrength, -100, 100);
  const status = strength >= 35 ? 'allied' : strength <= -35 ? 'conflict' : 'neutral';
  return {
    ...worldEconomy,
    hubRelations: {
      ...worldEconomy.hubRelations,
      [key]: { ...current, strength, status },
    },
  };
}

function expandHubsIfEligible(seed: WorldEconomyState) {
  const nextBlueprint = HUB_BLUEPRINTS.find((bp) => !seed.spawnedHubIds.includes(bp.id));
  if (!nextBlueprint) return { worldEconomy: seed, spawnedHubId: null as string | null };
  const hasLevelFiveHub = Object.values(seed.hubs).some((hub) => hub.level >= 5);
  if (!hasLevelFiveHub) return { worldEconomy: seed, spawnedHubId: null as string | null };

  injectHubBlueprint(nextBlueprint.id);
  const nextHub = {
    hubId: nextBlueprint.id,
    hubKind: resolveHubKind(nextBlueprint.id),
    wealth: 210,
    level: resolveHubLevel(210),
    treasury: 130,
    tradeTurnover: 75,
    resources: { food: 40, wood: 44, ore: 28, craft: 36 },
    supply: 50,
    demand: 46,
    stability: 58,
    playerRelation: 0,
    levelUpStreak: 0,
    levelDownStreak: 0,
    degradationStreak: 0,
    destroyed: false,
    marketMode: 'stable' as const,
    blackMarketUntilTick: undefined,
  };
  const expanded: WorldEconomyState = {
    ...seed,
    hubs: {
      ...seed.hubs,
      [nextBlueprint.id]: nextHub,
    },
    spawnedHubIds: [...seed.spawnedHubIds, nextBlueprint.id],
  };
  const rebuilt = rebuildTradeRoutes(expanded);
  const withEvent = appendEconomyEvent(rebuilt, {
    type: 'hub_founded',
    hubId: nextBlueprint.id,
    intensity: 85,
    tick: seed.tick + 1,
  });
  return { worldEconomy: withEvent, spawnedHubId: nextBlueprint.id };
}

function createDefaultWorldEconomy(): WorldEconomyState {
  const hubLocations = Object.values(LOCATIONS)
    .filter((loc) => loc.type === 'hub')
  const hubs = hubLocations.reduce<WorldEconomyState['hubs']>((acc, hub) => {
      acc[hub.id] = {
        hubId: hub.id,
        hubKind: resolveHubKind(hub.id),
        wealth: 180,
        level: 1,
        treasury: 120,
        tradeTurnover: 80,
        resources: { food: 45, wood: 40, ore: 30, craft: 35 },
        supply: 52,
        demand: 48,
        stability: 62,
        playerRelation: 0,
        levelUpStreak: 0,
        levelDownStreak: 0,
        degradationStreak: 0,
        destroyed: false,
        marketMode: 'stable',
      };
      return acc;
    }, {});
  const hubIds = hubLocations.map((h) => h.id);
  return {
    tick: 0,
    hubs,
    tradeRoutes: buildDefaultTradeRoutes(hubIds),
    hubRelations: buildDefaultHubRelations(hubIds),
    spawnedHubIds: [],
    events: [],
  };
}

function normalizeWorldEconomy(input: unknown): WorldEconomyState {
  const raw = (input || {}) as Partial<WorldEconomyState>;
  const spawnedHubIds = uniqueIds(raw.spawnedHubIds);
  applySpawnedHubBlueprints(spawnedHubIds);
  const defaults = createDefaultWorldEconomy();
  const rawHubs = (raw.hubs || {}) as Record<string, any>;
  const rawRoutes = (raw.tradeRoutes || {}) as Record<string, any>;
  const rawRelations = (raw.hubRelations || {}) as Record<string, any>;
  const rawEvents = Array.isArray(raw.events) ? raw.events : [];
  const hubs = Object.entries(defaults.hubs).reduce<WorldEconomyState['hubs']>((acc, [hubId, fallback]) => {
    const src = rawHubs[hubId] || {};
    const wealth = Number.isFinite(src.wealth) ? Number(src.wealth) : fallback.wealth;
    const supply = Number.isFinite(src.supply) ? Number(src.supply) : fallback.supply;
    const demand = Number.isFinite(src.demand) ? Number(src.demand) : fallback.demand;
    const stability = Number.isFinite(src.stability) ? Number(src.stability) : fallback.stability;
    const playerRelation = Number.isFinite(src.playerRelation) ? Number(src.playerRelation) : fallback.playerRelation;
    const treasury = Number.isFinite(src.treasury) ? Number(src.treasury) : fallback.treasury;
    const tradeTurnover = Number.isFinite(src.tradeTurnover) ? Number(src.tradeTurnover) : fallback.tradeTurnover;
    const levelUpStreak = Number.isFinite(src.levelUpStreak) ? Number(src.levelUpStreak) : fallback.levelUpStreak;
    const levelDownStreak = Number.isFinite(src.levelDownStreak) ? Number(src.levelDownStreak) : fallback.levelDownStreak;
    const degradationStreak = Number.isFinite(src.degradationStreak) ? Number(src.degradationStreak) : fallback.degradationStreak;
    const destroyed = src.destroyed === true;
    const blackMarketUntilTick = Number.isFinite(src.blackMarketUntilTick) ? Number(src.blackMarketUntilTick) : undefined;
    const rawMode = typeof src.marketMode === 'string' ? src.marketMode : fallback.marketMode;
    const marketMode =
      rawMode === 'scarcity' || rawMode === 'surplus' || rawMode === 'black_market'
        ? rawMode
        : 'stable';
    acc[hubId] = {
      hubId,
      hubKind: src.hubKind === 'faction' || src.hubKind === 'alliance' ? src.hubKind : fallback.hubKind,
      wealth: clamp(Math.floor(wealth), 0, 1200),
      level: resolveHubLevel(wealth),
      treasury: clamp(Math.floor(treasury), 0, 5000),
      tradeTurnover: clamp(Math.floor(tradeTurnover), 0, 5000),
      resources: {
        food: clamp(Math.floor(Number(src?.resources?.food ?? fallback.resources.food)), 0, 200),
        wood: clamp(Math.floor(Number(src?.resources?.wood ?? fallback.resources.wood)), 0, 200),
        ore: clamp(Math.floor(Number(src?.resources?.ore ?? fallback.resources.ore)), 0, 200),
        craft: clamp(Math.floor(Number(src?.resources?.craft ?? fallback.resources.craft)), 0, 200),
      },
      supply: clamp(Math.floor(supply), 0, 100),
      demand: clamp(Math.floor(demand), 0, 100),
      stability: clamp(Math.floor(stability), 0, 100),
      playerRelation: clamp(Math.floor(playerRelation), -100, 100),
      levelUpStreak: clamp(Math.floor(levelUpStreak), 0, 10),
      levelDownStreak: clamp(Math.floor(levelDownStreak), 0, 10),
      degradationStreak: clamp(Math.floor(degradationStreak), 0, 20),
      destroyed,
      marketMode,
      blackMarketUntilTick: blackMarketUntilTick === undefined ? undefined : Math.max(0, Math.floor(blackMarketUntilTick)),
    };
    return acc;
  }, {});
  const tradeRoutes = Object.entries(defaults.tradeRoutes).reduce<WorldEconomyState['tradeRoutes']>((acc, [routeId, fallback]) => {
    const src = rawRoutes[routeId] || {};
    const flow = Number.isFinite(src.flow) ? Number(src.flow) : fallback.flow;
    const risk = Number.isFinite(src.risk) ? Number(src.risk) : fallback.risk;
    const distance = Number.isFinite(src.distance) ? Number(src.distance) : fallback.distance;
    acc[routeId] = {
      id: routeId,
      fromHubId: fallback.fromHubId,
      toHubId: fallback.toHubId,
      distance: clamp(Math.floor(distance), 1, 24),
      flow: clamp(Math.floor(flow), 0, 100),
      risk: clamp(Math.floor(risk), 0, 100),
    };
    return acc;
  }, {});
  const hubRelations = Object.entries(defaults.hubRelations).reduce<WorldEconomyState['hubRelations']>((acc, [relationId, fallback]) => {
    const src = rawRelations[relationId] || {};
    const status = src.status === 'allied' || src.status === 'conflict' ? src.status : 'neutral';
    const strength = Number.isFinite(src.strength) ? Number(src.strength) : fallback.strength;
    acc[relationId] = {
      ...fallback,
      status,
      strength: clamp(Math.floor(strength), -100, 100),
    };
    return acc;
  }, {});
  return {
    tick: Number.isFinite(raw.tick) ? Math.max(0, Math.floor(Number(raw.tick))) : 0,
    hubs,
    tradeRoutes,
    hubRelations,
    spawnedHubIds,
    events: rawEvents
      .map((src, idx): WorldEconomyEvent | null => {
        if (!src || typeof src !== 'object') return null;
        const eventSrc = src as Record<string, any>;
        const eventType = typeof eventSrc.type === 'string' ? eventSrc.type : '';
        const isValidType =
          eventType === 'war'
          || eventType === 'caravan_attack'
          || eventType === 'crisis'
          || eventType === 'prosperity'
          || eventType === 'black_market_opened'
          || eventType === 'hub_destroyed'
          || eventType === 'hub_founded'
          || eventType === 'player_raid'
          || eventType === 'player_investment'
          || eventType === 'player_diplomacy'
          || eventType === 'player_sabotage';
        if (!isValidType) return null;
        const hubId = typeof eventSrc.hubId === 'string' ? eventSrc.hubId : '';
        if (!hubId) return null;
        const tick = Number.isFinite(eventSrc.tick) ? Math.max(0, Math.floor(Number(eventSrc.tick))) : 0;
        return {
          id: typeof eventSrc.id === 'string' && eventSrc.id.length > 0 ? eventSrc.id : `${eventType}_${hubId}_${tick}_${idx}`,
          tick,
          type: eventType,
          hubId,
          targetHubId: typeof eventSrc.targetHubId === 'string' && eventSrc.targetHubId.length > 0 ? eventSrc.targetHubId : undefined,
          intensity: clamp(Number.isFinite(eventSrc.intensity) ? Math.floor(Number(eventSrc.intensity)) : 1, 1, 100),
        };
      })
      .filter((event): event is WorldEconomyEvent => Boolean(event))
      .slice(-ECONOMY_EVENT_LIMIT),
  };
}

function simulateWorldEconomyTick(seed: WorldEconomyState, currentWeather: WeatherType): WorldEconomyState {
  const nextTick = seed.tick + 1;
  const events = [...(seed.events || [])].slice(-(ECONOMY_EVENT_LIMIT - 6));
  let hubs = Object.entries(seed.hubs).reduce<WorldEconomyState['hubs']>((acc, [hubId, hub]) => {
    if (hub.destroyed) {
      acc[hubId] = {
        ...hub,
        supply: 0,
        demand: 0,
        marketMode: 'scarcity',
      };
      return acc;
    }

    const weatherDemand = currentWeather === 'storm' ? 4 : currentWeather === 'snow' ? 3 : currentWeather === 'rain' ? 2 : 0;
    const weatherSupply = currentWeather === 'storm' ? -3 : currentWeather === 'snow' ? -2 : currentWeather === 'rain' ? -1 : 0;
    const supply = clamp(hub.supply + weatherSupply + (Math.floor(Math.random() * 7) - 3), 0, 100);
    const demand = clamp(hub.demand + weatherDemand + (Math.floor(Math.random() * 7) - 3), 0, 100);
    const pressure = demand - supply;
    const wealthDrift = Math.floor((supply - demand) * 0.45 + hub.stability * 0.06 + hub.playerRelation * 0.08 + hub.tradeTurnover * 0.012 + (Math.random() * 7 - 3));
    const wealth = clamp(hub.wealth + wealthDrift, 0, 1200);
    const stability = clamp(hub.stability + (pressure > 18 ? -2 : pressure < -12 ? 1 : 0) + (Math.random() < 0.2 ? -1 : 0), 0, 100);
    const treasury = clamp(hub.treasury + Math.floor(wealthDrift * 0.45) + Math.floor(Math.random() * 7) - 3, 0, 5000);
    const tradeTurnover = clamp(hub.tradeTurnover + Math.floor((supply + demand - 100) * 0.35) + (Math.floor(Math.random() * 5) - 2), 0, 5000);
    const resources = {
      food: clamp(hub.resources.food + Math.floor((supply - demand) * 0.12), 0, 200),
      wood: clamp(hub.resources.wood + Math.floor((supply - demand) * 0.08), 0, 200),
      ore: clamp(hub.resources.ore + Math.floor((hub.level - 2) * 0.4), 0, 200),
      craft: clamp(hub.resources.craft + Math.floor((tradeTurnover / 250) - 1), 0, 200),
    };

    const targetLevel = resolveHubLevel(wealth);
    let level = hub.level;
    let levelUpStreak = hub.levelUpStreak;
    let levelDownStreak = hub.levelDownStreak;
    if (targetLevel > hub.level) {
      levelUpStreak += 1;
      levelDownStreak = 0;
      if (levelUpStreak >= LEVEL_UP_STREAK_REQUIRED) {
        level = targetLevel;
        levelUpStreak = 0;
      }
    } else if (targetLevel < hub.level) {
      levelDownStreak += 1;
      levelUpStreak = 0;
      if (levelDownStreak >= LEVEL_DOWN_STREAK_REQUIRED) {
        level = targetLevel;
        levelDownStreak = 0;
      }
    } else {
      levelUpStreak = 0;
      levelDownStreak = 0;
    }

    const degradationStreak = wealth <= DESTRUCTION_WEALTH_THRESHOLD ? hub.degradationStreak + 1 : Math.max(0, hub.degradationStreak - 1);
    const destroyed = degradationStreak >= DESTRUCTION_STREAK_REQUIRED;

    let marketMode: WorldEconomyState['hubs'][string]['marketMode'] = 'stable';
    if (hub.blackMarketUntilTick && hub.blackMarketUntilTick > seed.tick) {
      marketMode = 'black_market';
    } else if (demand - supply >= 20) {
      marketMode = 'scarcity';
    } else if (supply - demand >= 18) {
      marketMode = 'surplus';
    }

    let blackMarketUntilTick = hub.blackMarketUntilTick;
    if ((!blackMarketUntilTick || blackMarketUntilTick <= seed.tick) && riskSpikeFromWeather(currentWeather, stability) && Math.random() < 0.08) {
      blackMarketUntilTick = seed.tick + 6 + Math.floor(Math.random() * 5);
      marketMode = 'black_market';
      events.push({
        id: `black_market_opened_${hubId}_${nextTick}`,
        tick: nextTick,
        type: 'black_market_opened',
        hubId,
        intensity: 24,
      });
    }

    if (!hub.destroyed && destroyed) {
      events.push({
        id: `hub_destroyed_${hubId}_${nextTick}`,
        tick: nextTick,
        type: 'hub_destroyed',
        hubId,
        intensity: 95,
      });
    }

    acc[hubId] = {
      ...hub,
      wealth,
      level,
      treasury,
      tradeTurnover,
      resources,
      supply,
      demand,
      stability,
      levelUpStreak,
      levelDownStreak,
      degradationStreak,
      destroyed,
      marketMode,
      blackMarketUntilTick,
    };
    return acc;
  }, {});
  const tradeRoutes = Object.entries(seed.tradeRoutes || {}).reduce<WorldEconomyState['tradeRoutes']>((acc, [routeId, route]) => {
    const weatherRisk = currentWeather === 'storm' ? 6 : currentWeather === 'snow' ? 4 : currentWeather === 'rain' ? 2 : 0;
    const risk = clamp(route.risk + weatherRisk + (Math.floor(Math.random() * 7) - 3), 0, 100);
    const flowPenalty = Math.floor(risk * 0.2) + route.distance;
    const flow = clamp(route.flow + (Math.floor(Math.random() * 9) - 4) - flowPenalty * 0.08, 0, 100);
    acc[routeId] = { ...route, risk, flow };
    return acc;
  }, {});

  Object.values(tradeRoutes).forEach((route) => {
    const fromHub = hubs[route.fromHubId];
    const toHub = hubs[route.toHubId];
    if (!fromHub || !toHub) return;
    const routePower = (route.flow * (100 - route.risk)) / 100;
    const supplyTransfer = Math.floor((fromHub.supply - toHub.supply) * routePower * 0.005);
    if (supplyTransfer !== 0) {
      hubs = {
        ...hubs,
        [route.fromHubId]: {
          ...fromHub,
          supply: clamp(fromHub.supply - supplyTransfer, 0, 100),
          wealth: clamp(fromHub.wealth + Math.floor(routePower * 0.02), 0, 1200),
          level: resolveHubLevel(clamp(fromHub.wealth + Math.floor(routePower * 0.02), 0, 1200)),
        },
        [route.toHubId]: {
          ...toHub,
          supply: clamp(toHub.supply + supplyTransfer, 0, 100),
          demand: clamp(toHub.demand - Math.sign(supplyTransfer), 0, 100),
          wealth: clamp(toHub.wealth + Math.floor(routePower * 0.015), 0, 1200),
          level: resolveHubLevel(clamp(toHub.wealth + Math.floor(routePower * 0.015), 0, 1200)),
        },
      };
    }
  });

  const hubRelations = Object.entries(seed.hubRelations || {}).reduce<WorldEconomyState['hubRelations']>((acc, [id, relation]) => {
    const a = hubs[relation.hubAId];
    const b = hubs[relation.hubBId];
    if (!a || !b) return acc;
    let strength = relation.strength;
    let status = relation.status;
    if (status === 'allied') {
      strength = clamp(strength + 1, -100, 100);
      hubs = {
        ...hubs,
        [relation.hubAId]: { ...a, stability: clamp(a.stability + 1, 0, 100), demand: clamp(a.demand - 1, 0, 100) },
        [relation.hubBId]: { ...b, stability: clamp(b.stability + 1, 0, 100), demand: clamp(b.demand - 1, 0, 100) },
      };
    } else if (status === 'conflict') {
      strength = clamp(strength - 1, -100, 100);
      if (a.stability < 35 || b.stability < 35) {
        hubs = {
          ...hubs,
          [relation.hubAId]: { ...a, supply: clamp(a.supply - 1, 0, 100), demand: clamp(a.demand + 1, 0, 100) },
          [relation.hubBId]: { ...b, supply: clamp(b.supply - 1, 0, 100), demand: clamp(b.demand + 1, 0, 100) },
        };
      }
    }
    acc[id] = { ...relation, strength, status };
    return acc;
  }, {});

  const activeHubIds = Object.values(hubs).filter((hub) => !hub.destroyed).map((hub) => hub.hubId);
  if (activeHubIds.length > 0 && Math.random() < 0.24) {
    const eventHubId = activeHubIds[Math.floor(Math.random() * activeHubIds.length)];
    const eventRoll = Math.random();
    if (eventRoll < 0.28) {
      const hub = hubs[eventHubId];
      const warOpponentPool = activeHubIds.filter((id) => id !== eventHubId);
      const warOpponentId = warOpponentPool.length > 0
        ? warOpponentPool[Math.floor(Math.random() * warOpponentPool.length)]
        : undefined;
      hubs = {
        ...hubs,
        [eventHubId]: {
          ...hub,
          wealth: clamp(hub.wealth - 50, 0, 1200),
          stability: clamp(hub.stability - 12, 0, 100),
          supply: clamp(hub.supply - 7, 0, 100),
          demand: clamp(hub.demand + 6, 0, 100),
          tradeTurnover: clamp(hub.tradeTurnover - 22, 0, 5000),
          marketMode: 'scarcity',
        },
      };
      events.push({
        id: `war_${eventHubId}_${nextTick}`,
        tick: nextTick,
        type: 'war',
        hubId: eventHubId,
        targetHubId: warOpponentId,
        intensity: 72,
      });
    } else if (eventRoll < 0.52) {
      const hub = hubs[eventHubId];
      hubs = {
        ...hubs,
        [eventHubId]: {
          ...hub,
          wealth: clamp(hub.wealth - 28, 0, 1200),
          stability: clamp(hub.stability - 7, 0, 100),
          supply: clamp(hub.supply - 9, 0, 100),
          demand: clamp(hub.demand + 7, 0, 100),
          tradeTurnover: clamp(hub.tradeTurnover - 16, 0, 5000),
          marketMode: 'scarcity',
        },
      };
      const affectedRoutes = Object.entries(tradeRoutes).reduce<WorldEconomyState['tradeRoutes']>((acc, [routeId, route]) => {
        if (route.fromHubId === eventHubId || route.toHubId === eventHubId) {
          acc[routeId] = {
            ...route,
            flow: clamp(route.flow - 15, 0, 100),
            risk: clamp(route.risk + 17, 0, 100),
          };
          return acc;
        }
        acc[routeId] = route;
        return acc;
      }, {});
      Object.assign(tradeRoutes, affectedRoutes);
      events.push({
        id: `caravan_attack_${eventHubId}_${nextTick}`,
        tick: nextTick,
        type: 'caravan_attack',
        hubId: eventHubId,
        intensity: 63,
      });
    } else if (eventRoll < 0.76) {
      const hub = hubs[eventHubId];
      hubs = {
        ...hubs,
        [eventHubId]: {
          ...hub,
          wealth: clamp(hub.wealth - 34, 0, 1200),
          stability: clamp(hub.stability - 10, 0, 100),
          supply: clamp(hub.supply - 5, 0, 100),
          demand: clamp(hub.demand + 5, 0, 100),
          treasury: clamp(hub.treasury - 28, 0, 5000),
          marketMode: 'scarcity',
        },
      };
      events.push({
        id: `crisis_${eventHubId}_${nextTick}`,
        tick: nextTick,
        type: 'crisis',
        hubId: eventHubId,
        intensity: 68,
      });
    } else {
      const hub = hubs[eventHubId];
      hubs = {
        ...hubs,
        [eventHubId]: {
          ...hub,
          wealth: clamp(hub.wealth + 42, 0, 1200),
          stability: clamp(hub.stability + 9, 0, 100),
          supply: clamp(hub.supply + 7, 0, 100),
          demand: clamp(hub.demand - 4, 0, 100),
          treasury: clamp(hub.treasury + 36, 0, 5000),
          tradeTurnover: clamp(hub.tradeTurnover + 22, 0, 5000),
          marketMode: 'surplus',
        },
      };
      events.push({
        id: `prosperity_${eventHubId}_${nextTick}`,
        tick: nextTick,
        type: 'prosperity',
        hubId: eventHubId,
        intensity: 49,
      });
    }
  }

  return {
    tick: nextTick,
    hubs,
    tradeRoutes,
    hubRelations,
    spawnedHubIds: seed.spawnedHubIds,
    events: events.slice(-ECONOMY_EVENT_LIMIT),
  };
}

function updateHubEconomy(
  worldEconomy: WorldEconomyState,
  hubId: string,
  delta: Partial<Pick<WorldEconomyState['hubs'][string], 'wealth' | 'supply' | 'demand' | 'stability' | 'playerRelation' | 'treasury' | 'tradeTurnover'>>,
): WorldEconomyState {
  const hub = worldEconomy.hubs[hubId];
  if (!hub) return worldEconomy;
  const wealth = clamp(hub.wealth + (delta.wealth || 0), 0, 1200);
  const supply = clamp(hub.supply + (delta.supply || 0), 0, 100);
  const demand = clamp(hub.demand + (delta.demand || 0), 0, 100);
  const stability = clamp(hub.stability + (delta.stability || 0), 0, 100);
  const playerRelation = clamp(hub.playerRelation + (delta.playerRelation || 0), -100, 100);
  const treasury = clamp(hub.treasury + (delta.treasury || 0), 0, 5000);
  const tradeTurnover = clamp(hub.tradeTurnover + (delta.tradeTurnover || 0), 0, 5000);
  const nextHub = {
    ...hub,
    wealth,
    treasury,
    tradeTurnover,
    supply,
    demand,
    stability,
    playerRelation,
    level: resolveHubLevel(wealth),
  };
  return {
    ...worldEconomy,
    hubs: {
      ...worldEconomy.hubs,
      [hubId]: nextHub,
    },
  };
}

function getHubEconomy(worldEconomy: WorldEconomyState, locationId: string) {
  return worldEconomy.hubs[locationId] || null;
}

function worldHubLevelForEventQuest(quest: Quest): number {
  const maybeLevel = quest.eventQuest?.sourceHubLevel;
  if (Number.isFinite(maybeLevel) && Number(maybeLevel) > 0) return Number(maybeLevel);
  return 3;
}

function riskSpikeFromWeather(currentWeather: WeatherType, stability: number): boolean {
  const weatherRisk = currentWeather === 'storm' ? 0.5 : currentWeather === 'snow' ? 0.35 : currentWeather === 'rain' ? 0.2 : 0.08;
  const instability = Math.max(0, (55 - stability) / 100);
  return Math.random() < weatherRisk * (1 + instability);
}

async function loadRemoteSave(userId: string): Promise<SaveData | null> {
  const response = await fetch(`/api/game/save/${userId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load remote save: ${response.status}`);
  return response.json();
}

async function upsertRemoteSave(userId: string, saveData: SaveData): Promise<void> {
  const response = await fetch(`/api/game/save/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saveData),
  });
  if (!response.ok) throw new Error(`Failed to upsert remote save: ${response.status}`);
}

async function deleteRemoteSave(userId: string): Promise<void> {
  const response = await fetch(`/api/game/save/${userId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Failed to delete remote save: ${response.status}`);
}

function deepCloneQuests(quests: Quest[]): Quest[] {
  return JSON.parse(JSON.stringify(quests));
}

function inventoryWeight(player: Player): number {
  return player.inventory.reduce((sum, invItem) => {
    const item = ITEMS[invItem.itemId];
    return item ? sum + item.weight * invItem.quantity : sum;
  }, 0);
}

function canCarry(player: Player, itemId: string, qty = 1): boolean {
  const item = ITEMS[itemId];
  if (!item) return false;
  const projectedWeight = inventoryWeight(player) + item.weight * qty;
  const hardCap = player.carryCapacity * 1.35;
  if (projectedWeight > hardCap + 0.0001) return false;
  const usage = getBackpackSlotUsage(player);
  const potionLimit = player.backpackSlots?.potion || 12;
  const materialLimit = player.backpackSlots?.material || 24;
  if (item.slotCategory === 'potion' && usage.potions + qty > potionLimit) return false;
  if (item.slotCategory === 'material' && usage.materials + qty > materialLimit) return false;
  return true;
}

function addItem(player: Player, itemId: string, qty = 1): { player: Player; added: number } {
  if (qty <= 0) return { player, added: 0 };
  const item = ITEMS[itemId];
  if (!item) return { player, added: 0 };

  const hardCap = player.carryCapacity * 1.35;
  const freeWeight = hardCap - inventoryWeight(player);
  const maxByWeight = Math.floor((freeWeight + 0.0001) / item.weight);
  const usage = getBackpackSlotUsage(player);
  const potionLimit = player.backpackSlots?.potion || 12;
  const materialLimit = player.backpackSlots?.material || 24;
  let maxBySlots = qty;
  if (item.slotCategory === 'potion') maxBySlots = Math.max(0, potionLimit - usage.potions);
  if (item.slotCategory === 'material') maxBySlots = Math.max(0, materialLimit - usage.materials);
  const toAdd = Math.min(qty, Math.max(0, Math.min(maxByWeight, maxBySlots)));
  if (toAdd <= 0) return { player, added: 0 };

  const inventory = [...player.inventory];
  const existing = inventory.find((i) => i.itemId === itemId);
  if (existing) existing.quantity += toAdd;
  else inventory.push({ itemId, quantity: toAdd });

  return { player: { ...player, inventory }, added: toAdd };
}

function removeItem(player: Player, itemId: string, qty = 1): Player {
  return {
    ...player,
    inventory: player.inventory
      .map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity - qty } : i))
      .filter((i) => i.quantity > 0),
  };
}

function getBackpackSlotUsage(player: Player) {
  let potions = 0;
  let materials = 0;
  player.inventory.forEach((inv) => {
    const item = ITEMS[inv.itemId];
    if (!item) return;
    if (item.slotCategory === 'potion') potions += inv.quantity;
    if (item.slotCategory === 'material') materials += inv.quantity;
  });
  return { potions, materials };
}

function getOverloadFactor(player: Player): number {
  const total = inventoryWeight(player);
  if (total <= player.carryCapacity) return 0;
  return Math.min(0.35, (total - player.carryCapacity) / Math.max(1, player.carryCapacity));
}

function getFatigueFactor(player: Player): number {
  const fatigue = Math.max(0, Math.min(FATIGUE_MAX, player.fatigue || 0));
  return fatigue / FATIGUE_MAX;
}

function reduceCooldowns(player: Player): Player {
  const cooldowns = { ...(player.cooldowns || {}) };
  Object.keys(cooldowns).forEach((id) => {
    cooldowns[id] = Math.max(0, cooldowns[id] - 1);
    if (cooldowns[id] <= 0) delete cooldowns[id];
  });
  return { ...player, cooldowns };
}

function applyStatusTick(target: { hp: number; maxHp: number; statusEffects?: StatusEffectInstance[] }) {
  const statuses = [...(target.statusEffects || [])];
  let hp = target.hp;
  let skippedTurn = false;
  const logs: string[] = [];
  const next: StatusEffectInstance[] = [];

  statuses.forEach((s) => {
    if (s.type === 'bleeding') {
      hp = Math.max(0, hp - s.potency);
      logs.push(`Bleeding: -${s.potency} HP`);
    }
    if (s.type === 'poisoned') {
      hp = Math.max(0, hp - s.potency);
      logs.push(`Poison: -${s.potency} HP`);
    }
    if (s.type === 'stunned') {
      skippedTurn = true;
      logs.push('Stunned');
    }
    if (s.duration > 1) next.push({ ...s, duration: s.duration - 1 });
  });

  return { hp, statusEffects: next, skippedTurn, logs };
}

function applyResist(dmg: number, damageType: DamageType, resistances?: Partial<Record<DamageType, number>>): number {
  const mod = resistances?.[damageType] || 0;
  return Math.max(1, Math.floor(dmg * (1 - mod)));
}

function getCombatStats(player: Player, currentWeather: WeatherType) {
  let minDamage = player.stats.baseDamage[0];
  let maxDamage = player.stats.baseDamage[1];
  let defense = player.stats.baseDefense;
  let critChance = 0.08;
  let counterChance = 0.05;
  let damageType: DamageType = 'physical';

  const strengthLevel = player.learnedSkills['strength_1'] || 0;
  const defenseLevel = player.learnedSkills['defense_1'] || 0;
  if (strengthLevel > 0) maxDamage += strengthLevel * (SKILLS['strength_1'].effect.valuePerLevel || 0);
  if (defenseLevel > 0) defense += defenseLevel * (SKILLS['defense_1'].effect.valuePerLevel || 0);

  if (player.equipment.weapon) {
    const weapon = ITEMS[player.equipment.weapon];
    if (weapon?.stats?.damage) {
      minDamage += weapon.stats.damage[0];
      maxDamage += weapon.stats.damage[1];
    }
    if (weapon?.stats?.critChanceBonus) critChance += weapon.stats.critChanceBonus;
    if (weapon?.stats?.counterChanceBonus) counterChance += weapon.stats.counterChanceBonus;
    if (weapon?.stats?.damageType) damageType = weapon.stats.damageType;
  }

  if (player.equipment.armor) {
    const armor = ITEMS[player.equipment.armor];
    if (armor?.stats?.defense) defense += armor.stats.defense;
    if (armor?.stats?.counterChanceBonus) counterChance += armor.stats.counterChanceBonus;
  }

  const weatherFx = WEATHER[currentWeather].combatEffect;
  if (weatherFx?.playerDamageMod) {
    minDamage = Math.floor(minDamage * weatherFx.playerDamageMod);
    maxDamage = Math.floor(maxDamage * weatherFx.playerDamageMod);
  }

  const criticalFocus = player.learnedSkills['berserk_critical_1'] || 0;
  critChance += criticalFocus * 0.04;
  const guardMaster = player.learnedSkills['guard_master_1'] || 0;
  counterChance += guardMaster * 0.04;

  if (player.questPerks?.includes('perk_trollbane')) {
    minDamage += 1;
    maxDamage += 2;
  }
  if (player.questPerks?.includes('perk_arcane_attunement')) critChance += 0.05;

  const overload = getOverloadFactor(player);
  if (overload > 0) {
    minDamage = Math.floor(minDamage * (1 - overload * 0.35));
    maxDamage = Math.floor(maxDamage * (1 - overload * 0.35));
    counterChance = Math.max(0, counterChance - overload * 0.15);
  }

  const fatigueFactor = getFatigueFactor(player);
  if (fatigueFactor > 0) {
    minDamage = Math.floor(minDamage * (1 - fatigueFactor * 0.22));
    maxDamage = Math.floor(maxDamage * (1 - fatigueFactor * 0.22));
    defense = Math.floor(defense * (1 - fatigueFactor * 0.15));
  }

  return {
    minDamage: Math.max(1, minDamage),
    maxDamage: Math.max(1, maxDamage),
    defense: Math.max(0, defense),
    critChance: Math.min(0.6, critChance),
    counterChance: Math.min(0.5, counterChance),
    damageType,
  };
}

function rollDamage(range: [number, number]) {
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildEnemy(enemy: Enemy): CombatEnemy {
  return {
    ...enemy,
    hp: enemy.maxHp,
    energy: enemy.maxEnergy,
    isBlocking: false,
    statusEffects: [],
    phaseIndex: -1,
    damageMod: 1,
    defenseMod: 1,
  };
}

function applyLevelUps(player: Player, lang: Language, logs: string[]) {
  const next = { ...player };
  const prevLevel = next.level;
  while (next.xp >= next.xpToNext) {
    next.level += 1;
    next.xp -= next.xpToNext;
    next.xpToNext = Math.floor(next.xpToNext * 1.5);
    next.skillPoints += 2;
    next.maxHp += 10;
    next.maxEnergy += 5;
    next.hp = next.maxHp;
    next.energy = next.maxEnergy;
    next.stats.baseDamage[0] += 1;
    next.stats.baseDamage[1] += 2;
    logs.push(lang === 'ru' ? `НОВЫЙ УРОВЕНЬ! Теперь вы уровня ${next.level}! (+2 SP)` : `LEVEL UP! You are now level ${next.level}! (+2 SP)`);
  }
  if (next.level > prevLevel && next.level % 15 === 0) {
    next.prestigeLevel = (next.prestigeLevel || 0) + 1;
    next.maxHp += 6;
    next.maxEnergy += 6;
    logs.push(lang === 'ru' ? `Престиж повышен! Текущий престиж: ${next.prestigeLevel}.` : `Prestige increased! Current prestige: ${next.prestigeLevel}.`);
  }
  return next;
}

function syncCollectGoals(quests: Quest[], player: Player): Quest[] {
  return quests.map((q) => {
    const isActive = (q.offerState || 'active') === 'active';
    if (q.isCompleted || !isActive) return q;
    const goals = q.goals.map((g) => {
      if (g.type !== 'collect') return g;
      const owned = player.inventory.find((i) => i.itemId === g.targetId)?.quantity || 0;
      return { ...g, currentCount: Math.min(g.targetCount, owned) };
    });
    return { ...q, goals };
  });
}

function markQuestTurnInReady(quests: Quest[]): Quest[] {
  return quests.map((q) => {
    const isActive = (q.offerState || 'active') === 'active';
    if (q.isCompleted || !isActive || q.goals.length === 0) return { ...q, isTurnInReady: false };
    const completed = q.goals.every((g) => g.currentCount >= g.targetCount);
    if (!completed) return { ...q, isTurnInReady: false };
    return { ...q, isTurnInReady: true };
  });
}

function syncQuestStates(quests: Quest[], player: Player): Quest[] {
  return markQuestTurnInReady(syncCollectGoals(quests, player));
}

function toEventQuestOffer(event: WorldEconomyEvent, sourceHubLevel?: number): Quest | null {
  if (
    event.type !== 'war'
    && event.type !== 'caravan_attack'
    && event.type !== 'crisis'
    && event.type !== 'prosperity'
    && event.type !== 'black_market_opened'
    && event.type !== 'hub_destroyed'
  ) {
    return null;
  }
  const hub = LOCATIONS[event.hubId];
  if (!hub) return null;
  const eventLabelEn =
    event.type === 'war'
      ? 'Warfront Response'
      : event.type === 'caravan_attack'
        ? 'Caravan Route Decision'
        : event.type === 'crisis'
          ? 'Crisis Contract'
          : event.type === 'prosperity'
            ? 'Prosperity Directive'
            : event.type === 'hub_destroyed'
              ? 'Recovery Mandate'
              : 'Black Market Dossier';
  const eventLabelRu =
    event.type === 'war'
      ? 'Ответ на фронт войны'
      : event.type === 'caravan_attack'
        ? 'Решение по караванным путям'
        : event.type === 'crisis'
          ? 'Контракт кризиса'
          : event.type === 'prosperity'
            ? 'Директива подъёма'
            : event.type === 'hub_destroyed'
              ? 'Мандат на восстановление'
              : 'Досье чёрного рынка';

  return {
    id: `event_quest_${event.id}`,
    name: {
      en: `${eventLabelEn}: ${hub.name.en}`,
      ru: `${eventLabelRu}: ${hub.name.ru}`,
    },
    description: {
      en: `A major economic event has struck ${hub.name.en}. Choose your branch before accepting this contract.`,
      ru: `${hub.name.ru} задет крупным экономическим событием. Выберите ветку перед принятием контракта.`,
    },
    locationId: event.hubId,
    goals: [],
    rewards: { xp: 0, gold: 0 },
    isTurnInReady: false,
    isCompleted: false,
    expiresAtTick: event.tick + 8,
    offerState: 'offered',
    isEventQuest: true,
    sourceEventId: event.id,
    eventQuest: {
      originType: event.type,
      targetHubId: event.hubId,
      opponentHubId: event.type === 'war' ? event.targetHubId : undefined,
      sourceHubLevel,
      branch: 'unselected',
    },
  };
}

function withGeneratedEventQuests(quests: Quest[], worldEconomy: WorldEconomyState): Quest[] {
  const currentTick = worldEconomy.tick;
  const withExpiry = quests.map((q) => {
    if ((q.offerState || 'active') !== 'offered') return q;
    if (!Number.isFinite(q.expiresAtTick)) return q;
    if ((q.expiresAtTick || 0) > currentTick) return q;
    return {
      ...q,
      offerState: 'expired' as const,
      isTurnInReady: false,
    };
  });
  const existingSourceIds = new Set(
    withExpiry
      .filter((q) => q.isEventQuest && q.sourceEventId)
      .map((q) => String(q.sourceEventId)),
  );
  const additions: Quest[] = [];
  (worldEconomy.events || []).slice(-8).forEach((event) => {
    if (existingSourceIds.has(event.id)) return;
    const offer = toEventQuestOffer(event, worldEconomy.hubs[event.hubId]?.level);
    if (!offer) return;
    additions.push(offer);
    existingSourceIds.add(event.id);
  });
  if (additions.length === 0) return withExpiry;
  return [...withExpiry, ...additions];
}

function applyEventQuestBranch(
  quest: Quest,
  branch: 'support' | 'punish' | 'support_a' | 'support_b' | 'neutral',
): Quest {
  if (!quest.isEventQuest || !quest.eventQuest) return quest;
  const hub = LOCATIONS[quest.eventQuest.targetHubId];
  const hubNameEn = hub?.name?.en || quest.eventQuest.targetHubId;
  const hubNameRu = hub?.name?.ru || quest.eventQuest.targetHubId;
  const opponentHub = quest.eventQuest.opponentHubId ? LOCATIONS[quest.eventQuest.opponentHubId] : null;
  const opponentNameEn = opponentHub?.name?.en || quest.eventQuest.opponentHubId || 'Unknown Hub';
  const opponentNameRu = opponentHub?.name?.ru || quest.eventQuest.opponentHubId || 'Неизвестный хаб';
  const branchLabelEn =
    branch === 'support'
      ? 'Support / Reward'
      : branch === 'punish'
        ? 'Punish / Destabilize'
        : branch === 'support_a'
          ? `Support ${hubNameEn}`
          : branch === 'support_b'
            ? `Support ${opponentNameEn}`
            : 'Stay Neutral';
  const branchLabelRu =
    branch === 'support'
      ? 'Поддержать / Вознаградить'
      : branch === 'punish'
        ? 'Наказать / Дестабилизировать'
        : branch === 'support_a'
          ? `Поддержать ${hubNameRu}`
          : branch === 'support_b'
            ? `Поддержать ${opponentNameRu}`
            : 'Сохранить нейтралитет';

  let goals: Quest['goals'] = [];
  let rewards: Quest['rewards'] = { xp: 100, gold: 70 };
  let locationId = quest.locationId;
  let descriptionEn = '';
  let descriptionRu = '';

  if (quest.eventQuest.originType === 'war') {
    const frontEnemy = 'ash_bandit';
    locationId = 'road_south';
    if (branch === 'support_a') {
      goals = [
        { type: 'kill', targetId: frontEnemy, targetCount: 3, currentCount: 0 },
        { type: 'explore', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
        ...(quest.eventQuest.opponentHubId ? [{ type: 'explore' as const, targetId: quest.eventQuest.opponentHubId, targetCount: 1, currentCount: 0 }] : []),
      ];
      rewards = { xp: 230, gold: 145, items: [{ itemId: 'potion_large', quantity: 1 }] };
      descriptionEn = `War support chain for ${hubNameEn}: hold the front, carry dispatch between allied hubs, and sustain war effort.`;
      descriptionRu = `Военная цепочка поддержки для ${hubNameRu}: удержите фронт, доставьте депеши между хабами и поддержите военную кампанию.`;
    } else if (branch === 'support_b') {
      goals = [
        { type: 'kill', targetId: frontEnemy, targetCount: 3, currentCount: 0 },
        ...(quest.eventQuest.opponentHubId ? [{ type: 'explore' as const, targetId: quest.eventQuest.opponentHubId, targetCount: 1, currentCount: 0 }] : []),
        { type: 'collect', targetId: 'bandit_bandana', targetCount: 2, currentCount: 0 },
      ];
      rewards = { xp: 235, gold: 150, items: [{ itemId: 'potion_energy', quantity: 2 }] };
      descriptionEn = `Support ${opponentNameEn}: break enemy patrols, deliver dispatch, and secure wartime proof from skirmishes.`;
      descriptionRu = `Поддержите ${opponentNameRu}: разбейте вражеские патрули, доставьте депешу и соберите доказательства боёв.`;
    } else {
      goals = [
        { type: 'collect', targetId: 'bandit_bandana', targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 95, gold: 55 };
      descriptionEn = `Stay neutral: file a non-intervention report and avoid direct war support.`;
      descriptionRu = `Сохраните нейтралитет: оформите отчёт о невмешательстве и избегайте прямой поддержки войны.`;
    }
  } else if (quest.eventQuest.originType === 'caravan_attack') {
    const hubLevel = clamp(worldHubLevelForEventQuest(quest), 1, 5);
    const killCount = clamp(2 + hubLevel, 3, 6);
    const enemyId = hubLevel >= 4 ? 'ash_bandit' : 'bandit';
    locationId = 'road_south';
    if (branch === 'support') {
      goals = [
        { type: 'kill', targetId: enemyId, targetCount: killCount, currentCount: 0 },
        { type: 'collect', targetId: 'bandit_bandana', targetCount: Math.max(1, Math.floor(killCount / 2)), currentCount: 0 },
      ];
      rewards = { xp: 200 + killCount * 14, gold: 130 + killCount * 10, items: [{ itemId: 'potion_energy', quantity: 1 }] };
      descriptionEn = `Escort-response operation: survive ${killCount} consecutive convoy fights and secure route evidence.`;
      descriptionRu = `Операция защиты караванов: выдержите ${killCount} боёв подряд и соберите доказательства зачистки маршрута.`;
    } else if (branch === 'punish') {
      goals = [
        { type: 'kill', targetId: enemyId, targetCount: killCount, currentCount: 0 },
      ];
      rewards = {
        xp: 220 + killCount * 16,
        gold: 170 + killCount * 13,
        items: [
          { itemId: 'bomb_toxic', quantity: 1 },
          { itemId: hubLevel >= 4 ? 'ember_resin' : 'hard_wood', quantity: Math.max(1, Math.floor(killCount / 2)) },
        ],
      };
      descriptionEn = `Raid operation: crush ${killCount} convoy guards and keep the plunder.`;
      descriptionRu = `Налётная операция: уничтожьте ${killCount} охранных отрядов каравана и оставьте награбленное себе.`;
    } else {
      goals = [
        { type: 'explore', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 80, gold: 45 };
      descriptionEn = `Non-intervention stance: do not interfere with the convoy and simply report the route status.`;
      descriptionRu = `Позиция невмешательства: не трогайте караван и просто передайте отчёт о состоянии маршрута.`;
    }
  } else if (quest.eventQuest.originType === 'crisis') {
    locationId = quest.eventQuest.targetHubId;
    if (branch === 'support') {
      goals = [
        { type: 'collect', targetId: 'iron_ore', targetCount: 3, currentCount: 0 },
        { type: 'collect', targetId: 'hard_wood', targetCount: 3, currentCount: 0 },
        { type: 'explore', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 180, gold: 120, items: [{ itemId: 'potion_large', quantity: 1 }] };
      descriptionEn = `Crisis relief: supply strategic materials and verify recovery at ${hubNameEn}.`;
      descriptionRu = `Антикризисная миссия: доставьте стратегические материалы и подтвердите восстановление в ${hubNameRu}.`;
    } else {
      goals = [
        { type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 },
        { type: 'collect', targetId: 'bandit_bandana', targetCount: 2, currentCount: 0 },
      ];
      rewards = { xp: 205, gold: 140, items: [{ itemId: 'bomb_fire', quantity: 1 }] };
      descriptionEn = `Exploit crisis: disrupt stabilization channels and deepen local shortages.`;
      descriptionRu = `Эксплуатация кризиса: сорвите каналы стабилизации и усилите локальный дефицит.`;
    }
  } else if (quest.eventQuest.originType === 'prosperity') {
    locationId = quest.eventQuest.targetHubId;
    if (branch === 'support') {
      goals = [
        { type: 'explore', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
        { type: 'collect', targetId: 'crystal_shard', targetCount: 2, currentCount: 0 },
      ];
      rewards = { xp: 170, gold: 135, items: [{ itemId: 'scroll_spear', quantity: 1 }] };
      descriptionEn = `Growth pact: reinforce prosperous logistics and deliver arcane commodities.`;
      descriptionRu = `Пакт роста: укрепите процветающую логистику и доставьте ценные арканические товары.`;
    } else {
      goals = [
        { type: 'kill', targetId: 'ash_bandit', targetCount: 2, currentCount: 0 },
        { type: 'collect', targetId: 'ember_resin', targetCount: 2, currentCount: 0 },
      ];
      rewards = { xp: 195, gold: 150, items: [{ itemId: 'bomb_toxic', quantity: 1 }] };
      descriptionEn = `Market sabotage: strike trade arteries and siphon high-value supplies.`;
      descriptionRu = `Рыночный саботаж: ударьте по торговым артериям и перехватите ценные ресурсы.`;
    }
  } else if (quest.eventQuest.originType === 'hub_destroyed') {
    locationId = quest.eventQuest.targetHubId;
    if (branch === 'support') {
      goals = [
        { type: 'collect', targetId: 'hard_wood', targetCount: 4, currentCount: 0 },
        { type: 'collect', targetId: 'iron_ore', targetCount: 2, currentCount: 0 },
      ];
      rewards = { xp: 210, gold: 120, items: [{ itemId: 'armor_iron', quantity: 1 }] };
      descriptionEn = `Recovery mission: deliver reconstruction stockpiles for ${hubNameEn}.`;
      descriptionRu = `Миссия восстановления: доставьте запасы для реконструкции ${hubNameRu}.`;
    } else {
      goals = [
        { type: 'kill', targetId: 'bandit', targetCount: 3, currentCount: 0 },
      ];
      rewards = { xp: 225, gold: 165, items: [{ itemId: 'bandit_bandana', quantity: 2 }] };
      descriptionEn = `Opportunist strike: prevent rebuilding by forcing militant pressure.`;
      descriptionRu = `Удар оппортуниста: сорвите восстановление, усилив давление налётчиков.`;
    }
  } else {
    locationId = quest.eventQuest.targetHubId;
    goals = [{ type: 'explore', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 }];
    rewards = branch === 'support' ? { xp: 130, gold: 90 } : { xp: 150, gold: 105 };
    descriptionEn =
      branch === 'support'
        ? `Deliver support policy to ${hubNameEn} and verify stabilization on site.`
        : `Execute punitive policy against ${hubNameEn} and verify destabilization on site.`;
    descriptionRu =
      branch === 'support'
        ? `Проведите курс поддержки для ${hubNameRu} и подтвердите стабилизацию на месте.`
        : `Проведите карательный курс против ${hubNameRu} и подтвердите дестабилизацию на месте.`;
  }

  return {
    ...quest,
    offerState: 'offered',
    eventQuest: {
      ...quest.eventQuest,
      branch,
    },
    locationId,
    name: {
      en: `${quest.name.en.split(' — ')[0]} — ${branchLabelEn}`,
      ru: `${quest.name.ru.split(' — ')[0]} — ${branchLabelRu}`,
    },
    description: {
      en: descriptionEn,
      ru: descriptionRu,
    },
    goals,
    rewards,
    isTurnInReady: false,
  };
}

function buildFollowupEventQuest(resolvedQuest: Quest): Quest | null {
  if (!resolvedQuest.isEventQuest || !resolvedQuest.eventQuest) return null;
  if (resolvedQuest.id.startsWith('followup_')) return null;
  const branch = resolvedQuest.eventQuest.branch;
  if (branch === 'unselected') return null;
  const hubId = resolvedQuest.eventQuest.targetHubId;
  const hub = LOCATIONS[hubId];
  if (!hub) return null;
  const baseId = `followup_${resolvedQuest.id}`;
  if (resolvedQuest.eventQuest.originType === 'war') {
    const isNeutral = branch === 'neutral';
    return {
      id: baseId,
      name: {
        en: isNeutral ? `War Fallout Report: ${hub.name.en}` : `Frontline Aftershock: ${hub.name.en}`,
        ru: isNeutral ? `Отчёт о последствиях войны: ${hub.name.ru}` : `Послевоенный отклик: ${hub.name.ru}`,
      },
      description: {
        en: isNeutral
          ? `Both sides demand proof of your non-intervention. Submit a formal route report.`
          : `After your intervention, opposition cells retaliate. Suppress the aftershock attacks.`,
        ru: isNeutral
          ? `Обе стороны требуют подтверждение вашего невмешательства. Передайте официальный маршрутный отчёт.`
          : `После вашего вмешательства противник отвечает налётами. Подавите волну ответных атак.`,
      },
      locationId: 'road_south',
      goals: isNeutral
        ? [{ type: 'explore', targetId: 'road_south', targetCount: 1, currentCount: 0 }]
        : [{ type: 'kill', targetId: 'ash_bandit', targetCount: 2, currentCount: 0 }],
      rewards: isNeutral ? { xp: 70, gold: 40 } : { xp: 150, gold: 95, items: [{ itemId: 'potion_energy', quantity: 1 }] },
      isTurnInReady: false,
      isCompleted: false,
      expiresAtTick: undefined,
      offerState: 'offered',
      isEventQuest: true,
      sourceEventId: `${resolvedQuest.sourceEventId || resolvedQuest.id}_followup`,
      eventQuest: {
        ...resolvedQuest.eventQuest,
      },
    };
  }
  if (resolvedQuest.eventQuest.originType === 'caravan_attack') {
    const isPunish = branch === 'punish';
    return {
      id: baseId,
      name: {
        en: isPunish ? `Plunder Heat: ${hub.name.en}` : `Route Audit: ${hub.name.en}`,
        ru: isPunish ? `Погоня за добычей: ${hub.name.ru}` : `Аудит маршрута: ${hub.name.ru}`,
      },
      description: {
        en: isPunish
          ? `Your raid triggered a bounty response. Survive the hunt and keep the loot chain alive.`
          : `Convoy masters request a post-escort audit to keep prices stable.`,
        ru: isPunish
          ? `Ваш налёт вызвал охоту за головами. Переживите ответ и удержите добычу.`
          : `Караван-мастера просят послесопроводительный аудит для стабилизации цен.`,
      },
      locationId: 'road_south',
      goals: isPunish
        ? [{ type: 'kill', targetId: 'ash_bandit', targetCount: 2, currentCount: 0 }]
        : [{ type: 'collect', targetId: 'bandit_bandana', targetCount: 1, currentCount: 0 }],
      rewards: isPunish ? { xp: 165, gold: 120 } : { xp: 120, gold: 95, items: [{ itemId: 'hard_wood', quantity: 2 }] },
      isTurnInReady: false,
      isCompleted: false,
      expiresAtTick: undefined,
      offerState: 'offered',
      isEventQuest: true,
      sourceEventId: `${resolvedQuest.sourceEventId || resolvedQuest.id}_followup`,
      eventQuest: {
        ...resolvedQuest.eventQuest,
      },
    };
  }
  return null;
}

function applyQuestRewards(playerSeed: Player, quest: Quest, lang: Language, logs: string[]) {
  let player = { ...playerSeed, inventory: [...playerSeed.inventory] };
  player.xp += quest.rewards.xp;
  player.gold += quest.rewards.gold;
  logs.push(
    lang === 'ru'
      ? `Награда за задание: ${quest.rewards.xp} XP и ${quest.rewards.gold} золота.`
      : `Quest reward: ${quest.rewards.xp} XP and ${quest.rewards.gold} gold.`,
  );

  if (quest.rewards.perkId && !(player.questPerks || []).includes(quest.rewards.perkId)) {
    player.questPerks = [...(player.questPerks || []), quest.rewards.perkId];
    if (quest.rewards.perkId === 'perk_runic_mastery') player.maxEnergy += 12;
    if (quest.rewards.perkId === 'perk_alchemical_precision') player.maxHp += 8;
    logs.push(lang === 'ru' ? `Получен перк: ${quest.rewards.perkId}.` : `Perk unlocked: ${quest.rewards.perkId}.`);
  }

  if (quest.rewards.reputation) {
    const rep = { ...(player.merchantReputation || {}) };
    quest.rewards.reputation.forEach((r) => {
      rep[r.merchantId] = (rep[r.merchantId] || 0) + r.amount;
    });
    player.merchantReputation = rep;
  }

  (quest.rewards.items || []).forEach((rewardItem) => {
    const add = addItem(player, rewardItem.itemId, rewardItem.quantity);
    player = add.player;
    if (add.added > 0) {
      logs.push(
        lang === 'ru'
          ? `Награда: ${ITEMS[rewardItem.itemId].name[lang]} x${add.added}`
          : `Reward: ${ITEMS[rewardItem.itemId].name[lang]} x${add.added}`,
      );
    }
    if (add.added < rewardItem.quantity) {
      logs.push(lang === 'ru' ? 'Рюкзак переполнен, часть награды утеряна.' : 'Backpack is full, some rewards were lost.');
    }
  });

  return player;
}

function applyClassLoadout(basePlayer: Player, classId: string, bonuses?: CharacterCreationBonuses, heroName?: string): Player {
  const classDef = CLASSES[classId];
  if (!classDef) return basePlayer;

  let player: Player = {
    ...basePlayer,
    classId: classId as any,
    maxHp: classDef.baseStats.maxHp,
    hp: classDef.baseStats.maxHp,
    maxEnergy: classDef.baseStats.maxEnergy,
    energy: classDef.baseStats.maxEnergy,
    carryCapacity: classDef.baseStats.carryCapacity,
    stats: {
      baseDamage: [...classDef.baseStats.baseDamage] as [number, number],
      baseDefense: classDef.baseStats.baseDefense,
    },
    inventory: [],
    equipment: {},
  };

  const withWeapon = addItem(player, classDef.startWeaponId, 1);
  player = withWeapon.player;
  const withArmor = addItem(player, classDef.startArmorId, 1);
  player = withArmor.player;
  classDef.startItems.forEach((it) => {
    player = addItem(player, it.itemId, it.quantity).player;
  });
  player.equipment = {
    weapon: classDef.startWeaponId,
    armor: classDef.startArmorId,
  };

  if (bonuses) {
    player.maxHp = Math.max(20, player.maxHp + (bonuses.maxHp || 0));
    player.hp = player.maxHp;
    player.maxEnergy = Math.max(20, player.maxEnergy + (bonuses.maxEnergy || 0));
    player.energy = player.maxEnergy;
    player.stats.baseDamage = [
      Math.max(1, player.stats.baseDamage[0] + (bonuses.baseDamageMin || 0)),
      Math.max(1, player.stats.baseDamage[1] + (bonuses.baseDamageMax || 0)),
    ];
    player.stats.baseDefense = Math.max(0, player.stats.baseDefense + (bonuses.baseDefense || 0));
    player.carryCapacity = Math.max(20, player.carryCapacity + (bonuses.carryCapacity || 0));
    player.gold += bonuses.gold || 0;
    player.skillPoints += bonuses.skillPoints || 0;
  }

  const normalizedName = (heroName || '').trim().replace(/\s+/g, ' ');
  if (normalizedName.length >= 2) player.name = normalizedName.slice(0, 24);

  return player;
}

export const useGameStore = create<GameState>((set, get) => {
  const normalizeSettings = (input: any): GameSettings => ({
    language: input?.language === 'ru' ? 'ru' : 'en',
    voice: {
      lore: input?.voice?.lore !== false,
      quests: input?.voice?.quests !== false,
      npcDialogue: input?.voice?.npcDialogue !== false,
    },
    tutorial: {
      enabled: input?.tutorial?.enabled !== false,
      completed: input?.tutorial?.completed === true,
      step: Number.isFinite(input?.tutorial?.step) ? Math.max(0, Math.floor(input.tutorial.step)) : 0,
      seenHints: Array.isArray(input?.tutorial?.seenHints) ? input.tutorial.seenHints.filter((x: unknown) => typeof x === 'string') : [],
    },
  });

  const findActiveCombatChainQuest = (quests: Quest[], locationId: string): Quest | null =>
    quests.find((q) =>
      !q.isCompleted
      && (q.offerState || 'active') === 'active'
      && q.isEventQuest
      && (q.eventQuest?.originType === 'war' || q.eventQuest?.originType === 'caravan_attack')
      && q.locationId === locationId
      && q.goals.some((g) => g.type === 'kill' && g.currentCount < g.targetCount),
    ) || null;

  const applyChainFailurePenalty = (
    state: GameState,
    playerSeed: Player,
    reason: 'flee' | 'defeat',
  ): { player: Player; quests: Quest[]; worldEconomy: WorldEconomyState; failureLog: string | null } => {
    const chainQuest = findActiveCombatChainQuest(state.quests, state.currentLocationId);
    if (!chainQuest || !chainQuest.eventQuest) {
      return { player: playerSeed, quests: state.quests, worldEconomy: state.worldEconomy, failureLog: null };
    }
    const lang = state.settings.language;
    const fine = reason === 'defeat'
      ? Math.min(80, Math.max(12, Math.floor(playerSeed.gold * 0.16)))
      : Math.min(55, Math.max(8, Math.floor(playerSeed.gold * 0.1)));
    const player = {
      ...playerSeed,
      gold: Math.max(0, playerSeed.gold - fine),
    };
    let worldEconomy = state.worldEconomy;
    const targetHubId = chainQuest.eventQuest.targetHubId;
    const opponentHubId = chainQuest.eventQuest.opponentHubId;
    if (worldEconomy.hubs[targetHubId]) {
      worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
        playerRelation: -6,
        stability: -2,
      });
    }
    if (opponentHubId && worldEconomy.hubs[opponentHubId]) {
      worldEconomy = updateHubEconomy(worldEconomy, opponentHubId, {
        playerRelation: -3,
      });
    }
    const quests = syncQuestStates(
      state.quests.map((q) => (q.id === chainQuest.id ? { ...q, offerState: 'expired', isTurnInReady: false } : q)),
      player,
    );
    const failureLog = lang === 'ru'
      ? `Срыв цепочки "${chainQuest.name.ru}": потеряно ${fine} золота и ухудшены отношения хабов.`
      : `Chain failure "${chainQuest.name.en}": lost ${fine} gold and damaged hub relations.`;
    return { player, quests, worldEconomy, failureLog };
  };

  const enemyTurn = (logsSeed: string[]) => {
    const state = get();
    if (!state.currentEnemy) return;

    const lang = state.settings.language;
    const playerStats = getCombatStats(state.player, state.currentWeather);
    let enemy = { ...state.currentEnemy };
    let player = { ...state.player };
    let combo = state.combatCombo;
    let adrenaline = state.combatAdrenaline;
    const logs = [...logsSeed];

    player = reduceCooldowns(player);

    const enemyTick = applyStatusTick(enemy);
    enemy.hp = enemyTick.hp;
    enemy.statusEffects = enemyTick.statusEffects;
    enemyTick.logs.forEach((entry) => logs.push(lang === 'ru' ? `${enemy.name[lang]}: ${entry}` : `${enemy.name[lang]}: ${entry}`));
    if (enemy.hp <= 0) {
      completeCombatWin(player, enemy, logs);
      return;
    }

    const playerTick = applyStatusTick(player);
    player.hp = playerTick.hp;
    player.statusEffects = playerTick.statusEffects;
    playerTick.logs.forEach((entry) => logs.push(lang === 'ru' ? `Вы: ${entry}` : `You: ${entry}`));
    if (player.hp <= 0) {
      const penalized = applyChainFailurePenalty(state, { ...player, hp: Math.floor(player.maxHp * 0.3), energy: Math.floor(player.maxEnergy * 0.5) }, 'defeat');
      set({
        player: penalized.player,
        currentLocationId: 'town_oakhaven',
        status: 'hub',
        currentEnemy: null,
        combatLogs: penalized.failureLog ? [penalized.failureLog] : [],
        quests: penalized.quests,
        worldEconomy: penalized.worldEconomy,
        isPlayerBlocking: false,
        combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
        combatCombo: 0,
        combatAdrenaline: 0,
      });
      return;
    }

    if (enemyTick.skippedTurn) {
      logs.push(lang === 'ru' ? `${enemy.name[lang]} оглушен и пропускает ход.` : `${enemy.name[lang]} is stunned and skips the turn.`);
      set({ player, currentEnemy: enemy, combatLogs: logs, isPlayerBlocking: false, combatCombo: combo, combatAdrenaline: adrenaline });
      return;
    }

    if (enemy.phases && enemy.phases.length > 0) {
      const hpPercent = (enemy.hp / Math.max(1, enemy.maxHp)) * 100;
      const nextPhaseIndex = enemy.phases.findIndex((p, idx) => hpPercent <= p.thresholdHpPercent && idx > enemy.phaseIndex);
      if (nextPhaseIndex >= 0) {
        const phase = enemy.phases[nextPhaseIndex];
        enemy.phaseIndex = nextPhaseIndex;
        enemy.damageMod *= phase.damageMod || 1;
        enemy.defenseMod *= phase.defenseMod || 1;
        logs.push(lang === 'ru' ? `${enemy.name[lang]} вступает в фазу: ${phase.name[lang]}!` : `${enemy.name[lang]} enters phase: ${phase.name[lang]}!`);
      }
    }

    const spend = (cost: number) => {
      enemy.energy = Math.max(0, enemy.energy - cost);
    };
    const canSpend = (cost: number) => enemy.energy >= cost;

    const lowHp = enemy.hp <= enemy.maxHp * 0.35;
    const lowEnergy = enemy.energy <= 10;

    if (enemy.role === 'alchemist' && lowHp && canSpend(10) && Math.random() < 0.45) {
      spend(10);
      const heal = 10 + enemy.level * 3;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
      logs.push(lang === 'ru' ? `${enemy.name[lang]} использует зелье и восстанавливает ${heal} HP.` : `${enemy.name[lang]} drinks a potion and restores ${heal} HP.`);
      set({ currentEnemy: enemy, combatLogs: logs, combatCombo: combo, combatAdrenaline: adrenaline });
      return;
    }

    if (lowEnergy || (enemy.role === 'tank' && Math.random() < 0.35) || Math.random() < 0.2) {
      enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + 14 + enemy.level);
      enemy.isBlocking = true;
      logs.push(lang === 'ru' ? `${enemy.name[lang]} уходит в блок и восстанавливает энергию.` : `${enemy.name[lang]} takes a defensive stance and recovers energy.`);
      set({ currentEnemy: enemy, combatLogs: logs, combatCombo: combo, combatAdrenaline: adrenaline });
      return;
    }

    let attackCost = 8;
    let hit = rollDamage(enemy.damage);
    const style = state.combatStyle;
    const punishBlock = enemy.adaptiveProfile?.punishBlocking && style.block >= style.attack;
    const punishItems = enemy.adaptiveProfile?.punishConsumables && style.item >= 2;
    const punishAggro = enemy.adaptiveProfile?.punishAggression && style.attack >= style.block + style.item;

    if (canSpend(18) && (punishAggro || Math.random() < 0.25)) {
      attackCost = 18;
      hit = Math.floor(hit * 1.35 * enemy.damageMod);
      logs.push(lang === 'ru' ? `${enemy.name[lang]} использует мощный удар!` : `${enemy.name[lang]} uses a heavy strike!`);
    } else if (canSpend(12) && (punishItems || punishBlock || Math.random() < 0.25)) {
      attackCost = 12;
      hit = Math.floor(rollDamage([8, 14]) * enemy.damageMod);
      logs.push(lang === 'ru' ? `${enemy.name[lang]} бросает в вас снаряд!` : `${enemy.name[lang]} throws a projectile at you!`);
    }

    if (!canSpend(attackCost)) {
      enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + 10);
      enemy.isBlocking = true;
      logs.push(lang === 'ru' ? `${enemy.name[lang]} выжидает и восстанавливает силы.` : `${enemy.name[lang]} pauses to recover stamina.`);
      set({ currentEnemy: enemy, combatLogs: logs, combatCombo: combo, combatAdrenaline: adrenaline });
      return;
    }

    spend(attackCost);
    enemy.isBlocking = false;

    const weatherFx = WEATHER[state.currentWeather].combatEffect;
    if (weatherFx?.enemyDamageMod) hit = Math.floor(hit * weatherFx.enemyDamageMod);

    const guardLevel = player.learnedSkills['guard_master_1'] || 0;
    if (state.isPlayerBlocking) {
      const blockFactor = Math.max(0.2, 0.35 - guardLevel * 0.05);
      hit = Math.floor(hit * blockFactor);
    }

    hit = Math.max(1, hit - playerStats.defense);
    hit = applyResist(hit, enemy.damageType || 'physical', undefined);
    player.hp = Math.max(0, player.hp - hit);
    combo = 0;
    adrenaline = Math.min(ADRENALINE_MAX, adrenaline + Math.max(6, Math.floor(hit / 2)));
    logs.push(lang === 'ru' ? `${enemy.name[lang]} бьет вас на ${hit} урона.` : `${enemy.name[lang]} hits you for ${hit} damage.`);

    if (enemy.statusInflict && Math.random() <= enemy.statusInflict.chance) {
      player.statusEffects = [...(player.statusEffects || []), { ...enemy.statusInflict, source: enemy.id }];
      logs.push(lang === 'ru' ? `Вы получаете эффект: ${enemy.statusInflict.type}.` : `You are afflicted with ${enemy.statusInflict.type}.`);
    }

    if (state.isPlayerBlocking && Math.random() <= playerStats.counterChance) {
      const counter = Math.max(1, Math.floor(rollDamage([playerStats.minDamage, playerStats.maxDamage]) * 0.65));
      enemy.hp = Math.max(0, enemy.hp - counter);
      logs.push(lang === 'ru' ? `Контратака! Вы наносите ${counter} урона.` : `Counterattack! You deal ${counter} damage.`);
      if (enemy.hp <= 0) {
        completeCombatWin(player, enemy, logs);
        return;
      }
    }

    if (player.hp <= 0) {
      const penalized = applyChainFailurePenalty(state, { ...player, hp: Math.floor(player.maxHp * 0.3), energy: Math.floor(player.maxEnergy * 0.5) }, 'defeat');
      set({
        player: penalized.player,
        currentLocationId: 'town_oakhaven',
        status: 'hub',
        currentEnemy: null,
        combatLogs: penalized.failureLog ? [penalized.failureLog] : [],
        quests: penalized.quests,
        worldEconomy: penalized.worldEconomy,
        isPlayerBlocking: false,
        combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
        combatCombo: 0,
        combatAdrenaline: 0,
      });
      return;
    }

    set({ player, currentEnemy: enemy, combatLogs: logs, isPlayerBlocking: false, combatCombo: combo, combatAdrenaline: adrenaline });
  };

  const completeCombatWin = (playerSeed: Player, enemy: CombatEnemy, logsSeed: string[]) => {
    const state = get();
    const lang = state.settings.language;
    let player = { ...playerSeed, inventory: [...playerSeed.inventory] };
    let codexUnlocks = unlockCodex(state.codexUnlocks, 'enemies', enemy.id);
    const logs = [...logsSeed, lang === 'ru' ? `Вы победили ${enemy.name[lang]}!` : `You defeated ${enemy.name[lang]}!`];

    player.xp += enemy.xpReward;
    const gold = rollDamage(enemy.goldReward);
    if (gold > 0) {
      player.gold += gold;
      logs.push(lang === 'ru' ? `Получено ${gold} золота.` : `Gained ${gold} gold.`);
    }

    enemy.dropTable.forEach((drop) => {
      if (Math.random() >= drop.chance) return;
      codexUnlocks = unlockCodex(codexUnlocks, 'items', drop.itemId);
      const count = rollDamage([drop.min, drop.max]);
      const add = addItem(player, drop.itemId, count);
      player = add.player;
      if (add.added > 0) logs.push(lang === 'ru' ? `Добыча: ${ITEMS[drop.itemId].name[lang]} x${add.added}` : `Looted: ${ITEMS[drop.itemId].name[lang]} x${add.added}`);
      if (add.added < count) logs.push(lang === 'ru' ? 'Рюкзак переполнен, часть добычи потеряна.' : 'Backpack is full, some loot was lost.');
    });

    const progressedQuests = state.quests.map((q) => {
      if (q.isCompleted || (q.offerState || 'active') !== 'active' || q.locationId !== state.currentLocationId) return q;
      let progressed = false;
      const goals = q.goals.map((g) => {
        if (g.type === 'kill' && g.targetId === enemy.id && g.currentCount < g.targetCount) {
          progressed = true;
          return { ...g, currentCount: g.currentCount + 1 };
        }
        return g;
      });
      if (!progressed) return q;
      const completed = goals.every((g) => g.currentCount >= g.targetCount);
      if (!completed) return { ...q, goals, isTurnInReady: false };

      logs.push(
        lang === 'ru'
          ? `Цель задания достигнута: ${q.name[lang]}. Вернитесь к NPC для сдачи.`
          : `Quest objective complete: ${q.name[lang]}. Return to the quest giver to turn it in.`,
      );
      return { ...q, goals, isTurnInReady: true };
    });

    player = applyLevelUps(player, lang, logs);
    const quests = syncQuestStates(progressedQuests, player);

    const chainedQuest = quests.find((q) =>
      !q.isCompleted
      && (q.offerState || 'active') === 'active'
      && q.isEventQuest
      && (q.eventQuest?.originType === 'war' || q.eventQuest?.originType === 'caravan_attack')
      && q.locationId === state.currentLocationId
      && q.goals.some((g) => g.type === 'kill' && g.currentCount < g.targetCount),
    );
    if (chainedQuest) {
      const pendingKillGoal = chainedQuest.goals.find((g) => g.type === 'kill' && g.currentCount < g.targetCount);
      const nextEnemyTemplate = pendingKillGoal ? ENEMIES[pendingKillGoal.targetId] : null;
      if (pendingKillGoal && nextEnemyTemplate) {
        const stageIndex = pendingKillGoal.currentCount + 1;
        const stageTotal = pendingKillGoal.targetCount;
        logs.push(
          lang === 'ru'
            ? `Боевая цепочка продолжается: этап ${stageIndex}/${stageTotal}.`
            : `Combat chain continues: stage ${stageIndex}/${stageTotal}.`,
        );
        set({
          player,
          currentEnemy: buildEnemy(nextEnemyTemplate),
          status: 'combat',
          combatLogs: logs,
          quests,
          codexUnlocks,
          isPlayerBlocking: false,
          combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
          combatCombo: 0,
          combatAdrenaline: 0,
        });
        return;
      }
    }

    set({
      player,
      currentEnemy: { ...enemy, hp: 0, isBlocking: false },
      combatLogs: logs,
      quests,
      codexUnlocks,
      isPlayerBlocking: false,
      combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
      combatCombo: 0,
      combatAdrenaline: 0,
    });
  };

  return {
    player: STARTING_PLAYER,
    currentLocationId: 'town_oakhaven',
    currentWeather: 'clear',
    weatherDuration: 0,
    quests: syncQuestStates(deepCloneQuests(INITIAL_QUESTS), STARTING_PLAYER),
    codexUnlocks: normalizeCodexUnlocks(null, STARTING_PLAYER),
    worldEconomy: createDefaultWorldEconomy(),
    status: 'hub',
    settings: DEFAULT_SETTINGS,
    currentEnemy: null,
    combatLogs: [],
    isPlayerBlocking: false,
    combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
    combatCombo: 0,
    combatAdrenaline: 0,

    setLanguage: (lang) => {
      set((state) => ({ settings: { ...state.settings, language: lang } }));
      get().saveGame();
    },

    setVoiceSetting: (channel, enabled) => {
      set((state) => ({
        settings: {
          ...state.settings,
          voice: {
            ...state.settings.voice,
            [channel]: enabled,
          },
        },
      }));
      get().saveGame();
    },

    setTutorialEnabled: (enabled) => {
      set((state) => ({
        settings: {
          ...state.settings,
          tutorial: {
            ...state.settings.tutorial,
            enabled,
          },
        },
      }));
      get().saveGame();
    },

    advanceTutorialStep: () => {
      set((state) => {
        const nextStep = (state.settings.tutorial.step || 0) + 1;
        const completed = nextStep >= 5;
        return {
          settings: {
            ...state.settings,
            tutorial: {
              ...state.settings.tutorial,
              step: completed ? 5 : nextStep,
              completed,
            },
          },
        };
      });
      get().saveGame();
    },

    skipTutorial: () => {
      set((state) => ({
        settings: {
          ...state.settings,
          tutorial: {
            ...state.settings.tutorial,
            completed: true,
            step: 5,
          },
        },
      }));
      get().saveGame();
    },

    resetTutorial: () => {
      set((state) => ({
        settings: {
          ...state.settings,
          tutorial: {
            enabled: true,
            completed: false,
            step: 0,
            seenHints: [],
          },
        },
      }));
      get().saveGame();
    },

    markTutorialHintSeen: (hintId) => {
      set((state) => {
        const seen = state.settings.tutorial.seenHints || [];
        if (seen.includes(hintId)) return state;
        return {
          settings: {
            ...state.settings,
            tutorial: {
              ...state.settings.tutorial,
              seenHints: [...seen, hintId],
            },
          },
        };
      });
      get().saveGame();
    },

    chooseClass: (classId, bonuses, heroName) => {
      const state = get();
      if (!CLASSES[classId]) return;
      const loaded = applyClassLoadout({ ...state.player }, classId, bonuses, heroName);
      set({
        player: loaded,
        codexUnlocks: normalizeCodexUnlocks(state.codexUnlocks, loaded),
        worldEconomy: normalizeWorldEconomy(state.worldEconomy),
        currentEnemy: null,
        combatLogs: [],
        isPlayerBlocking: false,
        status: 'hub',
        combatCombo: 0,
        combatAdrenaline: 0,
        settings: {
          ...state.settings,
          tutorial: {
            enabled: true,
            completed: false,
            step: 0,
            seenHints: [],
          },
        },
      });
      get().saveGame();
    },

    tickWeather: () => {
      const state = get();
      let newDuration = state.weatherDuration - 1;
      let newWeather = state.currentWeather;
      if (newDuration <= 0) {
        const loc = LOCATIONS[state.currentLocationId];
        const allowed = loc.allowedWeather || ['clear', 'rain', 'fog', 'storm', 'snow'];
        newWeather = allowed[Math.floor(Math.random() * allowed.length)];
        newDuration = Math.floor(Math.random() * 5) + 3;
      }
      set({ currentWeather: newWeather, weatherDuration: newDuration });
    },

    acceptQuest: (questId, npcId) => {
      const state = get();
      const existing = state.quests.find((q) => q.id === questId);
      if (existing && existing.isEventQuest) {
        if (!existing.eventQuest || existing.eventQuest.branch === 'unselected') return;
        if ((existing.offerState || 'active') !== 'offered') return;
        const quests = syncQuestStates(
          state.quests.map((q) => (q.id === questId ? { ...q, offerState: 'active', isTurnInReady: false } : q)),
          state.player,
        );
        set({ quests });
        get().saveGame();
        return;
      }
      const questDef = ALL_QUESTS[questId];
      let codexUnlocks = state.codexUnlocks;
      if (npcId) codexUnlocks = unlockCodex(codexUnlocks, 'npcs', npcId);
      if (questDef && !state.quests.find((q) => q.id === questId)) {
        const quest = JSON.parse(JSON.stringify(questDef)) as Quest;
        quest.offerState = 'active';
        if (npcId && !quest.giverNpcId) quest.giverNpcId = npcId;
        if (npcId && !quest.turnInNpcId) quest.turnInNpcId = npcId;
        quest.isTurnInReady = false;
        codexUnlocks = unlockCodex(codexUnlocks, 'locations', quest.locationId);
        set({ quests: syncQuestStates([...state.quests, quest], state.player), codexUnlocks });
        get().saveGame();
      } else if (codexUnlocks !== state.codexUnlocks) {
        set({ codexUnlocks });
        get().saveGame();
      }
    },

    chooseEventQuestBranch: (questId, branch) => {
      const state = get();
      const quest = state.quests.find((q) => q.id === questId);
      if (!quest || !quest.isEventQuest || !quest.eventQuest) return;
      if ((quest.offerState || 'active') !== 'offered') return;
      const updatedQuest = applyEventQuestBranch(quest, branch);
      const quests = syncQuestStates(
        state.quests.map((q) => (q.id === questId ? updatedQuest : q)),
        state.player,
      );
      set({ quests });
      get().saveGame();
    },

    turnInQuest: (questId, npcId) => {
      const state = get();
      const quest = state.quests.find((q) => q.id === questId);
      if (!quest || quest.isCompleted || !quest.isTurnInReady) return;
      if (!quest.isEventQuest && (quest.turnInNpcId || quest.giverNpcId) !== npcId) return;

      const logs = [...state.combatLogs];
      let player = applyQuestRewards(state.player, quest, state.settings.language, logs);
      player = applyLevelUps(player, state.settings.language, logs);
      let codexUnlocks = state.codexUnlocks;
      if (npcId) codexUnlocks = unlockCodex(codexUnlocks, 'npcs', npcId);
      codexUnlocks = unlockCodex(codexUnlocks, 'locations', quest.locationId);
      (quest.rewards.items || []).forEach((reward) => {
        codexUnlocks = unlockCodex(codexUnlocks, 'items', reward.itemId);
      });
      let worldEconomy = state.worldEconomy;
      if (LOCATIONS[state.currentLocationId]?.type === 'hub') {
        worldEconomy = updateHubEconomy(worldEconomy, state.currentLocationId, {
          wealth: Math.max(4, Math.floor(quest.rewards.gold * 0.18)),
          demand: 1,
          stability: 1,
          playerRelation: 3,
        });
      }
      if (quest.isEventQuest && quest.eventQuest) {
        const targetHubId = quest.eventQuest.targetHubId;
        const otherHubId = quest.eventQuest.opponentHubId;
        const branch = quest.eventQuest.branch;
        if (worldEconomy.hubs[targetHubId]) {
          if (branch === 'support' || branch === 'support_a') {
            worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
              wealth: 40,
              stability: 8,
              playerRelation: 9,
              demand: -3,
              supply: 4,
            });
            if (otherHubId && worldEconomy.hubs[otherHubId]) {
              worldEconomy = updateHubEconomy(worldEconomy, otherHubId, {
                playerRelation: -8,
                stability: -2,
              });
              worldEconomy = updateHubRelation(worldEconomy, targetHubId, otherHubId, 8);
            }
          } else if (branch === 'support_b' && otherHubId && worldEconomy.hubs[otherHubId]) {
            worldEconomy = updateHubEconomy(worldEconomy, otherHubId, {
              wealth: 40,
              stability: 8,
              playerRelation: 9,
              demand: -3,
              supply: 4,
            });
            worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
              playerRelation: -8,
              stability: -2,
            });
            worldEconomy = updateHubRelation(worldEconomy, targetHubId, otherHubId, 8);
          } else if (branch === 'neutral') {
            worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
              playerRelation: -3,
            });
            if (otherHubId && worldEconomy.hubs[otherHubId]) {
              worldEconomy = updateHubEconomy(worldEconomy, otherHubId, {
                playerRelation: -3,
              });
              worldEconomy = updateHubRelation(worldEconomy, targetHubId, otherHubId, -4);
            }
          } else if (branch === 'punish') {
            worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
              wealth: -48,
              stability: -10,
              playerRelation: -10,
              demand: 4,
              supply: -4,
            });
          }
        }
      }
      let quests = syncQuestStates(
        state.quests.map((q) =>
          q.id === questId
            ? { ...q, isCompleted: true, isTurnInReady: false, offerState: 'resolved' }
            : q,
        ),
        player,
      );
      if (quest.isEventQuest) {
        const followup = buildFollowupEventQuest(quest);
        if (followup && !quests.some((q) => q.id === followup.id)) {
          quests = syncQuestStates([...quests, followup], player);
        }
      }

      set({ player, quests, combatLogs: logs, codexUnlocks, worldEconomy });
      get().saveGame();
    },

    unlockCodexEntry: (section, id) => {
      const state = get();
      const codexUnlocks = unlockCodex(state.codexUnlocks, section, id);
      if (codexUnlocks === state.codexUnlocks) return;
      set({ codexUnlocks });
      get().saveGame();
    },

    raidCaravan: (hubId) => {
      const state = get();
      const currentHubId = state.currentLocationId;
      if (!state.worldEconomy.hubs[hubId]) return;
      let worldEconomy = updateHubEconomy(state.worldEconomy, hubId, {
        supply: -6,
        demand: 5,
        stability: -5,
        playerRelation: -8,
        wealth: -20,
        tradeTurnover: -12,
      });
      if (state.worldEconomy.hubs[currentHubId] && currentHubId !== hubId) {
        worldEconomy = updateHubRelation(worldEconomy, currentHubId, hubId, -10);
      }
      const tradeRoutes = Object.entries(worldEconomy.tradeRoutes).reduce<WorldEconomyState['tradeRoutes']>((acc, [routeId, route]) => {
        if (route.fromHubId === hubId || route.toHubId === hubId) {
          acc[routeId] = {
            ...route,
            flow: clamp(route.flow - 10, 0, 100),
            risk: clamp(route.risk + 12, 0, 100),
          };
        } else acc[routeId] = route;
        return acc;
      }, {});
      const withRoutes = { ...worldEconomy, tradeRoutes };
      const withEvent = appendEconomyEvent(withRoutes, {
        type: 'player_raid',
        hubId,
        targetHubId: currentHubId !== hubId ? currentHubId : undefined,
        intensity: 61,
      });
      set({ worldEconomy: withEvent });
      get().saveGame();
    },

    investInHub: (hubId, goldAmount) => {
      const state = get();
      const amount = Math.max(0, Math.floor(goldAmount));
      if (amount <= 0) return;
      if (state.player.gold < amount) return;
      if (!state.worldEconomy.hubs[hubId]) return;
      const player = { ...state.player, gold: state.player.gold - amount };
      const wealthDelta = Math.floor(amount * 0.7);
      const worldEconomy = updateHubEconomy(state.worldEconomy, hubId, {
        wealth: wealthDelta,
        treasury: amount,
        stability: Math.max(1, Math.floor(amount / 35)),
        playerRelation: Math.max(1, Math.floor(amount / 45)),
        tradeTurnover: Math.max(1, Math.floor(amount / 25)),
      });
      const withEvent = appendEconomyEvent(worldEconomy, {
        type: 'player_investment',
        hubId,
        intensity: clamp(Math.floor(amount / 8), 8, 90),
      });
      set({ player, worldEconomy: withEvent });
      get().saveGame();
    },

    runDiplomacy: (hubId) => {
      const state = get();
      const currentHubId = state.currentLocationId;
      if (!state.worldEconomy.hubs[hubId]) return;
      let worldEconomy = updateHubEconomy(state.worldEconomy, hubId, {
        stability: 3,
        playerRelation: 6,
      });
      if (state.worldEconomy.hubs[currentHubId] && currentHubId !== hubId) {
        worldEconomy = updateHubRelation(worldEconomy, currentHubId, hubId, 12);
      }
      const withEvent = appendEconomyEvent(worldEconomy, {
        type: 'player_diplomacy',
        hubId,
        targetHubId: currentHubId !== hubId ? currentHubId : undefined,
        intensity: 42,
      });
      set({ worldEconomy: withEvent });
      get().saveGame();
    },

    sabotageHub: (hubId) => {
      const state = get();
      if (!state.worldEconomy.hubs[hubId]) return;
      const worldEconomy = updateHubEconomy(state.worldEconomy, hubId, {
        wealth: -60,
        stability: -9,
        supply: -6,
        demand: 6,
        playerRelation: -12,
        tradeTurnover: -15,
      });
      const withEvent = appendEconomyEvent(worldEconomy, {
        type: 'player_sabotage',
        hubId,
        intensity: 74,
      });
      set({ worldEconomy: withEvent });
      get().saveGame();
    },

    loadSave: () => {
      const applySave = (data: SaveData) => {
        const loadedPlayer = { ...STARTING_PLAYER, ...data.player };
        if (!loadedPlayer.learnedSkills) loadedPlayer.learnedSkills = {};
        if (!loadedPlayer.knownRecipes) loadedPlayer.knownRecipes = [];
        if (!loadedPlayer.cooldowns) loadedPlayer.cooldowns = {};
        if (!loadedPlayer.questPerks) loadedPlayer.questPerks = [];
        if (!loadedPlayer.statusEffects) loadedPlayer.statusEffects = [];
        if (!loadedPlayer.merchantReputation) loadedPlayer.merchantReputation = { merchant_oakhaven: 0 };
        if (!loadedPlayer.backpackSlots) loadedPlayer.backpackSlots = { potion: 12, material: 24 };
        if (loadedPlayer.fatigue === undefined) loadedPlayer.fatigue = 0;
        if (!loadedPlayer.discoveredLocations) loadedPlayer.discoveredLocations = ['town_oakhaven'];
        if (loadedPlayer.classId === undefined) loadedPlayer.classId = null;
        if (loadedPlayer.specializationId === undefined) loadedPlayer.specializationId = 'duelist';
        if (loadedPlayer.prestigeLevel === undefined) loadedPlayer.prestigeLevel = 0;
        if (loadedPlayer.skillPoints === undefined) loadedPlayer.skillPoints = 0;
        if (loadedPlayer.maxEnergy === undefined) loadedPlayer.maxEnergy = 60;
        if (loadedPlayer.energy === undefined) loadedPlayer.energy = loadedPlayer.maxEnergy;
        if (loadedPlayer.carryCapacity === undefined) loadedPlayer.carryCapacity = 35;
        set({
          player: loadedPlayer,
          currentLocationId: data.currentLocationId,
          currentWeather: data.currentWeather || 'clear',
          weatherDuration: data.weatherDuration || 0,
          quests: syncQuestStates(data.quests || deepCloneQuests(INITIAL_QUESTS), loadedPlayer),
          codexUnlocks: normalizeCodexUnlocks(data.codexUnlocks, loadedPlayer),
          worldEconomy: normalizeWorldEconomy(data.worldEconomy),
          status: data.status === 'combat' ? 'exploring' : data.status,
          settings: normalizeSettings(data.settings || DEFAULT_SETTINGS),
          currentEnemy: null,
          combatLogs: [],
          isPlayerBlocking: false,
          combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
          combatCombo: 0,
          combatAdrenaline: 0,
        });
      };

      let localData: SaveData | null = null;
      const localSaved = localStorage.getItem(SAVE_KEY);
      if (localSaved) {
        try {
          localData = JSON.parse(localSaved) as SaveData;
          applySave(localData);
        } catch (e) {
          console.error('Failed to load local save', e);
        }
      }

      const telegramUserId = getTelegramUserId();
      if (!telegramUserId) return;

      loadRemoteSave(telegramUserId)
        .then((remoteSave) => {
          if (!remoteSave) return;
          if ((remoteSave.timestamp || 0) >= (localData?.timestamp || 0)) applySave(remoteSave);
        })
        .catch((e) => {
          console.error('Failed to load remote save', e);
        });
    },

    saveGame: () => {
      const state = get();
      const saveData: SaveData = {
        player: state.player,
        currentLocationId: state.currentLocationId,
        currentWeather: state.currentWeather,
        weatherDuration: state.weatherDuration,
        quests: state.quests,
        codexUnlocks: state.codexUnlocks,
        worldEconomy: state.worldEconomy,
        status: state.status,
        settings: state.settings,
        timestamp: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      const telegramUserId = getTelegramUserId();
      if (telegramUserId) {
        upsertRemoteSave(telegramUserId, saveData).catch((e) => console.error('Failed to sync remote save', e));
      }
    },

    resetGame: () => {
      set({
        player: { ...STARTING_PLAYER },
        currentLocationId: 'town_oakhaven',
        currentWeather: 'clear',
        weatherDuration: 5,
        quests: syncQuestStates(deepCloneQuests(INITIAL_QUESTS), STARTING_PLAYER),
        codexUnlocks: normalizeCodexUnlocks(null, STARTING_PLAYER),
        worldEconomy: createDefaultWorldEconomy(),
        status: 'hub',
        currentEnemy: null,
        combatLogs: [],
        isPlayerBlocking: false,
        combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
        combatCombo: 0,
        combatAdrenaline: 0,
      });
      localStorage.removeItem(SAVE_KEY);
      const telegramUserId = getTelegramUserId();
      if (telegramUserId) {
        deleteRemoteSave(telegramUserId).catch((e) => console.error('Failed to delete remote save', e));
      }
    },

    travelTo: (locationId) => {
      get().tickWeather();
      const state = get();
      const targetLoc = LOCATIONS[locationId];
      const lang = state.settings.language;
      let player = { ...state.player };
      let codexUnlocks = unlockCodex(state.codexUnlocks, 'locations', locationId);
      let worldEconomy = simulateWorldEconomyTick(state.worldEconomy, state.currentWeather);
      const expansion = expandHubsIfEligible(worldEconomy);
      worldEconomy = expansion.worldEconomy;
      const questsWithEvents = withGeneratedEventQuests(state.quests, worldEconomy);
      let encounterChance = 0.3;
      const weatherFx = WEATHER[state.currentWeather].exploreEffect;
      if (weatherFx?.encounterChanceMod) encounterChance += weatherFx.encounterChanceMod;

      const wasDiscovered = (player.discoveredLocations || []).includes(locationId);
      const travelFatigueGain = targetLoc.type === 'hub' ? 4 : 8;
      player.fatigue = Math.min(FATIGUE_MAX, (player.fatigue || 0) + travelFatigueGain);
      if (!wasDiscovered) {
        player.discoveredLocations = [...(player.discoveredLocations || []), locationId];
        player.xp += 30;
        player.gold += 18;
      }
      const fatigueFactor = getFatigueFactor(player);
      encounterChance += fatigueFactor * 0.08;

      const progressedQuests = questsWithEvents.map((q) => {
        if (q.isCompleted || (q.offerState || 'active') !== 'active') return q;
        const goals = q.goals.map((g) => {
          if (g.type === 'explore' && g.targetId === locationId && g.currentCount < g.targetCount) return { ...g, currentCount: g.currentCount + 1 };
          return g;
        });
        return { ...q, goals };
      });
      const nextQuests = syncQuestStates(progressedQuests, state.player);

      if (targetLoc.possibleEnemies && Math.random() < encounterChance) {
        const enemyId = targetLoc.possibleEnemies[Math.floor(Math.random() * targetLoc.possibleEnemies.length)];
        const enemyTemplate = ENEMIES[enemyId];
        codexUnlocks = unlockCodex(codexUnlocks, 'enemies', enemyId);
        const logs = [
          !wasDiscovered
            ? lang === 'ru'
              ? `Открыта новая локация: ${targetLoc.name[lang]} (+30 XP, +18 золота).`
              : `Discovered new location: ${targetLoc.name[lang]} (+30 XP, +18 gold).`
            : '',
          lang === 'ru' ? `На вас напал ${enemyTemplate.name[lang]} во время путешествия!` : `You were ambushed by a ${enemyTemplate.name[lang]} while traveling!`,
        ].filter(Boolean) as string[];
        if (expansion.spawnedHubId && LOCATIONS[expansion.spawnedHubId]) {
          logs.push(
            lang === 'ru'
              ? `На карте основан новый хаб: ${LOCATIONS[expansion.spawnedHubId].name[lang]}.`
              : `A new hub has been founded: ${LOCATIONS[expansion.spawnedHubId].name[lang]}.`,
          );
        }
        player = applyLevelUps(player, lang, logs);
        if (targetLoc.type === 'hub') {
          worldEconomy = updateHubEconomy(worldEconomy, locationId, { wealth: 6, stability: 1, playerRelation: 1 });
        }
        set({ player, currentLocationId: locationId, status: 'combat', currentEnemy: buildEnemy(enemyTemplate), combatLogs: logs, isPlayerBlocking: false, quests: nextQuests, codexUnlocks, worldEconomy, combatCombo: 0, combatAdrenaline: 0 });
      } else {
        const logs = !wasDiscovered
          ? [lang === 'ru' ? `Открыта новая локация: ${targetLoc.name[lang]} (+30 XP, +18 золота).` : `Discovered new location: ${targetLoc.name[lang]} (+30 XP, +18 gold).`]
          : [];
        if (expansion.spawnedHubId && LOCATIONS[expansion.spawnedHubId]) {
          logs.push(
            lang === 'ru'
              ? `На карте основан новый хаб: ${LOCATIONS[expansion.spawnedHubId].name[lang]}.`
              : `A new hub has been founded: ${LOCATIONS[expansion.spawnedHubId].name[lang]}.`,
          );
        }
        player = applyLevelUps(player, lang, logs);
        if (targetLoc.type === 'hub') {
          worldEconomy = updateHubEconomy(worldEconomy, locationId, { wealth: 8, stability: 1, playerRelation: 1 });
        }
        set({ player, currentLocationId: locationId, status: targetLoc.type === 'hub' ? 'hub' : 'exploring', quests: nextQuests, codexUnlocks, worldEconomy, combatLogs: logs.length > 0 ? logs : state.combatLogs });
      }
      get().saveGame();
    },

    explore: () => {
      get().tickWeather();
      const state = get();
      const loc = LOCATIONS[state.currentLocationId];
      if (loc.type === 'hub') return;
      const fatigueFactor = getFatigueFactor(state.player);
      let codexUnlocks = unlockCodex(state.codexUnlocks, 'locations', state.currentLocationId);
      let worldEconomy = simulateWorldEconomyTick(state.worldEconomy, state.currentWeather);
      const expansion = expandHubsIfEligible(worldEconomy);
      worldEconomy = expansion.worldEconomy;
      const questsWithEvents = withGeneratedEventQuests(state.quests, worldEconomy);

      const roll = Math.random();
      let encounterChance = 0.22;
      let lootChance = 0.9;
      const weatherFx = WEATHER[state.currentWeather].exploreEffect;
      if (weatherFx?.encounterChanceMod) encounterChance += weatherFx.encounterChanceMod;
      if (weatherFx?.lootChanceMod) lootChance += weatherFx.lootChanceMod;
      encounterChance += fatigueFactor * 0.1;
      lootChance -= fatigueFactor * 0.15;
      const scavLevel = state.player.learnedSkills['scavenger_1'] || 0;
      if (scavLevel > 0) lootChance += scavLevel * 0.05;

      if (roll < lootChance && loc.possibleLoot) {
        const lootId = loc.possibleLoot[Math.floor(Math.random() * loc.possibleLoot.length)];
        if (lootId === 'gold') {
          const amount = Math.floor(Math.random() * 10) + 1;
          const player = { ...state.player, gold: state.player.gold + amount, fatigue: Math.min(FATIGUE_MAX, (state.player.fatigue || 0) + 6) };
          set({ player, quests: syncQuestStates(questsWithEvents, player), codexUnlocks, worldEconomy });
        } else {
          codexUnlocks = unlockCodex(codexUnlocks, 'items', lootId);
          const player = addItem(state.player, lootId, 1).player;
          player.fatigue = Math.min(FATIGUE_MAX, (player.fatigue || 0) + 6);
          set({ player, quests: syncQuestStates(questsWithEvents, player), codexUnlocks, worldEconomy });
        }
      } else if (loc.possibleEnemies && Math.random() < encounterChance) {
        const enemyId = loc.possibleEnemies[Math.floor(Math.random() * loc.possibleEnemies.length)];
        const enemyTemplate = ENEMIES[enemyId];
        codexUnlocks = unlockCodex(codexUnlocks, 'enemies', enemyId);
        const lang = state.settings.language;
        const encounterMsg = lang === 'ru' ? `Во время исследования вы встретили ${enemyTemplate.name[lang]}!` : `While exploring, you encountered a ${enemyTemplate.name[lang]}!`;
        const logMsg = expansion.spawnedHubId && LOCATIONS[expansion.spawnedHubId]
          ? `${encounterMsg}\n${lang === 'ru'
            ? `На карте основан новый хаб: ${LOCATIONS[expansion.spawnedHubId].name[lang]}.`
            : `A new hub has been founded: ${LOCATIONS[expansion.spawnedHubId].name[lang]}.`}`
          : encounterMsg;
        set({
          player: { ...state.player, fatigue: Math.min(FATIGUE_MAX, (state.player.fatigue || 0) + 6) },
          status: 'combat',
          currentEnemy: buildEnemy(enemyTemplate),
          combatLogs: [logMsg],
          quests: syncQuestStates(questsWithEvents, state.player),
          codexUnlocks,
          worldEconomy,
          isPlayerBlocking: false,
          combatCombo: 0,
          combatAdrenaline: 0,
        });
      } else if (Math.random() < 0.1) {
        const bonusSkill = expansion.spawnedHubId ? 1 : 0;
        set({
          player: {
            ...state.player,
            skillPoints: state.player.skillPoints + 1 + bonusSkill,
            fatigue: Math.min(FATIGUE_MAX, (state.player.fatigue || 0) + 5),
          },
          quests: syncQuestStates(questsWithEvents, state.player),
          codexUnlocks,
          worldEconomy,
        });
      } else {
        set({
          player: {
            ...state.player,
            fatigue: Math.min(FATIGUE_MAX, (state.player.fatigue || 0) + 4),
          },
          quests: syncQuestStates(questsWithEvents, state.player),
          codexUnlocks,
          worldEconomy,
        });
      }
      get().saveGame();
    },

    camp: () => {
      set({ status: 'camp' });
      get().saveGame();
    },

    breakCamp: () => {
      set({ status: 'exploring' });
      get().saveGame();
    },

    rest: () => {
      set((state) => ({
        player: {
          ...state.player,
          hp: state.player.maxHp,
          energy: state.player.maxEnergy,
          fatigue: Math.max(0, (state.player.fatigue || 0) - 45),
        },
      }));
      get().saveGame();
    },

    attack: () => {
      const state = get();
      if (!state.currentEnemy) return;
      const lang = state.settings.language;
      if (state.player.energy < ENERGY_COSTS.attack) {
        set({ combatLogs: [...state.combatLogs, lang === 'ru' ? 'Недостаточно энергии для атаки.' : 'Not enough energy to attack.'] });
        return;
      }

      const stats = getCombatStats(state.player, state.currentWeather);
      const baseDamage = rollDamage([stats.minDamage, stats.maxDamage]);
      const isCrit = Math.random() <= stats.critChance;
      const critMult = isCrit ? 1.6 : 1;
      const comboBonus = 1 + Math.min(COMBO_MAX, state.combatCombo) * 0.06;
      let finalDamage = Math.max(1, Math.floor(baseDamage * critMult * comboBonus * (state.currentEnemy.isBlocking ? 0.45 : 1)));
      finalDamage = applyResist(finalDamage, stats.damageType, state.currentEnemy.resistances);
      finalDamage = Math.floor(finalDamage / (state.currentEnemy.defenseMod || 1));
      const enemy = { ...state.currentEnemy, hp: Math.max(0, state.currentEnemy.hp - finalDamage), isBlocking: false };
      const player = { ...state.player, energy: Math.max(0, state.player.energy - ENERGY_COSTS.attack) };
      const logs = [
        ...state.combatLogs,
        lang === 'ru'
          ? `Вы ударили ${state.currentEnemy.name[lang]} на ${finalDamage} урона${isCrit ? ' (Крит!)' : ''}.`
          : `You hit ${state.currentEnemy.name[lang]} for ${finalDamage} damage${isCrit ? ' (Crit!)' : ''}.`,
      ];

      const weapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
      if (weapon?.stats?.statusOnHit && Math.random() <= weapon.stats.statusOnHit.chance) {
        enemy.statusEffects = [...enemy.statusEffects, { ...weapon.stats.statusOnHit, source: weapon.id }];
        logs.push(lang === 'ru' ? `Наложен эффект: ${weapon.stats.statusOnHit.type}.` : `Applied status: ${weapon.stats.statusOnHit.type}.`);
      }

      if (enemy.hp <= 0) {
        completeCombatWin(player, enemy, logs);
        return;
      }
      set({
        player,
        currentEnemy: enemy,
        combatLogs: logs,
        isPlayerBlocking: false,
        combatStyle: { ...state.combatStyle, attack: state.combatStyle.attack + 1 },
        combatCombo: Math.min(COMBO_MAX, state.combatCombo + 1),
        combatAdrenaline: Math.min(ADRENALINE_MAX, state.combatAdrenaline + 14),
      });
      enemyTurn(logs);
    },

    block: () => {
      const state = get();
      if (!state.currentEnemy) return;
      const guardLevel = state.player.learnedSkills['guard_master_1'] || 0;
      const overload = getOverloadFactor(state.player);
      const recover = Math.max(6, Math.floor((14 + guardLevel * 5) * (1 - overload * 0.4)));
      const player = { ...state.player, energy: Math.min(state.player.maxEnergy, state.player.energy + recover) };
      const logs = [...state.combatLogs, state.settings.language === 'ru' ? 'Вы входите в блок и восстанавливаете энергию.' : 'You brace for impact and recover energy.'];
      set({
        player,
        combatLogs: logs,
        isPlayerBlocking: true,
        combatStyle: { ...state.combatStyle, block: state.combatStyle.block + 1 },
        combatCombo: 0,
        combatAdrenaline: Math.min(ADRENALINE_MAX, state.combatAdrenaline + 10),
      });
      enemyTurn(logs);
    },

    useSkill: (skillId) => {
      const state = get();
      if (!state.currentEnemy) return;
      const skillLevel = state.player.learnedSkills[skillId] || 0;
      const skill = SKILLS[skillId];
      if (!skill || skillLevel <= 0) return;
      if (skill.effect.type !== 'active' && skill.effect.type !== 'ultimate') return;

      const cooldown = state.player.cooldowns?.[skillId] || 0;
      if (cooldown > 0) return;
      const cost = skill.effect.energyCost || 0;
      if (state.player.energy < cost) return;

      const baseStats = getCombatStats(state.player, state.currentWeather);
      const scale = skill.effect.damageScale || 1;
      const dmgType = skill.effect.damageType || baseStats.damageType;
      const comboBonus = 1 + Math.min(COMBO_MAX, state.combatCombo) * 0.06;
      let damage = Math.max(1, Math.floor(rollDamage([baseStats.minDamage, baseStats.maxDamage]) * scale * comboBonus));
      damage = applyResist(damage, dmgType, state.currentEnemy.resistances);

      if (skill.id === 'ultimate_stormbreaker') {
        const hasBleed = state.currentEnemy.statusEffects.some((s) => s.type === 'bleeding');
        if (hasBleed) damage = Math.floor(damage * 1.25);
      }

      let enemy = { ...state.currentEnemy, hp: Math.max(0, state.currentEnemy.hp - damage), isBlocking: false };
      let player = { ...state.player, energy: state.player.energy - cost, cooldowns: { ...(state.player.cooldowns || {}) } };
      player.cooldowns![skillId] = skill.effect.cooldownTurns || 1;
      const logs = [
        ...state.combatLogs,
        state.settings.language === 'ru'
          ? `Вы используете ${skill.name.ru} и наносите ${damage} урона.`
          : `You use ${skill.name.en} and deal ${damage} damage.`,
      ];

      if (skill.effect.appliesStatus && Math.random() <= skill.effect.appliesStatus.chance) {
        enemy.statusEffects = [...enemy.statusEffects, { ...skill.effect.appliesStatus, source: skill.id }];
        logs.push(state.settings.language === 'ru' ? `Наложен эффект: ${skill.effect.appliesStatus.type}.` : `Applied status: ${skill.effect.appliesStatus.type}.`);
      }

      if (enemy.hp <= 0) {
        completeCombatWin(player, enemy, logs);
        return;
      }

      set({
        player,
        currentEnemy: enemy,
        combatLogs: logs,
        isPlayerBlocking: false,
        combatStyle: { ...state.combatStyle, skill: state.combatStyle.skill + 1 },
        combatCombo: Math.min(COMBO_MAX, state.combatCombo + 1),
        combatAdrenaline: Math.min(ADRENALINE_MAX, state.combatAdrenaline + 16),
      });
      enemyTurn(logs);
    },

    useCombatItem: (itemId, target) => {
      const state = get();
      if (!state.currentEnemy) return;
      const item = ITEMS[itemId];
      if (!item || item.type !== 'consumable') return;

      const invItem = state.player.inventory.find((i) => i.itemId === itemId);
      if (!invItem || invItem.quantity <= 0) return;

      const lang = state.settings.language;
      const actionCost = item.stats?.throwDamage && target === 'enemy' ? ENERGY_COSTS.throw : ENERGY_COSTS.item;
      if (state.player.energy < actionCost) {
        set({ combatLogs: [...state.combatLogs, lang === 'ru' ? 'Недостаточно энергии для использования предмета.' : 'Not enough energy to use this item.'] });
        return;
      }

      let player = removeItem(state.player, itemId, 1);
      player.energy = Math.max(0, player.energy - actionCost);
      let enemy = { ...state.currentEnemy };
      const logs = [...state.combatLogs];
      const alchemyLevel = state.player.learnedSkills['alchemist_1'] || 0;
      let combo = state.combatCombo;
      let adrenaline = state.combatAdrenaline;

      if (target === 'self') {
        const heal = item.stats?.heal ? Math.floor(item.stats.heal * (1 + alchemyLevel * 0.1)) : 0;
        const energyRestore = item.stats?.energyRestore || 0;
        if (itemId === 'potion_antidote') {
          player.statusEffects = (player.statusEffects || []).filter((s) => s.type !== 'poisoned');
          logs.push(lang === 'ru' ? 'Отравление снято.' : 'Poison removed.');
        }
        if (heal > 0) {
          player.hp = Math.min(player.maxHp, player.hp + heal);
          logs.push(lang === 'ru' ? `Вы выпили ${item.name[lang]} и восстановили ${heal} HP.` : `You drank ${item.name[lang]} and restored ${heal} HP.`);
        }
        if (energyRestore > 0) {
          player.energy = Math.min(player.maxEnergy, player.energy + energyRestore);
          logs.push(lang === 'ru' ? `Энергия восстановлена на ${energyRestore}.` : `Recovered ${energyRestore} energy.`);
        }
        combo = 0;
        adrenaline = Math.min(ADRENALINE_MAX, adrenaline + 8);
      } else {
        if (!item.stats?.throwDamage) {
          set({ combatLogs: [...logs, lang === 'ru' ? 'Этот предмет нельзя бросить во врага.' : 'This item cannot be thrown at an enemy.'] });
          return;
        }
        const throwDamage = rollDamage(item.stats.throwDamage);
        enemy.hp = Math.max(0, enemy.hp - throwDamage);
        enemy.isBlocking = false;
        logs.push(lang === 'ru' ? `Вы бросили ${item.name[lang]} и нанесли ${throwDamage} урона.` : `You threw ${item.name[lang]} and dealt ${throwDamage} damage.`);
        if (item.stats.statusOnHit && Math.random() <= item.stats.statusOnHit.chance) {
          enemy.statusEffects = [...enemy.statusEffects, { ...item.stats.statusOnHit, source: item.id }];
          logs.push(lang === 'ru' ? `Цель получает эффект: ${item.stats.statusOnHit.type}.` : `Target gains status: ${item.stats.statusOnHit.type}.`);
        }
        combo = Math.min(COMBO_MAX, combo + 1);
        adrenaline = Math.min(ADRENALINE_MAX, adrenaline + 12);
      }

      if (enemy.hp <= 0) {
        completeCombatWin(player, enemy, logs);
        return;
      }

      set({
        player,
        currentEnemy: enemy,
        combatLogs: logs,
        isPlayerBlocking: false,
        combatStyle: { ...state.combatStyle, item: state.combatStyle.item + 1 },
        combatCombo: combo,
        combatAdrenaline: adrenaline,
      });
      enemyTurn(logs);
    },

    useSecondWind: () => {
      const state = get();
      if (!state.currentEnemy) return;
      if (state.combatAdrenaline < SECOND_WIND_COST) return;
      const lang = state.settings.language;
      const heal = Math.floor(state.player.maxHp * 0.22);
      const energyGain = 25;
      const player = {
        ...state.player,
        hp: Math.min(state.player.maxHp, state.player.hp + heal),
        energy: Math.min(state.player.maxEnergy, state.player.energy + energyGain),
      };
      const logs = [
        ...state.combatLogs,
        lang === 'ru'
          ? `Вы используете Второе дыхание: +${heal} HP, +${energyGain} энергии.`
          : `You trigger Second Wind: +${heal} HP, +${energyGain} energy.`,
      ];
      set({
        player,
        combatLogs: logs,
        isPlayerBlocking: false,
        combatCombo: 0,
        combatAdrenaline: Math.max(0, state.combatAdrenaline - SECOND_WIND_COST),
      });
      enemyTurn(logs);
    },

    useItem: (itemId) => {
      const state = get();
      const item = ITEMS[itemId];
      if (!item) return;
      if (state.status === 'combat') {
        get().useCombatItem(itemId, 'self');
        return;
      }
      if (item.type === 'recipe') {
        get().learnRecipe(itemId);
        return;
      }
      if (item.type !== 'consumable') return;
      const invItem = state.player.inventory.find((i) => i.itemId === itemId);
      if (!invItem || invItem.quantity <= 0) return;

      const alchemyLevel = state.player.learnedSkills['alchemist_1'] || 0;
      const heal = item.stats?.heal ? Math.floor(item.stats.heal * (1 + alchemyLevel * 0.1)) : 0;
      const energyRestore = item.stats?.energyRestore || 0;
      let player = removeItem(state.player, itemId, 1);
      if (itemId === 'potion_antidote') player.statusEffects = (player.statusEffects || []).filter((s) => s.type !== 'poisoned');
      if (heal > 0) player.hp = Math.min(player.maxHp, player.hp + heal);
      if (energyRestore > 0) player.energy = Math.min(player.maxEnergy, player.energy + energyRestore);
      set({ player, quests: syncQuestStates(state.quests, player) });
      get().saveGame();
    },

    flee: () => {
      const state = get();
      if (!state.currentEnemy) return;
      const lang = state.settings.language;
      if (state.player.energy < ENERGY_COSTS.flee) {
        set({ combatLogs: [...state.combatLogs, lang === 'ru' ? 'Недостаточно энергии для побега.' : 'Not enough energy to flee.'] });
        return;
      }
      const player = { ...state.player, energy: Math.max(0, state.player.energy - ENERGY_COSTS.flee) };
      const overload = getOverloadFactor(state.player);
      if (Math.random() < 0.5 - overload * 0.3) {
        const penalized = applyChainFailurePenalty(state, player, 'flee');
        set({
          player: penalized.player,
          status: 'exploring',
          currentEnemy: null,
          combatLogs: penalized.failureLog ? [penalized.failureLog] : [],
          quests: penalized.quests,
          worldEconomy: penalized.worldEconomy,
          isPlayerBlocking: false,
          combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
          combatCombo: 0,
          combatAdrenaline: 0,
        });
        get().saveGame();
        return;
      }
      const logs = [...state.combatLogs, lang === 'ru' ? 'Не удалось сбежать!' : 'Failed to flee!'];
      set({ player, combatLogs: logs, isPlayerBlocking: false, combatCombo: 0 });
      enemyTurn(logs);
    },

    endCombat: () => {
      set({ status: 'exploring', currentEnemy: null, combatLogs: [], isPlayerBlocking: false, combatStyle: { attack: 0, block: 0, item: 0, skill: 0 }, combatCombo: 0, combatAdrenaline: 0 });
      get().saveGame();
    },

    buyItem: (itemId, price) => {
      const state = get();
      if (state.player.gold < price) return;
      if (!canCarry(state.player, itemId, 1)) return;
      const add = addItem(state.player, itemId, 1);
      if (add.added <= 0) return;
      const player = { ...add.player, gold: state.player.gold - price };
      let worldEconomy = state.worldEconomy;
      if (LOCATIONS[state.currentLocationId]?.type === 'hub') {
        worldEconomy = updateHubEconomy(worldEconomy, state.currentLocationId, {
          supply: -2,
          demand: 2,
          wealth: Math.max(1, Math.floor(price * 0.08)),
        });
      }
      set({ player, quests: syncQuestStates(state.quests, player), worldEconomy });
      get().saveGame();
    },

    sellItem: (itemId, price) => {
      const state = get();
      const itemInInv = state.player.inventory.find((i) => i.itemId === itemId);
      if (!itemInInv || itemInInv.quantity <= 0) return;

      const inventory = state.player.inventory
        .map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      const equipment = { ...state.player.equipment };
      if (inventory.find((i) => i.itemId === itemId) === undefined) {
        if (equipment.weapon === itemId) equipment.weapon = undefined;
        if (equipment.armor === itemId) equipment.armor = undefined;
      }

      const player = { ...state.player, gold: state.player.gold + price, inventory, equipment };
      let worldEconomy = state.worldEconomy;
      if (LOCATIONS[state.currentLocationId]?.type === 'hub') {
        worldEconomy = updateHubEconomy(worldEconomy, state.currentLocationId, {
          supply: 2,
          demand: -1,
          wealth: -Math.max(1, Math.floor(price * 0.05)),
        });
      }
      set({ player, quests: syncQuestStates(state.quests, player), worldEconomy });
      get().saveGame();
    },

    getBuyPrice: (merchantId, _itemId, basePrice) => {
      const state = get();
      const rep = state.player.merchantReputation?.[merchantId] || 0;
      const locMod = LOCATIONS[state.currentLocationId].merchantPriceMod || 1;
      const weather = state.currentWeather === 'storm' ? 1.1 : state.currentWeather === 'snow' ? 1.05 : 1;
      const fatigueMarkup = 1 + getFatigueFactor(state.player) * 0.08;
      const repDiscount = Math.max(0.75, 1 - rep * 0.02);
      const hub = getHubEconomy(state.worldEconomy, state.currentLocationId);
      if (hub?.destroyed) return Math.max(1, Math.round(basePrice * 2.4));
      const scarcity = hub ? (hub.demand - hub.supply) / 100 : 0;
      const stabilityMarkup = hub ? Math.max(0.9, 1 + (50 - hub.stability) / 180) : 1;
      const wealthMarkup = hub ? 1 + hub.level * 0.03 : 1;
      const relationDiscount = hub ? Math.max(0.82, 1 - hub.playerRelation * 0.0015) : 1;
      const marketPressure = 1 + scarcity * 0.28;
      const modeMarkup = hub?.marketMode === 'black_market'
        ? 1.16
        : hub?.marketMode === 'scarcity'
          ? 1.1
          : hub?.marketMode === 'surplus'
            ? 0.94
            : 1;
      return Math.max(1, Math.round(basePrice * locMod * weather * fatigueMarkup * repDiscount * stabilityMarkup * wealthMarkup * relationDiscount * marketPressure * modeMarkup));
    },

    getSellPrice: (merchantId, _itemId, basePrice) => {
      const state = get();
      const rep = state.player.merchantReputation?.[merchantId] || 0;
      const locMod = LOCATIONS[state.currentLocationId].merchantPriceMod || 1;
      const fatiguePenalty = 1 - getFatigueFactor(state.player) * 0.06;
      const repBonus = 1 + Math.min(0.25, rep * 0.015);
      const hub = getHubEconomy(state.worldEconomy, state.currentLocationId);
      if (hub?.destroyed) return Math.max(1, Math.round(Math.floor(basePrice * 0.5) * 0.45));
      const scarcity = hub ? (hub.demand - hub.supply) / 100 : 0;
      const wealthBonus = hub ? 1 + hub.level * 0.025 : 1;
      const relationBonus = hub ? 1 + Math.max(0, hub.playerRelation) * 0.0012 : 1;
      const demandBonus = 1 + Math.max(0, scarcity) * 0.22;
      const modeBonus = hub?.marketMode === 'black_market'
        ? 1.18
        : hub?.marketMode === 'scarcity'
          ? 1.08
          : hub?.marketMode === 'surplus'
            ? 0.93
            : 1;
      return Math.max(1, Math.round(Math.floor(basePrice * 0.5) * (2 - locMod * 0.2) * repBonus * fatiguePenalty * wealthBonus * relationBonus * demandBonus * modeBonus));
    },

    equipItem: (itemId, slot) => {
      const state = get();
      const hasItem = state.player.inventory.find((i) => i.itemId === itemId && i.quantity > 0);
      if (!hasItem && itemId !== '') return;
      set({ player: { ...state.player, equipment: { ...state.player.equipment, [slot]: itemId === '' ? undefined : itemId } } });
      get().saveGame();
    },

    learnRecipe: (itemId) => {
      const state = get();
      const item = ITEMS[itemId];
      if (item.type !== 'recipe' || !item.teachesRecipeId) return;
      if (state.player.knownRecipes.includes(item.teachesRecipeId)) return;
      const player = removeItem(state.player, itemId, 1);
      set({ player: { ...player, knownRecipes: [...state.player.knownRecipes, item.teachesRecipeId] } });
      get().saveGame();
    },

    craftItem: (recipeId) => {
      const state = get();
      const recipe = RECIPES[recipeId];
      if (!recipe) return;
      if (recipe.requiredStation) {
        const hasStation = LOCATIONS[state.currentLocationId].craftingStations?.includes(recipe.requiredStation) || false;
        if (!hasStation) return;
      }
      if (recipe.requiredSkill) {
        const learned = state.player.learnedSkills[recipe.requiredSkill.skillId] || 0;
        if (learned < recipe.requiredSkill.minLevel) return;
      }
      for (const ing of recipe.ingredients) {
        const pIng = state.player.inventory.find((i) => i.itemId === ing.itemId);
        if (!pIng || pIng.quantity < ing.quantity) return;
      }
      let player = { ...state.player, inventory: [...state.player.inventory] };
      recipe.ingredients.forEach((ing) => {
        player = removeItem(player, ing.itemId, ing.quantity);
      });
      const add = addItem(player, recipe.resultItemId, recipe.resultQuantity);
      if (add.added <= 0) return;
      set({ player: add.player, quests: syncQuestStates(state.quests, add.player) });
      get().saveGame();
    },

    learnSkill: (skillId) => {
      const state = get();
      const skill = SKILLS[skillId];
      if (!skill || state.player.skillPoints < skill.costPerLevel) return;
      const currentLevel = state.player.learnedSkills[skillId] || 0;
      if (currentLevel >= skill.maxLevel) return;
      if (skill.requires) {
        const hasReq = skill.requires.every((reqId) => (state.player.learnedSkills[reqId] || 0) > 0);
        if (!hasReq) return;
      }

      const player = {
        ...state.player,
        skillPoints: state.player.skillPoints - skill.costPerLevel,
        learnedSkills: { ...state.player.learnedSkills, [skillId]: currentLevel + 1 },
      };

      if (skillId === 'vitality_1') {
        player.maxHp += 10;
        player.hp += 10;
      }
      if (skillId === 'endurance_1') {
        player.maxEnergy += 8;
        player.energy += 8;
      }
      if (skillId === 'packrat_1') {
        player.carryCapacity += 8;
      }

      set({ player });
      get().saveGame();
    },
  };
});
