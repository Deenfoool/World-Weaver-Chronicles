import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFollowupEventQuest } from '../client/src/game/store';
import { Quest } from '../client/src/game/types';

function makeResolvedEventQuest(id: string): Quest {
  return {
    id,
    name: { en: 'War Contract', ru: 'Военный контракт' },
    description: { en: 'Desc', ru: 'Описание' },
    locationId: 'road_south',
    goals: [{ type: 'kill', targetId: 'bandit', targetCount: 2, currentCount: 2 }],
    rewards: { xp: 100, gold: 50 },
    isCompleted: true,
    isEventQuest: true,
    sourceEventId: 'war_test_1',
    eventQuest: {
      originType: 'war',
      targetHubId: 'town_oakhaven',
      opponentHubId: 'hub_emberwatch',
      sourceHubLevel: 3,
      branch: 'support_a',
    },
  };
}

test('creates one follow-up level and prevents recursive follow-up chains', () => {
  const resolved = makeResolvedEventQuest('event_quest_a');
  const followup = buildFollowupEventQuest(resolved);
  assert.ok(followup);
  assert.ok(followup?.id.startsWith('followup_'));
  const nested = followup ? buildFollowupEventQuest(followup) : null;
  assert.equal(nested, null);
});

