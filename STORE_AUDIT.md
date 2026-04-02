# Technical Audit: `client/src/game/store.ts`

Date: 2026-04-01

## Summary

`store.ts` already contains the full playable loop, but it concentrates combat, loot, quest progression, crafting, save-sync, and i18n in one large state file. The main risks are maintainability, duplicated combat rules, and side-effect timing under async save/load.

## Findings

### 1. High: Large monolithic store increases regression risk

- Impact: Small changes in one mechanic (combat, loot, quest, save) can unintentionally break another.
- Evidence: Single store file handles all domains and transitions.
- Recommendation: Split into domain actions (`combat`, `economy`, `quests`, `save-sync`) and keep a thin root store composition.

### 2. High: Combat formulas are duplicated and diverge

- Impact: Inconsistent gameplay and bugs that appear only in specific actions.
- Evidence: `attack()` applies defense/weather/skills/equipment logic, while `useItem()` and `flee()` use reduced enemy-damage pipelines.
- Recommendation: Extract one reusable `resolveEnemyAttack` and one `resolvePlayerDamage` utility used by all combat actions.

### 3. Medium: Mutable nested updates inside copied state objects

- Impact: Hard-to-debug state mutation side effects over time.
- Evidence: Patterns like modifying objects returned by `find()` inside arrays (`existing.quantity += ...`) after shallow copies.
- Recommendation: Always rebuild modified arrays/items immutably (`map` + spread for target item).

### 4. Medium: Save lifecycle mixes sync + async sources without conflict policy

- Impact: Last-write wins can overwrite newer progress when local and remote saves diverge.
- Evidence: Local save is applied first, then remote may overwrite later; no timestamp conflict merge policy.
- Recommendation: Compare `timestamp` and apply the newer save deterministically.

### 5. Medium: Randomness tightly coupled to action code

- Impact: Difficult to test and rebalance mechanics.
- Evidence: Multiple direct `Math.random()` calls in `travelTo`, `explore`, `attack`, loot drops.
- Recommendation: Inject RNG helper (`rng()`) for deterministic tests and future balancing tools.

### 6. Low: Business events and UI logs are coupled

- Impact: Localization and telemetry become harder to evolve.
- Evidence: Action methods build user-facing strings inline for every event.
- Recommendation: Emit typed combat/game events first; map events to localized text in a presenter layer.

## Positive Notes

- Clear baseline migration handling for save compatibility.
- Good coverage of RPG core loops in one place for initial prototype speed.
- Language support is consistently threaded through actions.

## Suggested Next Refactor Order

1. Extract combat math helpers.
2. Add save conflict policy (timestamp-aware local vs remote).
3. Move quest progression into a dedicated reducer/helper module.
4. Introduce deterministic RNG abstraction.
5. Split store into domain slices.
