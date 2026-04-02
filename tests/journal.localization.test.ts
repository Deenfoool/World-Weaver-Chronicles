import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeConsequenceKind, localizeOriginType, localizeReason } from '../client/src/components/game/FactionJournalPanel';

test('localizes known consequence kinds for RU/EN', () => {
  assert.equal(localizeConsequenceKind('ru', 'retaliation'), 'Ответные меры');
  assert.equal(localizeConsequenceKind('en', 'aid_arrival'), 'Aid Arrival');
  assert.equal(localizeOriginType('ru', 'caravan_attack'), 'Караванный конфликт');
});

test('localizes known reason keys and falls back gracefully', () => {
  assert.equal(localizeReason('ru', 'player_diplomacy'), 'Вы провели дипломатические улучшения.');
  assert.equal(localizeReason('en', undefined, 'Fallback reason'), 'Fallback reason');
});
