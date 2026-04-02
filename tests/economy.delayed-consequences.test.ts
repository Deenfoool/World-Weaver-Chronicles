import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorldEconomy, simulateWorldEconomyTick } from '../client/src/game/store';

test('applies due delayed consequences on next tick', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.99;
  try {
    const base = createDefaultWorldEconomy();
    const seeded = {
      ...base,
      tick: 10,
      pendingConsequences: [
        {
          id: 'cons_test_retaliation',
          dueTick: 11,
          originQuestId: 'quest_a',
          originType: 'war' as const,
          triggerHubId: 'town_oakhaven',
          kind: 'retaliation' as const,
          intensity: 60,
          sourceBranch: 'punish' as const,
        },
      ],
    };
    const next = simulateWorldEconomyTick(seeded, 'clear');
    assert.equal(next.tick, 11);
    assert.equal(next.pendingConsequences.length, 0);
    assert.ok(next.events.some((e) => e.type === 'retaliation' && e.hubId === 'town_oakhaven'));
    assert.ok(next.reputationLog.some((entry) => entry.reasonKey === 'delay_retaliation'));
  } finally {
    Math.random = originalRandom;
  }
});

test('origin context changes delayed consequence strength', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.99;
  try {
    const base = createDefaultWorldEconomy();
    const seeded = {
      ...base,
      tick: 20,
      hubs: {
        ...base.hubs,
        town_oakhaven: { ...base.hubs.town_oakhaven, playerRelation: 40, stability: 70, supply: 60, demand: 40 },
      },
      pendingConsequences: [
        {
          id: 'cons_war',
          dueTick: 21,
          originQuestId: 'q_war',
          originType: 'war' as const,
          triggerHubId: 'town_oakhaven',
          kind: 'retaliation' as const,
          intensity: 50,
          sourceBranch: 'punish' as const,
        },
      ],
    };
    const warTick = simulateWorldEconomyTick(seeded, 'clear');
    const afterWar = warTick.hubs.town_oakhaven.playerRelation;

    const seededProsperity = {
      ...seeded,
      pendingConsequences: [
        {
          id: 'cons_pros',
          dueTick: 21,
          originQuestId: 'q_pros',
          originType: 'prosperity' as const,
          triggerHubId: 'town_oakhaven',
          kind: 'retaliation' as const,
          intensity: 50,
          sourceBranch: 'punish' as const,
        },
      ],
    };
    const prosperityTick = simulateWorldEconomyTick(seededProsperity, 'clear');
    const afterProsperity = prosperityTick.hubs.town_oakhaven.playerRelation;
    assert.ok(afterWar < afterProsperity);
  } finally {
    Math.random = originalRandom;
  }
});
