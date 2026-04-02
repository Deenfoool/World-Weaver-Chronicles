import { create } from 'zustand';
import { Player, Quest, GameStateStatus, SaveData, Enemy, Language, WeatherType, DamageType, StatusEffectInstance, StatusEffectType, GameSettings, VoiceChannel } from './types';
import { INITIAL_QUESTS, LOCATIONS, ENEMIES, ITEMS, ALL_QUESTS, WEATHER, SKILLS, RECIPES, CLASSES } from './constants';
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
  chooseClass: (classId: string, bonuses?: CharacterCreationBonuses) => void;
  travelTo: (locationId: string) => void;
  explore: () => void;
  rest: () => void;
  camp: () => void;
  breakCamp: () => void;
  acceptQuest: (questId: string, npcId?: string) => void;
  turnInQuest: (questId: string, npcId: string) => void;

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
};
const ENERGY_COSTS = { attack: 15, flee: 20, item: 10, throw: 12 };
const COMBO_MAX = 5;
const ADRENALINE_MAX = 100;
const SECOND_WIND_COST = 50;
const FATIGUE_MAX = 100;

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
    if (q.isCompleted) return q;
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
    if (q.isCompleted) return q;
    const completed = q.goals.every((g) => g.currentCount >= g.targetCount);
    if (!completed) return { ...q, isTurnInReady: false };
    return { ...q, isTurnInReady: true };
  });
}

function syncQuestStates(quests: Quest[], player: Player): Quest[] {
  return markQuestTurnInReady(syncCollectGoals(quests, player));
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

function applyClassLoadout(basePlayer: Player, classId: string, bonuses?: CharacterCreationBonuses): Player {
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
  });

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
      set({
        player: { ...player, hp: Math.floor(player.maxHp * 0.3), energy: Math.floor(player.maxEnergy * 0.5) },
        currentLocationId: 'town_oakhaven',
        status: 'hub',
        currentEnemy: null,
        combatLogs: [],
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
      set({
        player: { ...player, hp: Math.floor(player.maxHp * 0.3), energy: Math.floor(player.maxEnergy * 0.5) },
        currentLocationId: 'town_oakhaven',
        status: 'hub',
        currentEnemy: null,
        combatLogs: [],
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
    const logs = [...logsSeed, lang === 'ru' ? `Вы победили ${enemy.name[lang]}!` : `You defeated ${enemy.name[lang]}!`];

    player.xp += enemy.xpReward;
    const gold = rollDamage(enemy.goldReward);
    if (gold > 0) {
      player.gold += gold;
      logs.push(lang === 'ru' ? `Получено ${gold} золота.` : `Gained ${gold} gold.`);
    }

    enemy.dropTable.forEach((drop) => {
      if (Math.random() >= drop.chance) return;
      const count = rollDamage([drop.min, drop.max]);
      const add = addItem(player, drop.itemId, count);
      player = add.player;
      if (add.added > 0) logs.push(lang === 'ru' ? `Добыча: ${ITEMS[drop.itemId].name[lang]} x${add.added}` : `Looted: ${ITEMS[drop.itemId].name[lang]} x${add.added}`);
      if (add.added < count) logs.push(lang === 'ru' ? 'Рюкзак переполнен, часть добычи потеряна.' : 'Backpack is full, some loot was lost.');
    });

    const progressedQuests = state.quests.map((q) => {
      if (q.isCompleted || q.locationId !== state.currentLocationId) return q;
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
    set({
      player,
      currentEnemy: { ...enemy, hp: 0, isBlocking: false },
      combatLogs: logs,
      quests,
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

    chooseClass: (classId, bonuses) => {
      const state = get();
      if (!CLASSES[classId]) return;
      const loaded = applyClassLoadout({ ...state.player }, classId, bonuses);
      set({ player: loaded, currentEnemy: null, combatLogs: [], isPlayerBlocking: false, status: 'hub', combatCombo: 0, combatAdrenaline: 0 });
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
      const questDef = ALL_QUESTS[questId];
      if (questDef && !state.quests.find((q) => q.id === questId)) {
        const quest = JSON.parse(JSON.stringify(questDef)) as Quest;
        if (npcId && !quest.giverNpcId) quest.giverNpcId = npcId;
        if (npcId && !quest.turnInNpcId) quest.turnInNpcId = npcId;
        quest.isTurnInReady = false;
        set({ quests: syncQuestStates([...state.quests, quest], state.player) });
        get().saveGame();
      }
    },

    turnInQuest: (questId, npcId) => {
      const state = get();
      const quest = state.quests.find((q) => q.id === questId);
      if (!quest || quest.isCompleted || !quest.isTurnInReady) return;
      if ((quest.turnInNpcId || quest.giverNpcId) !== npcId) return;

      const logs = [...state.combatLogs];
      let player = applyQuestRewards(state.player, quest, state.settings.language, logs);
      player = applyLevelUps(player, state.settings.language, logs);
      const quests = syncQuestStates(
        state.quests.map((q) =>
          q.id === questId
            ? { ...q, isCompleted: true, isTurnInReady: false }
            : q,
        ),
        player,
      );

      set({ player, quests, combatLogs: logs });
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

      const progressedQuests = state.quests.map((q) => {
        if (q.isCompleted) return q;
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
        const logs = [
          !wasDiscovered
            ? lang === 'ru'
              ? `Открыта новая локация: ${targetLoc.name[lang]} (+30 XP, +18 золота).`
              : `Discovered new location: ${targetLoc.name[lang]} (+30 XP, +18 gold).`
            : '',
          lang === 'ru' ? `На вас напал ${enemyTemplate.name[lang]} во время путешествия!` : `You were ambushed by a ${enemyTemplate.name[lang]} while traveling!`,
        ].filter(Boolean) as string[];
        player = applyLevelUps(player, lang, logs);
        set({ player, currentLocationId: locationId, status: 'combat', currentEnemy: buildEnemy(enemyTemplate), combatLogs: logs, isPlayerBlocking: false, quests: nextQuests, combatCombo: 0, combatAdrenaline: 0 });
      } else {
        const logs = !wasDiscovered
          ? [lang === 'ru' ? `Открыта новая локация: ${targetLoc.name[lang]} (+30 XP, +18 золота).` : `Discovered new location: ${targetLoc.name[lang]} (+30 XP, +18 gold).`]
          : [];
        player = applyLevelUps(player, lang, logs);
        set({ player, currentLocationId: locationId, status: targetLoc.type === 'hub' ? 'hub' : 'exploring', quests: nextQuests, combatLogs: logs.length > 0 ? logs : state.combatLogs });
      }
      get().saveGame();
    },

    explore: () => {
      get().tickWeather();
      const state = get();
      const loc = LOCATIONS[state.currentLocationId];
      if (loc.type === 'hub') return;
      const fatigueFactor = getFatigueFactor(state.player);

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
          set((prev) => {
            const player = { ...prev.player, gold: prev.player.gold + amount, fatigue: Math.min(FATIGUE_MAX, (prev.player.fatigue || 0) + 6) };
            return { player, quests: syncQuestStates(prev.quests, player) };
          });
        } else {
          set((prev) => {
            const player = addItem(prev.player, lootId, 1).player;
            player.fatigue = Math.min(FATIGUE_MAX, (player.fatigue || 0) + 6);
            return { player, quests: syncQuestStates(prev.quests, player) };
          });
        }
      } else if (loc.possibleEnemies && Math.random() < encounterChance) {
        const enemyId = loc.possibleEnemies[Math.floor(Math.random() * loc.possibleEnemies.length)];
        const enemyTemplate = ENEMIES[enemyId];
        const lang = state.settings.language;
        const logMsg = lang === 'ru' ? `Во время исследования вы встретили ${enemyTemplate.name[lang]}!` : `While exploring, you encountered a ${enemyTemplate.name[lang]}!`;
        set({
          player: { ...state.player, fatigue: Math.min(FATIGUE_MAX, (state.player.fatigue || 0) + 6) },
          status: 'combat',
          currentEnemy: buildEnemy(enemyTemplate),
          combatLogs: [logMsg],
          isPlayerBlocking: false,
          combatCombo: 0,
          combatAdrenaline: 0,
        });
      } else if (Math.random() < 0.1) {
        set((prev) => ({
          player: {
            ...prev.player,
            skillPoints: prev.player.skillPoints + 1,
            fatigue: Math.min(FATIGUE_MAX, (prev.player.fatigue || 0) + 5),
          },
        }));
      } else {
        set((prev) => ({
          player: {
            ...prev.player,
            fatigue: Math.min(FATIGUE_MAX, (prev.player.fatigue || 0) + 4),
          },
        }));
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
        set({ player, status: 'exploring', currentEnemy: null, combatLogs: [], isPlayerBlocking: false, combatStyle: { attack: 0, block: 0, item: 0, skill: 0 }, combatCombo: 0, combatAdrenaline: 0 });
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
      set({ player, quests: syncQuestStates(state.quests, player) });
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
      set({ player, quests: syncQuestStates(state.quests, player) });
      get().saveGame();
    },

    getBuyPrice: (merchantId, _itemId, basePrice) => {
      const state = get();
      const rep = state.player.merchantReputation?.[merchantId] || 0;
      const locMod = LOCATIONS[state.currentLocationId].merchantPriceMod || 1;
      const weather = state.currentWeather === 'storm' ? 1.1 : state.currentWeather === 'snow' ? 1.05 : 1;
      const fatigueMarkup = 1 + getFatigueFactor(state.player) * 0.08;
      const repDiscount = Math.max(0.75, 1 - rep * 0.02);
      return Math.max(1, Math.round(basePrice * locMod * weather * fatigueMarkup * repDiscount));
    },

    getSellPrice: (merchantId, _itemId, basePrice) => {
      const state = get();
      const rep = state.player.merchantReputation?.[merchantId] || 0;
      const locMod = LOCATIONS[state.currentLocationId].merchantPriceMod || 1;
      const fatiguePenalty = 1 - getFatigueFactor(state.player) * 0.06;
      const repBonus = 1 + Math.min(0.25, rep * 0.015);
      return Math.max(1, Math.round(Math.floor(basePrice * 0.5) * (2 - locMod * 0.2) * repBonus * fatiguePenalty));
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
