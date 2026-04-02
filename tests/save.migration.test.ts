import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSaveData } from '../client/src/game/store';
import { SaveData } from '../client/src/game/types';

test('migrates legacy save without version to current version and economy shape', () => {
  const legacy: SaveData = {
    player: {
      classId: null,
      name: 'Traveler',
      level: 1,
      xp: 0,
      xpToNext: 100,
      skillPoints: 0,
      learnedSkills: {},
      knownRecipes: [],
      hp: 50,
      maxHp: 50,
      energy: 60,
      maxEnergy: 60,
      carryCapacity: 35,
      gold: 10,
      inventory: [],
      equipment: {},
      stats: { baseDamage: [1, 3], baseDefense: 0 },
    },
    currentLocationId: 'town_oakhaven',
    currentWeather: 'clear',
    weatherDuration: 5,
    quests: [],
    worldEconomy: undefined,
    status: 'hub',
    timestamp: Date.now(),
    settings: {
      language: 'en',
      voice: { lore: true, quests: true, npcDialogue: true },
      tutorial: { enabled: true, completed: false, step: 0, seenHints: [] },
    },
  };
  const migrated = migrateSaveData(legacy);
  assert.equal(migrated.saveVersion, 2);
  assert.ok(migrated.worldEconomy);
  assert.ok(Array.isArray(migrated.worldEconomy?.pendingConsequences));
  assert.ok(Array.isArray(migrated.worldEconomy?.reputationLog));
});

