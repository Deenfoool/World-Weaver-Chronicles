export type WeatherType = "clear" | "rain" | "fog" | "storm" | "snow";
export type DamageType = "physical" | "poison" | "fire" | "frost" | "arcane";
export type StatusEffectType = "bleeding" | "poisoned" | "stunned";
export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type EnemyRole = "tank" | "berserker" | "alchemist" | "boss";
export type SkillBranch = "warfare" | "survival" | "alchemy" | "tactics";
export type PlayerClassId = "wanderer" | "guardian" | "slayer" | "arcanist" | "warrior" | "ranger" | "alchemist";
export type Specialization = "warden" | "duelist" | "plaguebinder" | "stormcaller";
export type CraftingStation = "campfire" | "alchemy_table" | "forge" | "runic_workbench";

export interface StatusEffectInstance {
  type: StatusEffectType;
  duration: number;
  potency: number;
  source?: string;
}

export interface WeatherEffect {
  id: WeatherType;
  name: Record<string, string>;
  description: Record<string, string>;
  combatEffect?: {
    playerDamageMod?: number;
    enemyDamageMod?: number;
    playerDefenseMod?: number;
    enemyDefenseMod?: number;
  };
  exploreEffect?: {
    encounterChanceMod?: number;
    lootChanceMod?: number;
  };
}

export interface Skill {
  [key: string]: any;
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  maxLevel: number;
  requires?: string[];
  costPerLevel: number;
  branch?: SkillBranch;
  synergyWith?: string[];
  effect: {
    type: "stat" | "passive" | "active" | "ultimate";
    stat?: "hp" | "damage" | "defense";
    valuePerLevel?: number;
    cooldownTurns?: number;
    energyCost?: number;
    damageScale?: number;
    damageType?: DamageType;
    appliesStatus?: {
      type: StatusEffectType;
      chance: number;
      duration: number;
      potency: number;
    };
  };
}

export interface CharacterClass {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  baseStats: {
    maxHp: number;
    maxEnergy: number;
    baseDamage: [number, number];
    baseDefense: number;
    carryCapacity: number;
  };
  startWeaponId: string;
  startArmorId: string;
  startItems: { itemId: string; quantity: number }[];
}

export interface Recipe {
  [key: string]: any;
  id: string;
  name: Record<string, string>;
  resultItemId: string;
  resultQuantity: number;
  ingredients: { itemId: string; quantity: number }[];
  requiredSkill?: { skillId: string; minLevel: number };
  requiredStation?: CraftingStation;
}

export type LocationType = "hub" | "explore" | "road" | "camp";

export interface Location {
  [key: string]: any;
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  type: LocationType;
  image: string;
  connectedLocations: string[];
  possibleEnemies?: string[];
  possibleLoot?: string[];
  npcs?: string[];
  allowedWeather?: WeatherType[];
  craftingStations?: CraftingStation[];
  merchantPriceMod?: number;
}

export interface Enemy {
  [key: string]: any;
  id: string;
  name: Record<string, string>;
  level: number;
  hp: number;
  maxHp: number;
  maxEnergy: number;
  damage: [number, number];
  damageType?: DamageType;
  role?: EnemyRole;
  resistances?: Partial<Record<DamageType, number>>;
  statusInflict?: {
    type: StatusEffectType;
    chance: number;
    duration: number;
    potency: number;
  };
  phases?: {
    thresholdHpPercent: number;
    name: Record<string, string>;
    damageMod?: number;
    defenseMod?: number;
    statusImmunity?: StatusEffectType[];
  }[];
  adaptiveProfile?: {
    punishBlocking?: boolean;
    punishConsumables?: boolean;
    punishAggression?: boolean;
  };
  dropTable: {
    itemId: string;
    chance: number;
    min: number;
    max: number;
  }[];
  xpReward: number;
  goldReward: [number, number];
}

export type ItemType =
  | "weapon"
  | "armor"
  | "consumable"
  | "material"
  | "quest"
  | "recipe";

export interface Item {
  [key: string]: any;
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  type: ItemType;
  rarity?: ItemRarity;
  affixes?: string[];
  setId?: string;
  uniqueLegendary?: boolean;
  slotCategory?: "potion" | "material" | "gear" | "misc";
  value: number;
  weight: number;
  stats?: {
    damage?: [number, number];
    defense?: number;
    heal?: number;
    energyRestore?: number;
    throwDamage?: [number, number];
    damageType?: DamageType;
    critChanceBonus?: number;
    counterChanceBonus?: number;
    statusOnHit?: {
      type: StatusEffectType;
      chance: number;
      duration: number;
      potency: number;
    };
  };
  teachesRecipeId?: string;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface Player {
  classId: PlayerClassId | null;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  specializationId?: Specialization;
  prestigeLevel?: number;
  questPerks?: string[];
  learnedSkills: Record<string, number>;
  cooldowns?: Record<string, number>;
  knownRecipes: string[];
  merchantReputation?: Record<string, number>;
  backpackSlots?: {
    potion: number;
    material: number;
  };
  statusEffects?: StatusEffectInstance[];
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  fatigue?: number;
  discoveredLocations?: string[];
  carryCapacity: number;
  gold: number;
  inventory: InventoryItem[];
  equipment: {
    weapon?: string;
    armor?: string;
  };
  stats: {
    baseDamage: [number, number];
    baseDefense: number;
  };
}

export interface QuestGoal {
  type: "kill" | "explore" | "collect" | "deliver" | "donate";
  targetId: string;
  targetCount: number;
  currentCount: number;
}

export interface Quest {
  [key: string]: any;
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  locationId: string;
  giverNpcId?: string;
  turnInNpcId?: string;
  goals: QuestGoal[];
  rewards: {
    xp: number;
    gold: number;
    items?: { itemId: string; quantity: number }[];
    perkId?: string;
    reputation?: { merchantId: string; amount: number }[];
  };
  expiresAtTick?: number;
  offerState?: "offered" | "active" | "resolved" | "expired";
  isEventQuest?: boolean;
  sourceEventId?: string;
  eventQuest?: {
    originType: "war" | "caravan_attack" | "crisis" | "prosperity" | "black_market_opened" | "hub_destroyed" | "hub_founded";
    targetHubId: string;
    opponentHubId?: string;
    sourceHubLevel?: number;
    branch: "unselected" | "support" | "punish" | "support_a" | "support_b" | "neutral";
    escort?: {
      originHubId: string;
      targetHubId: string;
      route: string[];
      currentLeg: number;
      ambushLocationIds: string[];
      clearedAmbushLocations: string[];
      pendingAmbushLocationId?: string;
      totalAmbushes: number;
      perfectRun: boolean;
    };
  };
  isTurnInReady?: boolean;
  isCompleted: boolean;
}

export interface Merchant {
  id: string;
  name: Record<string, string>;
  locationId: string;
  inventory: {
    itemId: string;
    price: number;
  }[];
}

export interface DialogueNode {
  id: string;
  text: Record<string, string>;
  options: {
    text: Record<string, string>;
    nextNodeId: string | null;
    action?: "give_quest" | "heal" | "turn_in_quest";
    actionPayload?: string;
  }[];
}

export interface NPC {
  id: string;
  name: Record<string, string>;
  locationId: string;
  dialogueTree: Record<string, DialogueNode>;
  defaultNode: string;
}

export type GameStateStatus =
  | "traveling"
  | "exploring"
  | "combat"
  | "hub"
  | "resting"
  | "camp";

export type Language = "en" | "ru";
export type VoiceChannel = "lore" | "quests" | "npcDialogue";

export interface VoiceSettings {
  lore: boolean;
  quests: boolean;
  npcDialogue: boolean;
}

export interface TutorialSettings {
  enabled: boolean;
  completed: boolean;
  step: number;
  seenHints: string[];
}

export interface GameSettings {
  language: Language;
  voice: VoiceSettings;
  tutorial: TutorialSettings;
}

export interface CodexUnlocks {
  items: string[];
  locations: string[];
  npcs: string[];
  enemies: string[];
}

export interface HubEconomyState {
  hubId: string;
  hubKind: "faction" | "alliance" | "community";
  wealth: number;
  level: number;
  treasury: number;
  tradeTurnover: number;
  resources: Record<string, number>;
  supply: number;
  demand: number;
  stability: number;
  playerRelation: number;
  levelUpStreak: number;
  levelDownStreak: number;
  degradationStreak: number;
  destroyed: boolean;
  marketMode: "stable" | "scarcity" | "surplus" | "black_market";
  blackMarketUntilTick?: number;
}

export interface TradeRouteState {
  id: string;
  fromHubId: string;
  toHubId: string;
  distance: number;
  flow: number;
  risk: number;
}

export interface WorldEconomyEvent {
  id: string;
  tick: number;
  type:
    | "war"
    | "caravan_attack"
    | "crisis"
    | "prosperity"
    | "black_market_opened"
    | "hub_destroyed"
    | "hub_founded"
    | "retaliation"
    | "aid_arrival"
    | "tariff_relief"
    | "player_raid"
    | "player_investment"
    | "player_diplomacy"
    | "player_sabotage";
  hubId: string;
  targetHubId?: string;
  intensity: number;
}

export interface ReputationLogEntry {
  id: string;
  tick: number;
  hubId: string;
  delta: number;
  reason: string;
  reasonKey?:
    | "quest_support"
    | "quest_punish"
    | "quest_neutral"
    | "quest_side_choice"
    | "delay_retaliation"
    | "delay_aid_arrival"
    | "delay_tariff_relief"
    | "delay_smuggler_backlash"
    | "player_investment"
    | "player_diplomacy"
    | "player_raid"
    | "player_sabotage";
  source: "quest_resolution" | "delayed_consequence" | "player_action";
  relatedHubId?: string;
}

export interface PendingEconomyConsequence {
  id: string;
  dueTick: number;
  originQuestId: string;
  triggerHubId: string;
  targetHubId?: string;
  kind: "retaliation" | "aid_arrival" | "tariff_relief" | "smuggler_crackdown";
  intensity: number;
  sourceBranch: "support" | "punish" | "support_a" | "support_b" | "neutral";
}

export interface WorldEconomyState {
  tick: number;
  hubs: Record<string, HubEconomyState>;
  tradeRoutes: Record<string, TradeRouteState>;
  hubRelations: Record<string, {
    hubAId: string;
    hubBId: string;
    status: "allied" | "neutral" | "conflict";
    strength: number;
  }>;
  spawnedHubIds: string[];
  events: WorldEconomyEvent[];
  pendingConsequences: PendingEconomyConsequence[];
  reputationLog: ReputationLogEntry[];
}

export interface SaveData {
  saveVersion?: number;
  player: Player;
  currentLocationId: string;
  currentWeather: WeatherType;
  weatherDuration: number;
  quests: Quest[];
  groundLootByLocation?: Record<string, { itemId: string; quantity: number }[]>;
  codexUnlocks?: CodexUnlocks;
  worldEconomy?: WorldEconomyState;
  status: GameStateStatus;
  timestamp: number;
  settings: GameSettings;
}
