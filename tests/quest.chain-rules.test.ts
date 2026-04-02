import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEscortRoute, shouldAbandonCombatChainOnTravel } from '../client/src/game/store';

test('buildEscortRoute creates ambush list matching requested chain length', () => {
  const route = buildEscortRoute('town_oakhaven', 5);
  assert.ok(route.route.length >= 1);
  assert.ok(route.ambushLocationIds.length >= 1);
  assert.ok(route.ambushLocationIds.length <= 5);
  assert.equal(new Set(route.ambushLocationIds).size, route.ambushLocationIds.length);
  assert.ok(route.route.includes('town_oakhaven'));
});

test('shouldAbandonCombatChainOnTravel honors valid escort route movement', () => {
  const escortRoute = ['hub_emberwatch', 'road_south', 'town_oakhaven'];
  assert.equal(
    shouldAbandonCombatChainOnTravel('hub_emberwatch', 'road_south', 'hub_emberwatch', escortRoute),
    false,
  );
  assert.equal(
    shouldAbandonCombatChainOnTravel('road_south', 'mountain_pass', 'hub_emberwatch', escortRoute),
    true,
  );
});
