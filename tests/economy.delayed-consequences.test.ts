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

