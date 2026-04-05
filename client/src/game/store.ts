import { create } from 'zustand';
import { Player, Quest, GameStateStatus, SaveData, Enemy, Language, WeatherType, DamageType, StatusEffectInstance, StatusEffectType, GameSettings, VoiceChannel, CodexUnlocks, WorldEconomyEvent, WorldEconomyState, GameTimeState } from './types';
import { INITIAL_QUESTS, LOCATIONS, ENEMIES, ITEMS, ALL_QUESTS, WEATHER, SKILLS, RECIPES, CLASSES, MERCHANTS } from './constants';
import { getAuthSession } from '@/lib/telegram';
import { ECONOMY_BALANCE } from './economy-balance';
import { stopVoicePlayback } from './voice';
import { playSfx } from './audio';

type CombatTarget = 'self' | 'enemy';
type DayPeriod = 'morning' | 'day' | 'evening' | 'night';
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
  gameTime: GameTimeState;
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
  setFogOfWar: (enabled: boolean) => void;
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
  contributeToQuestTreasury: (questId: string, goldAmount: number) => void;
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
  startTutorialCombat: () => void;
  stopTutorialCombat: () => void;

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
const SAVE_VERSION = 2;
const DEFAULT_SETTINGS: GameSettings = {
  language: 'en',
  voice: {
    lore: false,
    quests: false,
    npcDialogue: false,
  },
  tutorial: {
    enabled: true,
    completed: false,
    step: 0,
    seenHints: [],
  },
  world: {
    fogOfWar: true,
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
const REPUTATION_LOG_LIMIT = 120;
const CONSEQUENCE_QUEUE_LIMIT = 40;
const TUTORIAL_TOTAL_STEPS = 11;
const ENERGY_COSTS = { attack: 15, flee: 20, item: 10, throw: 12 };
const COMBO_MAX = 5;
const ADRENALINE_MAX = 100;
const SECOND_WIND_COST = 50;
const FATIGUE_MAX = 100;
const DEFAULT_GAME_TIME: GameTimeState = {
  day: 1,
  hour: 8,
  totalHours: 8,
};
const ANIMAL_ENEMY_IDS = new Set(['wolf', 'frost_wolf', 'swamp_thing']);
const UNNATURAL_ENEMY_IDS = new Set(['crystal_wisp', 'sentinel_golem', 'stone_revenant', 'mire_siren', 'war_hulk']);
const HUMANOID_ENEMY_IDS = new Set(['bandit', 'ash_bandit', 'goblin', 'plague_alchemist', 'iron_legionnaire', 'concord_assassin', 'mire_shaman', 'ruin_knight']);
const TWILIGHT_ENEMY_IDS = new Set(['crystal_wisp', 'mire_siren', 'stone_revenant', 'plague_alchemist']);
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

function normalizeGameTime(input: unknown): GameTimeState {
  const src = (input || {}) as Partial<GameTimeState>;
  const totalHours = Number.isFinite(src.totalHours) ? Math.max(0, Math.floor(Number(src.totalHours))) : DEFAULT_GAME_TIME.totalHours;
  const dayFromTotal = Math.floor(totalHours / 24) + 1;
  const hourFromTotal = totalHours % 24;
  const day = Number.isFinite(src.day) ? Math.max(1, Math.floor(Number(src.day))) : dayFromTotal;
  const hour = Number.isFinite(src.hour) ? clamp(Math.floor(Number(src.hour)), 0, 23) : hourFromTotal;
  const normalizedTotal = Math.max(totalHours, (day - 1) * 24 + hour);
  return { day, hour, totalHours: normalizedTotal };
}

function advanceGameTime(time: GameTimeState, hours: number): GameTimeState {
  const delta = Math.max(0, Math.floor(hours));
  if (delta <= 0) return time;
  const total = time.totalHours + delta;
  return {
    day: Math.floor(total / 24) + 1,
    hour: total % 24,
    totalHours: total,
  };
}

function getDayPeriod(hour: number): DayPeriod {
  if (hour >= 6 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'day';
  if (hour >= 18 && hour <= 21) return 'evening';
  return 'night';
}

function getDayPeriodFromTime(time?: GameTimeState): DayPeriod {
  if (!time) return 'day';
  return getDayPeriod(time.hour);
}

function isUnnaturalEnemy(enemyId: string): boolean {
  return UNNATURAL_ENEMY_IDS.has(enemyId);
}

function isHumanoidEnemy(enemyId: string): boolean {
  return HUMANOID_ENEMY_IDS.has(enemyId);
}

function isTwilightEnemy(enemyId: string): boolean {
  return TWILIGHT_ENEMY_IDS.has(enemyId);
}

function isAnimalEnemy(enemyId: string): boolean {
  return ANIMAL_ENEMY_IDS.has(enemyId);
}

function filterEnemiesByDayPeriod(enemyIds: string[], period: DayPeriod): string[] {
  if (!Array.isArray(enemyIds) || enemyIds.length === 0) return [];
  if (period === 'morning') {
    const natural = enemyIds.filter((id) => !isUnnaturalEnemy(id));
    return natural.length > 0 ? natural : enemyIds;
  }
  if (period === 'evening') {
    const twilight = enemyIds.filter((id) => isTwilightEnemy(id));
    if (twilight.length > 0) {
      const mixed = [...enemyIds, ...twilight];
      return mixed;
    }
  }
  if (period === 'day') {
    const humanoids = enemyIds.filter((id) => isHumanoidEnemy(id));
    if (humanoids.length > 0) {
      return [...enemyIds, ...humanoids, ...humanoids];
    }
  }
  if (period === 'night') {
    const nonAnimals = enemyIds.filter((id) => !isAnimalEnemy(id));
    if (nonAnimals.length > 0) return [...enemyIds, ...nonAnimals];
  }
  return enemyIds;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isMerchantClosedAtTime(merchantId: string, period: DayPeriod, totalHours: number): boolean {
  if (period === 'night') return true;
  if (period === 'evening') {
    const roll = stableHash(`${merchantId}_${Math.floor(totalHours / 3)}`) % 100;
    return roll < 35;
  }
  return false;
}

function getEveningRareItemPriceMod(period: DayPeriod, merchantId: string, itemId: string, totalHours: number): number {
  if (period !== 'evening') return 1;
  const item = ITEMS[itemId];
  if (!item || !item.rarity || !['rare', 'epic', 'legendary'].includes(item.rarity)) return 1;
  const roll = stableHash(`${merchantId}_${itemId}_${Math.floor(totalHours / 2)}`) % 100;
  if (roll < 30) return 0.86;
  if (roll > 84) return 1.22;
  return 1;
}

function getMajorEconomyEventChance(period: DayPeriod): number {
  if (period === 'morning') return 0.09;
  if (period === 'evening') return 0.16;
  if (period === 'night') return 0.14;
  return 0.11;
}

function rollMajorEconomyEvent(period: DayPeriod): 'war' | 'caravan_attack' | 'crisis' | 'prosperity' {
  const roll = Math.random();
  if (period === 'morning') {
    if (roll < 0.18) return 'war';
    if (roll < 0.34) return 'caravan_attack';
    if (roll < 0.52) return 'crisis';
    return 'prosperity';
  }
  if (period === 'day') {
    if (roll < 0.2) return 'war';
    if (roll < 0.5) return 'caravan_attack';
    if (roll < 0.68) return 'crisis';
    return 'prosperity';
  }
  if (period === 'evening') {
    if (roll < 0.34) return 'war';
    if (roll < 0.62) return 'caravan_attack';
    if (roll < 0.84) return 'crisis';
    return 'prosperity';
  }
  if (period === 'night') {
    if (roll < 0.38) return 'war';
    if (roll < 0.7) return 'caravan_attack';
    if (roll < 0.94) return 'crisis';
    return 'prosperity';
  }
  if (roll < 0.28) return 'war';
  if (roll < 0.58) return 'caravan_attack';
  if (roll < 0.86) return 'crisis';
  return 'prosperity';
}

function getDayPeriodEncounterDelta(period: DayPeriod): number {
  if (period === 'night') return 0.16;
  if (period === 'morning') return -0.08;
  if (period === 'evening') return 0.07;
  return 0.03;
}

function getDayPeriodLootDelta(period: DayPeriod): number {
  if (period === 'morning') return 0.08;
  if (period === 'night') return -0.06;
  return 0;
}

function getActiveMerchantIdForLocation(locationId: string): string | null {
  const merchant = Object.values(MERCHANTS).find((m) => m.locationId === locationId);
  return merchant?.id || null;
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

function appendReputationLog(
  worldEconomy: WorldEconomyState,
  entry: Omit<WorldEconomyState['reputationLog'][number], 'id' | 'tick'> & { tick?: number },
): WorldEconomyState {
  const tick = entry.tick ?? worldEconomy.tick;
  const next = {
    id: `rep_${entry.hubId}_${tick}_${Math.floor(Math.random() * 100000)}`,
    tick,
    ...entry,
  };
  const reputationLog = [...(worldEconomy.reputationLog || []), next].slice(-REPUTATION_LOG_LIMIT);
  return { ...worldEconomy, reputationLog };
}

function queueEconomyConsequence(
  worldEconomy: WorldEconomyState,
  consequence: Omit<WorldEconomyState['pendingConsequences'][number], 'id'>,
): WorldEconomyState {
  const next = {
    ...consequence,
    id: `cons_${consequence.kind}_${consequence.triggerHubId}_${consequence.dueTick}_${Math.floor(Math.random() * 100000)}`,
  };
  const existing = [...(worldEconomy.pendingConsequences || [])];
  const dupIndex = existing.findIndex((item) =>
    item.kind === next.kind
    && item.triggerHubId === next.triggerHubId
    && item.targetHubId === next.targetHubId
    && item.originType === next.originType
    && item.sourceBranch === next.sourceBranch
    && Math.abs(item.dueTick - next.dueTick) <= 1,
  );
  let pendingConsequences: WorldEconomyState['pendingConsequences'];
  if (dupIndex >= 0) {
    const merged = existing[dupIndex];
    existing[dupIndex] = {
      ...merged,
      dueTick: Math.min(merged.dueTick, next.dueTick),
      intensity: clamp(Math.floor((merged.intensity + next.intensity * 0.7)), 0, 100),
      contextTag: merged.contextTag || next.contextTag,
    };
    pendingConsequences = existing;
  } else {
    pendingConsequences = [...existing, next];
  }
  pendingConsequences = pendingConsequences.slice(-CONSEQUENCE_QUEUE_LIMIT);
  return { ...worldEconomy, pendingConsequences };
}

function resolveConsequenceDelay(
  originType: NonNullable<Quest['eventQuest']>['originType'],
  kind: WorldEconomyState['pendingConsequences'][number]['kind'],
): number {
  if (originType === 'war') {
    if (kind === 'retaliation') return 1 + Math.floor(Math.random() * 2);
    if (kind === 'aid_arrival') return 2 + Math.floor(Math.random() * 2);
    return 2 + Math.floor(Math.random() * 2);
  }
  if (originType === 'caravan_attack') {
    if (kind === 'retaliation') return 1 + Math.floor(Math.random() * 2);
    if (kind === 'aid_arrival') return 1 + Math.floor(Math.random() * 3);
    return 2 + Math.floor(Math.random() * 2);
  }
  if (originType === 'crisis') {
    if (kind === 'aid_arrival') return 1 + Math.floor(Math.random() * 2);
    return 2 + Math.floor(Math.random() * 2);
  }
  if (originType === 'prosperity') {
    if (kind === 'tariff_relief') return 1 + Math.floor(Math.random() * 2);
    return 2 + Math.floor(Math.random() * 3);
  }
  if (originType === 'black_market_opened') {
    if (kind === 'smuggler_crackdown') return 1 + Math.floor(Math.random() * 2);
    return 2 + Math.floor(Math.random() * 2);
  }
  return 1 + Math.floor(Math.random() * 3);
}

function resolveHubLevel(wealth: number): number {
  let level = 0;
  for (let i = 0; i < HUB_LEVEL_THRESHOLDS.length; i += 1) {
    if (wealth >= HUB_LEVEL_THRESHOLDS[i]) level = i;
  }
  return level;
}

function resolveHubKind(hubId: string): "faction" | "alliance" | "community" {
  if (hubId === 'town_oakhaven' || hubId === 'hub_ironhold') return 'faction';
  if (hubId === 'hub_sky_consort') return 'alliance';
  if (hubId === 'hub_mire_union') return 'community';
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

function findLocationPath(fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId];
  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    const loc = LOCATIONS[next.id];
    if (!loc) continue;
    for (const neighbor of loc.connectedLocations || []) {
      if (visited.has(neighbor)) continue;
      const path = [...next.path, neighbor];
      if (neighbor === toId) return path;
      visited.add(neighbor);
      queue.push({ id: neighbor, path });
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

function relationStatusFromStrength(strength: number): 'allied' | 'neutral' | 'conflict' {
  if (strength >= 35) return 'allied';
  if (strength <= -35) return 'conflict';
  return 'neutral';
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

export function createDefaultWorldEconomy(): WorldEconomyState {
  const hubLocations = Object.values(LOCATIONS)
    .filter((loc) => loc.type === 'hub')
  const hubs = hubLocations.reduce<WorldEconomyState['hubs']>((acc, hub) => {
      const hubKind = resolveHubKind(hub.id);
      const factionStart = hubKind === 'faction';
      const wealth = factionStart ? 600 : 180;
      acc[hub.id] = {
        hubId: hub.id,
        hubKind,
        wealth,
        level: resolveHubLevel(wealth),
        treasury: factionStart ? 220 : 120,
        tradeTurnover: factionStart ? 150 : 80,
        resources: factionStart
          ? { food: 60, wood: 55, ore: 52, craft: 48 }
          : { food: 45, wood: 40, ore: 30, craft: 35 },
        supply: 52,
        demand: 48,
        stability: factionStart ? 68 : 62,
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
    pendingConsequences: [],
    reputationLog: [],
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
  const rawPending = Array.isArray((raw as any).pendingConsequences) ? (raw as any).pendingConsequences : [];
  const rawRepLog = Array.isArray((raw as any).reputationLog) ? (raw as any).reputationLog : [];
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
          || eventType === 'retaliation'
          || eventType === 'aid_arrival'
          || eventType === 'tariff_relief'
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
    pendingConsequences: rawPending
      .map((src: any, idx: number) => {
        if (!src || typeof src !== 'object') return null;
        const kind = typeof src.kind === 'string' ? src.kind : '';
        const validKind = kind === 'retaliation' || kind === 'aid_arrival' || kind === 'tariff_relief' || kind === 'smuggler_crackdown';
        if (!validKind) return null;
        const sourceBranch = typeof src.sourceBranch === 'string' ? src.sourceBranch : '';
        const validBranch = sourceBranch === 'support' || sourceBranch === 'punish' || sourceBranch === 'support_a' || sourceBranch === 'support_b' || sourceBranch === 'neutral';
        if (!validBranch) return null;
        const dueTick = Number.isFinite(src.dueTick) ? Math.max(0, Math.floor(src.dueTick)) : 0;
        const intensity = Number.isFinite(src.intensity) ? clamp(Math.floor(src.intensity), 0, 100) : 40;
        if (typeof src.triggerHubId !== 'string' || src.triggerHubId.length === 0) return null;
        const originType = typeof src.originType === 'string'
          && (
            src.originType === 'war'
            || src.originType === 'caravan_attack'
            || src.originType === 'crisis'
            || src.originType === 'prosperity'
            || src.originType === 'black_market_opened'
            || src.originType === 'hub_destroyed'
            || src.originType === 'hub_founded'
          )
          ? src.originType
          : 'crisis';
        return {
          id: typeof src.id === 'string' && src.id.length > 0 ? src.id : `cons_norm_${idx}`,
          dueTick,
          originQuestId: typeof src.originQuestId === 'string' ? src.originQuestId : `legacy_${idx}`,
          originType,
          triggerHubId: src.triggerHubId,
          targetHubId: typeof src.targetHubId === 'string' ? src.targetHubId : undefined,
          kind,
          intensity,
          sourceBranch,
          contextTag: typeof src.contextTag === 'string' ? src.contextTag : undefined,
        } as WorldEconomyState['pendingConsequences'][number];
      })
      .filter((x: WorldEconomyState['pendingConsequences'][number] | null): x is WorldEconomyState['pendingConsequences'][number] => Boolean(x))
      .slice(-CONSEQUENCE_QUEUE_LIMIT),
    reputationLog: rawRepLog
      .map((src: any, idx: number) => {
        if (!src || typeof src !== 'object') return null;
        if (typeof src.hubId !== 'string' || src.hubId.length === 0) return null;
        const source = src.source === 'quest_resolution' || src.source === 'delayed_consequence' || src.source === 'player_action'
          ? src.source
          : 'quest_resolution';
        const reasonKey = src.reasonKey === 'quest_support'
          || src.reasonKey === 'quest_punish'
          || src.reasonKey === 'quest_neutral'
          || src.reasonKey === 'quest_side_choice'
          || src.reasonKey === 'delay_retaliation'
          || src.reasonKey === 'delay_aid_arrival'
          || src.reasonKey === 'delay_tariff_relief'
          || src.reasonKey === 'delay_smuggler_backlash'
          || src.reasonKey === 'player_investment'
          || src.reasonKey === 'player_diplomacy'
          || src.reasonKey === 'player_raid'
          || src.reasonKey === 'player_sabotage'
          ? src.reasonKey
          : undefined;
        const delta = Number.isFinite(src.delta) ? clamp(Math.floor(src.delta), -100, 100) : 0;
        if (delta === 0) return null;
        return {
          id: typeof src.id === 'string' && src.id.length > 0 ? src.id : `rep_norm_${idx}`,
          tick: Number.isFinite(src.tick) ? Math.max(0, Math.floor(src.tick)) : 0,
          hubId: src.hubId,
          delta,
          reason: typeof src.reason === 'string' && src.reason.length > 0 ? src.reason : 'Reputation shift',
          reasonKey,
          source,
          relatedHubId: typeof src.relatedHubId === 'string' ? src.relatedHubId : undefined,
        } as WorldEconomyState['reputationLog'][number];
      })
      .filter((x: WorldEconomyState['reputationLog'][number] | null): x is WorldEconomyState['reputationLog'][number] => Boolean(x))
      .slice(-REPUTATION_LOG_LIMIT),
  };
}

export function simulateWorldEconomyTick(seed: WorldEconomyState, currentWeather: WeatherType, gameTime?: GameTimeState): WorldEconomyState {
  const nextTick = seed.tick + 1;
  const dayPeriod = getDayPeriodFromTime(gameTime);
  const events = [...(seed.events || [])].slice(-(ECONOMY_EVENT_LIMIT - 6));
  let reputationLog = [...(seed.reputationLog || [])].slice(-REPUTATION_LOG_LIMIT);
  const pendingConsequences = [...(seed.pendingConsequences || [])];
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
    const blackMarketChance = dayPeriod === 'night' ? 0.18 : dayPeriod === 'evening' ? 0.12 : dayPeriod === 'morning' ? 0.06 : 0.08;
    if ((!blackMarketUntilTick || blackMarketUntilTick <= seed.tick) && riskSpikeFromWeather(currentWeather, stability) && Math.random() < blackMarketChance) {
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
  const majorTypes: WorldEconomyEvent['type'][] = ['war', 'caravan_attack', 'crisis', 'prosperity'];
  const recentMajorEvents = (seed.events || []).filter((event) => majorTypes.includes(event.type));
  const lastGlobalMajorTick = recentMajorEvents.reduce((maxTick, event) => Math.max(maxTick, event.tick), -9999);
  if (activeHubIds.length > 0 && nextTick - lastGlobalMajorTick >= 2 && Math.random() < getMajorEconomyEventChance(dayPeriod)) {
    const eventHubId = activeHubIds[Math.floor(Math.random() * activeHubIds.length)];
    const lastHubMajorTick = recentMajorEvents
      .filter((event) => event.hubId === eventHubId)
      .reduce((maxTick, event) => Math.max(maxTick, event.tick), -9999);
    if (nextTick - lastHubMajorTick >= 3) {
      const majorEvent = rollMajorEconomyEvent(dayPeriod);
      if (majorEvent === 'war') {
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
      } else if (majorEvent === 'caravan_attack') {
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
      } else if (majorEvent === 'crisis') {
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
  }

  const due = pendingConsequences.filter((c) => c.dueTick <= nextTick);
  const deferred = pendingConsequences.filter((c) => c.dueTick > nextTick);
  due.forEach((cons) => {
    const triggerHub = hubs[cons.triggerHubId];
    if (!triggerHub || triggerHub.destroyed) return;
    const targetHubId = cons.targetHubId && hubs[cons.targetHubId] ? cons.targetHubId : undefined;
    const relationTargetHub = targetHubId ? hubs[targetHubId] : null;
    const relationKey = targetHubId ? hubRelationKey(cons.triggerHubId, targetHubId) : null;
    const relation = relationKey ? hubRelations[relationKey] : null;
    const originFactor =
      cons.originType === 'war'
        ? 1.25
        : cons.originType === 'caravan_attack'
          ? 1.15
          : cons.originType === 'crisis'
            ? 1.1
            : cons.originType === 'prosperity'
              ? 0.9
              : cons.originType === 'black_market_opened'
                ? 1.2
                : cons.originType === 'hub_destroyed'
                  ? 1.18
                  : cons.originType === 'hub_founded'
                    ? 0.85
                    : 1;
    const scaledIntensity = clamp(Math.floor(cons.intensity * originFactor), 0, 100);
    if (cons.kind === 'retaliation') {
      hubs = {
        ...hubs,
        [cons.triggerHubId]: {
          ...triggerHub,
          stability: clamp(triggerHub.stability - Math.max(3, Math.floor(scaledIntensity / 12)), 0, 100),
          playerRelation: clamp(triggerHub.playerRelation - Math.max(4, Math.floor(scaledIntensity / 10)), -100, 100),
          supply: clamp(triggerHub.supply - (cons.originType === 'caravan_attack' ? 3 : 2), 0, 100),
          demand: clamp(triggerHub.demand + (cons.originType === 'war' ? 3 : 2), 0, 100),
        },
      };
      if (relation && relationTargetHub) {
        const nextStrength = clamp(relation.strength - 6, -100, 100);
        hubRelations[relationKey!] = {
          ...relation,
          strength: nextStrength,
          status: relationStatusFromStrength(nextStrength),
        };
      }
      events.push({
        id: `retaliation_${cons.triggerHubId}_${nextTick}_${Math.floor(Math.random() * 100000)}`,
        tick: nextTick,
        type: 'retaliation',
        hubId: cons.triggerHubId,
        targetHubId,
        intensity: scaledIntensity,
      });
      const nextHub = hubs[cons.triggerHubId];
      if (nextHub && nextHub.playerRelation !== triggerHub.playerRelation) {
        reputationLog.push({
          id: `rep_delay_${cons.triggerHubId}_${nextTick}_${Math.floor(Math.random() * 100000)}`,
          tick: nextTick,
          hubId: cons.triggerHubId,
          delta: nextHub.playerRelation - triggerHub.playerRelation,
          reason: `Retaliation fallout after ${cons.originType} choices`,
          reasonKey: 'delay_retaliation',
          source: 'delayed_consequence',
          relatedHubId: targetHubId,
        });
      }
    } else if (cons.kind === 'aid_arrival') {
      hubs = {
        ...hubs,
        [cons.triggerHubId]: {
          ...triggerHub,
          wealth: clamp(triggerHub.wealth + Math.max(14, Math.floor(scaledIntensity / 2)), 0, 1200),
          stability: clamp(triggerHub.stability + Math.max(3, Math.floor(scaledIntensity / 14)), 0, 100),
          playerRelation: clamp(triggerHub.playerRelation + Math.max(2, Math.floor(scaledIntensity / 16)), -100, 100),
          supply: clamp(triggerHub.supply + (cons.originType === 'crisis' ? 4 : 3), 0, 100),
          demand: clamp(triggerHub.demand - (cons.originType === 'prosperity' ? 1 : 2), 0, 100),
        },
      };
      events.push({
        id: `aid_arrival_${cons.triggerHubId}_${nextTick}_${Math.floor(Math.random() * 100000)}`,
        tick: nextTick,
        type: 'aid_arrival',
        hubId: cons.triggerHubId,
        intensity: scaledIntensity,
      });
      const nextHub = hubs[cons.triggerHubId];
      if (nextHub && nextHub.playerRelation !== triggerHub.playerRelation) {
        reputationLog.push({
          id: `rep_delay_${cons.triggerHubId}_${nextTick}_${Math.floor(Math.random() * 100000)}`,
          tick: nextTick,
          hubId: cons.triggerHubId,
          delta: nextHub.playerRelation - triggerHub.playerRelation,
          reason: `Aid impact after ${cons.originType} narrative`,
          reasonKey: 'delay_aid_arrival',
          source: 'delayed_consequence',
        });
      }
    } else if (cons.kind === 'tariff_relief') {
      hubs = {
        ...hubs,
        [cons.triggerHubId]: {
          ...triggerHub,
          demand: clamp(triggerHub.demand - (cons.originType === 'war' ? 5 : 4), 0, 100),
          stability: clamp(triggerHub.stability + (cons.originType === 'prosperity' ? 3 : 2), 0, 100),
          playerRelation: clamp(triggerHub.playerRelation + (cons.originType === 'war' ? 3 : 2), -100, 100),
        },
      };
      if (relation && relationTargetHub) {
        const nextStrength = clamp(relation.strength + 5, -100, 100);
        hubRelations[relationKey!] = {
          ...relation,
          strength: nextStrength,
          status: nextStrength >= 35 ? 'allied' : nextStrength <= -35 ? 'conflict' : 'neutral',
        };
      }
      events.push({
        id: `tariff_relief_${cons.triggerHubId}_${nextTick}_${Math.floor(Math.random() * 100000)}`,
        tick: nextTick,
        type: 'tariff_relief',
        hubId: cons.triggerHubId,
        targetHubId,
        intensity: scaledIntensity,
      });
      const nextHub = hubs[cons.triggerHubId];
      if (nextHub && nextHub.playerRelation !== triggerHub.playerRelation) {
        reputationLog.push({
          id: `rep_delay_${cons.triggerHubId}_${nextTick}_${Math.floor(Math.random() * 100000)}`,
          tick: nextTick,
          hubId: cons.triggerHubId,
          delta: nextHub.playerRelation - triggerHub.playerRelation,
          reason: `Tariff relief negotiated after ${cons.originType}`,
          reasonKey: 'delay_tariff_relief',
          source: 'delayed_consequence',
          relatedHubId: targetHubId,
        });
      }
    } else if (cons.kind === 'smuggler_crackdown') {
      hubs = {
        ...hubs,
        [cons.triggerHubId]: {
          ...triggerHub,
          stability: clamp(triggerHub.stability + 2, 0, 100),
          supply: clamp(triggerHub.supply - (cons.originType === 'black_market_opened' ? 2 : 1), 0, 100),
          demand: clamp(triggerHub.demand + (cons.originType === 'black_market_opened' ? 2 : 1), 0, 100),
          playerRelation: clamp(triggerHub.playerRelation - (cons.originType === 'black_market_opened' ? 3 : 2), -100, 100),
        },
      };
      events.push({
        id: `retaliation_smug_${cons.triggerHubId}_${nextTick}_${Math.floor(Math.random() * 100000)}`,
        tick: nextTick,
        type: 'retaliation',
        hubId: cons.triggerHubId,
        intensity: scaledIntensity,
      });
      const nextHub = hubs[cons.triggerHubId];
      if (nextHub && nextHub.playerRelation !== triggerHub.playerRelation) {
        reputationLog.push({
          id: `rep_delay_${cons.triggerHubId}_${nextTick}_${Math.floor(Math.random() * 100000)}`,
          tick: nextTick,
          hubId: cons.triggerHubId,
          delta: nextHub.playerRelation - triggerHub.playerRelation,
          reason: `Smuggler backlash triggered by ${cons.originType}`,
          reasonKey: 'delay_smuggler_backlash',
          source: 'delayed_consequence',
        });
      }
    }
  });

  return {
    tick: nextTick,
    hubs,
    tradeRoutes,
    hubRelations,
    spawnedHubIds: seed.spawnedHubIds,
    events: events.slice(-ECONOMY_EVENT_LIMIT),
    pendingConsequences: deferred.slice(-CONSEQUENCE_QUEUE_LIMIT),
    reputationLog: reputationLog.slice(-REPUTATION_LOG_LIMIT),
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

function pickEscortOriginHub(targetHubId: string): string {
  const hubIds = Object.values(LOCATIONS)
    .filter((loc) => loc.type === 'hub')
    .map((loc) => loc.id)
    .filter((id) => id !== targetHubId);
  if (hubIds.length === 0) return targetHubId;
  const scored = hubIds
    .map((hubId) => ({ hubId, distance: findLocationDistance(hubId, targetHubId) }))
    .filter((x): x is { hubId: string; distance: number } => x.distance !== null);
  if (scored.length === 0) return hubIds[0];
  scored.sort((a, b) => a.distance - b.distance);
  return scored[0].hubId;
}

export function buildEscortRoute(targetHubId: string, killCount: number) {
  const originHubId = pickEscortOriginHub(targetHubId);
  const route = findLocationPath(originHubId, targetHubId) || [originHubId, targetHubId];
  const candidateNodes = new Set<string>();
  route.forEach((locId) => {
    if (LOCATIONS[locId]?.type !== 'hub') candidateNodes.add(locId);
    const neighbors = LOCATIONS[locId]?.connectedLocations || [];
    neighbors.forEach((n) => {
      if (LOCATIONS[n]?.type !== 'hub') candidateNodes.add(n);
    });
  });
  const prioritized = Array.from(candidateNodes).sort((a, b) => {
    const ia = route.indexOf(a);
    const ib = route.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const ambushLocationIds = prioritized.slice(0, Math.max(1, Math.min(killCount, prioritized.length)));
  return {
    originHubId,
    route,
    ambushLocationIds,
  };
}

export function shouldAbandonCombatChainOnTravel(
  currentLocationId: string,
  nextLocationId: string,
  chainLocationId: string,
  escortRoute: string[],
): boolean {
  if (nextLocationId === currentLocationId) return false;
  const inLocalChain = chainLocationId === currentLocationId || escortRoute.includes(currentLocationId);
  if (!inLocalChain) return false;
  if (escortRoute.length > 0 && escortRoute.includes(nextLocationId)) return false;
  return true;
}

function riskSpikeFromWeather(currentWeather: WeatherType, stability: number): boolean {
  const weatherRisk = currentWeather === 'storm' ? 0.5 : currentWeather === 'snow' ? 0.35 : currentWeather === 'rain' ? 0.2 : 0.08;
  const instability = Math.max(0, (55 - stability) / 100);
  return Math.random() < weatherRisk * (1 + instability);
}

export function migrateSaveData(input: SaveData): SaveData {
  const fromVersion = Number.isFinite(input.saveVersion) ? Number(input.saveVersion) : 1;
  if (fromVersion >= SAVE_VERSION) return input;
  const migrated: SaveData = {
    ...input,
    saveVersion: SAVE_VERSION,
    worldEconomy: normalizeWorldEconomy(input.worldEconomy),
  };
  return migrated;
}

async function loadRemoteSave(): Promise<SaveData | null> {
  const baseOrigin = typeof window !== 'undefined' && typeof window.location?.origin === 'string' ? window.location.origin : '';
  if (!baseOrigin || !/^https?:/i.test(baseOrigin)) return null;
  const response = await fetch(new URL('/api/game/save', baseOrigin).toString(), { credentials: 'include' });
  if (response.status === 404 || response.status === 401) return null;
  if (!response.ok) throw new Error(`Failed to load remote save: ${response.status}`);
  return response.json();
}

async function upsertRemoteSave(saveData: SaveData): Promise<void> {
  const baseOrigin = typeof window !== 'undefined' && typeof window.location?.origin === 'string' ? window.location.origin : '';
  if (!baseOrigin || !/^https?:/i.test(baseOrigin)) return;
  const response = await fetch(new URL('/api/game/save', baseOrigin).toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saveData),
    credentials: 'include',
  });
  if (response.status === 401) return;
  if (!response.ok) throw new Error(`Failed to upsert remote save: ${response.status}`);
}

async function deleteRemoteSave(): Promise<void> {
  const baseOrigin = typeof window !== 'undefined' && typeof window.location?.origin === 'string' ? window.location.origin : '';
  if (!baseOrigin || !/^https?:/i.test(baseOrigin)) return;
  const response = await fetch(new URL('/api/game/save', baseOrigin).toString(), { method: 'DELETE', credentials: 'include' });
  if (response.status === 401) return;
  if (!response.ok) throw new Error(`Failed to delete remote save: ${response.status}`);
}

type ServerGameActionPayload =
  | { type: 'raid_caravan'; hubId: string; currentHubId?: string }
  | { type: 'invest_hub'; hubId: string; goldAmount: number }
  | { type: 'run_diplomacy'; hubId: string; currentHubId?: string }
  | { type: 'sabotage_hub'; hubId: string };

async function runServerGameAction(action: ServerGameActionPayload): Promise<SaveData | null> {
  const baseOrigin = typeof window !== 'undefined' && typeof window.location?.origin === 'string' ? window.location.origin : '';
  if (!baseOrigin || !/^https?:/i.test(baseOrigin)) return null;
  const response = await fetch(new URL('/api/game/action', baseOrigin).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
    credentials: 'include',
  });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to run server game action: ${response.status}`);
  const payload = await response.json();
  return (payload?.save || null) as SaveData | null;
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

function getCombatStats(player: Player, currentWeather: WeatherType, gameTime?: GameTimeState) {
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

  if (getDayPeriodFromTime(gameTime) === 'night') {
    minDamage = Math.floor(minDamage * 0.88);
    maxDamage = Math.floor(maxDamage * 0.88);
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

function enemyIsImmuneToStatus(enemy: CombatEnemy, status: StatusEffectType): boolean {
  if (!enemy.phases || enemy.phases.length === 0) return false;
  if (enemy.phaseIndex < 0 || enemy.phaseIndex >= enemy.phases.length) return false;
  const phase = enemy.phases[enemy.phaseIndex];
  return Boolean(phase?.statusImmunity?.includes(status));
}

function getEnemyDodgeChance(player: Player, enemy: CombatEnemy): number {
  const playerLevel = player.level || 1;
  const levelDiff = enemy.level - playerLevel;
  const enemyEnergyRatio = enemy.maxEnergy > 0 ? enemy.energy / enemy.maxEnergy : 0;
  const roleBonus =
    enemy.role === 'boss'
      ? 0.04
      : enemy.role === 'tank'
        ? 0.02
        : enemy.role === 'berserker'
          ? -0.01
          : 0;
  const blockBonus = enemy.isBlocking ? 0.08 : 0;
  const chance = 0.05 + levelDiff * 0.006 + enemyEnergyRatio * 0.04 + roleBonus + blockBonus;
  return clamp(chance, 0.01, 0.4);
}

function getPlayerDodgeChance(player: Player, enemy: CombatEnemy, currentWeather: WeatherType, gameTime?: GameTimeState): number {
  const playerStats = getCombatStats(player, currentWeather, gameTime);
  const levelDiff = (player.level || 1) - (enemy.level || 1);
  const fatigue = getFatigueFactor(player);
  const overload = getOverloadFactor(player);
  const energyRatio = player.maxEnergy > 0 ? player.energy / player.maxEnergy : 0;
  const weatherAdj = currentWeather === 'storm' ? -0.02 : currentWeather === 'fog' ? 0.01 : 0;
  const nightAdj = getDayPeriodFromTime(gameTime) === 'night' && !isAnimalEnemy(enemy.id) ? -0.01 : 0;
  const chance = 0.06 + levelDiff * 0.007 + playerStats.defense * 0.003 + energyRatio * 0.06 - fatigue * 0.08 - overload * 0.12 + weatherAdj + nightAdj;
  return clamp(chance, 0.02, 0.45);
}

function getPlayerStunChance(state: GameState, enemy: CombatEnemy, source: 'attack' | 'skill' | 'throw'): number {
  const sourceBase = source === 'skill' ? 0.1 : source === 'throw' ? 0.08 : 0.06;
  const levelDelta = ((state.player.level || 1) - (enemy.level || 1)) * 0.006;
  const adrenalineBonus = (state.combatAdrenaline / ADRENALINE_MAX) * 0.05;
  const fatiguePenalty = getFatigueFactor(state.player) * 0.03;
  const bossPenalty = enemy.role === 'boss' ? 0.06 : 0;
  const chance = sourceBase + levelDelta + adrenalineBonus - fatiguePenalty - bossPenalty;
  return clamp(chance, 0.02, 0.3);
}

function getEnemyStunChance(player: Player, enemy: CombatEnemy): number {
  const levelDelta = ((enemy.level || 1) - (player.level || 1)) * 0.007;
  const guardLevel = player.learnedSkills['guard_master_1'] || 0;
  const roleBonus =
    enemy.role === 'boss'
      ? 0.04
      : enemy.role === 'berserker'
        ? 0.03
        : enemy.role === 'alchemist'
          ? -0.01
          : 0;
  const chance = 0.05 + levelDelta + roleBonus - guardLevel * 0.01;
  return clamp(chance, 0.01, 0.26);
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
    && event.type !== 'hub_founded'
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
            : event.type === 'hub_founded'
              ? 'Founding Charter'
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
            : event.type === 'hub_founded'
              ? 'Хартия основания'
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
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
        { type: 'donate', targetId: quest.eventQuest.targetHubId, targetCount: 110, currentCount: 0 },
      ];
      rewards = { xp: 230, gold: 145, items: [{ itemId: 'potion_large', quantity: 1 }] };
      descriptionEn = `War support chain for ${hubNameEn}: hold the front, deliver a dispatch, and fund the war chest.`;
      descriptionRu = `Военная цепочка поддержки для ${hubNameRu}: удержите фронт, доставьте депешу и пополните военную казну.`;
    } else if (branch === 'support_b') {
      goals = [
        { type: 'kill', targetId: frontEnemy, targetCount: 3, currentCount: 0 },
        ...(quest.eventQuest.opponentHubId ? [{ type: 'deliver' as const, targetId: quest.eventQuest.opponentHubId, targetCount: 1, currentCount: 0 }] : []),
        ...(quest.eventQuest.opponentHubId ? [{ type: 'donate' as const, targetId: quest.eventQuest.opponentHubId, targetCount: 110, currentCount: 0 }] : []),
      ];
      rewards = { xp: 235, gold: 150, items: [{ itemId: 'potion_energy', quantity: 2 }] };
      descriptionEn = `Support ${opponentNameEn}: break patrols, deliver a sealed letter, and finance the campaign.`;
      descriptionRu = `Поддержите ${opponentNameRu}: разбейте патрули, доставьте запечатанное письмо и профинансируйте кампанию.`;
    } else {
      goals = [
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
        ...(quest.eventQuest.opponentHubId ? [{ type: 'deliver' as const, targetId: quest.eventQuest.opponentHubId, targetCount: 1, currentCount: 0 }] : []),
      ];
      rewards = { xp: 95, gold: 55 };
      descriptionEn = `Stay neutral: deliver non-intervention notices to both war sides.`;
      descriptionRu = `Сохраните нейтралитет: передайте уведомление о невмешательстве обеим сторонам войны.`;
    }
  } else if (quest.eventQuest.originType === 'caravan_attack') {
    const hubLevel = clamp(worldHubLevelForEventQuest(quest), 1, 5);
    const killCount = clamp(2 + hubLevel, 3, 6);
    const enemyId = hubLevel >= 4 ? 'ash_bandit' : 'bandit';
    locationId = 'road_south';
    if (branch === 'support') {
      const escort = buildEscortRoute(quest.eventQuest.targetHubId, killCount);
      locationId = escort.originHubId;
      goals = [
        { type: 'kill', targetId: enemyId, targetCount: killCount, currentCount: 0 },
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 200 + killCount * 14, gold: 130 + killCount * 10, items: [{ itemId: 'potion_energy', quantity: 1 }] };
      descriptionEn = `Escort-response operation: move convoy from ${LOCATIONS[escort.originHubId]?.name.en || escort.originHubId} to ${hubNameEn} via route (${escort.route.map((node) => LOCATIONS[node]?.name.en || node).join(' -> ')}), survive ${killCount} ambushes.`;
      descriptionRu = `Операция защиты караванов: проведите караван из ${LOCATIONS[escort.originHubId]?.name.ru || escort.originHubId} в ${hubNameRu} по маршруту (${escort.route.map((node) => LOCATIONS[node]?.name.ru || node).join(' -> ')}), пережив ${killCount} засад.`;
      return {
        ...quest,
        offerState: 'offered',
        eventQuest: {
          ...quest.eventQuest,
          branch,
          escort: {
            originHubId: escort.originHubId,
            targetHubId: quest.eventQuest.targetHubId,
            route: escort.route,
            currentLeg: 0,
            ambushLocationIds: escort.ambushLocationIds,
            clearedAmbushLocations: [],
            pendingAmbushLocationId: undefined,
            totalAmbushes: killCount,
            perfectRun: true,
          },
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
    } else if (branch === 'punish') {
      goals = [
        { type: 'kill', targetId: enemyId, targetCount: killCount, currentCount: 0 },
        { type: 'collect', targetId: 'bandit_bandana', targetCount: Math.max(2, Math.floor(killCount / 2) + 1), currentCount: 0 },
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
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 80, gold: 45 };
      descriptionEn = `Non-intervention stance: don't touch the caravan, only deliver a route status report.`;
      descriptionRu = `Позиция невмешательства: не трогайте караван, только доставьте отчёт о состоянии маршрута.`;
    }
  } else if (quest.eventQuest.originType === 'crisis') {
    locationId = quest.eventQuest.targetHubId;
    if (branch === 'support') {
      goals = [
        { type: 'collect', targetId: 'iron_ore', targetCount: 3, currentCount: 0 },
        { type: 'collect', targetId: 'hard_wood', targetCount: 3, currentCount: 0 },
        { type: 'donate', targetId: quest.eventQuest.targetHubId, targetCount: 120, currentCount: 0 },
      ];
      rewards = { xp: 180, gold: 120, items: [{ itemId: 'potion_large', quantity: 1 }] };
      descriptionEn = `Crisis relief: supply strategic materials and transfer emergency treasury funds to ${hubNameEn}.`;
      descriptionRu = `Антикризисная миссия: доставьте стратегические материалы и внесите экстренный взнос в казну ${hubNameRu}.`;
    } else {
      goals = [
        { type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 },
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 205, gold: 140, items: [{ itemId: 'bomb_fire', quantity: 1 }] };
      descriptionEn = `Exploit crisis: break stabilization squads and plant false directives inside ${hubNameEn}.`;
      descriptionRu = `Эксплуатация кризиса: разбейте группы стабилизации и внедрите ложные директивы в ${hubNameRu}.`;
    }
  } else if (quest.eventQuest.originType === 'prosperity') {
    locationId = quest.eventQuest.targetHubId;
    if (branch === 'support') {
      goals = [
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
        { type: 'collect', targetId: 'crystal_shard', targetCount: 2, currentCount: 0 },
        { type: 'donate', targetId: quest.eventQuest.targetHubId, targetCount: 90, currentCount: 0 },
      ];
      rewards = { xp: 170, gold: 135, items: [{ itemId: 'scroll_spear', quantity: 1 }] };
      descriptionEn = `Growth pact: deliver trade contracts, bring arcane commodities, and co-invest in the treasury.`;
      descriptionRu = `Пакт роста: доставьте торговые контракты, привезите арканические товары и соинвестируйте в казну.`;
    } else {
      goals = [
        { type: 'kill', targetId: 'ash_bandit', targetCount: 2, currentCount: 0 },
        { type: 'collect', targetId: 'ember_resin', targetCount: 2, currentCount: 0 },
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 195, gold: 150, items: [{ itemId: 'bomb_toxic', quantity: 1 }] };
      descriptionEn = `Market sabotage: hit trade arteries, siphon valuables, and deliver forged price directives.`;
      descriptionRu = `Рыночный саботаж: ударьте по торговым артериям, перехватите ценности и доставьте фальшивые ценовые директивы.`;
    }
  } else if (quest.eventQuest.originType === 'black_market_opened') {
    locationId = quest.eventQuest.targetHubId;
    if (branch === 'support') {
      goals = [
        { type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 },
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 175, gold: 120, items: [{ itemId: 'potion_antidote', quantity: 1 }] };
      descriptionEn = `Anti-contraband operation: clear smuggler squads and deliver an enforcement order to ${hubNameEn}.`;
      descriptionRu = `Антиконтрабандная операция: зачистите отряды контрабандистов и доставьте приказ о подавлении в ${hubNameRu}.`;
    } else {
      goals = [
        { type: 'collect', targetId: 'ember_resin', targetCount: 3, currentCount: 0 },
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 195, gold: 165, items: [{ itemId: 'bomb_toxic', quantity: 1 }] };
      descriptionEn = `Contraband patronage: secure illicit stock and deliver black-market access codes to ${hubNameEn}.`;
      descriptionRu = `Покровительство контрабанде: соберите нелегальный товар и доставьте коды доступа на чёрный рынок ${hubNameRu}.`;
    }
  } else if (quest.eventQuest.originType === 'hub_destroyed') {
    locationId = quest.eventQuest.targetHubId;
    if (branch === 'support') {
      goals = [
        { type: 'collect', targetId: 'hard_wood', targetCount: 4, currentCount: 0 },
        { type: 'collect', targetId: 'iron_ore', targetCount: 2, currentCount: 0 },
        { type: 'donate', targetId: quest.eventQuest.targetHubId, targetCount: 140, currentCount: 0 },
      ];
      rewards = { xp: 210, gold: 120, items: [{ itemId: 'armor_iron', quantity: 1 }] };
      descriptionEn = `Recovery mission: deliver reconstruction stockpiles and emergency treasury aid for ${hubNameEn}.`;
      descriptionRu = `Миссия восстановления: доставьте запасы для реконструкции и экстренную казну для ${hubNameRu}.`;
    } else {
      goals = [
        { type: 'kill', targetId: 'bandit', targetCount: 3, currentCount: 0 },
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 225, gold: 165, items: [{ itemId: 'bandit_bandana', quantity: 2 }] };
      descriptionEn = `Opportunist strike: prevent rebuilding and deliver intimidation terms to block reconstruction.`;
      descriptionRu = `Удар оппортуниста: сорвите восстановление и доставьте условия запугивания, блокируя реконструкцию.`;
    }
  } else if (quest.eventQuest.originType === 'hub_founded') {
    locationId = quest.eventQuest.targetHubId;
    if (branch === 'support') {
      goals = [
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
        { type: 'collect', targetId: 'hard_wood', targetCount: 3, currentCount: 0 },
        { type: 'donate', targetId: quest.eventQuest.targetHubId, targetCount: 80, currentCount: 0 },
      ];
      rewards = { xp: 185, gold: 130, items: [{ itemId: 'potion_energy', quantity: 1 }] };
      descriptionEn = `Founding support: deliver the charter, bring construction resources, and seed the new treasury.`;
      descriptionRu = `Поддержка основания: доставьте хартию, привезите стройматериалы и заложите стартовую казну нового хаба.`;
    } else {
      goals = [
        { type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 },
        { type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 },
      ];
      rewards = { xp: 200, gold: 150, items: [{ itemId: 'bomb_fire', quantity: 1 }] };
      descriptionEn = `Founding disruption: raid startup escorts and deliver sabotage directives before growth stabilizes.`;
      descriptionRu = `Срыв основания: разбейте стартовые эскорты и доставьте саботажные директивы до стабилизации роста.`;
    }
  } else {
    locationId = quest.eventQuest.targetHubId;
    goals = [{ type: 'deliver', targetId: quest.eventQuest.targetHubId, targetCount: 1, currentCount: 0 }];
    rewards = branch === 'support' ? { xp: 130, gold: 90 } : { xp: 150, gold: 105 };
    descriptionEn =
      branch === 'support'
        ? `Deliver support policy to ${hubNameEn} and execute local stabilization protocol.`
        : `Execute punitive policy against ${hubNameEn} and trigger destabilization protocol.`;
    descriptionRu =
      branch === 'support'
        ? `Проведите курс поддержки для ${hubNameRu} и запустите протокол стабилизации.`
        : `Проведите карательный курс против ${hubNameRu} и запустите протокол дестабилизации.`;
  }

  return {
    ...quest,
    offerState: 'offered',
    eventQuest: {
      ...quest.eventQuest,
      branch,
      escort: undefined,
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

export function buildFollowupEventQuest(resolvedQuest: Quest): Quest | null {
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
  if (resolvedQuest.eventQuest.originType === 'crisis') {
    const isSupport = branch === 'support';
    return {
      id: baseId,
      name: {
        en: isSupport ? `Relief Audit: ${hub.name.en}` : `Crisis Spiral: ${hub.name.en}`,
        ru: isSupport ? `Аудит помощи: ${hub.name.ru}` : `Спираль кризиса: ${hub.name.ru}`,
      },
      description: {
        en: isSupport
          ? `Inspect relief routes and submit stabilization paperwork.`
          : `Your disruption caused shortages. Intercept response squads before they restore balance.`,
        ru: isSupport
          ? `Проверьте маршруты помощи и передайте документы стабилизации.`
          : `Ваш саботаж вызвал дефицит. Перехватите ответные отряды до восстановления баланса.`,
      },
      locationId: hubId,
      goals: isSupport
        ? [{ type: 'deliver', targetId: hubId, targetCount: 1, currentCount: 0 }]
        : [{ type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 }],
      rewards: isSupport ? { xp: 110, gold: 80 } : { xp: 155, gold: 120 },
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
  if (resolvedQuest.eventQuest.originType === 'prosperity') {
    const isSupport = branch === 'support';
    return {
      id: baseId,
      name: {
        en: isSupport ? `Growth Oversight: ${hub.name.en}` : `Market Backlash: ${hub.name.en}`,
        ru: isSupport ? `Надзор за ростом: ${hub.name.ru}` : `Откат рынка: ${hub.name.ru}`,
      },
      description: {
        en: isSupport
          ? `Sign expansion ledgers and secure prosperous routes from opportunistic raids.`
          : `Merchants react to your sabotage. Sustain pressure before prices normalize.`,
        ru: isSupport
          ? `Подпишите реестры расширения и защитите процветающие маршруты от рейдов.`
          : `Торговцы реагируют на ваш саботаж. Удерживайте давление до нормализации цен.`,
      },
      locationId: 'road_south',
      goals: isSupport
        ? [{ type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 }]
        : [{ type: 'collect', targetId: 'ember_resin', targetCount: 2, currentCount: 0 }],
      rewards: isSupport ? { xp: 120, gold: 85 } : { xp: 150, gold: 125 },
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
  if (resolvedQuest.eventQuest.originType === 'black_market_opened') {
    const isSupport = branch === 'support';
    return {
      id: baseId,
      name: {
        en: isSupport ? `Smuggler Crackdown: ${hub.name.en}` : `Contraband Relay: ${hub.name.en}`,
        ru: isSupport ? `Зачистка контрабанды: ${hub.name.ru}` : `Контрабандный канал: ${hub.name.ru}`,
      },
      description: {
        en: isSupport
          ? `Track the remaining smugglers and complete the final seizure report.`
          : `Expand illicit supply and deliver coded access papers.`,
        ru: isSupport
          ? `Отследите остатки контрабандистов и завершите итоговый отчёт об изъятии.`
          : `Расширьте нелегальные поставки и доставьте кодированные бумаги доступа.`,
      },
      locationId: hubId,
      goals: isSupport
        ? [{ type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 }]
        : [{ type: 'deliver', targetId: hubId, targetCount: 1, currentCount: 0 }],
      rewards: isSupport ? { xp: 130, gold: 90 } : { xp: 165, gold: 130 },
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
  if (resolvedQuest.eventQuest.originType === 'hub_founded' || resolvedQuest.eventQuest.originType === 'hub_destroyed') {
    const isSupport = branch === 'support';
    return {
      id: baseId,
      name: {
        en: isSupport ? `Settlement Stabilization: ${hub.name.en}` : `Settlement Pressure: ${hub.name.en}`,
        ru: isSupport ? `Стабилизация поселения: ${hub.name.ru}` : `Давление на поселение: ${hub.name.ru}`,
      },
      description: {
        en: isSupport
          ? `Finalize infrastructure papers and secure the nearest trade road.`
          : `Push intimidation through local routes to prevent a stable recovery.`,
        ru: isSupport
          ? `Завершите инфраструктурные документы и защитите ближайший торговый тракт.`
          : `Продвиньте давление по локальным маршрутам, чтобы не допустить стабильного восстановления.`,
      },
      locationId: 'road_south',
      goals: isSupport
        ? [{ type: 'deliver', targetId: hubId, targetCount: 1, currentCount: 0 }]
        : [{ type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 }],
      rewards: isSupport ? { xp: 125, gold: 95 } : { xp: 160, gold: 130 },
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

function applyQuestRewards(playerSeed: Player, quest: Quest, lang: Language, logs: string[], rewardMultiplier = 1) {
  let player = { ...playerSeed, inventory: [...playerSeed.inventory] };
  const xpReward = Math.max(0, Math.round(quest.rewards.xp * rewardMultiplier));
  const goldReward = Math.max(0, Math.round(quest.rewards.gold * rewardMultiplier));
  player.xp += xpReward;
  player.gold += goldReward;
  logs.push(
    lang === 'ru'
      ? `Награда за задание: ${xpReward} XP и ${goldReward} золота.`
      : `Quest reward: ${xpReward} XP and ${goldReward} gold.`,
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
      lore: input?.voice?.lore === true,
      quests: input?.voice?.quests === true,
      npcDialogue: input?.voice?.npcDialogue === true,
    },
    tutorial: {
      enabled: input?.tutorial?.enabled !== false,
      completed: input?.tutorial?.completed === true,
      step: Number.isFinite(input?.tutorial?.step) ? Math.max(0, Math.floor(input.tutorial.step)) : 0,
      seenHints: Array.isArray(input?.tutorial?.seenHints) ? input.tutorial.seenHints.filter((x: unknown) => typeof x === 'string') : [],
    },
    world: {
      fogOfWar: input?.world?.fogOfWar !== false,
    },
  });

  const findActiveCombatChainQuest = (quests: Quest[], locationId: string): Quest | null =>
    quests.find((q) =>
      !q.isCompleted
      && (q.offerState || 'active') === 'active'
      && q.isEventQuest
      && (q.eventQuest?.originType === 'war' || q.eventQuest?.originType === 'caravan_attack')
      && (
        q.locationId === locationId
        || (
          q.eventQuest?.originType === 'caravan_attack'
          && q.eventQuest?.branch === 'support'
          && !!q.eventQuest.escort
          && q.eventQuest.escort.route.includes(locationId)
        )
      )
      && q.goals.some((g) => g.type === 'kill' && g.currentCount < g.targetCount),
    ) || null;

  const findAnyActiveCombatChainQuest = (quests: Quest[]): Quest | null =>
    quests.find((q) =>
      !q.isCompleted
      && (q.offerState || 'active') === 'active'
      && q.isEventQuest
      && (q.eventQuest?.originType === 'war' || q.eventQuest?.originType === 'caravan_attack')
      && q.goals.some((g) => g.type === 'kill' && g.currentCount < g.targetCount),
    ) || null;

  const applyChainFailurePenalty = (
    state: GameState,
    playerSeed: Player,
    reason: 'flee' | 'defeat' | 'abandon',
  ): { player: Player; quests: Quest[]; worldEconomy: WorldEconomyState; failureLog: string | null } => {
    const chainQuest = findActiveCombatChainQuest(state.quests, state.currentLocationId) || findAnyActiveCombatChainQuest(state.quests);
    if (!chainQuest || !chainQuest.eventQuest) {
      return { player: playerSeed, quests: state.quests, worldEconomy: state.worldEconomy, failureLog: null };
    }
    const lang = state.settings.language;
    const fine = reason === 'defeat'
      ? Math.min(80, Math.max(12, Math.floor(playerSeed.gold * 0.16)))
      : reason === 'flee'
        ? Math.min(55, Math.max(8, Math.floor(playerSeed.gold * 0.1)))
        : Math.min(70, Math.max(10, Math.floor(playerSeed.gold * 0.12)));
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
      ? (
        reason === 'abandon'
          ? `Цепочка "${chainQuest.name.ru}" провалена из-за выхода с маршрута: потеряно ${fine} золота и ухудшены отношения хабов.`
          : `Срыв цепочки "${chainQuest.name.ru}": потеряно ${fine} золота и ухудшены отношения хабов.`
      )
      : (
        reason === 'abandon'
          ? `Chain "${chainQuest.name.en}" failed due to route abandonment: lost ${fine} gold and damaged hub relations.`
          : `Chain failure "${chainQuest.name.en}": lost ${fine} gold and damaged hub relations.`
      );
    return { player, quests, worldEconomy, failureLog };
  };

  const enemyTurn = (logsSeed: string[]) => {
    const state = get();
    if (!state.currentEnemy) return;

    const lang = state.settings.language;
    const playerStats = getCombatStats(state.player, state.currentWeather, state.gameTime);
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
    if (getDayPeriodFromTime(state.gameTime) === 'night' && !isAnimalEnemy(enemy.id)) {
      hit = Math.floor(hit * 0.86);
    }

    const playerDodgeChance = getPlayerDodgeChance(player, enemy, state.currentWeather, state.gameTime) * (state.isPlayerBlocking ? 0.5 : 1);
    if (Math.random() < playerDodgeChance) {
      logs.push(lang === 'ru' ? 'Вы уклоняетесь от удара!' : 'You dodge the incoming hit!');
      adrenaline = Math.min(ADRENALINE_MAX, adrenaline + 4);
      set({
        player,
        currentEnemy: enemy,
        combatLogs: logs,
        isPlayerBlocking: false,
        combatCombo: combo,
        combatAdrenaline: adrenaline,
      });
      return;
    }

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
    const hasNativeStun = enemy.statusInflict?.type === 'stunned';
    if (!hasNativeStun && Math.random() <= getEnemyStunChance(player, enemy)) {
      player.statusEffects = [...(player.statusEffects || []), { type: 'stunned', duration: 1, potency: 1, source: enemy.id }];
      logs.push(lang === 'ru' ? 'Вы оглушены!' : 'You are stunned!');
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
      const locationMatches =
        q.locationId === state.currentLocationId
        || (
          q.isEventQuest
          && q.eventQuest?.originType === 'caravan_attack'
          && q.eventQuest?.branch === 'support'
          && !!q.eventQuest.escort
          && q.eventQuest.escort.route.includes(state.currentLocationId)
        );
      if (q.isCompleted || (q.offerState || 'active') !== 'active' || !locationMatches) return q;
      let progressed = false;
      const goals = q.goals.map((g) => {
        if (g.type === 'kill' && g.targetId === enemy.id && g.currentCount < g.targetCount) {
          progressed = true;
          return { ...g, currentCount: g.currentCount + 1 };
        }
        return g;
      });
      if (!progressed) return q;
      let eventQuest = q.eventQuest;
      if (
        q.isEventQuest
        && q.eventQuest?.originType === 'caravan_attack'
        && q.eventQuest?.branch === 'support'
        && q.eventQuest.escort
        && q.eventQuest.escort.pendingAmbushLocationId
      ) {
        const pendingLoc = q.eventQuest.escort.pendingAmbushLocationId;
        const cleared = q.eventQuest.escort.clearedAmbushLocations.includes(pendingLoc)
          ? q.eventQuest.escort.clearedAmbushLocations
          : [...q.eventQuest.escort.clearedAmbushLocations, pendingLoc];
        eventQuest = {
          ...q.eventQuest,
          escort: {
            ...q.eventQuest.escort,
            clearedAmbushLocations: cleared,
            pendingAmbushLocationId: undefined,
          },
        };
      }
      const completed = goals.every((g) => g.currentCount >= g.targetCount);
      if (!completed) return { ...q, goals, eventQuest, isTurnInReady: false };

      logs.push(
        lang === 'ru'
          ? `Цель задания достигнута: ${q.name[lang]}. Вернитесь к NPC для сдачи.`
          : `Quest objective complete: ${q.name[lang]}. Return to the quest giver to turn it in.`,
      );
      return { ...q, goals, eventQuest, isTurnInReady: true };
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
    gameTime: DEFAULT_GAME_TIME,
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

    setFogOfWar: (enabled) => {
      set((state) => ({
        settings: {
          ...state.settings,
          world: {
            ...state.settings.world,
            fogOfWar: enabled,
          },
        },
      }));
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
      if (!enabled) stopVoicePlayback(channel);
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
        const completed = nextStep >= TUTORIAL_TOTAL_STEPS;
        return {
          settings: {
            ...state.settings,
            tutorial: {
              ...state.settings.tutorial,
              step: completed ? TUTORIAL_TOTAL_STEPS : nextStep,
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
            step: TUTORIAL_TOTAL_STEPS,
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
        gameTime: DEFAULT_GAME_TIME,
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

    contributeToQuestTreasury: (questId, goldAmount) => {
      const state = get();
      const amount = Math.max(0, Math.floor(goldAmount));
      if (amount <= 0) return;
      const quest = state.quests.find((q) => q.id === questId);
      if (!quest || quest.isCompleted || (quest.offerState || 'active') !== 'active') return;
      const donateGoal = quest.goals.find((g) => g.type === 'donate' && g.currentCount < g.targetCount);
      if (!donateGoal) return;
      const remaining = donateGoal.targetCount - donateGoal.currentCount;
      const spend = Math.min(amount, remaining, state.player.gold);
      if (spend <= 0) return;

      const player = {
        ...state.player,
        gold: state.player.gold - spend,
      };
      const updatedQuest: Quest = {
        ...quest,
        goals: quest.goals.map((g) =>
          g === donateGoal
            ? { ...g, currentCount: Math.min(g.targetCount, g.currentCount + spend) }
            : g,
        ),
      };
      let worldEconomy = state.worldEconomy;
      const targetHubId = updatedQuest.eventQuest?.targetHubId;
      if (targetHubId && worldEconomy.hubs[targetHubId]) {
        worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
          treasury: spend,
          wealth: Math.max(1, Math.floor(spend * 0.6)),
          stability: Math.max(1, Math.floor(spend / 70)),
          playerRelation: Math.max(1, Math.floor(spend / 90)),
        });
      }
      const quests = syncQuestStates(
        state.quests.map((q) => (q.id === questId ? updatedQuest : q)),
        player,
      );
      set({ player, quests, worldEconomy });
      get().saveGame();
    },

    turnInQuest: (questId, npcId) => {
      const state = get();
      const quest = state.quests.find((q) => q.id === questId);
      if (!quest || quest.isCompleted || !quest.isTurnInReady) return;
      if (!quest.isEventQuest && (quest.turnInNpcId || quest.giverNpcId) !== npcId) return;
      const dayPeriod = getDayPeriodFromTime(state.gameTime);
      const morningOfficialBonus = dayPeriod === 'morning' ? 1.12 : 1;
      const morningRepDelta = dayPeriod === 'morning' ? 2 : 0;

      const logs = [...state.combatLogs];
      let player = applyQuestRewards(state.player, quest, state.settings.language, logs, morningOfficialBonus);
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
          playerRelation: 3 + morningRepDelta,
        });
      }
      if (quest.isEventQuest && quest.eventQuest) {
        const targetHubId = quest.eventQuest.targetHubId;
        const otherHubId = quest.eventQuest.opponentHubId;
        const branch = quest.eventQuest.branch;
        if (
          quest.eventQuest.originType === 'caravan_attack'
          && branch === 'support'
          && quest.eventQuest.escort
          && quest.eventQuest.escort.perfectRun
          && quest.eventQuest.escort.clearedAmbushLocations.length >= 1
        ) {
          player.gold += 90;
          player = addItem(player, 'potion_large', 1).player;
          logs.push(
            state.settings.language === 'ru'
              ? 'Идеальное сопровождение: +90 золота и премиальное зелье за сохранность каравана.'
              : 'Perfect escort: +90 gold and a premium potion for keeping the convoy intact.',
          );
        }
        if (worldEconomy.hubs[targetHubId]) {
          if (branch === 'support' || branch === 'support_a') {
            worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
              wealth: ECONOMY_BALANCE.questResolution.support.wealth,
              stability: ECONOMY_BALANCE.questResolution.support.stability,
              playerRelation: ECONOMY_BALANCE.questResolution.support.relation,
              demand: ECONOMY_BALANCE.questResolution.support.demand,
              supply: ECONOMY_BALANCE.questResolution.support.supply,
            });
            worldEconomy = appendReputationLog(worldEconomy, {
              hubId: targetHubId,
              delta: 9 + morningRepDelta,
              reason: 'Supported local war economy and supply effort',
              reasonKey: 'quest_support',
              source: 'quest_resolution',
              relatedHubId: otherHubId,
            });
            if (otherHubId && worldEconomy.hubs[otherHubId]) {
              worldEconomy = updateHubEconomy(worldEconomy, otherHubId, {
                playerRelation: ECONOMY_BALANCE.questResolution.sideRelationPenalty - morningRepDelta,
                stability: -2,
              });
              worldEconomy = appendReputationLog(worldEconomy, {
                hubId: otherHubId,
                delta: -8 - morningRepDelta,
                reason: 'Backed opposing side in conflict',
                reasonKey: 'quest_side_choice',
                source: 'quest_resolution',
                relatedHubId: targetHubId,
              });
              worldEconomy = updateHubRelation(worldEconomy, targetHubId, otherHubId, 8);
              worldEconomy = queueEconomyConsequence(worldEconomy, {
                dueTick: worldEconomy.tick + resolveConsequenceDelay(quest.eventQuest.originType, 'retaliation'),
                originQuestId: quest.id,
                originType: quest.eventQuest.originType,
                triggerHubId: otherHubId,
                targetHubId,
                kind: 'retaliation',
                intensity: 58,
                sourceBranch: branch,
                contextTag: 'war_side_backlash',
              });
            }
            worldEconomy = queueEconomyConsequence(worldEconomy, {
              dueTick: worldEconomy.tick + resolveConsequenceDelay(quest.eventQuest.originType, 'aid_arrival'),
              originQuestId: quest.id,
              originType: quest.eventQuest.originType,
              triggerHubId: targetHubId,
              kind: 'aid_arrival',
              intensity: 52,
              sourceBranch: branch,
              contextTag: 'supported_hub_recovery',
            });
          } else if (branch === 'support_b' && otherHubId && worldEconomy.hubs[otherHubId]) {
            worldEconomy = updateHubEconomy(worldEconomy, otherHubId, {
              wealth: ECONOMY_BALANCE.questResolution.support.wealth,
              stability: ECONOMY_BALANCE.questResolution.support.stability,
              playerRelation: ECONOMY_BALANCE.questResolution.support.relation,
              demand: ECONOMY_BALANCE.questResolution.support.demand,
              supply: ECONOMY_BALANCE.questResolution.support.supply,
            });
            worldEconomy = appendReputationLog(worldEconomy, {
              hubId: otherHubId,
              delta: 9 + morningRepDelta,
              reason: 'Supported requested side in active war',
              reasonKey: 'quest_side_choice',
              source: 'quest_resolution',
              relatedHubId: targetHubId,
            });
            worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
              playerRelation: ECONOMY_BALANCE.questResolution.sideRelationPenalty - morningRepDelta,
              stability: -2,
            });
            worldEconomy = appendReputationLog(worldEconomy, {
              hubId: targetHubId,
              delta: -8 - morningRepDelta,
              reason: 'Chose rival side in war',
              reasonKey: 'quest_side_choice',
              source: 'quest_resolution',
              relatedHubId: otherHubId,
            });
            worldEconomy = updateHubRelation(worldEconomy, targetHubId, otherHubId, 8);
            worldEconomy = queueEconomyConsequence(worldEconomy, {
              dueTick: worldEconomy.tick + resolveConsequenceDelay(quest.eventQuest.originType, 'retaliation'),
              originQuestId: quest.id,
              originType: quest.eventQuest.originType,
              triggerHubId: targetHubId,
              targetHubId: otherHubId,
              kind: 'retaliation',
              intensity: 58,
              sourceBranch: branch,
              contextTag: 'war_side_backlash',
            });
            worldEconomy = queueEconomyConsequence(worldEconomy, {
              dueTick: worldEconomy.tick + resolveConsequenceDelay(quest.eventQuest.originType, 'aid_arrival'),
              originQuestId: quest.id,
              originType: quest.eventQuest.originType,
              triggerHubId: otherHubId,
              targetHubId,
              kind: 'aid_arrival',
              intensity: 52,
              sourceBranch: branch,
              contextTag: 'supported_hub_recovery',
            });
          } else if (branch === 'neutral') {
            worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
              playerRelation: ECONOMY_BALANCE.questResolution.neutralRelationPenalty,
            });
            worldEconomy = appendReputationLog(worldEconomy, {
              hubId: targetHubId,
              delta: -3 - (dayPeriod === 'morning' ? 1 : 0),
              reason: 'Stayed neutral during strategic conflict',
              reasonKey: 'quest_neutral',
              source: 'quest_resolution',
              relatedHubId: otherHubId,
            });
            if (otherHubId && worldEconomy.hubs[otherHubId]) {
              worldEconomy = updateHubEconomy(worldEconomy, otherHubId, {
                playerRelation: ECONOMY_BALANCE.questResolution.neutralRelationPenalty,
              });
              worldEconomy = appendReputationLog(worldEconomy, {
                hubId: otherHubId,
                delta: -3 - (dayPeriod === 'morning' ? 1 : 0),
                reason: 'Refused to intervene in conflict',
                reasonKey: 'quest_neutral',
                source: 'quest_resolution',
                relatedHubId: targetHubId,
              });
              worldEconomy = updateHubRelation(worldEconomy, targetHubId, otherHubId, -4);
              worldEconomy = queueEconomyConsequence(worldEconomy, {
                dueTick: worldEconomy.tick + resolveConsequenceDelay(quest.eventQuest.originType, 'tariff_relief'),
                originQuestId: quest.id,
                originType: quest.eventQuest.originType,
                triggerHubId: targetHubId,
                targetHubId: otherHubId,
                kind: 'tariff_relief',
                intensity: 35,
                sourceBranch: branch,
                contextTag: 'neutral_trade_compensation',
              });
            }
          } else if (branch === 'punish') {
            worldEconomy = updateHubEconomy(worldEconomy, targetHubId, {
              wealth: ECONOMY_BALANCE.questResolution.punish.wealth,
              stability: ECONOMY_BALANCE.questResolution.punish.stability,
              playerRelation: ECONOMY_BALANCE.questResolution.punish.relation,
              demand: ECONOMY_BALANCE.questResolution.punish.demand,
              supply: ECONOMY_BALANCE.questResolution.punish.supply,
            });
            worldEconomy = appendReputationLog(worldEconomy, {
              hubId: targetHubId,
              delta: -10 - (dayPeriod === 'morning' ? 1 : 0),
              reason: 'Punished hub infrastructure and economic capacity',
              reasonKey: 'quest_punish',
              source: 'quest_resolution',
            });
            worldEconomy = queueEconomyConsequence(worldEconomy, {
              dueTick: worldEconomy.tick + resolveConsequenceDelay(
                quest.eventQuest.originType,
                quest.eventQuest.originType === 'black_market_opened' ? 'smuggler_crackdown' : 'retaliation',
              ),
              originQuestId: quest.id,
              originType: quest.eventQuest.originType,
              triggerHubId: targetHubId,
              kind: quest.eventQuest.originType === 'black_market_opened' ? 'smuggler_crackdown' : 'retaliation',
              intensity: 62,
              sourceBranch: branch,
              contextTag: quest.eventQuest.originType === 'caravan_attack' ? 'route_revenge' : 'economic_backlash',
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

      void playSfx('ui_reward_claim');
      void playSfx('coin_jingle', 0.9);
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
      const applyLocal = () => {
        const state = get();
        const currentHubId = state.currentLocationId;
        if (!state.worldEconomy.hubs[hubId]) return;
        const dayPeriod = getDayPeriodFromTime(state.gameTime);
        const nightMultiplier = dayPeriod === 'night' ? 1.2 : 1;
        let worldEconomy = updateHubEconomy(state.worldEconomy, hubId, {
          supply: Math.floor(ECONOMY_BALANCE.playerActions.raid.supply * nightMultiplier),
          demand: Math.floor(ECONOMY_BALANCE.playerActions.raid.demand * nightMultiplier),
          stability: Math.floor(ECONOMY_BALANCE.playerActions.raid.stability * nightMultiplier),
          playerRelation: Math.floor(ECONOMY_BALANCE.playerActions.raid.relation * nightMultiplier),
          wealth: Math.floor(ECONOMY_BALANCE.playerActions.raid.wealth * nightMultiplier),
          tradeTurnover: Math.floor(ECONOMY_BALANCE.playerActions.raid.turnover * nightMultiplier),
        });
        if (state.worldEconomy.hubs[currentHubId] && currentHubId !== hubId) {
          worldEconomy = updateHubRelation(worldEconomy, currentHubId, hubId, -10);
        }
        const tradeRoutes = Object.entries(worldEconomy.tradeRoutes).reduce<WorldEconomyState['tradeRoutes']>((acc, [routeId, route]) => {
          if (route.fromHubId === hubId || route.toHubId === hubId) {
            acc[routeId] = {
              ...route,
              flow: clamp(route.flow + ECONOMY_BALANCE.playerActions.raid.routeFlow, 0, 100),
              risk: clamp(route.risk + ECONOMY_BALANCE.playerActions.raid.routeRisk, 0, 100),
            };
          } else acc[routeId] = route;
          return acc;
        }, {});
        const withRoutes = { ...worldEconomy, tradeRoutes };
        const withEvent = appendEconomyEvent(withRoutes, {
          type: 'player_raid',
          hubId,
          targetHubId: currentHubId !== hubId ? currentHubId : undefined,
          intensity: clamp(Math.floor(61 * nightMultiplier), 20, 95),
        });
        const withLog = appendReputationLog(withEvent, {
          hubId,
          delta: -8,
          reason: 'You raided a caravan linked to this hub',
          reasonKey: 'player_raid',
          source: 'player_action',
          relatedHubId: currentHubId !== hubId ? currentHubId : undefined,
        });
        set({ worldEconomy: withLog });
        get().saveGame();
      };

      const authSession = getAuthSession();
      if (!authSession) {
        applyLocal();
        return;
      }

      const currentHubId = get().currentLocationId;
      runServerGameAction({ type: 'raid_caravan', hubId, currentHubId })
        .then((remoteSave) => {
          if (!remoteSave || !remoteSave.player || !remoteSave.worldEconomy) {
            applyLocal();
            return;
          }
          set({
            player: remoteSave.player,
            worldEconomy: normalizeWorldEconomy(remoteSave.worldEconomy),
          });
          get().saveGame();
        })
        .catch((error) => {
          console.error('Failed to run server raid action', error);
          applyLocal();
        });
    },

    investInHub: (hubId, goldAmount) => {
      const applyLocal = () => {
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
        const withLog = appendReputationLog(withEvent, {
          hubId,
          delta: Math.max(1, Math.floor(amount / 45)),
          reason: 'You invested funds into hub treasury and production',
          reasonKey: 'player_investment',
          source: 'player_action',
        });
        set({ player, worldEconomy: withLog });
        get().saveGame();
      };

      const authSession = getAuthSession();
      if (!authSession) {
        applyLocal();
        return;
      }

      const amount = Math.max(0, Math.floor(goldAmount));
      runServerGameAction({ type: 'invest_hub', hubId, goldAmount: amount })
        .then((remoteSave) => {
          if (!remoteSave || !remoteSave.player || !remoteSave.worldEconomy) {
            applyLocal();
            return;
          }
          set({
            player: remoteSave.player,
            worldEconomy: normalizeWorldEconomy(remoteSave.worldEconomy),
          });
          get().saveGame();
        })
        .catch((error) => {
          console.error('Failed to run server invest action', error);
          applyLocal();
        });
    },

    runDiplomacy: (hubId) => {
      const applyLocal = () => {
        const state = get();
        const currentHubId = state.currentLocationId;
        if (!state.worldEconomy.hubs[hubId]) return;
        const dayPeriod = getDayPeriodFromTime(state.gameTime);
        const morningBonus = dayPeriod === 'morning' ? 2 : 0;
        let worldEconomy = updateHubEconomy(state.worldEconomy, hubId, {
          stability: ECONOMY_BALANCE.playerActions.diplomacy.stability,
          playerRelation: ECONOMY_BALANCE.playerActions.diplomacy.relation + morningBonus,
        });
        if (state.worldEconomy.hubs[currentHubId] && currentHubId !== hubId) {
          worldEconomy = updateHubRelation(worldEconomy, currentHubId, hubId, ECONOMY_BALANCE.playerActions.diplomacy.relationLinkDelta);
        }
        const withEvent = appendEconomyEvent(worldEconomy, {
          type: 'player_diplomacy',
          hubId,
          targetHubId: currentHubId !== hubId ? currentHubId : undefined,
          intensity: 42,
        });
        const withLog = appendReputationLog(withEvent, {
          hubId,
          delta: 6 + morningBonus,
          reason: 'You negotiated diplomatic concessions',
          reasonKey: 'player_diplomacy',
          source: 'player_action',
          relatedHubId: currentHubId !== hubId ? currentHubId : undefined,
        });
        set({ worldEconomy: withLog });
        get().saveGame();
      };

      const authSession = getAuthSession();
      if (!authSession) {
        applyLocal();
        return;
      }

      const currentHubId = get().currentLocationId;
      runServerGameAction({ type: 'run_diplomacy', hubId, currentHubId })
        .then((remoteSave) => {
          if (!remoteSave || !remoteSave.player || !remoteSave.worldEconomy) {
            applyLocal();
            return;
          }
          set({
            player: remoteSave.player,
            worldEconomy: normalizeWorldEconomy(remoteSave.worldEconomy),
          });
          get().saveGame();
        })
        .catch((error) => {
          console.error('Failed to run server diplomacy action', error);
          applyLocal();
        });
    },

    sabotageHub: (hubId) => {
      const applyLocal = () => {
        const state = get();
        if (!state.worldEconomy.hubs[hubId]) return;
        const dayPeriod = getDayPeriodFromTime(state.gameTime);
        const nightMultiplier = dayPeriod === 'night' ? 1.18 : 1;
        const worldEconomy = updateHubEconomy(state.worldEconomy, hubId, {
          wealth: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.wealth * nightMultiplier),
          stability: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.stability * nightMultiplier),
          supply: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.supply * nightMultiplier),
          demand: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.demand * nightMultiplier),
          playerRelation: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.relation * nightMultiplier),
          tradeTurnover: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.turnover * nightMultiplier),
        });
        const withEvent = appendEconomyEvent(worldEconomy, {
          type: 'player_sabotage',
          hubId,
          intensity: clamp(Math.floor(74 * nightMultiplier), 24, 98),
        });
        const withLog = appendReputationLog(withEvent, {
          hubId,
          delta: -12,
          reason: 'You sabotaged production and logistics',
          reasonKey: 'player_sabotage',
          source: 'player_action',
        });
        set({ worldEconomy: withLog });
        get().saveGame();
      };

      const authSession = getAuthSession();
      if (!authSession) {
        applyLocal();
        return;
      }

      runServerGameAction({ type: 'sabotage_hub', hubId })
        .then((remoteSave) => {
          if (!remoteSave || !remoteSave.player || !remoteSave.worldEconomy) {
            applyLocal();
            return;
          }
          set({
            player: remoteSave.player,
            worldEconomy: normalizeWorldEconomy(remoteSave.worldEconomy),
          });
          get().saveGame();
        })
        .catch((error) => {
          console.error('Failed to run server sabotage action', error);
          applyLocal();
        });
    },

    loadSave: () => {
      const applySave = (rawData: SaveData) => {
        const data = migrateSaveData(rawData);
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
          gameTime: normalizeGameTime(data.gameTime),
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

      const authSession = getAuthSession();
      if (!authSession) return;

      loadRemoteSave()
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
        saveVersion: SAVE_VERSION,
        player: state.player,
        gameTime: state.gameTime,
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
      const authSession = getAuthSession();
      if (authSession) {
        upsertRemoteSave(saveData).catch((e) => console.error('Failed to sync remote save', e));
      }
    },

    resetGame: () => {
      set({
        player: { ...STARTING_PLAYER },
        gameTime: DEFAULT_GAME_TIME,
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
      const authSession = getAuthSession();
      if (authSession) {
        deleteRemoteSave().catch((e) => console.error('Failed to delete remote save', e));
      }
    },

    travelTo: (locationId) => {
      void playSfx('travel_whoosh_short');
      get().tickWeather();
      const state = get();
      const activeChain = findAnyActiveCombatChainQuest(state.quests);
      const escortRoute = activeChain?.eventQuest?.escort?.route || [];
      if (
        activeChain
        && shouldAbandonCombatChainOnTravel(
          state.currentLocationId,
          locationId,
          activeChain.locationId,
          escortRoute,
        )
      ) {
        const penalized = applyChainFailurePenalty(state, state.player, 'abandon');
        set({
          player: penalized.player,
          quests: penalized.quests,
          worldEconomy: penalized.worldEconomy,
          combatLogs: penalized.failureLog ? [penalized.failureLog] : state.combatLogs,
        });
        get().saveGame();
      }
      const freshState = get();
      const targetLoc = LOCATIONS[locationId];
      const lang = freshState.settings.language;
      const nextGameTime = advanceGameTime(freshState.gameTime, 4);
      const dayPeriod = getDayPeriodFromTime(nextGameTime);
      let player = { ...freshState.player };
      let codexUnlocks = unlockCodex(freshState.codexUnlocks, 'locations', locationId);
      let worldEconomy = simulateWorldEconomyTick(freshState.worldEconomy, freshState.currentWeather, nextGameTime);
      const expansion = expandHubsIfEligible(worldEconomy);
      worldEconomy = expansion.worldEconomy;
      const questsWithEvents = withGeneratedEventQuests(freshState.quests, worldEconomy);
      let encounterChance = 0.3;
      const weatherFx = WEATHER[state.currentWeather].exploreEffect;
      if (weatherFx?.encounterChanceMod) encounterChance += weatherFx.encounterChanceMod;
      encounterChance += getDayPeriodEncounterDelta(dayPeriod);

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
          if (g.type === 'deliver' && g.targetId === locationId && g.currentCount < g.targetCount) return { ...g, currentCount: g.currentCount + 1 };
          return g;
        });
        return { ...q, goals };
      });
      let routeLogs: string[] = [];
      let forcedAmbushEnemy: Enemy | null = null;
      const escortAdjustedQuests = progressedQuests.map((q) => {
        if (
          q.isCompleted
          || (q.offerState || 'active') !== 'active'
          || !q.isEventQuest
          || q.eventQuest?.originType !== 'caravan_attack'
          || q.eventQuest?.branch !== 'support'
          || !q.eventQuest.escort
        ) {
          return q;
        }
        const escort = q.eventQuest.escort;
        const routeIndex = escort.route.indexOf(locationId);
        let nextEscort = { ...escort };
        if (routeIndex >= 0 && routeIndex > escort.currentLeg) {
          nextEscort.currentLeg = routeIndex;
          routeLogs.push(
            lang === 'ru'
              ? `Караван продвинулся по маршруту: этап ${routeIndex + 1}/${escort.route.length}.`
              : `Convoy advanced on route: stage ${routeIndex + 1}/${escort.route.length}.`,
          );
        } else if (routeIndex < 0 && locationId !== q.eventQuest.targetHubId && escort.perfectRun) {
          nextEscort.perfectRun = false;
          routeLogs.push(
            lang === 'ru'
              ? 'Маршрут сопровождения нарушен: идеальный бонус больше недоступен.'
              : 'Escort route was broken: perfect-run bonus is no longer available.',
          );
        }
        const ambushPending = nextEscort.pendingAmbushLocationId === locationId;
        const ambushRequired = nextEscort.ambushLocationIds.includes(locationId)
          && !nextEscort.clearedAmbushLocations.includes(locationId)
          && !nextEscort.pendingAmbushLocationId;
        if (ambushRequired || ambushPending) {
          nextEscort.pendingAmbushLocationId = locationId;
          const hubLevel = clamp(worldHubLevelForEventQuest(q), 1, 5);
          const enemyId = hubLevel >= 4 ? 'ash_bandit' : 'bandit';
          forcedAmbushEnemy = ENEMIES[enemyId];
          routeLogs.push(
            lang === 'ru'
              ? `Засада на маршруте! Защитите караван у ${targetLoc.name[lang]}.`
              : `Route ambush! Defend the convoy near ${targetLoc.name[lang]}.`,
          );
        }
        return {
          ...q,
          eventQuest: {
            ...q.eventQuest,
            escort: nextEscort,
          },
        };
      });
      const nextQuests = syncQuestStates(escortAdjustedQuests, player);

      const periodEnemyPoolRaw = filterEnemiesByDayPeriod(targetLoc.possibleEnemies || [], dayPeriod);
      const periodEnemyPool = periodEnemyPoolRaw.length > 0 ? periodEnemyPoolRaw : (targetLoc.possibleEnemies || []);
      const enemyTemplate = forcedAmbushEnemy
        || (targetLoc.possibleEnemies && Math.random() < encounterChance
          ? ENEMIES[periodEnemyPool[Math.floor(Math.random() * periodEnemyPool.length)]]
          : null);
      if (enemyTemplate) {
        const enemyId = enemyTemplate.id;
        codexUnlocks = unlockCodex(codexUnlocks, 'enemies', enemyId);
        const logs = [
          !wasDiscovered
            ? lang === 'ru'
              ? `Открыта новая локация: ${targetLoc.name[lang]} (+30 XP, +18 золота).`
              : `Discovered new location: ${targetLoc.name[lang]} (+30 XP, +18 gold).`
            : '',
          ...(routeLogs.length > 0 ? routeLogs : []),
          forcedAmbushEnemy
            ? (lang === 'ru' ? `Караван атакован: ${enemyTemplate.name[lang]} выходит на перехват!` : `Convoy attacked: ${enemyTemplate.name[lang]} intercepts the route!`)
            : (lang === 'ru' ? `На вас напал ${enemyTemplate.name[lang]} во время путешествия!` : `You were ambushed by a ${enemyTemplate.name[lang]} while traveling!`),
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
        set({ player, gameTime: nextGameTime, currentLocationId: locationId, status: 'combat', currentEnemy: buildEnemy(enemyTemplate), combatLogs: logs, isPlayerBlocking: false, quests: nextQuests, codexUnlocks, worldEconomy, combatCombo: 0, combatAdrenaline: 0 });
      } else {
        const logs = !wasDiscovered
          ? [lang === 'ru' ? `Открыта новая локация: ${targetLoc.name[lang]} (+30 XP, +18 золота).` : `Discovered new location: ${targetLoc.name[lang]} (+30 XP, +18 gold).`]
          : [];
        logs.push(...routeLogs);
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
        set({ player, gameTime: nextGameTime, currentLocationId: locationId, status: targetLoc.type === 'hub' ? 'hub' : 'exploring', quests: nextQuests, codexUnlocks, worldEconomy, combatLogs: logs.length > 0 ? logs : freshState.combatLogs });
      }
      get().saveGame();
    },

    explore: () => {
      get().tickWeather();
      const state = get();
      const loc = LOCATIONS[state.currentLocationId];
      if (loc.type === 'hub') return;
      const nextGameTime = advanceGameTime(state.gameTime, 2);
      const dayPeriod = getDayPeriodFromTime(nextGameTime);
      const chainQuest = findActiveCombatChainQuest(state.quests, state.currentLocationId);
      const pendingChainGoal = chainQuest?.goals.find((g) => g.type === 'kill' && g.currentCount < g.targetCount);
      if (pendingChainGoal) {
        const forcedEnemy = ENEMIES[pendingChainGoal.targetId];
        if (forcedEnemy) {
          const lang = state.settings.language;
          set({
            gameTime: nextGameTime,
            status: 'combat',
            currentEnemy: buildEnemy(forcedEnemy),
            combatLogs: [
              lang === 'ru'
                ? `Цепочка боя продолжается: этап ${pendingChainGoal.currentCount + 1}/${pendingChainGoal.targetCount}.`
                : `Combat chain continues: stage ${pendingChainGoal.currentCount + 1}/${pendingChainGoal.targetCount}.`,
            ],
            isPlayerBlocking: false,
            combatCombo: 0,
            combatAdrenaline: 0,
          });
          get().saveGame();
          return;
        }
      }
      const fatigueFactor = getFatigueFactor(state.player);
      let codexUnlocks = unlockCodex(state.codexUnlocks, 'locations', state.currentLocationId);
      let worldEconomy = simulateWorldEconomyTick(state.worldEconomy, state.currentWeather, nextGameTime);
      const expansion = expandHubsIfEligible(worldEconomy);
      worldEconomy = expansion.worldEconomy;
      const questsWithEvents = withGeneratedEventQuests(state.quests, worldEconomy);

      const roll = Math.random();
      let encounterChance = 0.22;
      let lootChance = 0.9;
      const weatherFx = WEATHER[state.currentWeather].exploreEffect;
      if (weatherFx?.encounterChanceMod) encounterChance += weatherFx.encounterChanceMod;
      if (weatherFx?.lootChanceMod) lootChance += weatherFx.lootChanceMod;
      encounterChance += getDayPeriodEncounterDelta(dayPeriod);
      lootChance += getDayPeriodLootDelta(dayPeriod);
      encounterChance += fatigueFactor * 0.1;
      lootChance -= fatigueFactor * 0.15;
      const scavLevel = state.player.learnedSkills['scavenger_1'] || 0;
      if (scavLevel > 0) lootChance += scavLevel * 0.05;

      if (roll < lootChance && loc.possibleLoot) {
        const lootId = loc.possibleLoot[Math.floor(Math.random() * loc.possibleLoot.length)];
        if (lootId === 'gold') {
          const amount = Math.floor(Math.random() * 10) + 1;
          const player = { ...state.player, gold: state.player.gold + amount, fatigue: Math.min(FATIGUE_MAX, (state.player.fatigue || 0) + 6) };
          set({ player, gameTime: nextGameTime, quests: syncQuestStates(questsWithEvents, player), codexUnlocks, worldEconomy });
        } else {
          codexUnlocks = unlockCodex(codexUnlocks, 'items', lootId);
          const player = addItem(state.player, lootId, 1).player;
          player.fatigue = Math.min(FATIGUE_MAX, (player.fatigue || 0) + 6);
          set({ player, gameTime: nextGameTime, quests: syncQuestStates(questsWithEvents, player), codexUnlocks, worldEconomy });
        }
      } else if (loc.possibleEnemies && Math.random() < encounterChance) {
        const periodEnemyPoolRaw = filterEnemiesByDayPeriod(loc.possibleEnemies, dayPeriod);
        const periodEnemyPool = periodEnemyPoolRaw.length > 0 ? periodEnemyPoolRaw : loc.possibleEnemies;
        const enemyId = periodEnemyPool[Math.floor(Math.random() * periodEnemyPool.length)];
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
          gameTime: nextGameTime,
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
          gameTime: nextGameTime,
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
          gameTime: nextGameTime,
          quests: syncQuestStates(questsWithEvents, state.player),
          codexUnlocks,
          worldEconomy,
        });
      }
      get().saveGame();
    },

    camp: () => {
      const state = get();
      const chainQuest = findActiveCombatChainQuest(state.quests, state.currentLocationId);
      if (chainQuest) {
        set({
          combatLogs: [
            ...(state.combatLogs || []),
            state.settings.language === 'ru'
              ? 'Нельзя разбить лагерь во время активной боевой цепочки.'
              : 'You cannot camp while a combat chain is active.',
          ],
        });
        return;
      }
      set({ status: 'camp' });
      get().saveGame();
    },

    breakCamp: () => {
      const state = get();
      const chainQuest = findActiveCombatChainQuest(state.quests, state.currentLocationId);
      if (chainQuest) {
        set({
          combatLogs: [
            ...(state.combatLogs || []),
            state.settings.language === 'ru'
              ? 'Сначала завершите боевую цепочку по контракту.'
              : 'Finish the contract combat chain first.',
          ],
        });
        return;
      }
      set({ status: 'exploring' });
      get().saveGame();
    },

    rest: () => {
      const state = get();
      const chainQuest = findActiveCombatChainQuest(state.quests, state.currentLocationId);
      if (chainQuest) {
        set({
          combatLogs: [
            ...(state.combatLogs || []),
            state.settings.language === 'ru'
              ? 'Отдых недоступен: у вас незавершённая боевая цепочка.'
              : 'Rest is unavailable while you have an unfinished combat chain.',
          ],
        });
        return;
      }
      const hoursToMorning = ((24 - state.gameTime.hour + 6) % 24) || 24;
      const nextGameTime = advanceGameTime(state.gameTime, hoursToMorning);
      const isFieldRest = LOCATIONS[state.currentLocationId]?.type !== 'hub';
      const isNightRest = isFieldRest && getDayPeriodFromTime(state.gameTime) === 'night';
      set((state) => ({
        player: {
          ...state.player,
          hp: isNightRest
            ? Math.min(state.player.maxHp, state.player.hp + Math.floor((state.player.maxHp - state.player.hp) * 0.72))
            : state.player.maxHp,
          energy: isNightRest
            ? Math.min(state.player.maxEnergy, state.player.energy + Math.floor((state.player.maxEnergy - state.player.energy) * 0.72))
            : state.player.maxEnergy,
          fatigue: Math.max(0, (state.player.fatigue || 0) - (isNightRest ? 25 : 45)),
        },
        gameTime: nextGameTime,
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

      const stats = getCombatStats(state.player, state.currentWeather, state.gameTime);
      let enemy = { ...state.currentEnemy, isBlocking: false };
      const player = { ...state.player, energy: Math.max(0, state.player.energy - ENERGY_COSTS.attack) };
      const dodgeChance = getEnemyDodgeChance(player, enemy);
      if (Math.random() < dodgeChance) {
        const logs = [
          ...state.combatLogs,
          lang === 'ru'
            ? `${state.currentEnemy.name[lang]} уклоняется от атаки.`
            : `${state.currentEnemy.name[lang]} dodges your attack.`,
        ];
        set({
          player,
          currentEnemy: enemy,
          combatLogs: logs,
          isPlayerBlocking: false,
          combatStyle: { ...state.combatStyle, attack: state.combatStyle.attack + 1 },
          combatCombo: 0,
          combatAdrenaline: Math.max(0, state.combatAdrenaline - 3),
        });
        enemyTurn(logs);
        return;
      }
      const baseDamage = rollDamage([stats.minDamage, stats.maxDamage]);
      const isCrit = Math.random() <= stats.critChance;
      const critMult = isCrit ? 1.6 : 1;
      const comboBonus = 1 + Math.min(COMBO_MAX, state.combatCombo) * 0.06;
      let finalDamage = Math.max(1, Math.floor(baseDamage * critMult * comboBonus * (state.currentEnemy.isBlocking ? 0.45 : 1)));
      finalDamage = applyResist(finalDamage, stats.damageType, state.currentEnemy.resistances);
      finalDamage = Math.floor(finalDamage / (state.currentEnemy.defenseMod || 1));
      enemy = { ...enemy, hp: Math.max(0, state.currentEnemy.hp - finalDamage) };
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
      if (!enemyIsImmuneToStatus(enemy, 'stunned') && Math.random() <= getPlayerStunChance(state, enemy, 'attack')) {
        enemy.statusEffects = [...enemy.statusEffects, { type: 'stunned', duration: 1, potency: 1, source: 'combat_attack' }];
        logs.push(lang === 'ru' ? 'Цель оглушена!' : 'Target is stunned!');
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

      const baseStats = getCombatStats(state.player, state.currentWeather, state.gameTime);
      const scale = skill.effect.damageScale || 1;
      const dmgType = skill.effect.damageType || baseStats.damageType;
      const comboBonus = 1 + Math.min(COMBO_MAX, state.combatCombo) * 0.06;
      let player = { ...state.player, energy: state.player.energy - cost, cooldowns: { ...(state.player.cooldowns || {}) } };
      player.cooldowns![skillId] = skill.effect.cooldownTurns || 1;
      let enemy = { ...state.currentEnemy, isBlocking: false };
      const logs = [
        ...state.combatLogs,
      ];

      const dodgeChance = getEnemyDodgeChance(player, enemy);
      if (Math.random() < dodgeChance) {
        logs.push(
          state.settings.language === 'ru'
            ? `${enemy.name.ru} уклоняется от навыка ${skill.name.ru}.`
            : `${enemy.name.en} dodges your ${skill.name.en}.`,
        );
        set({
          player,
          currentEnemy: enemy,
          combatLogs: logs,
          isPlayerBlocking: false,
          combatStyle: { ...state.combatStyle, skill: state.combatStyle.skill + 1 },
          combatCombo: 0,
          combatAdrenaline: Math.max(0, state.combatAdrenaline - 2),
        });
        enemyTurn(logs);
        return;
      }

      let damage = Math.max(1, Math.floor(rollDamage([baseStats.minDamage, baseStats.maxDamage]) * scale * comboBonus));
      damage = applyResist(damage, dmgType, state.currentEnemy.resistances);

      if (skill.id === 'ultimate_stormbreaker') {
        const hasBleed = state.currentEnemy.statusEffects.some((s) => s.type === 'bleeding');
        if (hasBleed) damage = Math.floor(damage * 1.25);
      }

      enemy = { ...enemy, hp: Math.max(0, state.currentEnemy.hp - damage) };
      logs.push(
        state.settings.language === 'ru'
          ? `Вы используете ${skill.name.ru} и наносите ${damage} урона.`
          : `You use ${skill.name.en} and deal ${damage} damage.`,
      );

      if (skill.effect.appliesStatus && Math.random() <= skill.effect.appliesStatus.chance) {
        enemy.statusEffects = [...enemy.statusEffects, { ...skill.effect.appliesStatus, source: skill.id }];
        logs.push(state.settings.language === 'ru' ? `Наложен эффект: ${skill.effect.appliesStatus.type}.` : `Applied status: ${skill.effect.appliesStatus.type}.`);
      }
      if (!enemyIsImmuneToStatus(enemy, 'stunned') && Math.random() <= getPlayerStunChance(state, enemy, 'skill')) {
        enemy.statusEffects = [...enemy.statusEffects, { type: 'stunned', duration: 1, potency: 1, source: skill.id }];
        logs.push(state.settings.language === 'ru' ? 'Цель оглушена!' : 'Target is stunned!');
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
        const dodgeChance = getEnemyDodgeChance(player, enemy);
        if (Math.random() < dodgeChance) {
          logs.push(
            lang === 'ru'
              ? `${enemy.name.ru} уклоняется от брошенного предмета.`
              : `${enemy.name.en} dodges the thrown item.`,
          );
          combo = 0;
          adrenaline = Math.max(0, adrenaline - 2);
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
        if (!enemyIsImmuneToStatus(enemy, 'stunned') && Math.random() <= getPlayerStunChance(state, enemy, 'throw')) {
          enemy.statusEffects = [...enemy.statusEffects, { type: 'stunned', duration: 1, potency: 1, source: item.id }];
          logs.push(lang === 'ru' ? 'Цель оглушена!' : 'Target is stunned!');
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
      const state = get();
      const completedFight = Boolean(state.currentEnemy && state.currentEnemy.hp <= 0);
      const nextGameTime = completedFight ? advanceGameTime(state.gameTime, 1) : state.gameTime;
      set({ gameTime: nextGameTime, status: 'exploring', currentEnemy: null, combatLogs: [], isPlayerBlocking: false, combatStyle: { attack: 0, block: 0, item: 0, skill: 0 }, combatCombo: 0, combatAdrenaline: 0 });
      get().saveGame();
    },

    startTutorialCombat: () => {
      const state = get();
      if (state.status === 'combat' && state.currentEnemy) return;
      const lang = state.settings.language;
      const tutorialEnemyTemplate =
        Object.values(ENEMIES).find((enemy) => enemy.level <= 2)
        || Object.values(ENEMIES)[0];
      if (!tutorialEnemyTemplate) return;
      set({
        status: 'combat',
        currentEnemy: buildEnemy(tutorialEnemyTemplate),
        combatLogs: [
          lang === 'ru'
            ? 'Учебный бой начался. Отработайте действия на практике.'
            : 'Tutorial combat started. Practice each action in real combat.',
        ],
        isPlayerBlocking: false,
        combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
        combatCombo: 0,
        combatAdrenaline: 0,
      });
    },

    stopTutorialCombat: () => {
      const state = get();
      if (state.status !== 'combat') return;
      set({
        status: 'hub',
        currentEnemy: null,
        combatLogs: [],
        isPlayerBlocking: false,
        combatStyle: { attack: 0, block: 0, item: 0, skill: 0 },
        combatCombo: 0,
        combatAdrenaline: 0,
      });
    },

    buyItem: (itemId, price) => {
      const state = get();
      const period = getDayPeriodFromTime(state.gameTime);
      const merchantId = getActiveMerchantIdForLocation(state.currentLocationId) || state.currentLocationId;
      if (isMerchantClosedAtTime(merchantId, period, state.gameTime.totalHours)) {
        void playSfx('ui_error_denied');
        set({
          combatLogs: [
            ...(state.combatLogs || []),
            state.settings.language === 'ru'
              ? 'Торговля сейчас недоступна: торговцы закрыты для этого времени суток.'
              : 'Trading is unavailable right now: merchants are closed for this time of day.',
          ],
        });
        return;
      }
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
      void playSfx('shop_buy');
      set({ player, quests: syncQuestStates(state.quests, player), worldEconomy });
      get().saveGame();
    },

    sellItem: (itemId, price) => {
      const state = get();
      const period = getDayPeriodFromTime(state.gameTime);
      const merchantId = getActiveMerchantIdForLocation(state.currentLocationId) || state.currentLocationId;
      if (isMerchantClosedAtTime(merchantId, period, state.gameTime.totalHours)) {
        void playSfx('ui_error_denied');
        set({
          combatLogs: [
            ...(state.combatLogs || []),
            state.settings.language === 'ru'
              ? 'Торговля сейчас недоступна: торговцы закрыты для этого времени суток.'
              : 'Trading is unavailable right now: merchants are closed for this time of day.',
          ],
        });
        return;
      }
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
      void playSfx('shop_sell');
      set({ player, quests: syncQuestStates(state.quests, player), worldEconomy });
      get().saveGame();
    },

    getBuyPrice: (merchantId, itemId, basePrice) => {
      const state = get();
      const period = getDayPeriodFromTime(state.gameTime);
      if (isMerchantClosedAtTime(merchantId, period, state.gameTime.totalHours)) {
        return Math.max(1, Math.round(basePrice * 9.99));
      }
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
      const morningDiscount = period === 'morning' ? 0.92 : 1;
      const eveningRareMod = getEveningRareItemPriceMod(period, merchantId, itemId, state.gameTime.totalHours);
      return Math.max(1, Math.round(basePrice * locMod * weather * fatigueMarkup * repDiscount * stabilityMarkup * wealthMarkup * relationDiscount * marketPressure * modeMarkup * morningDiscount * eveningRareMod));
    },

    getSellPrice: (merchantId, itemId, basePrice) => {
      const state = get();
      const period = getDayPeriodFromTime(state.gameTime);
      if (isMerchantClosedAtTime(merchantId, period, state.gameTime.totalHours)) {
        return 0;
      }
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
      const item = ITEMS[itemId];
      const dayResourceBonus = period === 'day' && item?.type === 'material' ? 1.1 : 1;
      return Math.max(1, Math.round(Math.floor(basePrice * 0.5) * (2 - locMod * 0.2) * repBonus * fatiguePenalty * wealthBonus * relationBonus * demandBonus * modeBonus * dayResourceBonus));
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
      const dayPeriod = getDayPeriodFromTime(state.gameTime);
      const eveningHubBonus = dayPeriod === 'evening' && LOCATIONS[state.currentLocationId]?.type === 'hub' && Math.random() < 0.2 ? 1 : 0;
      const add = addItem(player, recipe.resultItemId, recipe.resultQuantity + eveningHubBonus);
      if (add.added <= 0) return;
      if (eveningHubBonus > 0 && add.added > recipe.resultQuantity) {
        set({
          combatLogs: [
            ...(state.combatLogs || []),
            state.settings.language === 'ru'
              ? 'Вечерняя смена в мастерской дала бонус к крафту: +1 предмет.'
              : 'Evening workshop shift improved crafting efficiency: +1 extra item.',
          ],
        });
      }
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
