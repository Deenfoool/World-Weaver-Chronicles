import { CharacterClass, Enemy, Item, Location, Merchant, NPC, Quest, Recipe, Skill, WeatherEffect, WeatherType } from './game-types';
import {
  EXPANSION_CONNECTIONS,
  EXPANSION_ENEMIES,
  EXPANSION_ITEMS,
  EXPANSION_LOCATIONS,
  EXPANSION_MERCHANTS,
  EXPANSION_NPCS,
  EXPANSION_QUESTS,
  EXPANSION_RECIPES,
} from './game-content.expansion';

const EN = 'en';
const RU = 'ru';

export const WEATHER: Record<WeatherType, WeatherEffect> = {
  clear: { id: 'clear', name: { [EN]: 'Clear', [RU]: 'Ясно' }, description: { [EN]: 'Normal conditions.', [RU]: 'Нормальные условия.' } },
  rain: { id: 'rain', name: { [EN]: 'Rain', [RU]: 'Дождь' }, description: { [EN]: 'Damage reduced by 10%.', [RU]: 'Урон снижен на 10%.' }, combatEffect: { playerDamageMod: 0.9, enemyDamageMod: 0.9 } },
  fog: { id: 'fog', name: { [EN]: 'Fog', [RU]: 'Туман' }, description: { [EN]: 'More encounters.', [RU]: 'Больше встреч.' }, exploreEffect: { encounterChanceMod: 0.2 } },
  storm: { id: 'storm', name: { [EN]: 'Storm', [RU]: 'Буря' }, description: { [EN]: 'You deal less, enemies deal more.', [RU]: 'Вы наносите меньше, враги больше.' }, combatEffect: { playerDamageMod: 0.8, enemyDamageMod: 1.2 } },
  snow: { id: 'snow', name: { [EN]: 'Snow', [RU]: 'Снег' }, description: { [EN]: 'Loot harder to find.', [RU]: 'Добычу сложнее найти.' }, exploreEffect: { lootChanceMod: -0.1 } },
};

export const SKILLS: Record<string, Skill> = {
  vitality_1: { id: 'vitality_1', branch: 'survival', name: { en: 'Vitality', ru: 'Живучесть' }, description: { en: '+10 Max HP per level.', ru: '+10 к макс. HP за уровень.' }, maxLevel: 5, costPerLevel: 1, effect: { type: 'stat', stat: 'hp', valuePerLevel: 10 } },
  endurance_1: { id: 'endurance_1', branch: 'survival', name: { en: 'Endurance', ru: 'Выносливость' }, description: { en: '+8 Max Energy per level.', ru: '+8 к макс. энергии.' }, maxLevel: 5, costPerLevel: 1, requires: ['vitality_1'], effect: { type: 'passive' } },
  strength_1: { id: 'strength_1', branch: 'warfare', name: { en: 'Strength', ru: 'Сила' }, description: { en: '+1 Max Damage per level.', ru: '+1 к макс. урону.' }, maxLevel: 5, costPerLevel: 1, effect: { type: 'stat', stat: 'damage', valuePerLevel: 1 } },
  defense_1: { id: 'defense_1', branch: 'survival', name: { en: 'Iron Skin', ru: 'Железная кожа' }, description: { en: '+1 Defense per level.', ru: '+1 к защите.' }, maxLevel: 3, requires: ['vitality_1'], costPerLevel: 2, effect: { type: 'stat', stat: 'defense', valuePerLevel: 1 } },
  scavenger_1: { id: 'scavenger_1', branch: 'survival', name: { en: 'Scavenger', ru: 'Мусорщик' }, description: { en: 'Better loot chance.', ru: 'Больше шанса лута.' }, maxLevel: 3, costPerLevel: 1, effect: { type: 'passive' } },
  packrat_1: { id: 'packrat_1', branch: 'survival', name: { en: 'Pack Rat', ru: 'Вьючный' }, description: { en: '+8 carry capacity per level.', ru: '+8 к грузоподъемности.' }, maxLevel: 4, costPerLevel: 1, effect: { type: 'passive' } },
  alchemist_1: { id: 'alchemist_1', branch: 'alchemy', name: { en: 'Field Alchemy', ru: 'Полевая алхимия' }, description: { en: 'Potions heal +10% per level.', ru: 'Зелья лечат +10%.' }, maxLevel: 3, costPerLevel: 2, requires: ['scavenger_1'], effect: { type: 'passive' } },
  guard_master_1: { id: 'guard_master_1', branch: 'tactics', name: { en: 'Guard Mastery', ru: 'Мастер блока' }, description: { en: 'Stronger block and counters.', ru: 'Сильнее блок и контры.' }, maxLevel: 3, costPerLevel: 2, requires: ['defense_1', 'endurance_1'], effect: { type: 'passive' } },
  berserk_critical_1: { id: 'berserk_critical_1', branch: 'warfare', name: { en: 'Critical Focus', ru: 'Смертельный фокус' }, description: { en: '+4% crit chance per level.', ru: '+4% шанса крита.' }, maxLevel: 3, costPerLevel: 2, requires: ['strength_1'], effect: { type: 'passive' } },
  active_rend: { id: 'active_rend', branch: 'warfare', name: { en: 'Rend Strike', ru: 'Рваный удар' }, description: { en: 'Active heavy strike with bleed.', ru: 'Активный удар с кровотечением.' }, maxLevel: 1, costPerLevel: 2, requires: ['strength_1'], effect: { type: 'active', cooldownTurns: 2, energyCost: 20, damageScale: 1.35, damageType: 'physical', appliesStatus: { type: 'bleeding', chance: 0.85, duration: 3, potency: 5 } } },
  active_poison_flask: { id: 'active_poison_flask', branch: 'alchemy', name: { en: 'Toxic Flask', ru: 'Токсичная колба' }, description: { en: 'Active poison skill.', ru: 'Активный ядовитый навык.' }, maxLevel: 1, costPerLevel: 2, requires: ['alchemist_1'], synergyWith: ['active_rend'], effect: { type: 'active', cooldownTurns: 3, energyCost: 18, damageScale: 1.1, damageType: 'poison', appliesStatus: { type: 'poisoned', chance: 0.95, duration: 4, potency: 4 } } },
  ultimate_stormbreaker: { id: 'ultimate_stormbreaker', branch: 'warfare', name: { en: 'Stormbreaker', ru: 'Разрыв бури' }, description: { en: 'Ultimate arcane strike.', ru: 'Ультимейт-удар тайной магией.' }, maxLevel: 1, costPerLevel: 4, requires: ['active_rend', 'berserk_critical_1'], effect: { type: 'ultimate', cooldownTurns: 5, energyCost: 35, damageScale: 2.1, damageType: 'arcane' } },
};

export const CLASSES: Record<string, CharacterClass> = {
  warrior: {
    id: 'warrior',
    name: { en: 'Warrior', ru: 'Воин' },
    description: { en: 'Frontline fighter with high defense and HP.', ru: 'Боец передней линии с высокой защитой и HP.' },
    baseStats: { maxHp: 65, maxEnergy: 52, baseDamage: [2, 4] as [number, number], baseDefense: 2, carryCapacity: 45 },
    startWeaponId: 'sword_rusty',
    startArmorId: 'armor_leather',
    startItems: [{ itemId: 'potion_small', quantity: 2 }, { itemId: 'potion_energy', quantity: 1 }],
  },
  ranger: {
    id: 'ranger',
    name: { en: 'Ranger', ru: 'Следопыт' },
    description: { en: 'Mobile fighter with high energy and utility.', ru: 'Мобильный боец с высокой энергией и утилитарными предметами.' },
    baseStats: { maxHp: 54, maxEnergy: 70, baseDamage: [2, 5] as [number, number], baseDefense: 1, carryCapacity: 38 },
    startWeaponId: 'sword_rusty',
    startArmorId: 'armor_leather',
    startItems: [{ itemId: 'potion_small', quantity: 1 }, { itemId: 'potion_energy', quantity: 2 }, { itemId: 'bomb_fire', quantity: 1 }],
  },
  alchemist: {
    id: 'alchemist',
    name: { en: 'Alchemist', ru: 'Алхимик' },
    description: { en: 'Potion specialist with strong pouch gameplay.', ru: 'Специалист по зельям с сильной игрой через подсумок.' },
    baseStats: { maxHp: 50, maxEnergy: 74, baseDamage: [1, 4] as [number, number], baseDefense: 1, carryCapacity: 34 },
    startWeaponId: 'sword_rusty',
    startArmorId: 'armor_leather',
    startItems: [{ itemId: 'potion_small', quantity: 2 }, { itemId: 'potion_energy', quantity: 2 }, { itemId: 'bomb_fire', quantity: 2 }],
  },
};

export const RECIPES: Record<string, Recipe> = {
  recipe_potion_small: { id: 'recipe_potion_small', name: { en: 'Minor Health Potion', ru: 'Малое зелье здоровья' }, resultItemId: 'potion_small', resultQuantity: 1, requiredStation: 'campfire', ingredients: [{ itemId: 'swamp_weed', quantity: 2 }] },
  recipe_leather_armor: { id: 'recipe_leather_armor', name: { en: 'Torn Leather Tunic', ru: 'Рваная кожаная туника' }, resultItemId: 'armor_leather', resultQuantity: 1, requiredStation: 'campfire', ingredients: [{ itemId: 'wolf_pelt', quantity: 3 }] },
  recipe_antidote: { id: 'recipe_antidote', name: { en: 'Antidote', ru: 'Антидот' }, resultItemId: 'potion_antidote', resultQuantity: 1, requiredStation: 'alchemy_table', ingredients: [{ itemId: 'goblin_ear', quantity: 1 }, { itemId: 'swamp_weed', quantity: 1 }] },
  recipe_spear_ward: { id: 'recipe_spear_ward', name: { en: 'Warden Spear', ru: 'Копье хранителя' }, resultItemId: 'spear_ward', resultQuantity: 1, requiredStation: 'forge', ingredients: [{ itemId: 'hard_wood', quantity: 3 }, { itemId: 'iron_ore', quantity: 2 }] },
  recipe_potion_frost: { id: 'recipe_potion_frost', name: { en: 'Frost Phial', ru: 'Ледяная фиала' }, resultItemId: 'potion_frost', resultQuantity: 1, requiredStation: 'alchemy_table', ingredients: [{ itemId: 'crystal_shard', quantity: 2 }, { itemId: 'swamp_weed', quantity: 1 }] },
  recipe_axe_blackiron: { id: 'recipe_axe_blackiron', name: { en: 'Blackiron Axe', ru: 'Секира черного железа' }, resultItemId: 'axe_blackiron', resultQuantity: 1, requiredStation: 'forge', ingredients: [{ itemId: 'iron_ore', quantity: 4 }, { itemId: 'ember_resin', quantity: 2 }] },
  recipe_scalehide_armor: { id: 'recipe_scalehide_armor', name: { en: 'Scalehide Armor', ru: 'Чешуйчатый доспех' }, resultItemId: 'armor_scalehide', resultQuantity: 1, requiredStation: 'forge', ingredients: [{ itemId: 'scalehide', quantity: 4 }, { itemId: 'hard_wood', quantity: 2 }] },
  recipe_potion_energy_plus: { id: 'recipe_potion_energy_plus', name: { en: 'Charged Draught', ru: 'Заряженное зелье' }, resultItemId: 'potion_energy', resultQuantity: 2, requiredStation: 'alchemy_table', ingredients: [{ itemId: 'crystal_shard', quantity: 1 }, { itemId: 'goblin_ear', quantity: 1 }] },
  recipe_bomb_toxic_plus: { id: 'recipe_bomb_toxic_plus', name: { en: 'Corrosive Bomb', ru: 'Едкая бомба' }, resultItemId: 'bomb_toxic', resultQuantity: 1, requiredStation: 'alchemy_table', ingredients: [{ itemId: 'ember_resin', quantity: 1 }, { itemId: 'swamp_weed', quantity: 2 }] },
  recipe_armor_iron_plus: { id: 'recipe_armor_iron_plus', name: { en: 'Reinforced Chainmail', ru: 'Усиленная кольчуга' }, resultItemId: 'armor_iron', resultQuantity: 1, requiredStation: 'forge', ingredients: [{ itemId: 'iron_ore', quantity: 5 }, { itemId: 'scalehide', quantity: 2 }] },
};

export const ITEMS: Record<string, Item> = {
  gold: { id: 'gold', name: { [EN]: 'Gold Coins', [RU]: 'Золотые монеты' }, description: { [EN]: 'Currency.', [RU]: 'Валюта.' }, type: 'material', slotCategory: 'misc', rarity: 'common', value: 1, weight: 0.01 },
  potion_small: { id: 'potion_small', name: { [EN]: 'Minor Health Potion', [RU]: 'Малое зелье здоровья' }, description: { [EN]: 'Restores 20 HP.', [RU]: 'Восстанавливает 20 HP.' }, type: 'consumable', slotCategory: 'potion', rarity: 'common', value: 15, weight: 0.4, stats: { heal: 20 } },
  potion_large: { id: 'potion_large', name: { [EN]: 'Major Health Potion', [RU]: 'Большое зелье здоровья' }, description: { [EN]: 'Restores 50 HP.', [RU]: 'Восстанавливает 50 HP.' }, type: 'consumable', slotCategory: 'potion', rarity: 'uncommon', value: 40, weight: 0.8, stats: { heal: 50 } },
  potion_energy: { id: 'potion_energy', name: { [EN]: 'Stamina Draught', [RU]: 'Зелье бодрости' }, description: { [EN]: 'Restores 35 Energy.', [RU]: 'Восстанавливает 35 энергии.' }, type: 'consumable', slotCategory: 'potion', rarity: 'uncommon', value: 35, weight: 0.4, stats: { energyRestore: 35 } },
  potion_antidote: { id: 'potion_antidote', name: { [EN]: 'Antidote', [RU]: 'Антидот' }, description: { [EN]: 'Removes poison and restores 10 HP.', [RU]: 'Снимает яд и лечит на 10 HP.' }, type: 'consumable', slotCategory: 'potion', rarity: 'uncommon', value: 38, weight: 0.4, stats: { heal: 10 } },
  bomb_fire: { id: 'bomb_fire', name: { [EN]: 'Fire Bomb', [RU]: 'Огненная бомба' }, description: { [EN]: 'Throw for 12-20 fire damage.', [RU]: 'Бросьте для 12-20 огненного урона.' }, type: 'consumable', slotCategory: 'potion', rarity: 'rare', value: 45, weight: 0.5, stats: { throwDamage: [12, 20], damageType: 'fire' } },
  bomb_toxic: { id: 'bomb_toxic', name: { [EN]: 'Toxic Bomb', [RU]: 'Токсичная бомба' }, description: { [EN]: 'Throw for poison damage and poison.', [RU]: 'Бросьте для ядовитого урона и отравления.' }, type: 'consumable', slotCategory: 'potion', rarity: 'rare', value: 72, weight: 0.6, stats: { throwDamage: [9, 14], damageType: 'poison', statusOnHit: { type: 'poisoned', chance: 0.9, duration: 3, potency: 4 } } },
  sword_rusty: { id: 'sword_rusty', name: { [EN]: 'Rusty Iron Sword', [RU]: 'Ржавый железный меч' }, description: { [EN]: 'Better than fists.', [RU]: 'Лучше кулаков.' }, type: 'weapon', slotCategory: 'gear', rarity: 'common', value: 25, weight: 2.8, stats: { damage: [2, 5], damageType: 'physical' } },
  sword_iron: { id: 'sword_iron', name: { [EN]: 'Iron Sword', [RU]: 'Железный меч' }, description: { [EN]: 'Reliable infantry sword.', [RU]: 'Надежный пехотный меч.' }, type: 'weapon', slotCategory: 'gear', rarity: 'uncommon', value: 80, weight: 4.4, stats: { damage: [5, 10], damageType: 'physical', critChanceBonus: 0.03 } },
  spear_ward: { id: 'spear_ward', name: { [EN]: 'Warden Spear', [RU]: 'Копье хранителя' }, description: { [EN]: 'Counterattack-focused spear.', [RU]: 'Копье для контратак.' }, type: 'weapon', slotCategory: 'gear', rarity: 'rare', value: 210, weight: 3.6, stats: { damage: [7, 11], damageType: 'physical', counterChanceBonus: 0.08 }, setId: 'warden', affixes: ['Defender'] },
  blade_eclipse: { id: 'blade_eclipse', name: { [EN]: 'Blade of Eclipse', [RU]: 'Клинок Затмения' }, description: { [EN]: 'Unique legendary arcane blade.', [RU]: 'Уникальный легендарный тайный клинок.' }, type: 'weapon', slotCategory: 'gear', rarity: 'legendary', uniqueLegendary: true, value: 950, weight: 3.2, stats: { damage: [13, 22], damageType: 'arcane', critChanceBonus: 0.12, statusOnHit: { type: 'bleeding', chance: 0.35, duration: 2, potency: 7 } }, affixes: ['Mythic'], setId: 'eclipse' },
  armor_leather: { id: 'armor_leather', name: { [EN]: 'Torn Leather Tunic', [RU]: 'Рваная кожаная туника' }, description: { [EN]: 'Minimal protection.', [RU]: 'Минимальная защита.' }, type: 'armor', slotCategory: 'gear', rarity: 'common', value: 40, weight: 6.2, stats: { defense: 2 } },
  armor_iron: { id: 'armor_iron', name: { [EN]: 'Iron Chainmail', [RU]: 'Железная кольчуга' }, description: { [EN]: 'Sturdy and reliable.', [RU]: 'Прочная и надежная.' }, type: 'armor', slotCategory: 'gear', rarity: 'uncommon', value: 120, weight: 10.1, stats: { defense: 5 } },
  wardplate_legendary: { id: 'wardplate_legendary', name: { [EN]: 'Warden Wardplate', [RU]: 'Панцирь Хранителя' }, description: { [EN]: 'Unique legendary armor.', [RU]: 'Уникальная легендарная броня.' }, type: 'armor', slotCategory: 'gear', rarity: 'legendary', uniqueLegendary: true, value: 890, weight: 11.8, stats: { defense: 13, counterChanceBonus: 0.1 }, setId: 'warden', affixes: ['Runic'] },
  wolf_pelt: { id: 'wolf_pelt', name: { [EN]: 'Wolf Pelt', [RU]: 'Волчья шкура' }, description: { [EN]: 'Crafting leather.', [RU]: 'Крафтовая кожа.' }, type: 'material', slotCategory: 'material', rarity: 'common', value: 8, weight: 0.7 },
  bandit_bandana: { id: 'bandit_bandana', name: { [EN]: 'Bandit Bandana', [RU]: 'Бандана бандита' }, description: { [EN]: 'Dirty cloth.', [RU]: 'Грязная тряпка.' }, type: 'material', slotCategory: 'material', rarity: 'common', value: 5, weight: 0.3 },
  goblin_ear: { id: 'goblin_ear', name: { [EN]: 'Goblin Ear', [RU]: 'Ухо гоблина' }, description: { [EN]: 'Alchemical catalyst.', [RU]: 'Алхимический катализатор.' }, type: 'material', slotCategory: 'material', rarity: 'common', value: 12, weight: 0.2 },
  swamp_weed: { id: 'swamp_weed', name: { [EN]: 'Swamp Weed', [RU]: 'Болотная трава' }, description: { [EN]: 'Potion reagent.', [RU]: 'Реагент для зелий.' }, type: 'material', slotCategory: 'material', rarity: 'common', value: 15, weight: 0.5 },
  iron_ore: { id: 'iron_ore', name: { [EN]: 'Iron Ore', [RU]: 'Железная руда' }, description: { [EN]: 'Forge material.', [RU]: 'Материал кузницы.' }, type: 'material', slotCategory: 'material', rarity: 'common', value: 18, weight: 1.0 },
  hard_wood: { id: 'hard_wood', name: { [EN]: 'Hardened Wood', [RU]: 'Закаленная древесина' }, description: { [EN]: 'Weapon shafts.', [RU]: 'Древки оружия.' }, type: 'material', slotCategory: 'material', rarity: 'common', value: 14, weight: 0.8 },
  crystal_shard: { id: 'crystal_shard', name: { [EN]: 'Crystal Shard', [RU]: 'Осколок кристалла' }, description: { [EN]: 'Arcane crafting fragment.', [RU]: 'Осколок для тайного ремесла.' }, type: 'material', slotCategory: 'material', rarity: 'uncommon', value: 26, weight: 0.4 },
  ember_resin: { id: 'ember_resin', name: { [EN]: 'Ember Resin', [RU]: 'Смола углей' }, description: { [EN]: 'Burning sap used in forges.', [RU]: 'Тлеющая смола для кузницы.' }, type: 'material', slotCategory: 'material', rarity: 'uncommon', value: 24, weight: 0.5 },
  scalehide: { id: 'scalehide', name: { [EN]: 'Scalehide', [RU]: 'Чешуйчатая кожа' }, description: { [EN]: 'Durable hide from swamp beasts.', [RU]: 'Прочная кожа болотных тварей.' }, type: 'material', slotCategory: 'material', rarity: 'uncommon', value: 21, weight: 0.7 },
  potion_frost: { id: 'potion_frost', name: { [EN]: 'Frost Phial', [RU]: 'Ледяная фиала' }, description: { [EN]: 'Throw for frost damage and slow shock.', [RU]: 'Бросьте для ледяного урона и шока.' }, type: 'consumable', slotCategory: 'potion', rarity: 'rare', value: 68, weight: 0.5, stats: { throwDamage: [10, 16], damageType: 'frost', statusOnHit: { type: 'stunned', chance: 0.25, duration: 1, potency: 1 } } },
  axe_blackiron: { id: 'axe_blackiron', name: { [EN]: 'Blackiron Axe', [RU]: 'Секира черного железа' }, description: { [EN]: 'Heavy axe that rewards precision.', [RU]: 'Тяжелая секира для точных ударов.' }, type: 'weapon', slotCategory: 'gear', rarity: 'rare', value: 260, weight: 5.5, stats: { damage: [8, 13], damageType: 'physical', critChanceBonus: 0.05 } },
  armor_scalehide: { id: 'armor_scalehide', name: { [EN]: 'Scalehide Armor', [RU]: 'Чешуйчатый доспех' }, description: { [EN]: 'Flexible armor from marsh predators.', [RU]: 'Гибкий доспех из болотных хищников.' }, type: 'armor', slotCategory: 'gear', rarity: 'rare', value: 245, weight: 8.7, stats: { defense: 7, counterChanceBonus: 0.04 } },
  scroll_potion: { id: 'scroll_potion', name: { [EN]: 'Recipe: Minor Potion', [RU]: 'Рецепт: Малое зелье' }, description: { [EN]: 'Teaches potion crafting.', [RU]: 'Обучает крафту зелья.' }, type: 'recipe', rarity: 'uncommon', value: 50, weight: 0.1, teachesRecipeId: 'recipe_potion_small' },
  scroll_armor: { id: 'scroll_armor', name: { [EN]: 'Recipe: Leather Tunic', [RU]: 'Рецепт: Кожаная туника' }, description: { [EN]: 'Teaches leather armor crafting.', [RU]: 'Обучает крафту кожаной брони.' }, type: 'recipe', rarity: 'uncommon', value: 50, weight: 0.1, teachesRecipeId: 'recipe_leather_armor' },
  scroll_antidote: { id: 'scroll_antidote', name: { [EN]: 'Recipe: Antidote', [RU]: 'Рецепт: Антидот' }, description: { [EN]: 'Teaches antidote crafting.', [RU]: 'Обучает крафту антидота.' }, type: 'recipe', rarity: 'uncommon', value: 80, weight: 0.1, teachesRecipeId: 'recipe_antidote' },
  scroll_spear: { id: 'scroll_spear', name: { [EN]: 'Recipe: Warden Spear', [RU]: 'Рецепт: Копье хранителя' }, description: { [EN]: 'Teaches spear crafting.', [RU]: 'Обучает крафту копья.' }, type: 'recipe', rarity: 'rare', value: 105, weight: 0.1, teachesRecipeId: 'recipe_spear_ward' },
  silver_ore: { id: 'silver_ore', name: { [EN]: 'Silver Ore', [RU]: 'Серебряная руда' }, description: { [EN]: 'Refined ore from high ridges.', [RU]: 'Очищенная руда из высокогорья.' }, type: 'material', slotCategory: 'material', rarity: 'uncommon', value: 28, weight: 1.1 },
  obsidian_shard: { id: 'obsidian_shard', name: { [EN]: 'Obsidian Shard', [RU]: 'Осколок обсидиана' }, description: { [EN]: 'Volcanic glass used in elite forging.', [RU]: 'Вулканическое стекло для элитной ковки.' }, type: 'material', slotCategory: 'material', rarity: 'rare', value: 44, weight: 0.5 },
  moon_herb: { id: 'moon_herb', name: { [EN]: 'Moon Herb', [RU]: 'Лунная трава' }, description: { [EN]: 'Cold-growing herb for advanced tonics.', [RU]: 'Холодостойкая трава для редких настоек.' }, type: 'material', slotCategory: 'material', rarity: 'uncommon', value: 25, weight: 0.3 },
  titan_plate: { id: 'titan_plate', name: { [EN]: 'Titan Plate', [RU]: 'Титановая пластина' }, description: { [EN]: 'Dense plate from war machines.', [RU]: 'Плотная пластина из боевых конструкций.' }, type: 'material', slotCategory: 'material', rarity: 'rare', value: 58, weight: 1.4 },
  silk_fiber: { id: 'silk_fiber', name: { [EN]: 'Silk Fiber', [RU]: 'Шелковое волокно' }, description: { [EN]: 'Flexible thread for reinforced gear.', [RU]: 'Гибкая нить для усиленного снаряжения.' }, type: 'material', slotCategory: 'material', rarity: 'uncommon', value: 22, weight: 0.2 },
  weapon_silver_sabre: { id: 'weapon_silver_sabre', name: { [EN]: 'Silver Sabre', [RU]: 'Серебряная сабля' }, description: { [EN]: 'Balanced blade favored by ward captains.', [RU]: 'Сбалансированный клинок капитанов стражи.' }, type: 'weapon', slotCategory: 'gear', rarity: 'rare', value: 320, weight: 3.4, stats: { damage: [9, 14], damageType: 'physical', critChanceBonus: 0.06 } },
  weapon_obsidian_maul: { id: 'weapon_obsidian_maul', name: { [EN]: 'Obsidian Maul', [RU]: 'Обсидиановая кувалда' }, description: { [EN]: 'Brutal hammer that breaks guard stances.', [RU]: 'Тяжёлая кувалда, ломающая стойки блока.' }, type: 'weapon', slotCategory: 'gear', rarity: 'epic', value: 520, weight: 7.2, stats: { damage: [12, 18], damageType: 'physical', counterChanceBonus: 0.05 } },
  armor_titan_mail: { id: 'armor_titan_mail', name: { [EN]: 'Titan Mail', [RU]: 'Титановая кольчуга' }, description: { [EN]: 'Battle mail built for frontline attrition.', [RU]: 'Боевая кольчуга для затяжного фронта.' }, type: 'armor', slotCategory: 'gear', rarity: 'epic', value: 510, weight: 12.4, stats: { defense: 10, counterChanceBonus: 0.06 } },
  armor_silk_vest: { id: 'armor_silk_vest', name: { [EN]: 'Silkguard Vest', [RU]: 'Жилет шелкостража' }, description: { [EN]: 'Light armor woven with alchemical thread.', [RU]: 'Лёгкая броня из алхимической нити.' }, type: 'armor', slotCategory: 'gear', rarity: 'rare', value: 295, weight: 4.1, stats: { defense: 6, critChanceBonus: 0.04 } },
  potion_moon_focus: { id: 'potion_moon_focus', name: { [EN]: 'Moon Focus Tonic', [RU]: 'Настой лунного фокуса' }, description: { [EN]: 'Restores 30 energy and sharpens reflexes.', [RU]: 'Восстанавливает 30 энергии и повышает реакцию.' }, type: 'consumable', slotCategory: 'potion', rarity: 'rare', value: 84, weight: 0.4, stats: { energyRestore: 30 } },
  potion_bastion_oil: { id: 'potion_bastion_oil', name: { [EN]: 'Bastion Oil', [RU]: 'Масло бастиона' }, description: { [EN]: 'Dense mixture that stabilizes breathing in battle.', [RU]: 'Плотная смесь для стабилизации дыхания в бою.' }, type: 'consumable', slotCategory: 'potion', rarity: 'rare', value: 88, weight: 0.5, stats: { heal: 24 } },
};

export const ENEMIES: Record<string, Enemy> = {
  wolf: { id: 'wolf', name: { [EN]: 'Rabid Wolf', [RU]: 'Бешеный волк' }, role: 'berserker', level: 1, hp: 25, maxHp: 25, maxEnergy: 30, damage: [3, 6], damageType: 'physical', xpReward: 15, goldReward: [0, 0], dropTable: [{ itemId: 'wolf_pelt', chance: 0.6, min: 1, max: 1 }] },
  bandit: { id: 'bandit', name: { [EN]: 'Highway Bandit', [RU]: 'Разбойник с большой дороги' }, role: 'berserker', level: 2, hp: 35, maxHp: 35, maxEnergy: 45, damage: [4, 8], damageType: 'physical', xpReward: 25, goldReward: [5, 15], dropTable: [{ itemId: 'potion_small', chance: 0.2, min: 1, max: 1 }, { itemId: 'potion_energy', chance: 0.15, min: 1, max: 1 }, { itemId: 'bandit_bandana', chance: 0.8, min: 1, max: 1 }] },
  goblin: { id: 'goblin', name: { [EN]: 'Scavenger Goblin', [RU]: 'Гоблин-мусорщик' }, role: 'alchemist', level: 2, hp: 30, maxHp: 30, maxEnergy: 40, damage: [5, 7], damageType: 'physical', statusInflict: { type: 'poisoned', chance: 0.2, duration: 2, potency: 2 }, xpReward: 20, goldReward: [2, 10], dropTable: [{ itemId: 'goblin_ear', chance: 0.5, min: 1, max: 1 }, { itemId: 'bomb_fire', chance: 0.1, min: 1, max: 1 }, { itemId: 'sword_rusty', chance: 0.1, min: 1, max: 1 }, { itemId: 'scroll_antidote', chance: 0.08, min: 1, max: 1 }] },
  troll: { id: 'troll', name: { [EN]: 'Cave Troll', [RU]: 'Пещерный тролль' }, role: 'tank', level: 4, hp: 80, maxHp: 80, maxEnergy: 55, damage: [8, 14], damageType: 'physical', resistances: { physical: 0.1 }, xpReward: 60, goldReward: [15, 40], dropTable: [{ itemId: 'potion_large', chance: 0.3, min: 1, max: 1 }, { itemId: 'armor_iron', chance: 0.05, min: 1, max: 1 }, { itemId: 'hard_wood', chance: 0.5, min: 1, max: 2 }] },
  swamp_thing: { id: 'swamp_thing', name: { [EN]: 'Bog Horror', [RU]: 'Болотный ужас' }, role: 'tank', level: 3, hp: 50, maxHp: 50, maxEnergy: 50, damage: [6, 10], damageType: 'poison', statusInflict: { type: 'poisoned', chance: 0.3, duration: 2, potency: 3 }, xpReward: 40, goldReward: [5, 20], dropTable: [{ itemId: 'swamp_weed', chance: 0.7, min: 1, max: 2 }, { itemId: 'scroll_potion', chance: 0.1, min: 1, max: 1 }, { itemId: 'potion_energy', chance: 0.2, min: 1, max: 1 }] },
  plague_alchemist: { id: 'plague_alchemist', name: { [EN]: 'Plague Alchemist', [RU]: 'Чумной алхимик' }, role: 'alchemist', level: 6, hp: 65, maxHp: 65, maxEnergy: 85, damage: [8, 13], damageType: 'poison', adaptiveProfile: { punishConsumables: true }, statusInflict: { type: 'poisoned', chance: 0.5, duration: 3, potency: 4 }, xpReward: 110, goldReward: [35, 60], dropTable: [{ itemId: 'bomb_toxic', chance: 0.2, min: 1, max: 1 }, { itemId: 'potion_antidote', chance: 0.5, min: 1, max: 1 }] },
  sentinel_golem: { id: 'sentinel_golem', name: { [EN]: 'Sentinel Golem', [RU]: 'Голем-страж' }, role: 'boss', level: 8, hp: 180, maxHp: 180, maxEnergy: 110, damage: [12, 20], damageType: 'physical', resistances: { physical: 0.25, poison: 0.4, arcane: -0.1 }, adaptiveProfile: { punishAggression: true, punishBlocking: true }, phases: [{ thresholdHpPercent: 66, name: { [EN]: 'Stone Resolve', [RU]: 'Каменная решимость' }, damageMod: 1.15, defenseMod: 1.15 }, { thresholdHpPercent: 33, name: { [EN]: 'Runic Overdrive', [RU]: 'Рунический разгон' }, damageMod: 1.3, defenseMod: 1.05, statusImmunity: ['stunned'] }], xpReward: 240, goldReward: [95, 140], dropTable: [{ itemId: 'wardplate_legendary', chance: 0.25, min: 1, max: 1 }, { itemId: 'blade_eclipse', chance: 0.15, min: 1, max: 1 }] },
  frost_wolf: { id: 'frost_wolf', name: { [EN]: 'Frost Wolf', [RU]: 'Ледяной волк' }, role: 'berserker', level: 4, hp: 46, maxHp: 46, maxEnergy: 45, damage: [6, 10], damageType: 'frost', statusInflict: { type: 'stunned', chance: 0.12, duration: 1, potency: 1 }, xpReward: 48, goldReward: [8, 20], dropTable: [{ itemId: 'scalehide', chance: 0.65, min: 1, max: 1 }, { itemId: 'wolf_pelt', chance: 0.4, min: 1, max: 1 }] },
  ash_bandit: { id: 'ash_bandit', name: { [EN]: 'Ashroad Raider', [RU]: 'Пепельный налетчик' }, role: 'berserker', level: 5, hp: 58, maxHp: 58, maxEnergy: 52, damage: [7, 12], damageType: 'fire', xpReward: 62, goldReward: [12, 28], dropTable: [{ itemId: 'ember_resin', chance: 0.6, min: 1, max: 2 }, { itemId: 'bandit_bandana', chance: 0.7, min: 1, max: 1 }] },
  crystal_wisp: { id: 'crystal_wisp', name: { [EN]: 'Crystal Wisp', [RU]: 'Кристальный огонек' }, role: 'alchemist', level: 4, hp: 40, maxHp: 40, maxEnergy: 70, damage: [6, 11], damageType: 'arcane', resistances: { arcane: 0.2, physical: -0.1 }, xpReward: 54, goldReward: [6, 22], dropTable: [{ itemId: 'crystal_shard', chance: 0.8, min: 1, max: 2 }, { itemId: 'potion_energy', chance: 0.2, min: 1, max: 1 }] },
  iron_legionnaire: { id: 'iron_legionnaire', name: { [EN]: 'Iron Legionnaire', [RU]: 'Железный легионер' }, role: 'tank', level: 7, hp: 108, maxHp: 108, maxEnergy: 72, damage: [10, 15], damageType: 'physical', resistances: { physical: 0.18 }, xpReward: 112, goldReward: [30, 60], dropTable: [{ itemId: 'silver_ore', chance: 0.7, min: 1, max: 2 }, { itemId: 'titan_plate', chance: 0.3, min: 1, max: 1 }] },
  concord_assassin: { id: 'concord_assassin', name: { [EN]: 'Concord Assassin', [RU]: 'Ассасин Конкорда' }, role: 'berserker', level: 7, hp: 82, maxHp: 82, maxEnergy: 95, damage: [11, 17], damageType: 'physical', adaptiveProfile: { punishBlocking: true }, xpReward: 118, goldReward: [40, 72], dropTable: [{ itemId: 'obsidian_shard', chance: 0.55, min: 1, max: 2 }, { itemId: 'silk_fiber', chance: 0.6, min: 1, max: 2 }] },
  mire_shaman: { id: 'mire_shaman', name: { [EN]: 'Mire Shaman', [RU]: 'Болотный шаман' }, role: 'alchemist', level: 7, hp: 88, maxHp: 88, maxEnergy: 110, damage: [9, 15], damageType: 'poison', statusInflict: { type: 'poisoned', chance: 0.55, duration: 3, potency: 5 }, xpReward: 124, goldReward: [28, 68], dropTable: [{ itemId: 'moon_herb', chance: 0.65, min: 1, max: 2 }, { itemId: 'swamp_weed', chance: 0.55, min: 1, max: 2 }] },
  war_hulk: { id: 'war_hulk', name: { [EN]: 'War Hulk', [RU]: 'Осадный громила' }, role: 'boss', level: 10, hp: 245, maxHp: 245, maxEnergy: 140, damage: [15, 24], damageType: 'physical', resistances: { physical: 0.22, poison: 0.2, arcane: -0.08 }, phases: [{ thresholdHpPercent: 60, name: { [EN]: 'Siege Momentum', [RU]: 'Осадный натиск' }, damageMod: 1.2, defenseMod: 1.08 }, { thresholdHpPercent: 30, name: { [EN]: 'Overrun', [RU]: 'Прорыв' }, damageMod: 1.35, defenseMod: 1.02 }], xpReward: 360, goldReward: [150, 220], dropTable: [{ itemId: 'weapon_obsidian_maul', chance: 0.16, min: 1, max: 1 }, { itemId: 'armor_titan_mail', chance: 0.16, min: 1, max: 1 }, { itemId: 'titan_plate', chance: 0.9, min: 2, max: 4 }] },
  ruin_knight: { id: 'ruin_knight', name: { [EN]: 'Ruin Knight', [RU]: 'Руинный рыцарь' }, role: 'tank', level: 6, hp: 96, maxHp: 96, maxEnergy: 60, damage: [9, 14], damageType: 'physical', resistances: { physical: 0.15 }, xpReward: 90, goldReward: [22, 40], dropTable: [{ itemId: 'iron_ore', chance: 0.7, min: 1, max: 2 }, { itemId: 'armor_iron', chance: 0.08, min: 1, max: 1 }] },
  mire_siren: { id: 'mire_siren', name: { [EN]: 'Mire Siren', [RU]: 'Болотная сирена' }, role: 'alchemist', level: 6, hp: 72, maxHp: 72, maxEnergy: 88, damage: [8, 13], damageType: 'poison', statusInflict: { type: 'poisoned', chance: 0.45, duration: 2, potency: 4 }, xpReward: 96, goldReward: [18, 44], dropTable: [{ itemId: 'swamp_weed', chance: 0.65, min: 1, max: 2 }, { itemId: 'crystal_shard', chance: 0.35, min: 1, max: 1 }, { itemId: 'scalehide', chance: 0.45, min: 1, max: 1 }] },
  stone_revenant: { id: 'stone_revenant', name: { [EN]: 'Stone Revenant', [RU]: 'Каменный ревенант' }, role: 'boss', level: 9, hp: 210, maxHp: 210, maxEnergy: 120, damage: [14, 22], damageType: 'physical', resistances: { physical: 0.2, frost: 0.1, arcane: -0.05 }, phases: [{ thresholdHpPercent: 50, name: { [EN]: 'Grave Echo', [RU]: 'Эхо могилы' }, damageMod: 1.2, defenseMod: 1.1 }], xpReward: 300, goldReward: [120, 170], dropTable: [{ itemId: 'axe_blackiron', chance: 0.18, min: 1, max: 1 }, { itemId: 'armor_scalehide', chance: 0.18, min: 1, max: 1 }, { itemId: 'crystal_shard', chance: 0.9, min: 2, max: 4 }] },
};

export const LOCATIONS: Record<string, Location> = {
  town_oakhaven: { id: 'town_oakhaven', name: { [EN]: 'Oakhaven', [RU]: 'Окхейвен' }, description: { [EN]: 'A bustling trading hub.', [RU]: 'Оживленный торговый центр.' }, type: 'hub', image: '/images/town-hub.png', connectedLocations: ['road_south', 'forest_whispering', 'road_ironway', 'road_concord'], npcs: ['npc_elder_bran', 'npc_guard_tom', 'npc_alchemist_mira', 'npc_scout_lyra', 'npc_blacksmith_durn', 'npc_chronicler_vesna'], craftingStations: ['campfire', 'alchemy_table'], merchantPriceMod: 1, allowedWeather: ['clear', 'rain'] },
  road_south: { id: 'road_south', name: { [EN]: 'South Road', [RU]: 'Южная дорога' }, description: { [EN]: 'Main route, lately unsafe.', [RU]: 'Главный путь, в последнее время небезопасен.' }, type: 'road', image: '/images/old-road.png', connectedLocations: ['town_oakhaven', 'ruins_ancient', 'mountain_pass', 'road_marshlane'], possibleEnemies: ['bandit', 'ash_bandit', 'ruin_knight'], possibleLoot: ['gold', 'hard_wood', 'ember_resin'], merchantPriceMod: 1.05 },
  forest_whispering: { id: 'forest_whispering', name: { [EN]: 'Whispering Forest', [RU]: 'Шепчущий лес' }, description: { [EN]: 'Dark trees and old hunting paths.', [RU]: 'Темные деревья и старые тропы.' }, type: 'explore', image: '/images/dark-forest.png', connectedLocations: ['town_oakhaven', 'swamp_murky', 'road_marshlane'], possibleEnemies: ['wolf', 'goblin', 'frost_wolf', 'crystal_wisp', 'mire_shaman'], possibleLoot: ['potion_small', 'swamp_weed', 'crystal_shard', 'moon_herb'], merchantPriceMod: 1.1, allowedWeather: ['clear', 'rain', 'fog'] },
  ruins_ancient: { id: 'ruins_ancient', name: { [EN]: 'Ancient Ruins', [RU]: 'Древние руины' }, description: { [EN]: 'Crumbling towers of forgotten age.', [RU]: 'Разрушающиеся башни забытой эпохи.' }, type: 'explore', image: '/images/ruined-castle.png', connectedLocations: ['road_south', 'forgotten_forge'], possibleEnemies: ['goblin', 'bandit', 'plague_alchemist', 'ruin_knight', 'ash_bandit', 'crystal_wisp'], possibleLoot: ['gold', 'scroll_armor', 'scroll_spear', 'crystal_shard', 'ember_resin'], craftingStations: ['runic_workbench'], merchantPriceMod: 1.12, allowedWeather: ['clear', 'rain', 'storm'] },
  mountain_pass: { id: 'mountain_pass', name: { [EN]: 'Troll Pass', [RU]: 'Перевал троллей' }, description: { [EN]: 'Treacherous mountain path.', [RU]: 'Коварная горная тропа.' }, type: 'road', image: '/images/mountain-pass.png', connectedLocations: ['road_south', 'cave_deep', 'road_ironway'], possibleEnemies: ['troll', 'bandit', 'ruin_knight', 'frost_wolf', 'iron_legionnaire'], possibleLoot: ['iron_ore', 'scalehide', 'silver_ore'], merchantPriceMod: 1.2, allowedWeather: ['clear', 'snow', 'storm'] },
  cave_deep: { id: 'cave_deep', name: { [EN]: 'Echoing Cave', [RU]: 'Эхо-пещера' }, description: { [EN]: 'Damp caves with crystals.', [RU]: 'Сырые пещеры с кристаллами.' }, type: 'explore', image: '/images/cave.png', connectedLocations: ['mountain_pass', 'sunken_sanctum'], possibleEnemies: ['troll', 'goblin', 'crystal_wisp', 'stone_revenant'], possibleLoot: ['gold', 'potion_large', 'sword_iron', 'crystal_shard'], craftingStations: ['forge'], merchantPriceMod: 1.18, allowedWeather: ['clear'] },
  swamp_murky: { id: 'swamp_murky', name: { [EN]: 'Murky Swamp', [RU]: 'Мрачное болото' }, description: { [EN]: 'Green fog and dead trees.', [RU]: 'Зеленый туман и мертвые деревья.' }, type: 'explore', image: '/images/swamp.png', connectedLocations: ['forest_whispering', 'road_marshlane'], possibleEnemies: ['swamp_thing', 'plague_alchemist', 'mire_siren', 'mire_shaman'], possibleLoot: ['swamp_weed', 'scroll_potion', 'scalehide', 'moon_herb'], merchantPriceMod: 1.14, allowedWeather: ['fog', 'rain'] },
  forgotten_forge: { id: 'forgotten_forge', name: { [EN]: 'Forgotten Forge', [RU]: 'Забытая кузня' }, description: { [EN]: 'Ancient forge still warm.', [RU]: 'Древняя кузня, еще теплая.' }, type: 'explore', image: '/images/ruined-castle.png', connectedLocations: ['ruins_ancient'], possibleEnemies: ['sentinel_golem', 'stone_revenant'], possibleLoot: ['wardplate_legendary', 'axe_blackiron', 'armor_scalehide'], craftingStations: ['forge'], merchantPriceMod: 1.25, allowedWeather: ['clear', 'storm'] },
  sunken_sanctum: { id: 'sunken_sanctum', name: { [EN]: 'Sunken Sanctum', [RU]: 'Затонувшее святилище' }, description: { [EN]: 'Flooded shrine of arcane glyphs.', [RU]: 'Затопленное святилище тайных рун.' }, type: 'explore', image: '/images/cave.png', connectedLocations: ['cave_deep'], possibleEnemies: ['sentinel_golem', 'mire_siren', 'stone_revenant', 'war_hulk'], possibleLoot: ['blade_eclipse', 'crystal_shard', 'potion_frost', 'obsidian_shard'], craftingStations: ['runic_workbench'], merchantPriceMod: 1.3, allowedWeather: ['clear'] },
  road_ironway: { id: 'road_ironway', name: { [EN]: 'Ironway', [RU]: 'Железный тракт' }, description: { [EN]: 'Military road to the citadel foundries.', [RU]: 'Военный тракт к цитадели и литейным дворам.' }, type: 'road', image: '/images/old-road.png', connectedLocations: ['town_oakhaven', 'mountain_pass', 'hub_ironhold'], possibleEnemies: ['iron_legionnaire', 'ash_bandit', 'ruin_knight'], possibleLoot: ['silver_ore', 'iron_ore', 'titan_plate'], merchantPriceMod: 1.16, allowedWeather: ['clear', 'rain', 'storm'] },
  road_concord: { id: 'road_concord', name: { [EN]: 'Concord Causeway', [RU]: 'Тракт Конкорда' }, description: { [EN]: 'Well-guarded alliance route with hidden toll posts.', [RU]: 'Охраняемая дорога содружества с тайными заставами.' }, type: 'road', image: '/images/old-road.png', connectedLocations: ['town_oakhaven', 'hub_sky_consort'], possibleEnemies: ['concord_assassin', 'bandit', 'crystal_wisp'], possibleLoot: ['obsidian_shard', 'silk_fiber', 'gold'], merchantPriceMod: 1.12, allowedWeather: ['clear', 'rain', 'fog'] },
  road_marshlane: { id: 'road_marshlane', name: { [EN]: 'Marshlane', [RU]: 'Топкий путь' }, description: { [EN]: 'Mudbound track leading to the bog communities.', [RU]: 'Топкая тропа к болотным общинам.' }, type: 'road', image: '/images/old-road.png', connectedLocations: ['road_south', 'forest_whispering', 'swamp_murky', 'hub_mire_union'], possibleEnemies: ['mire_shaman', 'swamp_thing', 'plague_alchemist'], possibleLoot: ['moon_herb', 'swamp_weed', 'silk_fiber'], merchantPriceMod: 1.15, allowedWeather: ['fog', 'rain'] },
  hub_ironhold: { id: 'hub_ironhold', name: { [EN]: 'Ironhold Citadel', [RU]: 'Цитадель Айронхолд' }, description: { [EN]: 'Faction stronghold of military foundries and siege forges.', [RU]: 'Фракционная крепость литейных дворов и осадных кузниц.' }, type: 'hub', image: '/images/town-hub.png', connectedLocations: ['road_ironway'], npcs: ['npc_marshal_thorne', 'npc_quartermaster_ilda', 'npc_smith_varr'], craftingStations: ['forge', 'campfire'], merchantPriceMod: 1.09, allowedWeather: ['clear', 'snow', 'storm'] },
  hub_sky_consort: { id: 'hub_sky_consort', name: { [EN]: 'Sky Concord', [RU]: 'Небесный Конкорд' }, description: { [EN]: 'Alliance trade summit where contracts are written in steel and silk.', [RU]: 'Торговый узел содружества, где контракты пишут сталью и шелком.' }, type: 'hub', image: '/images/town-hub.png', connectedLocations: ['road_concord'], npcs: ['npc_envoy_sera', 'npc_apothecary_nox', 'npc_factor_brom'], craftingStations: ['alchemy_table', 'runic_workbench'], merchantPriceMod: 1.04, allowedWeather: ['clear', 'rain', 'fog'] },
  hub_mire_union: { id: 'hub_mire_union', name: { [EN]: 'Mire Union', [RU]: 'Болотный Союз' }, description: { [EN]: 'Community hub of gatherers, herbalists, and swamp ferrymen.', [RU]: 'Сообщество сборщиков, травников и болотных перевозчиков.' }, type: 'hub', image: '/images/town-hub.png', connectedLocations: ['road_marshlane'], npcs: ['npc_warden_rook', 'npc_herbalist_vesk', 'npc_tinker_juno'], craftingStations: ['campfire', 'alchemy_table'], merchantPriceMod: 1.11, allowedWeather: ['fog', 'rain', 'clear'] },
};

const QUESTS_FROM_NPCS: Quest[] = [
  { id: 'quest_wolves', giverNpcId: 'npc_guard_tom', turnInNpcId: 'npc_guard_tom', name: { [EN]: 'Culling the Pack', [RU]: 'Сокращение стаи' }, description: { [EN]: 'Clear out wolves threatening the town.', [RU]: 'Уберите волков, угрожающих городу.' }, locationId: 'forest_whispering', goals: [{ type: 'kill', targetId: 'wolf', targetCount: 3, currentCount: 0 }], rewards: { xp: 50, gold: 50, items: [{ itemId: 'potion_small', quantity: 2 }], reputation: [{ merchantId: 'merchant_oakhaven', amount: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_bandits', giverNpcId: 'npc_guard_tom', turnInNpcId: 'npc_guard_tom', name: { [EN]: 'Highway Robbery', [RU]: 'Разбой на дороге' }, description: { [EN]: 'Drive bandits from South Road.', [RU]: 'Прогоните бандитов с Южной дороги.' }, locationId: 'road_south', goals: [{ type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 0 }], rewards: { xp: 80, gold: 100, reputation: [{ merchantId: 'merchant_oakhaven', amount: 2 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_swamp_samples', giverNpcId: 'npc_alchemist_mira', turnInNpcId: 'npc_alchemist_mira', name: { [EN]: 'Toxic Samples', [RU]: 'Токсичные образцы' }, description: { [EN]: 'Collect swamp herbs for Mira.', [RU]: 'Соберите болотные травы для Миры.' }, locationId: 'swamp_murky', goals: [{ type: 'collect', targetId: 'swamp_weed', targetCount: 4, currentCount: 0 }], rewards: { xp: 95, gold: 60, items: [{ itemId: 'scroll_antidote', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_ruins_scout', giverNpcId: 'npc_elder_bran', turnInNpcId: 'npc_elder_bran', name: { [EN]: 'Echoes of Ruins', [RU]: 'Эхо руин' }, description: { [EN]: 'Scout the Ancient Ruins and return alive.', [RU]: 'Разведайте древние руины и вернитесь живым.' }, locationId: 'ruins_ancient', goals: [{ type: 'explore', targetId: 'ruins_ancient', targetCount: 1, currentCount: 0 }], rewards: { xp: 70, gold: 55, items: [{ itemId: 'scroll_spear', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_crystal_path', giverNpcId: 'npc_chronicler_vesna', turnInNpcId: 'npc_chronicler_vesna', name: { [EN]: 'Crystal Path', [RU]: 'Кристальный путь' }, description: { [EN]: 'Bring 4 crystal shards from ruins and caves.', [RU]: 'Принесите 4 кристальных осколка из руин и пещер.' }, locationId: 'cave_deep', goals: [{ type: 'collect', targetId: 'crystal_shard', targetCount: 4, currentCount: 0 }], rewards: { xp: 145, gold: 110, items: [{ itemId: 'potion_frost', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_ash_road', giverNpcId: 'npc_guard_tom', turnInNpcId: 'npc_guard_tom', name: { [EN]: 'Ashes on the Road', [RU]: 'Пепел на дороге' }, description: { [EN]: 'Eliminate 3 Ashroad Raiders.', [RU]: 'Устраните 3 пепельных налётчиков.' }, locationId: 'road_south', goals: [{ type: 'kill', targetId: 'ash_bandit', targetCount: 3, currentCount: 0 }], rewards: { xp: 170, gold: 135, items: [{ itemId: 'ember_resin', quantity: 2 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_frost_hunt', giverNpcId: 'npc_scout_lyra', turnInNpcId: 'npc_scout_lyra', name: { [EN]: 'Cold Trail', [RU]: 'Холодный след' }, description: { [EN]: 'Hunt 3 Frost Wolves in mountain routes.', [RU]: 'Выследите 3 ледяных волков на горных маршрутах.' }, locationId: 'mountain_pass', goals: [{ type: 'kill', targetId: 'frost_wolf', targetCount: 3, currentCount: 0 }], rewards: { xp: 165, gold: 120, items: [{ itemId: 'scalehide', quantity: 2 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_wisp_spark', giverNpcId: 'npc_alchemist_mira', turnInNpcId: 'npc_alchemist_mira', name: { [EN]: 'Spark Capture', [RU]: 'Поймать искру' }, description: { [EN]: 'Defeat 4 Crystal Wisps for volatile essence.', [RU]: 'Победите 4 кристальных огонька ради летучей эссенции.' }, locationId: 'ruins_ancient', goals: [{ type: 'kill', targetId: 'crystal_wisp', targetCount: 4, currentCount: 0 }], rewards: { xp: 180, gold: 145, items: [{ itemId: 'crystal_shard', quantity: 2 }, { itemId: 'potion_energy', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_scalehide_trade', giverNpcId: 'npc_blacksmith_durn', turnInNpcId: 'npc_blacksmith_durn', name: { [EN]: 'Hide for Steel', [RU]: 'Кожа в обмен на сталь' }, description: { [EN]: 'Deliver 5 scalehide pieces to Durn.', [RU]: 'Доставьте Дурну 5 кусков чешуйчатой кожи.' }, locationId: 'swamp_murky', goals: [{ type: 'collect', targetId: 'scalehide', targetCount: 5, currentCount: 0 }], rewards: { xp: 190, gold: 160, items: [{ itemId: 'armor_scalehide', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_revenant_watch', giverNpcId: 'npc_elder_bran', turnInNpcId: 'npc_elder_bran', name: { [EN]: 'Watcher of Stone', [RU]: 'Страж из камня' }, description: { [EN]: 'Defeat the Stone Revenant beneath the forge paths.', [RU]: 'Победите каменного ревенанта под тропами к кузне.' }, locationId: 'forgotten_forge', goals: [{ type: 'kill', targetId: 'stone_revenant', targetCount: 1, currentCount: 0 }], rewards: { xp: 360, gold: 280, items: [{ itemId: 'axe_blackiron', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_ironhold_silver', giverNpcId: 'npc_quartermaster_ilda', turnInNpcId: 'npc_quartermaster_ilda', name: { [EN]: 'Silver for the Forges', [RU]: 'Серебро для литейных' }, description: { [EN]: 'Bring 6 units of silver ore to Ironhold quartermasters.', [RU]: 'Доставьте 6 единиц серебряной руды в снабжение Айронхолда.' }, locationId: 'road_ironway', goals: [{ type: 'collect', targetId: 'silver_ore', targetCount: 6, currentCount: 0 }], rewards: { xp: 210, gold: 170, items: [{ itemId: 'weapon_silver_sabre', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_ironhold_plate', giverNpcId: 'npc_smith_varr', turnInNpcId: 'npc_smith_varr', name: { [EN]: 'Titan Plate Ledger', [RU]: 'Партия титановых пластин' }, description: { [EN]: 'Recover 4 titan plates from legionary patrol wrecks.', [RU]: 'Верните 4 титановые пластины с разбитых патрульных обозов.' }, locationId: 'road_ironway', goals: [{ type: 'collect', targetId: 'titan_plate', targetCount: 4, currentCount: 0 }], rewards: { xp: 225, gold: 190, items: [{ itemId: 'armor_titan_mail', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_marshal_front', giverNpcId: 'npc_marshal_thorne', turnInNpcId: 'npc_marshal_thorne', name: { [EN]: 'Frontline Directive', [RU]: 'Директива фронта' }, description: { [EN]: 'Defeat 3 Iron Legionnaires threatening the relay towers.', [RU]: 'Устраните 3 железных легионеров, угрожающих сигнальным башням.' }, locationId: 'road_ironway', goals: [{ type: 'kill', targetId: 'iron_legionnaire', targetCount: 3, currentCount: 0 }], rewards: { xp: 235, gold: 205, items: [{ itemId: 'potion_bastion_oil', quantity: 2 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_concord_shadow', giverNpcId: 'npc_envoy_sera', turnInNpcId: 'npc_envoy_sera', name: { [EN]: 'Shadow Tariffs', [RU]: 'Теневые пошлины' }, description: { [EN]: 'Eliminate 3 Concord assassins harassing diplomatic caravans.', [RU]: 'Устраните 3 ассасинов Конкорда, терроризирующих дипломатические караваны.' }, locationId: 'road_concord', goals: [{ type: 'kill', targetId: 'concord_assassin', targetCount: 3, currentCount: 0 }], rewards: { xp: 240, gold: 210, items: [{ itemId: 'obsidian_shard', quantity: 2 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_concord_fibers', giverNpcId: 'npc_factor_brom', turnInNpcId: 'npc_factor_brom', name: { [EN]: 'Silk Transit', [RU]: 'Шелковый транзит' }, description: { [EN]: 'Secure 6 silk fibers for alliance courier harnesses.', [RU]: 'Соберите 6 шелковых волокон для упряжи курьеров содружества.' }, locationId: 'road_concord', goals: [{ type: 'collect', targetId: 'silk_fiber', targetCount: 6, currentCount: 0 }], rewards: { xp: 210, gold: 185, items: [{ itemId: 'armor_silk_vest', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_apothecary_moon', giverNpcId: 'npc_apothecary_nox', turnInNpcId: 'npc_apothecary_nox', name: { [EN]: 'Moon Distillate', [RU]: 'Лунный дистиллят' }, description: { [EN]: 'Gather 5 moon herbs for advanced focus tonics.', [RU]: 'Добудьте 5 лунных трав для настоек концентрации.' }, locationId: 'road_marshlane', goals: [{ type: 'collect', targetId: 'moon_herb', targetCount: 5, currentCount: 0 }], rewards: { xp: 215, gold: 175, items: [{ itemId: 'potion_moon_focus', quantity: 2 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_union_shaman', giverNpcId: 'npc_warden_rook', turnInNpcId: 'npc_warden_rook', name: { [EN]: 'Bogline Patrol', [RU]: 'Патруль топей' }, description: { [EN]: 'Defeat 3 mire shamans along Marshlane.', [RU]: 'Уничтожьте 3 болотных шаманов на Топком пути.' }, locationId: 'road_marshlane', goals: [{ type: 'kill', targetId: 'mire_shaman', targetCount: 3, currentCount: 0 }], rewards: { xp: 220, gold: 180, items: [{ itemId: 'potion_antidote', quantity: 2 }, { itemId: 'moon_herb', quantity: 2 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_union_reeds', giverNpcId: 'npc_herbalist_vesk', turnInNpcId: 'npc_herbalist_vesk', name: { [EN]: 'Reed Apothecary', [RU]: 'Тростниковая аптека' }, description: { [EN]: 'Collect 6 swamp weeds for Mire Union emergency stores.', [RU]: 'Соберите 6 болотных трав для аварийного запаса Болотного Союза.' }, locationId: 'swamp_murky', goals: [{ type: 'collect', targetId: 'swamp_weed', targetCount: 6, currentCount: 0 }], rewards: { xp: 180, gold: 150, items: [{ itemId: 'potion_bastion_oil', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_union_machines', giverNpcId: 'npc_tinker_juno', turnInNpcId: 'npc_tinker_juno', name: { [EN]: 'Salvage the Siege', [RU]: 'Осадный лом' }, description: { [EN]: 'Recover 3 titan plates and 3 obsidian shards for field prototypes.', [RU]: 'Добудьте 3 титановые пластины и 3 обсидиановых осколка для полевых прототипов.' }, locationId: 'sunken_sanctum', goals: [{ type: 'collect', targetId: 'titan_plate', targetCount: 3, currentCount: 0 }, { type: 'collect', targetId: 'obsidian_shard', targetCount: 3, currentCount: 0 }], rewards: { xp: 290, gold: 245, items: [{ itemId: 'weapon_obsidian_maul', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  { id: 'quest_war_hulk_break', giverNpcId: 'npc_marshal_thorne', turnInNpcId: 'npc_marshal_thorne', name: { [EN]: 'Break the War Hulk', [RU]: 'Сломить Осадного громилу' }, description: { [EN]: 'Hunt down and defeat the War Hulk in the drowned sanctum corridors.', [RU]: 'Найдите и уничтожьте Осадного громилу в коридорах затонувшего святилища.' }, locationId: 'sunken_sanctum', goals: [{ type: 'kill', targetId: 'war_hulk', targetCount: 1, currentCount: 0 }], rewards: { xp: 460, gold: 360, items: [{ itemId: 'armor_titan_mail', quantity: 1 }, { itemId: 'weapon_silver_sabre', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
];

export const INITIAL_QUESTS: Quest[] = [];

export const MERCHANTS: Record<string, Merchant> = {
  merchant_oakhaven: {
    id: 'merchant_oakhaven',
    name: { [EN]: 'Bram the Trader', [RU]: 'Торговец Брэм' },
    locationId: 'town_oakhaven',
    inventory: [
      { itemId: 'potion_small', price: 20 }, { itemId: 'potion_large', price: 50 }, { itemId: 'potion_energy', price: 45 }, { itemId: 'potion_antidote', price: 50 },
      { itemId: 'bomb_fire', price: 60 }, { itemId: 'bomb_toxic', price: 88 }, { itemId: 'sword_rusty', price: 40 }, { itemId: 'sword_iron', price: 150 },
      { itemId: 'spear_ward', price: 330 }, { itemId: 'armor_leather', price: 60 }, { itemId: 'armor_iron', price: 200 }, { itemId: 'scroll_potion', price: 65 },
      { itemId: 'scroll_armor', price: 65 }, { itemId: 'scroll_antidote', price: 120 }, { itemId: 'scroll_spear', price: 170 },
      { itemId: 'potion_frost', price: 95 }, { itemId: 'axe_blackiron', price: 420 }, { itemId: 'armor_scalehide', price: 390 },
      { itemId: 'crystal_shard', price: 46 }, { itemId: 'ember_resin', price: 44 }, { itemId: 'scalehide', price: 42 },
    ],
  },
  merchant_elder_bran: {
    id: 'merchant_elder_bran',
    name: { [EN]: 'Council Provisioner', [RU]: 'Советский снабженец' },
    locationId: 'town_oakhaven',
    inventory: [
      { itemId: 'potion_small', price: 22 }, { itemId: 'potion_energy', price: 44 }, { itemId: 'scroll_potion', price: 72 },
      { itemId: 'scroll_armor', price: 72 }, { itemId: 'scroll_antidote', price: 130 }, { itemId: 'gold', price: 2 },
    ],
  },
  merchant_guard_tom: {
    id: 'merchant_guard_tom',
    name: { [EN]: 'Guard Quarter Rack', [RU]: 'Арсенал стражи' },
    locationId: 'town_oakhaven',
    inventory: [
      { itemId: 'sword_rusty', price: 42 }, { itemId: 'sword_iron', price: 160 }, { itemId: 'armor_leather', price: 65 },
      { itemId: 'armor_iron', price: 210 }, { itemId: 'potion_small', price: 22 }, { itemId: 'potion_bastion_oil', price: 96 },
    ],
  },
  merchant_alchemist_mira: {
    id: 'merchant_alchemist_mira',
    name: { [EN]: 'Mira\'s Reagents', [RU]: 'Реагенты Миры' },
    locationId: 'town_oakhaven',
    inventory: [
      { itemId: 'potion_small', price: 20 }, { itemId: 'potion_large', price: 52 }, { itemId: 'potion_energy', price: 46 },
      { itemId: 'potion_antidote', price: 52 }, { itemId: 'potion_frost', price: 98 }, { itemId: 'potion_moon_focus', price: 95 },
      { itemId: 'potion_bastion_oil', price: 99 }, { itemId: 'bomb_fire', price: 65 }, { itemId: 'bomb_toxic', price: 90 },
      { itemId: 'swamp_weed', price: 20 }, { itemId: 'moon_herb', price: 36 },
    ],
  },
  merchant_scout_lyra: {
    id: 'merchant_scout_lyra',
    name: { [EN]: 'Lyra\'s Trail Cache', [RU]: 'Схрон Лиры' },
    locationId: 'town_oakhaven',
    inventory: [
      { itemId: 'wolf_pelt', price: 16 }, { itemId: 'hard_wood', price: 20 }, { itemId: 'scalehide', price: 30 },
      { itemId: 'silk_fiber', price: 34 }, { itemId: 'potion_energy', price: 48 }, { itemId: 'bomb_fire', price: 66 },
    ],
  },
  merchant_blacksmith_durn: {
    id: 'merchant_blacksmith_durn',
    name: { [EN]: 'Durn\'s Forge Stock', [RU]: 'Кузня Дурна' },
    locationId: 'town_oakhaven',
    inventory: [
      { itemId: 'iron_ore', price: 27 }, { itemId: 'silver_ore', price: 42 }, { itemId: 'titan_plate', price: 75 },
      { itemId: 'sword_iron', price: 170 }, { itemId: 'spear_ward', price: 340 }, { itemId: 'axe_blackiron', price: 435 },
      { itemId: 'weapon_silver_sabre', price: 480 }, { itemId: 'armor_iron', price: 220 }, { itemId: 'armor_titan_mail', price: 640 },
      { itemId: 'armor_scalehide', price: 405 },
    ],
  },
  merchant_chronicler_vesna: {
    id: 'merchant_chronicler_vesna',
    name: { [EN]: 'Archive Exchange', [RU]: 'Архивный обмен' },
    locationId: 'town_oakhaven',
    inventory: [
      { itemId: 'scroll_potion', price: 72 }, { itemId: 'scroll_armor', price: 72 }, { itemId: 'scroll_antidote', price: 126 },
      { itemId: 'scroll_spear', price: 176 }, { itemId: 'crystal_shard', price: 50 }, { itemId: 'obsidian_shard', price: 68 },
      { itemId: 'potion_moon_focus', price: 92 },
    ],
  },
  merchant_marshal_thorne: {
    id: 'merchant_marshal_thorne',
    name: { [EN]: 'Frontline Commissary', [RU]: 'Фронтовой комиссариат' },
    locationId: 'hub_ironhold',
    inventory: [
      { itemId: 'weapon_silver_sabre', price: 470 }, { itemId: 'spear_ward', price: 335 }, { itemId: 'armor_titan_mail', price: 620 },
      { itemId: 'armor_iron', price: 215 }, { itemId: 'potion_bastion_oil', price: 92 }, { itemId: 'potion_energy', price: 44 },
    ],
  },
  merchant_quartermaster_ilda: {
    id: 'merchant_quartermaster_ilda',
    name: { [EN]: 'Ilda Supply Office', [RU]: 'Снабжение Ильды' },
    locationId: 'hub_ironhold',
    inventory: [
      { itemId: 'iron_ore', price: 25 }, { itemId: 'silver_ore', price: 40 }, { itemId: 'titan_plate', price: 72 },
      { itemId: 'hard_wood', price: 19 }, { itemId: 'scalehide', price: 29 }, { itemId: 'silk_fiber', price: 31 },
    ],
  },
  merchant_smith_varr: {
    id: 'merchant_smith_varr',
    name: { [EN]: 'Varr Heavy Forge', [RU]: 'Тяжёлая кузня Варра' },
    locationId: 'hub_ironhold',
    inventory: [
      { itemId: 'sword_iron', price: 164 }, { itemId: 'axe_blackiron', price: 430 }, { itemId: 'weapon_obsidian_maul', price: 760 },
      { itemId: 'weapon_silver_sabre', price: 465 }, { itemId: 'armor_iron', price: 210 }, { itemId: 'armor_titan_mail', price: 630 },
      { itemId: 'armor_scalehide', price: 398 },
    ],
  },
  merchant_envoy_sera: {
    id: 'merchant_envoy_sera',
    name: { [EN]: 'Concord Contracts', [RU]: 'Контракты Конкорда' },
    locationId: 'hub_sky_consort',
    inventory: [
      { itemId: 'silk_fiber', price: 30 }, { itemId: 'armor_silk_vest', price: 420 }, { itemId: 'potion_moon_focus', price: 90 },
      { itemId: 'scroll_antidote', price: 120 }, { itemId: 'obsidian_shard', price: 66 }, { itemId: 'gold', price: 2 },
    ],
  },
  merchant_apothecary_nox: {
    id: 'merchant_apothecary_nox',
    name: { [EN]: 'Nox Distillery', [RU]: 'Дистиллерия Нокса' },
    locationId: 'hub_sky_consort',
    inventory: [
      { itemId: 'potion_small', price: 19 }, { itemId: 'potion_large', price: 50 }, { itemId: 'potion_energy', price: 42 },
      { itemId: 'potion_antidote', price: 49 }, { itemId: 'potion_moon_focus', price: 88 }, { itemId: 'potion_bastion_oil', price: 94 },
      { itemId: 'bomb_toxic', price: 86 }, { itemId: 'moon_herb', price: 34 }, { itemId: 'swamp_weed', price: 19 },
    ],
  },
  merchant_factor_brom: {
    id: 'merchant_factor_brom',
    name: { [EN]: 'Brom Trade Ledger', [RU]: 'Торговый реестр Брома' },
    locationId: 'hub_sky_consort',
    inventory: [
      { itemId: 'iron_ore', price: 26 }, { itemId: 'silver_ore', price: 41 }, { itemId: 'obsidian_shard', price: 67 },
      { itemId: 'silk_fiber', price: 30 }, { itemId: 'titan_plate', price: 74 }, { itemId: 'crystal_shard', price: 49 },
    ],
  },
  merchant_warden_rook: {
    id: 'merchant_warden_rook',
    name: { [EN]: 'Rook Marsh Armory', [RU]: 'Болотный арсенал Рука' },
    locationId: 'hub_mire_union',
    inventory: [
      { itemId: 'spear_ward', price: 325 }, { itemId: 'axe_blackiron', price: 410 }, { itemId: 'armor_scalehide', price: 380 },
      { itemId: 'armor_silk_vest', price: 405 }, { itemId: 'potion_bastion_oil', price: 90 }, { itemId: 'potion_antidote', price: 48 },
    ],
  },
  merchant_herbalist_vesk: {
    id: 'merchant_herbalist_vesk',
    name: { [EN]: 'Vesk Herb Table', [RU]: 'Травный стол Веска' },
    locationId: 'hub_mire_union',
    inventory: [
      { itemId: 'swamp_weed', price: 17 }, { itemId: 'moon_herb', price: 30 }, { itemId: 'potion_small', price: 19 },
      { itemId: 'potion_energy', price: 42 }, { itemId: 'potion_antidote', price: 48 }, { itemId: 'potion_moon_focus', price: 86 },
      { itemId: 'bomb_toxic', price: 84 },
    ],
  },
  merchant_tinker_juno: {
    id: 'merchant_tinker_juno',
    name: { [EN]: 'Juno Field Workshop', [RU]: 'Полевой цех Джуно' },
    locationId: 'hub_mire_union',
    inventory: [
      { itemId: 'titan_plate', price: 76 }, { itemId: 'obsidian_shard', price: 68 }, { itemId: 'silver_ore', price: 40 },
      { itemId: 'weapon_obsidian_maul', price: 750 }, { itemId: 'armor_titan_mail', price: 620 }, { itemId: 'bomb_fire', price: 61 },
      { itemId: 'bomb_toxic', price: 86 },
    ],
  },
};

export const NPCS: Record<string, NPC> = {
  npc_elder_bran: {
    id: 'npc_elder_bran', name: { [EN]: 'Elder Bran', [RU]: 'Старейшина Бран' }, locationId: 'town_oakhaven', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Traveler, darkness grows across the old lands.', [RU]: 'Путник, тьма сгущается над древними землями.' }, options: [
        { text: { [EN]: 'Tell me about the trolls.', [RU]: 'Расскажи о троллях.' }, nextNodeId: 'trolls' },
        { text: { [EN]: 'Any work for me?', [RU]: 'Есть работа?' }, nextNodeId: 'work', action: 'give_quest', actionPayload: 'quest_troll_hunt' },
        { text: { [EN]: 'I seek greater threats.', [RU]: 'Ищу более серьезную угрозу.' }, nextNodeId: 'golem', action: 'give_quest', actionPayload: 'quest_forge_sentinel' },
        { text: { [EN]: 'What happened in these lands?', [RU]: 'Что произошло с этими землями?' }, nextNodeId: 'lore_fall' },
        { text: { [EN]: 'Any ancient task?', [RU]: 'Есть древнее поручение?' }, nextNodeId: 'sanctum', action: 'give_quest', actionPayload: 'quest_sanctum_explore' },
        { text: { [EN]: 'Goodbye.', [RU]: 'Прощай.' }, nextNodeId: null },
      ] },
      trolls: { id: 'trolls', text: { [EN]: 'They dwell in the Echoing Cave beyond the pass.', [RU]: 'Они обитают в Эхо-пещере за перевалом.' }, options: [{ text: { [EN]: 'Understood.', [RU]: 'Понял.' }, nextNodeId: 'start' }] },
      work: { id: 'work', text: { [EN]: 'Slay a cave troll and you will be rewarded.', [RU]: 'Убей пещерного тролля и получишь награду.' }, options: [{ text: { [EN]: 'I will do it.', [RU]: 'Я сделаю это.' }, nextNodeId: null }] },
      golem: { id: 'golem', text: { [EN]: 'An ancient sentinel woke in the forgotten forge.', [RU]: 'В забытой кузне пробудился древний страж.' }, options: [{ text: { [EN]: 'I accept.', [RU]: 'Принимаю.' }, nextNodeId: null }] },
      lore_fall: { id: 'lore_fall', text: { [EN]: 'Long ago, runes kept peace. Then greed turned runes into weapons, and the sky bled storms.', [RU]: 'Давно руны хранили мир. Но жадность превратила их в оружие, и небо пролилось бурями.' }, options: [{ text: { [EN]: 'And now?', [RU]: 'И что теперь?' }, nextNodeId: 'lore_now' }] },
      lore_now: { id: 'lore_now', text: { [EN]: 'Now every road remembers that war. Listen to stone, and it warns before steel does.', [RU]: 'Теперь каждая дорога помнит ту войну. Камень предупреждает раньше, чем сталь.' }, options: [{ text: { [EN]: 'I will remember.', [RU]: 'Я запомню.' }, nextNodeId: 'start' }] },
      sanctum: { id: 'sanctum', text: { [EN]: 'Reach the Sunken Sanctum and return with your mind intact. Few do.', [RU]: 'Доберись до Затонувшего святилища и вернись в здравом уме. Удаётся немногим.' }, options: [{ text: { [EN]: 'I will descend.', [RU]: 'Я спущусь.' }, nextNodeId: null }] },
    },
  },
  npc_guard_tom: {
    id: 'npc_guard_tom', name: { [EN]: 'Guard Tom', [RU]: 'Стражник Том' }, locationId: 'town_oakhaven', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Keep your blade sheathed in town, traveler.', [RU]: 'Держи клинок в ножнах в городе, путник.' }, options: [
        { text: { [EN]: 'Any patrol work?', [RU]: 'Есть работа для патруля?' }, nextNodeId: 'patrol', action: 'give_quest', actionPayload: 'quest_pass_patrol' },
        { text: { [EN]: 'Bandits still active?', [RU]: 'Бандиты всё ещё активны?' }, nextNodeId: 'bandana', action: 'give_quest', actionPayload: 'quest_bandana_evidence' },
        { text: { [EN]: 'Any rumors from the gate?', [RU]: 'Какие слухи у ворот?' }, nextNodeId: 'rumors' },
        { text: { [EN]: 'Understood.', [RU]: 'Понял.' }, nextNodeId: null },
      ] },
      patrol: { id: 'patrol', text: { [EN]: 'Walk the Troll Pass twice and report what tracks you saw.', [RU]: 'Пройди Перевал троллей дважды и доложи, чьи следы видел.' }, options: [{ text: { [EN]: 'On my way.', [RU]: 'Уже иду.' }, nextNodeId: null }] },
      bandana: { id: 'bandana', text: { [EN]: 'Bring me bandit bandanas. I need proof before I can mobilize reserves.', [RU]: 'Принеси мне банданы разбойников. Нужны доказательства, чтобы собрать резерв.' }, options: [{ text: { [EN]: 'I will collect them.', [RU]: 'Соберу.' }, nextNodeId: null }] },
      rumors: { id: 'rumors', text: { [EN]: 'Fog near the swamp whispers names. Men hear their own and vanish before dawn.', [RU]: 'Туман у болота шепчет имена. Люди слышат своё и исчезают до рассвета.' }, options: [{ text: { [EN]: 'I will stay sharp.', [RU]: 'Буду начеку.' }, nextNodeId: 'start' }] },
    },
  },
  npc_alchemist_mira: {
    id: 'npc_alchemist_mira', name: { [EN]: 'Mira the Alchemist', [RU]: 'Алхимик Мира' }, locationId: 'town_oakhaven', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Bring me swamp reagents and I will teach potent mixtures.', [RU]: 'Принеси болотные реагенты, и я научу тебя мощным смесям.' }, options: [
        { text: { [EN]: 'I can gather samples.', [RU]: 'Я соберу образцы.' }, nextNodeId: null, action: 'give_quest', actionPayload: 'quest_swamp_samples' },
        { text: { [EN]: 'Need antidotes?', [RU]: 'Нужны антидоты?' }, nextNodeId: 'antidote', action: 'give_quest', actionPayload: 'quest_poison_cure' },
        { text: { [EN]: 'Need goblin reagents?', [RU]: 'Нужны гоблинские реагенты?' }, nextNodeId: 'goblin', action: 'give_quest', actionPayload: 'quest_goblin_ears' },
        { text: { [EN]: 'Any dangerous brew request?', [RU]: 'Есть опасный алхимический заказ?' }, nextNodeId: 'plague', action: 'give_quest', actionPayload: 'quest_alchemist_hunt' },
        { text: { [EN]: 'Tell me about plague mists.', [RU]: 'Расскажи о чумных испарениях.' }, nextNodeId: 'lore_plague' },
        { text: { [EN]: 'Maybe later.', [RU]: 'Позже.' }, nextNodeId: null },
      ] },
      antidote: { id: 'antidote', text: { [EN]: 'Brew two antidotes. If your hands stay steady, I will trust you with rarer toxins.', [RU]: 'Свари два антидота. Если руки не дрогнут, доверю тебе более редкие яды.' }, options: [{ text: { [EN]: 'Deal.', [RU]: 'Договорились.' }, nextNodeId: null }] },
      goblin: { id: 'goblin', text: { [EN]: 'I need fresh goblin ears. Old samples lose catalytic oils.', [RU]: 'Мне нужны свежие уши гоблинов. Старые образцы теряют каталитические масла.' }, options: [{ text: { [EN]: 'I will hunt them.', [RU]: 'Я их выследу.' }, nextNodeId: null }] },
      plague: { id: 'plague', text: { [EN]: 'Find and eliminate plague alchemists. Their brews poison the rain itself.', [RU]: 'Найди и уничтожь чумных алхимиков. Их смеси отравляют сам дождь.' }, options: [{ text: { [EN]: 'I will cleanse them.', [RU]: 'Я очищу эти земли.' }, nextNodeId: null }] },
      lore_plague: { id: 'lore_plague', text: { [EN]: 'Plague mists are not natural. They are distilled fear, given form by broken runes.', [RU]: 'Чумные испарения неестественны. Это дистиллированный страх, которому сломанные руны дали форму.' }, options: [{ text: { [EN]: 'Then we break the source.', [RU]: 'Значит, сломаем источник.' }, nextNodeId: 'start' }] },
    },
  },
  npc_scout_lyra: {
    id: 'npc_scout_lyra', name: { [EN]: 'Scout Lyra', [RU]: 'Разведчица Лира' }, locationId: 'town_oakhaven', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'I map routes no one survives twice. Want to test your luck?', [RU]: 'Я картографирую маршруты, которые редко проходят дважды. Проверишь удачу?' }, options: [
        { text: { [EN]: 'Need pelts?', [RU]: 'Нужны шкуры?' }, nextNodeId: 'pelts', action: 'give_quest', actionPayload: 'quest_wolf_pelts' },
        { text: { [EN]: 'Any scouting orders?', [RU]: 'Есть разведзадание?' }, nextNodeId: 'ruins', action: 'give_quest', actionPayload: 'quest_ruins_scout' },
        { text: { [EN]: 'Tell me route lore.', [RU]: 'Расскажи о дорогах.' }, nextNodeId: 'lore_routes' },
        { text: { [EN]: 'Later.', [RU]: 'Позже.' }, nextNodeId: null },
      ] },
      pelts: { id: 'pelts', text: { [EN]: 'Bring wolf pelts. I reinforce boots for marsh marches.', [RU]: 'Принеси волчьи шкуры. Я усиливаю ими сапоги для болотных маршей.' }, options: [{ text: { [EN]: 'I will gather them.', [RU]: 'Соберу.' }, nextNodeId: null }] },
      ruins: { id: 'ruins', text: { [EN]: 'Enter the Ancient Ruins and return with your own report, not old rumors.', [RU]: 'Войди в Древние руины и вернись со своим отчётом, а не с чужими слухами.' }, options: [{ text: { [EN]: 'I will scout it.', [RU]: 'Разведаю.' }, nextNodeId: null }] },
      lore_routes: { id: 'lore_routes', text: { [EN]: 'South Road is loud with steel. Whispering Forest is loud with silence. Choose your danger.', [RU]: 'Южная дорога громкая от стали. Шепчущий лес громкий от тишины. Выбирай свою опасность.' }, options: [{ text: { [EN]: 'Useful advice.', [RU]: 'Полезный совет.' }, nextNodeId: 'start' }] },
    },
  },
  npc_blacksmith_durn: {
    id: 'npc_blacksmith_durn', name: { [EN]: 'Blacksmith Durn', [RU]: 'Кузнец Дурн' }, locationId: 'town_oakhaven', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Steel keeps promises better than people. Bring ore, I shape destiny.', [RU]: 'Сталь держит слово лучше людей. Принеси руду, и я выкую судьбу.' }, options: [
        { text: { [EN]: 'Need iron ore?', [RU]: 'Нужна железная руда?' }, nextNodeId: 'iron', action: 'give_quest', actionPayload: 'quest_iron_forge' },
        { text: { [EN]: 'Need forge relics?', [RU]: 'Нужны реликвии кузни?' }, nextNodeId: 'forge', action: 'give_quest', actionPayload: 'quest_forge_relic' },
        { text: { [EN]: 'Tell me forge history.', [RU]: 'Расскажи историю кузни.' }, nextNodeId: 'lore_forge' },
        { text: { [EN]: 'Later.', [RU]: 'Позже.' }, nextNodeId: null },
      ] },
      iron: { id: 'iron', text: { [EN]: 'Five chunks of iron ore. No sand, no excuses.', [RU]: 'Пять кусков железной руды. Без песка и оправданий.' }, options: [{ text: { [EN]: 'You will have it.', [RU]: 'Будет сделано.' }, nextNodeId: null }] },
      forge: { id: 'forge', text: { [EN]: 'The Forgotten Forge still breathes heat. Step inside and return alive.', [RU]: 'Забытая кузня всё ещё дышит жаром. Войди туда и вернись живым.' }, options: [{ text: { [EN]: 'I can handle it.', [RU]: 'Справлюсь.' }, nextNodeId: null }] },
      lore_forge: { id: 'lore_forge', text: { [EN]: 'The old smiths etched vows into steel. Their blades hum when oathbreakers are near.', [RU]: 'Старые кузнецы вплавляли клятвы в сталь. Их клинки гудят рядом с клятвопреступниками.' }, options: [{ text: { [EN]: 'I hear enough hum already.', [RU]: 'Я и так слышу слишком много гула.' }, nextNodeId: 'start' }] },
    },
  },
  npc_chronicler_vesna: {
    id: 'npc_chronicler_vesna', name: { [EN]: 'Chronicler Vesna', [RU]: 'Летописец Весна' }, locationId: 'town_oakhaven', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Words survive where walls fall. Bring me truths from the dark.', [RU]: 'Слова выживают там, где падают стены. Принеси мне правду из тьмы.' }, options: [
        { text: { [EN]: 'Need sanctum notes?', [RU]: 'Нужны заметки из святилища?' }, nextNodeId: 'sanctum', action: 'give_quest', actionPayload: 'quest_sanctum_notes' },
        { text: { [EN]: 'Need golem records?', [RU]: 'Нужны записи о големе?' }, nextNodeId: 'runic_trial', action: 'give_quest', actionPayload: 'quest_runic_trial' },
        { text: { [EN]: 'Tell me old lore.', [RU]: 'Расскажи древний лор.' }, nextNodeId: 'lore_archive' },
        { text: { [EN]: 'Farewell.', [RU]: 'Прощай.' }, nextNodeId: null },
      ] },
      sanctum: { id: 'sanctum', text: { [EN]: 'Reach the Sunken Sanctum and return with memory intact. That alone is knowledge.', [RU]: 'Доберись до Затонувшего святилища и сохрани память. Уже это будет знанием.' }, options: [{ text: { [EN]: 'I will return.', [RU]: 'Я вернусь.' }, nextNodeId: null }] },
      runic_trial: { id: 'runic_trial', text: { [EN]: 'Defeat the Sentinel Golem and describe the runes that ignite as it falls.', [RU]: 'Победи Голема-стража и опиши руны, вспыхивающие в момент его падения.' }, options: [{ text: { [EN]: 'I accept the trial.', [RU]: 'Принимаю испытание.' }, nextNodeId: null }] },
      lore_archive: { id: 'lore_archive', text: { [EN]: 'Before kingdoms, there were Wardens. Before Wardens, there were storms that listened.', [RU]: 'До королевств были Хранители. До Хранителей были бури, которые слушали.' }, options: [{ text: { [EN]: 'And now storms obey no one.', [RU]: 'А теперь бури никого не слушают.' }, nextNodeId: 'start' }] },
    },
  },
  npc_marshal_thorne: {
    id: 'npc_marshal_thorne', name: { [EN]: 'Marshal Thorne', [RU]: 'Маршал Торн' }, locationId: 'hub_ironhold', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Ironhold holds because discipline never sleeps.', [RU]: 'Айронхолд стоит, пока дисциплина не спит.' }, options: [
        { text: { [EN]: 'Assign me to the frontline.', [RU]: 'Назначьте меня на передовую.' }, nextNodeId: 'frontline', action: 'give_quest', actionPayload: 'quest_marshal_front' },
        { text: { [EN]: 'Any major threat?', [RU]: 'Есть крупная угроза?' }, nextNodeId: 'hulk', action: 'give_quest', actionPayload: 'quest_war_hulk_break' },
        { text: { [EN]: 'Open military supplies.', [RU]: 'Открыть военное снабжение.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_marshal_thorne' },
        { text: { [EN]: 'Stand down.', [RU]: 'Отбой.' }, nextNodeId: null },
      ] },
      frontline: { id: 'frontline', text: { [EN]: 'Relay towers are under pressure. Remove legion raiders and report.', [RU]: 'Сигнальные башни под давлением. Устрани налётчиков легиона и доложи.' }, options: [{ text: { [EN]: 'Understood.', [RU]: 'Понял.' }, nextNodeId: null }] },
      hulk: { id: 'hulk', text: { [EN]: 'A war hulk is grinding through old sanctum halls. Break it before nightfall.', [RU]: 'Осадный громила продирается через святилище. Сломай его до ночи.' }, options: [{ text: { [EN]: 'I take the order.', [RU]: 'Принимаю приказ.' }, nextNodeId: null }] },
    },
  },
  npc_quartermaster_ilda: {
    id: 'npc_quartermaster_ilda', name: { [EN]: 'Quartermaster Ilda', [RU]: 'Квартирмейстер Ильда' }, locationId: 'hub_ironhold', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Ledgers first, glory second. Supplies win wars.', [RU]: 'Сначала ведомости, потом слава. Войны выигрывают поставки.' }, options: [
        { text: { [EN]: 'I can haul silver ore.', [RU]: 'Я могу доставить серебряную руду.' }, nextNodeId: 'silver', action: 'give_quest', actionPayload: 'quest_ironhold_silver' },
        { text: { [EN]: 'Open supply office.', [RU]: 'Открыть склад снабжения.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_quartermaster_ilda' },
        { text: { [EN]: 'That is all.', [RU]: 'На этом всё.' }, nextNodeId: null },
      ] },
      silver: { id: 'silver', text: { [EN]: 'Six units of silver ore. Clean chunks only.', [RU]: 'Шесть единиц серебряной руды. Только чистая порода.' }, options: [{ text: { [EN]: 'I will bring them.', [RU]: 'Принесу.' }, nextNodeId: null }] },
    },
  },
  npc_smith_varr: {
    id: 'npc_smith_varr', name: { [EN]: 'Master Smith Varr', [RU]: 'Мастер-кузнец Варр' }, locationId: 'hub_ironhold', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Heat, ore, and timing. Miss one and steel dies.', [RU]: 'Жар, руда и тайминг. Потеряешь одно — сталь мертва.' }, options: [
        { text: { [EN]: 'Need titan plates?', [RU]: 'Нужны титановые пластины?' }, nextNodeId: 'plates', action: 'give_quest', actionPayload: 'quest_ironhold_plate' },
        { text: { [EN]: 'Show me forge stock.', [RU]: 'Показать кузнечный товар.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_smith_varr' },
        { text: { [EN]: 'I will return.', [RU]: 'Я вернусь.' }, nextNodeId: null },
      ] },
      plates: { id: 'plates', text: { [EN]: 'Bring four titan plates from wrecked patrol rigs.', [RU]: 'Принеси четыре титановые пластины с разбитых патрульных машин.' }, options: [{ text: { [EN]: 'Accepted.', [RU]: 'Принято.' }, nextNodeId: null }] },
    },
  },
  npc_envoy_sera: {
    id: 'npc_envoy_sera', name: { [EN]: 'Envoy Sera', [RU]: 'Посол Сера' }, locationId: 'hub_sky_consort', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Concord survives by contracts and pressure points.', [RU]: 'Конкорд держится на контрактах и точках давления.' }, options: [
        { text: { [EN]: 'I can clear shadow operatives.', [RU]: 'Я устраню теневых оперативников.' }, nextNodeId: 'shadow', action: 'give_quest', actionPayload: 'quest_concord_shadow' },
        { text: { [EN]: 'Open contract market.', [RU]: 'Открыть контрактный рынок.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_envoy_sera' },
        { text: { [EN]: 'No deal today.', [RU]: 'Сегодня без сделки.' }, nextNodeId: null },
      ] },
      shadow: { id: 'shadow', text: { [EN]: 'Three assassins disrupt caravan diplomacy. Remove them quietly or loudly.', [RU]: 'Три ассасина срывают караванную дипломатию. Устрани их тихо или громко.' }, options: [{ text: { [EN]: 'I will handle it.', [RU]: 'Я разберусь.' }, nextNodeId: null }] },
    },
  },
  npc_apothecary_nox: {
    id: 'npc_apothecary_nox', name: { [EN]: 'Apothecary Nox', [RU]: 'Аптекарь Нокс' }, locationId: 'hub_sky_consort', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Moon herbs and careful dosing. That is the line between cure and poison.', [RU]: 'Лунные травы и точная дозировка. Это грань между лечением и ядом.' }, options: [
        { text: { [EN]: 'I will gather moon herbs.', [RU]: 'Соберу лунные травы.' }, nextNodeId: 'moon', action: 'give_quest', actionPayload: 'quest_apothecary_moon' },
        { text: { [EN]: 'Open apothecary stock.', [RU]: 'Открыть аптекарский ассортимент.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_apothecary_nox' },
        { text: { [EN]: 'Later.', [RU]: 'Позже.' }, nextNodeId: null },
      ] },
      moon: { id: 'moon', text: { [EN]: 'Bring five moon herbs. Fresh cuts only.', [RU]: 'Принеси пять лунных трав. Только свежий сбор.' }, options: [{ text: { [EN]: 'Understood.', [RU]: 'Понял.' }, nextNodeId: null }] },
    },
  },
  npc_factor_brom: {
    id: 'npc_factor_brom', name: { [EN]: 'Factor Brom', [RU]: 'Фактор Бром' }, locationId: 'hub_sky_consort', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Logistics is war by arithmetic.', [RU]: 'Логистика — это война арифметикой.' }, options: [
        { text: { [EN]: 'Need courier fibers?', [RU]: 'Нужны волокна для курьеров?' }, nextNodeId: 'fibers', action: 'give_quest', actionPayload: 'quest_concord_fibers' },
        { text: { [EN]: 'Open trade ledger.', [RU]: 'Открыть торговый реестр.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_factor_brom' },
        { text: { [EN]: 'Maybe next cycle.', [RU]: 'В следующий цикл.' }, nextNodeId: null },
      ] },
      fibers: { id: 'fibers', text: { [EN]: 'Secure six silk fibers for alliance dispatch rigs.', [RU]: 'Добудь шесть шелковых волокон для упряжи альянса.' }, options: [{ text: { [EN]: 'I will secure them.', [RU]: 'Добуду.' }, nextNodeId: null }] },
    },
  },
  npc_warden_rook: {
    id: 'npc_warden_rook', name: { [EN]: 'Warden Rook', [RU]: 'Хранитель Рук' }, locationId: 'hub_mire_union', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Bog lines must hold. If they break, everyone drowns in panic.', [RU]: 'Линия топей должна держаться. Если рухнет — всех утопит паника.' }, options: [
        { text: { [EN]: 'I will patrol the marshline.', [RU]: 'Я выйду в болотный патруль.' }, nextNodeId: 'bogline', action: 'give_quest', actionPayload: 'quest_union_shaman' },
        { text: { [EN]: 'Open marsh armory.', [RU]: 'Открыть болотный арсенал.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_warden_rook' },
        { text: { [EN]: 'Hold the line.', [RU]: 'Держите рубеж.' }, nextNodeId: null },
      ] },
      bogline: { id: 'bogline', text: { [EN]: 'Three mire shamans are poisoning patrol wells. End it.', [RU]: 'Трое болотных шаманов травят колодцы патруля. Останови это.' }, options: [{ text: { [EN]: 'On it.', [RU]: 'Выполняю.' }, nextNodeId: null }] },
    },
  },
  npc_herbalist_vesk: {
    id: 'npc_herbalist_vesk', name: { [EN]: 'Herbalist Vesk', [RU]: 'Травник Веск' }, locationId: 'hub_mire_union', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'Roots, reeds, and patience. Nature pays those who listen.', [RU]: 'Корни, тростник и терпение. Природа платит тем, кто слушает.' }, options: [
        { text: { [EN]: 'I can gather reeds and herbs.', [RU]: 'Соберу тростник и травы.' }, nextNodeId: 'reeds', action: 'give_quest', actionPayload: 'quest_union_reeds' },
        { text: { [EN]: 'Open herb bench.', [RU]: 'Открыть травный стол.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_herbalist_vesk' },
        { text: { [EN]: 'Until next tide.', [RU]: 'До следующего прилива.' }, nextNodeId: null },
      ] },
      reeds: { id: 'reeds', text: { [EN]: 'Bring six bundles of swamp weed for emergency kits.', [RU]: 'Принеси шесть пучков болотной травы для аварийных наборов.' }, options: [{ text: { [EN]: 'I will collect them.', [RU]: 'Соберу.' }, nextNodeId: null }] },
    },
  },
  npc_tinker_juno: {
    id: 'npc_tinker_juno', name: { [EN]: 'Tinker Juno', [RU]: 'Техник Джуно' }, locationId: 'hub_mire_union', defaultNode: 'start',
    dialogueTree: {
      start: { id: 'start', text: { [EN]: 'If it can be rebuilt, I can overbuild it.', [RU]: 'Если это можно пересобрать — я могу пересобрать лучше.' }, options: [
        { text: { [EN]: 'Need salvage from sanctum?', [RU]: 'Нужен лом из святилища?' }, nextNodeId: 'salvage', action: 'give_quest', actionPayload: 'quest_union_machines' },
        { text: { [EN]: 'Open field workshop.', [RU]: 'Открыть полевой цех.' }, nextNodeId: 'start', action: 'open_merchant', actionPayload: 'merchant_tinker_juno' },
        { text: { [EN]: 'I will be back.', [RU]: 'Я вернусь.' }, nextNodeId: null },
      ] },
      salvage: { id: 'salvage', text: { [EN]: 'I need titan plates and obsidian shards for a siege-breaker prototype.', [RU]: 'Мне нужны титановые пластины и обсидиановые осколки для прототипа осадного разрушителя.' }, options: [{ text: { [EN]: 'I will salvage them.', [RU]: 'Добуду.' }, nextNodeId: null }] },
    },
  },
};

export const ALL_QUESTS: Record<string, Quest> = {
  ...Object.fromEntries(QUESTS_FROM_NPCS.map((q) => [q.id, q])),
  quest_troll_hunt: { id: 'quest_troll_hunt', giverNpcId: 'npc_elder_bran', turnInNpcId: 'npc_elder_bran', name: { [EN]: 'Troll Menace', [RU]: 'Угроза троллей' }, description: { [EN]: 'Elder Bran asked you to slay a Troll in the Echoing Cave.', [RU]: 'Старейшина Бран попросил вас убить тролля в Эхо-пещере.' }, locationId: 'cave_deep', goals: [{ type: 'kill', targetId: 'troll', targetCount: 1, currentCount: 0 }], rewards: { xp: 200, gold: 150, items: [{ itemId: 'potion_large', quantity: 1 }], perkId: 'perk_trollbane', reputation: [{ merchantId: 'merchant_oakhaven', amount: 3 }] }, isTurnInReady: false, isCompleted: false },
  quest_forge_sentinel: { id: 'quest_forge_sentinel', giverNpcId: 'npc_elder_bran', turnInNpcId: 'npc_elder_bran', name: { [EN]: 'Forge Sentinel', [RU]: 'Страж кузни' }, description: { [EN]: 'Defeat the Sentinel Golem in the Forgotten Forge.', [RU]: 'Победите голема-стража в Забытой кузне.' }, locationId: 'forgotten_forge', goals: [{ type: 'kill', targetId: 'sentinel_golem', targetCount: 1, currentCount: 0 }], rewards: { xp: 420, gold: 320, items: [{ itemId: 'wardplate_legendary', quantity: 1 }], perkId: 'perk_runic_mastery', reputation: [{ merchantId: 'merchant_oakhaven', amount: 5 }] }, isTurnInReady: false, isCompleted: false },
  quest_poison_cure: { id: 'quest_poison_cure', giverNpcId: 'npc_alchemist_mira', turnInNpcId: 'npc_alchemist_mira', name: { [EN]: 'Brew the Cure', [RU]: 'Сварить противоядие' }, description: { [EN]: 'Craft 2 antidotes for Mira at an alchemy station.', [RU]: 'Создайте 2 антидота для Миры.' }, locationId: 'town_oakhaven', goals: [{ type: 'collect', targetId: 'potion_antidote', targetCount: 2, currentCount: 0 }], rewards: { xp: 130, gold: 90, items: [{ itemId: 'potion_energy', quantity: 1 }], perkId: 'perk_alchemical_precision' }, isTurnInReady: false, isCompleted: false },
  quest_sanctum_explore: { id: 'quest_sanctum_explore', giverNpcId: 'npc_elder_bran', turnInNpcId: 'npc_elder_bran', name: { [EN]: 'Sunken Secrets', [RU]: 'Тайны святилища' }, description: { [EN]: 'Reach the Sunken Sanctum and survive.', [RU]: 'Доберитесь до Затонувшего святилища и выживите.' }, locationId: 'sunken_sanctum', goals: [{ type: 'explore', targetId: 'sunken_sanctum', targetCount: 1, currentCount: 0 }], rewards: { xp: 260, gold: 180, items: [{ itemId: 'blade_eclipse', quantity: 1 }], perkId: 'perk_arcane_attunement' }, isTurnInReady: false, isCompleted: false },
  quest_goblin_ears: { id: 'quest_goblin_ears', giverNpcId: 'npc_alchemist_mira', turnInNpcId: 'npc_alchemist_mira', name: { [EN]: 'Catalyst Harvest', [RU]: 'Сбор катализаторов' }, description: { [EN]: 'Bring 4 goblin ears for Mira\'s reagents.', [RU]: 'Принесите 4 уха гоблина для реагентов Миры.' }, locationId: 'forest_whispering', goals: [{ type: 'collect', targetId: 'goblin_ear', targetCount: 4, currentCount: 0 }], rewards: { xp: 120, gold: 75, items: [{ itemId: 'bomb_toxic', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  quest_alchemist_hunt: { id: 'quest_alchemist_hunt', giverNpcId: 'npc_alchemist_mira', turnInNpcId: 'npc_alchemist_mira', name: { [EN]: 'Silence the Plague', [RU]: 'Заглушить чуму' }, description: { [EN]: 'Defeat 2 Plague Alchemists in the ruins and swamp.', [RU]: 'Победите 2 чумных алхимиков в руинах и болотах.' }, locationId: 'ruins_ancient', goals: [{ type: 'kill', targetId: 'plague_alchemist', targetCount: 2, currentCount: 0 }], rewards: { xp: 220, gold: 180, items: [{ itemId: 'scroll_antidote', quantity: 1 }, { itemId: 'potion_antidote', quantity: 2 }] }, isTurnInReady: false, isCompleted: false },
  quest_wolf_pelts: { id: 'quest_wolf_pelts', giverNpcId: 'npc_scout_lyra', turnInNpcId: 'npc_scout_lyra', name: { [EN]: 'Trailhide Boots', [RU]: 'Следовые сапоги' }, description: { [EN]: 'Gather 6 wolf pelts for Lyra\'s travel gear.', [RU]: 'Соберите 6 волчьих шкур для походного снаряжения Лиры.' }, locationId: 'forest_whispering', goals: [{ type: 'collect', targetId: 'wolf_pelt', targetCount: 6, currentCount: 0 }], rewards: { xp: 140, gold: 95, items: [{ itemId: 'potion_energy', quantity: 2 }] }, isTurnInReady: false, isCompleted: false },
  quest_pass_patrol: { id: 'quest_pass_patrol', giverNpcId: 'npc_guard_tom', turnInNpcId: 'npc_guard_tom', name: { [EN]: 'Patrol the Pass', [RU]: 'Патруль перевала' }, description: { [EN]: 'Scout Troll Pass two times and report signs of raiders.', [RU]: 'Дважды разведайте Перевал троллей и доложите о следах налётчиков.' }, locationId: 'mountain_pass', goals: [{ type: 'explore', targetId: 'mountain_pass', targetCount: 2, currentCount: 0 }], rewards: { xp: 150, gold: 110, reputation: [{ merchantId: 'merchant_oakhaven', amount: 2 }] }, isTurnInReady: false, isCompleted: false },
  quest_bandana_evidence: { id: 'quest_bandana_evidence', giverNpcId: 'npc_guard_tom', turnInNpcId: 'npc_guard_tom', name: { [EN]: 'Proof of Raiders', [RU]: 'Доказательства налётов' }, description: { [EN]: 'Bring 5 bandit bandanas to Guard Tom.', [RU]: 'Принесите 5 бандан разбойников стражнику Тому.' }, locationId: 'road_south', goals: [{ type: 'collect', targetId: 'bandit_bandana', targetCount: 5, currentCount: 0 }], rewards: { xp: 160, gold: 130, items: [{ itemId: 'armor_iron', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  quest_iron_forge: { id: 'quest_iron_forge', giverNpcId: 'npc_blacksmith_durn', turnInNpcId: 'npc_blacksmith_durn', name: { [EN]: 'Forge Fuel', [RU]: 'Топливо для горна' }, description: { [EN]: 'Bring 5 iron ore chunks to Blacksmith Durn.', [RU]: 'Принесите 5 кусков железной руды кузнецу Дурну.' }, locationId: 'mountain_pass', goals: [{ type: 'collect', targetId: 'iron_ore', targetCount: 5, currentCount: 0 }], rewards: { xp: 170, gold: 120, items: [{ itemId: 'sword_iron', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  quest_forge_relic: { id: 'quest_forge_relic', giverNpcId: 'npc_blacksmith_durn', turnInNpcId: 'npc_blacksmith_durn', name: { [EN]: 'Heat of Ages', [RU]: 'Жар веков' }, description: { [EN]: 'Reach the Forgotten Forge and confirm the old fire still burns.', [RU]: 'Доберитесь до Забытой кузни и подтвердите, что древний огонь всё ещё горит.' }, locationId: 'forgotten_forge', goals: [{ type: 'explore', targetId: 'forgotten_forge', targetCount: 1, currentCount: 0 }], rewards: { xp: 210, gold: 165, items: [{ itemId: 'scroll_spear', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  quest_sanctum_notes: { id: 'quest_sanctum_notes', giverNpcId: 'npc_chronicler_vesna', turnInNpcId: 'npc_chronicler_vesna', name: { [EN]: 'Silted Chronicle', [RU]: 'Илистая летопись' }, description: { [EN]: 'Reach the Sunken Sanctum and return with your account.', [RU]: 'Доберитесь до Затонувшего святилища и вернитесь с личным отчётом.' }, locationId: 'sunken_sanctum', goals: [{ type: 'explore', targetId: 'sunken_sanctum', targetCount: 1, currentCount: 0 }], rewards: { xp: 230, gold: 170, items: [{ itemId: 'scroll_armor', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
  quest_runic_trial: { id: 'quest_runic_trial', giverNpcId: 'npc_chronicler_vesna', turnInNpcId: 'npc_chronicler_vesna', name: { [EN]: 'Runic Trial', [RU]: 'Руническое испытание' }, description: { [EN]: 'Defeat the Sentinel Golem and survive to tell the tale.', [RU]: 'Победите Голема-стража и выживите, чтобы рассказать об этом.' }, locationId: 'forgotten_forge', goals: [{ type: 'kill', targetId: 'sentinel_golem', targetCount: 1, currentCount: 0 }], rewards: { xp: 360, gold: 250, items: [{ itemId: 'blade_eclipse', quantity: 1 }], reputation: [{ merchantId: 'merchant_oakhaven', amount: 3 }] }, isTurnInReady: false, isCompleted: false },
  quest_swamp_horror: { id: 'quest_swamp_horror', giverNpcId: 'npc_alchemist_mira', turnInNpcId: 'npc_alchemist_mira', name: { [EN]: 'Heart of the Bog', [RU]: 'Сердце трясины' }, description: { [EN]: 'Defeat 2 Bog Horrors in the Murky Swamp.', [RU]: 'Победите 2 болотных ужаса в Мрачном болоте.' }, locationId: 'swamp_murky', goals: [{ type: 'kill', targetId: 'swamp_thing', targetCount: 2, currentCount: 0 }], rewards: { xp: 190, gold: 145, items: [{ itemId: 'potion_antidote', quantity: 2 }, { itemId: 'bomb_toxic', quantity: 1 }] }, isTurnInReady: false, isCompleted: false },
};

Object.assign(RECIPES, EXPANSION_RECIPES);
Object.assign(ITEMS, EXPANSION_ITEMS);
Object.assign(ENEMIES, EXPANSION_ENEMIES);
Object.assign(LOCATIONS, EXPANSION_LOCATIONS);
Object.assign(MERCHANTS, EXPANSION_MERCHANTS);
Object.assign(NPCS, EXPANSION_NPCS);
Object.assign(ALL_QUESTS, EXPANSION_QUESTS);

for (const [from, to] of EXPANSION_CONNECTIONS) {
  const fromLoc = LOCATIONS[from];
  const toLoc = LOCATIONS[to];
  if (!fromLoc || !toLoc) continue;
  if (!fromLoc.connectedLocations.includes(to)) fromLoc.connectedLocations.push(to);
  if (!toLoc.connectedLocations.includes(from)) toLoc.connectedLocations.push(from);
}
