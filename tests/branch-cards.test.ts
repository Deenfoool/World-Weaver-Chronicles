import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventQuestBranchCards } from '../client/src/components/game/QuestsPanel';
import { Quest } from '../client/src/game/types';

function makeQuest(originType: Quest['eventQuest']['originType']): Quest {
  return {
    id: `q_${originType}`,
    name: { en: 'Q', ru: 'К' },
    description: { en: 'D', ru: 'О' },
    locationId: 'town_oakhaven',
    goals: [],
    rewards: { xp: 0, gold: 0 },
    isCompleted: false,
    eventQuest: {
      originType,
      targetHubId: 'town_oakhaven',
      sourceHubLevel: 4,
      branch: 'unselected',
    },
  };
}

test('war offer returns 3 branch cards including neutrality', () => {
  const cards = buildEventQuestBranchCards(makeQuest('war'), 'en');
  assert.equal(cards.length, 3);
  assert.ok(cards.some((c) => c.branch === 'neutral'));
});

test('caravan offer includes scaled fight count text', () => {
  const cards = buildEventQuestBranchCards(makeQuest('caravan_attack'), 'en');
  const escort = cards.find((c) => c.branch === 'support');
  assert.ok(escort);
  assert.ok(escort?.impacts.some((line) => line.includes('consecutive ambush fights')));
});

