# PROJECT MEMORY - World Weaver Chronicles

Last updated: 2026-04-03 (Europe/Moscow)
Repository: https://github.com/Deenfoool/World-Weaver-Chronicles
Branch: main

## 1) Current Product Direction
- Tone: dark fantasy RPG, lore-heavy narrative, immersive UI (especially mobile-first feel).
- Priority: stronger atmosphere, richer onboarding/prologue, better mobile UX, deeper world simulation (factions/hubs/economy), scalable content pipeline (images/audio/voice).

## 2) Major Implemented Changes (Already in main)

### 2.1 Skills / Combat Progression
- Skill tree UI heavily redesigned to a stylized constellation/radial look.
- Added filters and clearer skill presentation.
- Added explicit display blocks for learned combat actives and passives.

### 2.2 Quests and NPC flow
- Active quests at game start are now empty.
- Quests are taken from NPC dialogue options.
- Quest turn-in is tied to giver/turn-in NPC and works via NPC panel.

### 2.3 Character Creation / Intro
- Added lore intro flow for new players (multi-screen narrative).
- Character creation replaced with question-based RPG background choices.
- Choices affect class/stat bonuses (parents/upbringing/path/oath).
- Texts were rewritten to be lore-driven instead of dry stat lines.
- Added biography summary before final confirmation.

### 2.4 UI / Navigation Structure
- Character panel redesigned with RPG-like sections and improved visual hierarchy.
- Added Bestiary tab (items/locations/NPCs/enemies + search).
- Inventory now has internal section switch: Inventory / Crafting.

### 2.5 NPC Visual Buttons and Dialogue Art
- NPC action buttons now use stylized card look with role/accent visual metadata.
- Created folder for mini images:
  - client/public/images/npcs/mini
- Mini file convention in use:
  - {npc_id}_mini.png (user provided 200x600 ratio)
- In location actions list: buttons use mini art as background.
- In opened NPC dialog panel: full image is loaded from
  - /images/npcs/{npc_id}.png
  with fallback to mini image and then location background.

### 2.6 Location Screen Mobile UX (Important)
- Reworked from static 2-column desktop-ish layout to mobile-first bottom sheet style.
- Implemented:
  - tabbed sheet (Actions / Travel)
  - horizontal snap carousels for NPC and travel cards
  - page indicators (dots)
  - staged card appearance (stagger-like)
  - hover edge "spark" effect on cards
  - compact/peek/open sheet behavior
  - touch drag handling for sheet state transitions
  - narrow mobile sizing tuning for 360-430 px
- Compact mode also has quick actions over background (not passive hidden mode).

### 2.7 Combat Bug Fix
- Fixed enemy AI healing behavior:
  - wolves/non-alchemist enemies no longer use potion-heal logic.
  - Heal branch restricted to alchemist role with low HP condition.

## 3) Content / Assets Pipelines Implemented

### 3.1 Image prompt pipeline
- Generated structured prompt pack and folders for:
  - locations
  - npcs
  - mobs
- Path:
  - assets/generated-images/
- Includes prompt index and per-entity prompt markdown files.

### 3.2 Audio SFX/BGM pipeline
- Created audio folder structure:
  - assets/audio/{ui,ambience,dialogue,combat/player,combat/enemy,skills,items,crafting,economy,weather,music}
- Created:
  - assets/audio/audio_manifest.json
- Manifest contains expected file keys, paths, loop flags, recommended volume.
- Current status observed in session:
  - ui: complete
  - economy: complete
  - weather: user said complete 5/5

### 3.3 Voice-over pipeline
- Added voice folders and script sources:
  - assets/audio/voice/lore/lore_voice_lines.txt
  - assets/audio/voice/quests/quest_voice_lines.txt
  - assets/audio/voice/npc_dialogues/npc_dialogue_lines.txt
  - assets/audio/voice/voice_manifest.json
  - assets/audio/voice/README.md
- Generated line IDs and recording guidance for per-line OGG exports.

## 4) Settings / Data Model Changes

### 4.1 Voice toggles added in Settings UI
- Added separate toggles:
  - lore voice
  - quest voice
  - npc dialogue voice
- UI path:
  - client/src/components/game/SettingsPanel.tsx

### 4.2 Store + types updated
- Settings model extended in shared types:
  - GameSettings with language + voice channels
- Store now includes:
  - setVoiceSetting(channel, enabled)
- Save/load normalizes settings with defaults.

Files touched for this:
- shared/game-types.ts
- client/src/game/store.ts
- client/src/game/translations.ts
- client/src/components/game/SettingsPanel.tsx

## 5) Planning / Backlog Files
- ui_next_steps.txt exists and was updated with:
  - prior UI proposals
  - world simulation/social depth ideas
  - explicit Roadmap split by MVP / Mid / Late
  - includes:
    - living world time cycle
    - rare world events
    - legendary chains
    - derelict hub restoration only
    - bestiary-as-codex + discovery gating
    - expanded economy loop (contracts/auctions/contraband/black market)

## 6) Git / Repo Status
- This project was initialized as git in local workspace.
- Initial snapshot committed.
- Remote added and push completed to:
  - origin/main -> https://github.com/Deenfoool/World-Weaver-Chronicles.git

## 7) User Confirmed/Requested Future Direction (Do Not Lose)
1. Language switch directly in prologue.
2. During prologue, preload full game assets (images/music/data).
3. If user skips/finishes fast, show loading screen with progress bar + lore tips; then "press to continue".
4. First-time user tutorial with guided popups across key screens.
5. After character build summary, ask for hero name input before final continue.
6. Expand hubs/factions/communities; relation graph between them and relation to player.
7. Expand locations with branches and locked access by level/quest.
8. Living economy tied to hub relations, deficits/surpluses, dynamic prices.
9. Hub growth/decline levels, wealth metrics, thresholds, spawn new hubs at max level, possible hub collapse.
10. Bestiary entries should unlock only after interaction.
11. Add lore voiceover support and granular voice toggles (implemented at setting level, playback integration pending).

## 8) What Is NOT Fully Implemented Yet (High Priority Pending)
- Economy/hub simulation system (levels, wealth thresholds, relation-driven market model).
- Voice playback integration respecting toggles (files/pipeline are prepared, runtime playback orchestration pending).

### Newly completed on 2026-04-02
- Prologue preload/loading pipeline is now implemented:
  - Background preload starts during intro for location/NPC images and core data.
  - Optional audio manifest warmup is attempted without hard-fail if files are absent.
  - If user skips or reaches intro end before preload completes, a dedicated loading screen appears.
  - Loading screen includes progress bar, rotating lore/combat tips, and explicit "press to continue" gate after 100%.
- Hero name step before first gameplay start is now implemented:
  - Biography finalization now includes explicit hero name input.
  - Validation: 2-24 chars, letters/digits/space/apostrophe/hyphen.
  - Create Character button is gated until name is valid.
  - Validated hero name is passed into class creation and persisted in player profile.
- First-time tutorial state + guided hints are now implemented:
  - Persisted tutorial settings added to save model (`enabled/completed/step/seenHints`).
  - Store actions added: toggle tutorial, advance step, skip, reset, mark hint seen.
  - Guided overlay implemented in main gameplay with 5-step flow:
    1) welcome
    2) world/travel
    3) combat basics
    4) inventory
    5) quests
  - Overlay progression supports Next, Skip Step, Skip Tutorial.
  - Tutorial controls added to Settings panel (enable/disable + restart).
- Codex unlock-state persistence + event hooks are now implemented:
  - Added `codexUnlocks` to shared save model (`items/locations/npcs/enemies`).
  - Added store-level codex unlock flow with persistent save/load support.
  - Added gameplay hooks:
    - exploration/travel unlock visited locations
    - enemy encounters/combat unlock enemy entries
    - loot/reward drops unlock item entries
    - NPC dialogue interactions unlock NPC entries
  - Bestiary now supports discovery gating (unknown entries stay hidden until unlocked) with per-tab progress counters.
  - API save payload schema was expanded/passthrough-safe so remote save keeps codex, tutorial, and voice fields.
- Economy core v1 for hubs is now implemented (4-point batch):
  - Added persistent `worldEconomy` save model with per-hub metrics:
    - wealth, level, supply, demand, stability, playerRelation, tick.
  - Added economy simulation ticks tied to world flow:
    - updates run during travel and exploration.
    - supports level growth/decline via wealth thresholds.
  - Integrated market state into merchant pricing:
    - buy/sell prices now factor in scarcity (supply/demand), hub level, stability, and player relation.
  - Added player-action market impact hooks:
    - buying/selling changes hub supply/demand/wealth.
    - quest turn-in in hub improves local economy/relation.
    - minimal hub economy readout is displayed on hub location screen.
- Economy network v2 groundwork is now implemented:
  - `worldEconomy` now includes `tradeRoutes` (id, fromHubId, toHubId, distance, flow, risk).
  - Added route graph builder based on map connectivity (shortest-path distance between hubs).
  - Economy simulation tick now updates both hubs and trade routes.
  - Route pressure now contributes to inter-hub supply/wealth balancing.
  - Hub UI readout now includes route count, preparing for multi-hub expansion.
- Economy events layer v2 is now implemented:
  - Hub economy now tracks market modes:
    - `stable`, `scarcity`, `surplus`, `black_market`.
  - Added black market windows with tick-based duration (`blackMarketUntilTick`) triggered by risk/weather instability.
  - Buy/sell formulas now include market mode multipliers.
  - Hub UI readout now shows current market mode for live feedback.
- Hub expansion trigger (`level 5 -> new hub`) is now implemented:
  - Economy state now persists `spawnedHubIds`.
  - Added runtime hub blueprint system with safe map injection:
    - when an existing hub reaches level 5, next blueprint hub is created and connected to map roads.
    - merchant for spawned hub is injected and available immediately.
  - Economy simulation now rebuilds trade routes after hub spawn.
  - Spawn event is surfaced through travel/explore flow messaging.
  - Current first expansion blueprint:
    - `hub_emberwatch` (connected to `road_south`, with `merchant_emberwatch`).
- Hub system alignment with design spec is now in progress (implemented foundation):
  - Hub type taxonomy added:
    - `faction`, `alliance`, `community`.
  - Hub economy model expanded with:
    - treasury, resources, tradeTurnover,
    - level up/down streaks,
    - degradation streak and `destroyed` state.
  - Level transition rules now use streaks:
    - upgrade requires 3 consecutive ticks above threshold,
    - downgrade requires 2 consecutive ticks below threshold.
  - Destruction rules now active:
    - critically low wealth over sustained degradation destroys a hub.
    - destruction affects pricing and state visibility.
  - Inter-hub relation model added:
    - `allied / neutral / conflict` + relation strength,
    - alliance/conflict now affect stability and market pressure over ticks.
  - Player influence actions added in store (logic-level API):
    - caravan raid,
    - investments,
    - diplomacy,
    - sabotage.
  - Runtime/remote save schema updated for all new fields.

## 9) Suggested Next Execution Plan (Immediate)
1. Add economy-driven world events (deficit contracts, scarcity alerts, black market windows).
2. Introduce at least one additional hub and merchant to activate live inter-hub routing gameplay.

## 10) File Landmarks (Quick Re-entry)
- Main gameplay layout:
  - client/src/components/game/GameLayout.tsx
- Location scene / sheet / npc cards:
  - client/src/components/game/LocationScreen.tsx
- NPC dialog panel (full art behavior):
  - client/src/components/game/NPCPanel.tsx
- Settings UI:
  - client/src/components/game/SettingsPanel.tsx
- Core state/store:
  - client/src/game/store.ts
- Shared data model:
  - shared/game-types.ts
- Static content database:
  - shared/game-content.ts

## 11) Newly completed on 2026-04-03 (Content Expansion Batch)
- Expanded content pools in `shared/game-content.ts`:
  - Added new resources/materials, combat consumables, weapons, armor.
  - Added new enemy set including higher-tier road/hub threats and a new boss.
  - Added multiple new NPC quests (collect/kill hybrid mix) for new hubs.
- Added 3 new major hubs (design taxonomy-aligned):
  - `hub_ironhold` (faction flavor),
  - `hub_sky_consort` (alliance flavor),
  - `hub_mire_union` (community flavor),
  plus connector roads and map links.
- Added dedicated NPC casts for each new hub:
  - Ironhold: `npc_marshal_thorne`, `npc_quartermaster_ilda`, `npc_smith_varr`
  - Sky Concord: `npc_envoy_sera`, `npc_apothecary_nox`, `npc_factor_brom`
  - Mire Union: `npc_warden_rook`, `npc_herbalist_vesk`, `npc_tinker_juno`
- Implemented category-based trade per NPC profession:
  - Added merchant records for each NPC (`merchant_<npc_suffix>`),
  - inventories are role-specific (alchemy, smithing, military supply, logistics, herbs, etc.).
- NPC commerce integration in UI:
  - `shared/game-types.ts`: dialogue action now supports `open_merchant`.
  - `client/src/components/game/NPCPanel.tsx`:
    - supports `open_merchant` dialogue action;
    - auto-detects NPC merchant by ID pattern and shows `Open Shop / Открыть лавку` button;
    - opens existing `MerchantPanel` directly from NPC dialog.
- Added UI role metadata for new NPC cards in `client/src/components/game/LocationScreen.tsx`.
- Validation status:
  - `npm run check`: passed,
  - `npm test`: passed (unit + UI).

## 11) Canonical Design Spec Snapshot (User-Provided, Keep Intact)

### 11.1 Hub System (Section 5)
Definition:
- A hub is an economic-social unit (faction, alliance, community).

Hub types:
- `faction` - major power influencing the global world.
- `alliance` - union of several hubs.
- `community` - local group (example: blacksmith communities).

Hub parameters:
- development level
- wealth indicator
- resources and goods
- links with other hubs
- relation to player

Hub levels:
- Level 1, "Seedling": survival stage, 1-2 quests, basic resources.
- Level 2, "Craft Hearth": craft development, 2-3 quests, resources, recipes.
- Level 3, "Developed Settlement": starter mature stage, 4-6 quests, resources, recipes, items.
- Level 4, "Production Center": advanced economy, expanded assortment.
- Level 5, "Guild / Consortium": dominant hub, unique items and quests.

Level up rules:
- wealth above threshold
- sustained for 3 turns in a row

Level down rules:
- wealth below threshold
- sustained for 2 turns in a row

Hub destruction:
- critically low wealth
- sustained degradation over time
- even a starter hub can disappear

Expansion:
- when a hub reaches level 5:
  - a new hub is created at level 1
  - new quests, items, and recipes are unlocked

### 11.2 Economy (Section 6)
Foundations:
- hub economy includes treasury, resources, goods, trade turnover.

Resource states:
- deficit
- balance
- surplus

Inter-hub relation impact:
- alliance -> stability, lower prices
- conflict -> deficit pressure, higher prices
- chain reactions between hubs are possible

World events that affect economy:
- wars
- caravan attacks
- crises
- player actions

### 11.3 Player Influence (Section 7)
Caravan destruction:
- causes deficits
- worsens relations
- destabilizes economy

Investments:
- increase wealth
- speed up development
- improve relation

Diplomacy:
- improves links
- reduces prices
- stabilizes economy

Sabotage:
- damages production
- lowers hub level
- can trigger crisis

## 12) Recent Integration Status (2026-04-02)
- Player influence actions are now wired into hub UI controls (not store-only):
  - `Invest`, `Diplomacy`, `Raid`, `Sabotage` buttons added in Location screen hub controls.
  - Actions trigger corresponding store API and show immediate result feedback.
  - Target hub selection + quick economy stats are shown in the same panel.
- Economy events layer expanded to gameplay-visible state:
  - `worldEconomy.events` journal added and persisted in save model.
  - Simulation ticks now generate world events (`war`, `caravan_attack`, `crisis`, `prosperity`, `black_market_opened`, `hub_destroyed`).
  - Hub expansion now writes an explicit `hub_founded` event.
  - Player hub actions now write explicit event entries (`player_investment`, `player_diplomacy`, `player_raid`, `player_sabotage`).
  - Location hub UI now shows a localized "Economic Events" feed (latest events related to current hub).
- Economy notifications in GameLayout:
  - Added floating notification stack for important economy events in `GameLayout`.
  - Notifications are generated from new unseen `worldEconomy.events` entries and auto-expire.
  - Covered event classes: founded/destroyed hub, war, crisis, caravan attacks, black market windows, prosperity.
  - Localized RU/EN event text and severity tone (`good` / `bad` / `neutral`) implemented.

## 13) Event Quest Design (Detailed, Pending Implementation)

### 13.1 Goal
- Convert major economy events into player-facing contracts where player intentionally chooses moral-economic direction:
  - reward/stabilize a hub
  - punish/weaken a hub
- Choice must be explicit and reversible only through later gameplay consequences (not instant undo).

### 13.2 Core quest archetypes
- `crisis_contract`:
  - trigger: `crisis` or deep `scarcity`
  - stabilize path: deliver supplies / escort aid caravans
  - punish path: intercept aid / spread panic sabotage
- `caravan_escort`:
  - trigger: `caravan_attack`, route risk spike
  - stabilize path: escort and secure route
  - punish path: raid or misdirect convoy
- `recovery_mission`:
  - trigger: post-war/post-destruction recovery window
  - stabilize path: rebuild production nodes
  - punish path: sabotage reconstruction

### 13.3 Choice UX contract
- Each event quest starts with a mandatory branch choice screen:
  - Branch A: `Support / Reward Hub`
  - Branch B: `Punish / Destabilize Hub`
- UI must show preview before confirmation:
  - expected relation impact
  - expected wealth/stability direction
  - risk/reward profile
- After confirmation, branch is locked for this quest instance.

### 13.4 Data model extension (planned)
- Add event-quest metadata:
  - `eventQuestId`
  - `originEventId`
  - `targetHubId`
  - `branch`: `support` | `punish` | `unselected`
  - `state`: `offered` | `accepted` | `resolved` | `failed` | `expired`
  - `expiresAtTick`
  - `impactProfile` (economy/relation deltas)
- Quest goals remain standard (`collect`/`kill`/`explore`) but branch defines goal variants and reward tables.

### 13.5 Consequence model
- Support branch typical outcome:
  - target hub: +wealth, +stability, +playerRelation
  - allied routes: lower risk, better flow
  - prices: tendency toward normalization/discount
- Punish branch typical outcome:
  - target hub: -wealth, -stability, -playerRelation
  - nearby routes: risk growth, chain deficits
  - prices: tendency toward inflation/scarcity
- Secondary consequences:
  - opposing factions may open retaliation quests later
  - repeated punishment can push hub toward downgrade/destruction

### 13.6 Safeguards and balance rules
- No hard lock by one choice:
  - support and punish both have valid gameplay rewards, but different world-state side effects.
- Anti-snowball caps:
  - per-tick and per-quest clamp on economy delta
  - diminishing returns on repeated same-branch actions against same hub
- Fair warning:
  - explicit warning in branch UI if choice can cause downgrade/destruction risk.

### 13.7 Implementation phases (recommended)
1. Introduce event-quest generation pipeline (from `worldEconomy.events` -> quest offers).
2. Add branch selection UI and persist branch choice.
3. Add branch-specific objective templates and completion handlers.
4. Add economy consequence applicator with clamps and relation propagation.
5. Add telemetry/readout panel for "why prices changed" based on resolved branch quests.

### 13.8 Implemented now (Phase 1 + Branch-gate UX)
- Event quest offers are now generated automatically from `worldEconomy.events` during world ticks (travel/explore flow).
- Generated event quests start in `offerState: offered` and do not progress until accepted.
- Added explicit branch gate before acceptance:
  - player must pick `support` or `punish`,
  - only then `Accept contract` becomes meaningful (quest moves to active state).
- Event quest resolution path is now available in quest UI:
  - when objectives are complete, player resolves the event quest directly from Quests panel (no NPC gate required).
- Branch consequences are now applied on resolution:
  - `support` stabilizes and rewards target hub,
  - `punish` destabilizes and penalizes target hub.

### 13.9 Expanded Event Quest Logic (War/Caravan Deepening)
- War event quests now support 3-way political choice:
  - support side A,
  - support side B,
  - stay neutral.
- War consequences on resolve:
  - support A: `+rep` with A, `-rep` with B.
  - support B: `+rep` with B, `-rep` with A.
  - neutral: small `-rep` with both sides.
- War objective templates now use mixed chains (combat + travel/report/resource proof), not single-step placeholder tasks.

- Caravan attack event quests now scale battle chain by source hub level:
  - required fights scale from `3` to `6`.
  - support path focuses on route security and evidence.
  - punish path focuses on raid chain and higher plunder-like rewards.
  - added third branch: non-intervention (`leave convoy alone`) with lower reward and neutral-report objective.

- Other event templates expanded with mixed objective sets:
  - crisis: logistics support vs destabilization.
  - prosperity: growth reinforcement vs market sabotage.
  - hub destroyed: reconstruction aid vs opportunistic pressure.

- Event quest model now stores richer branch metadata:
  - side/opponent context for war,
  - source hub level for difficulty scaling.

### 13.10 Follow-through On Next 4 Plan Items (Implemented)
- Real combat chain progression for war/caravan event quests:
  - consecutive battle stages now continue automatically after each victory while chain goals remain.
  - no manual exit/re-enter loop required for each stage.

- Consequence preview before branch confirmation:
  - branch cards now show expected impact (reputation/economy/risk profile) directly in offer UI.
  - war and caravan branches have explicit side-specific forecasts.

- Follow-up quest chain generation:
  - resolving event quests can now spawn branch-aware follow-up contracts (retaliation/audit/fallout style).
  - guard added to avoid infinite recursive follow-up loops.

- Price-change explanation log:
  - Quests panel now includes "Why Prices Changed" section derived from resolved event quests and selected branch outcomes.

### 13.11 Additional Completion Pass (Chain/Fails/Expiry/Relations)
- Combat UI now shows active chain indicator in `CombatScreen`:
  - current chain stage (`N/Total`), target enemy, and explicit warning about flee/defeat penalties.

- Chain failure penalties now implemented on both:
  - successful flee from combat chain,
  - player defeat during combat chain.
  Effects:
  - direct gold penalty,
  - branch quest chain marked failed/expired,
  - negative relation impact on involved hubs.

- Event offer expiration now active:
  - event quest offers include `expiresAtTick`,
  - stale offered quests auto-switch to `expired` during world updates,
  - expired offers are hidden from the "Economic Offers" acceptance list.

- Quests UI now includes war-side relation card:
  - side A / side B relation-to-player readout,
  - inter-side relation status/strength snapshot from `hubRelations`.

### 13.12 Full Completion Pass (No Return Required)
- Event quest objective model expanded with explicit objective types:
  - `deliver` (dispatch/report delivery to target hub),
  - `donate` (direct treasury funding objective in gold).
- Added dedicated gameplay action for treasury objectives:
  - store API `contributeToQuestTreasury(questId, amount)` now spends player gold, progresses `donate` goal, and updates hub treasury/wealth/stability/relation.
  - Quests UI now includes direct donation buttons (`25`, `50`, `max`) on active quests with treasury goals.

- War event branches now use mixed mission chains exactly as requested:
  - combat chain,
  - dispatch delivery objective,
  - treasury support objective for chosen side.
  - neutral branch implemented as two-sided non-intervention notice delivery.

- Caravan branch logic now fully supports attack/escort/ignore:
  - attack and escort paths keep scaled `3-6` chained fights by hub level source,
  - escort path includes actual destination delivery objective,
  - ignore path uses non-intervention route report delivery.

- Crisis/prosperity/destroyed/founded/black-market event templates were deepened:
  - each now uses mixed objective sets (combat + delivery + collection + treasury funding where relevant),
  - no more flat/generic one-step event templates for these categories.

- Event-offer generation now also includes `hub_founded` events:
  - founded-hub contracts are generated and branchable like other economy events.

- Follow-up chain generation expanded beyond war/caravan:
  - added follow-up offers for crisis, prosperity, black market, and settlement states (founded/destroyed),
  - existing anti-recursion guard preserved.

- Anti-bypass enforcement for combat chains is now stricter:
  - leaving the active chain route before completion triggers immediate chain failure (`abandon`) with penalties and quest expiration.
  - camp/rest/break-camp actions are blocked while a local combat chain is active.
  - explore action now force-starts the pending chain stage enemy instead of allowing random bypass flow.

- Delivery progression integrated into travel:
  - `deliver` goals now auto-progress when player reaches target location.

### 13.13 Contract Acceptance Screen + Real Escort Route (Requested 1+2)
- Implemented dedicated contract acceptance modal in Quests UI:
  - Offers now open through "Open contract board" before branch selection.
  - Modal includes per-branch consequence forecast (reputation, market pressure, risk profile).
  - Branch selection is made in modal; after selection player confirms via `Accept contract`.

- Caravan escort upgraded from abstract chain to route gameplay:
  - On branch `support`, escort contract now builds an explicit route between hubs (origin -> waypoints -> target).
  - Route progress is tracked in quest metadata (`currentLeg`, route nodes, ambush points, perfect-run flag).
  - Ambushes trigger on route travel points and force convoy combat interception.
  - Active quest panel now shows route stage progress, ambush progress, and perfect-run status.
  - Escort chain supports bonus reward on turn-in when perfect run is preserved.

- Combat-chain + escort integration hardening:
  - Chain detection now recognizes caravan escort route locations (not just static quest location id).
  - Chain abandonment rules allow valid movement along escort route but penalize route exit.
  - Combat chain indicator now also works on escort route nodes.

### 13.14 Delayed Consequences + Reputation Journal (Requested 3+4)
- Implemented delayed world consequences system:
  - `worldEconomy.pendingConsequences` queue added to save/state model.
  - Event-quest resolution now schedules follow-up effects in `+1..+3` ticks.
  - Supported delayed consequence kinds:
    - `retaliation`
    - `aid_arrival`
    - `tariff_relief`
    - `smuggler_crackdown`
  - `simulateWorldEconomyTick` now resolves due consequences automatically and applies economy/relation changes.
  - Consequence outcomes are surfaced as economy events and visible in notifications.

- Extended economy event types for delayed aftermath visibility:
  - `retaliation`, `aid_arrival`, `tariff_relief`.

- Added persistent faction reputation history:
  - `worldEconomy.reputationLog` added to save/state model.
  - Reputation changes now log reason/source/hub/tick metadata.
  - Sources currently logged:
    - event-quest resolution branch impact,
    - delayed consequence impact,
    - direct player actions (`invest`, `diplomacy`, `raid`, `sabotage`).

- Added dedicated Reputation Journal UI:
  - New panel: `client/src/components/game/FactionJournalPanel.tsx`.
  - Integrated as new tab in desktop and mobile navigation.
  - Includes:
    - threshold table (hostile -> trusted ally) with gameplay effects,
    - current standings per hub (relation score + tier),
    - chronological reputation change history with reasons.

### 13.15 Debt Closure Pass (All Remaining Items From Last Review)
- Added automated tests and test runner:
  - package script: `npm test` (`tsx --test tests/**/*.test.ts`).
  - new tests:
    - `tests/economy.delayed-consequences.test.ts` (economy delayed effects),
    - `tests/quest.chain-rules.test.ts` (escort/chain travel rules),
    - `tests/save.migration.test.ts` (save migration/versioning).
  - Verified: all tests pass.

- Balance constants extracted into dedicated config:
  - file: `client/src/game/economy-balance.ts`.
  - store now consumes config for key resolution and player-action economy deltas
    (support/punish, raid/diplomacy/sabotage, route pressure knobs).

- Reputation reason localization upgraded:
  - reputation entries now support `reasonKey` in data model.
  - `FactionJournalPanel` localizes reason text from keys for RU/EN.
  - fallback to raw reason remains for backward compatibility.

- Delayed consequences timeline added in UI:
  - Reputation Journal now includes "Delayed Consequences Timeline" with due tick, kind, and intensity.

- Market analytics view added:
  - Reputation Journal now includes "Hub Market Analytics":
    - market mode per hub,
    - demand/supply spread,
    - buy/sell pressure hints.

- Save versioning and migration strategy implemented:
  - `SaveData.saveVersion` added.
  - current version constant in store: `SAVE_VERSION = 2`.
  - migration hook `migrateSaveData()` normalizes legacy saves and upgrades structure safely.

- Runtime voice playback integrated (channel-aware):
  - new utility: `client/src/game/voice.ts` using browser SpeechSynthesis fallback runtime.
  - NPC dialogue voice playback in `NPCPanel` (respects `voice.npcDialogue`).
  - quest-contract voice notifications in `QuestsPanel` (respects `voice.quests`).
  - intro lore narration playback in `GameLayout` (respects `voice.lore`).
  - Existing voice toggles from settings now control real runtime narration behavior.

### 13.16 Quality Fix Pass (Logic/UX Consistency)
- Fixed relation-status regression in retaliation processing:
  - relation status now always recalculates from resulting strength (`allied/neutral/conflict`) instead of staying stale.

- Fixed voice toggle runtime behavior:
  - disabling any voice channel now immediately stops active speech playback (no lingering utterance).

- Refined reputation threshold texts to match real formulas:
  - journal now describes effect tiers using current relation coefficients from pricing/economy logic instead of generic promises.

- Localized delayed consequence kinds in timeline:
  - replaced raw technical keys with player-facing RU/EN labels.

### 13.17 Context-Aware Consequences + Test Expansion
- Delayed consequence system now includes deeper narrative context:
  - pending consequence entries store `originType` and optional `contextTag`.
  - consequence resolver scales impact by origin context (`war`, `caravan_attack`, `crisis`, `prosperity`, etc.), so retaliation/aid/tariff effects are no longer flat templates.
  - timeline now shows localized consequence origin source.

- Expanded automated test coverage beyond baseline:
  - Added context-strength test for delayed consequences.
  - Added branch-card generation tests for event-quest UI branching.
  - Added localization tests for journal reason/kind/origin labels.
  - Added voice runtime behavior test (disabled channel + stop behavior).
  - Added follow-up chain depth guard test (no recursive infinite chain).
  - Current test summary: 11/11 passing.

### 13.18 Consistency + UX + UI-Flow Test Pass (Latest)
- Escort route ambush generation was hardened against repeated single-point fallback:
  - `buildEscortRoute` now prefers unique route/neighbor nodes for ambush points and avoids farming one location on short paths.

- Delayed consequence timing is now context-dependent (not one-size-fits-all):
  - Added `resolveConsequenceDelay(originType, kind)` with different timing windows for war/caravan/crisis/prosperity/black-market contexts.
  - Consequences are now scheduled with narrative-sensitive due ticks.

- Pending consequence queue now deduplicates/merges near-identical entries:
  - `queueEconomyConsequence` merges same kind/trigger/target/origin/source branch within close tick window.
  - Merged entries keep earliest due tick and combine intensity with clamp, reducing unnatural same-tick stacks.

- Reputation journal copy corrected for formula accuracy:
  - threshold effect text now references wealth drift impact (matching store math), removing misleading stability wording.

- Voice toggle UX refined to channel-level stop behavior:
  - `stopVoicePlayback(channel?)` now cancels only when the active utterance belongs to the disabled channel.
  - Disabling quests voice no longer cuts npc/lore speech.

- Test stack expanded with UI integration flow (Vitest + Testing Library):
  - Added `test:ui` pipeline with `vitest` + `jsdom` setup.
  - Added UI tests for:
    - event contract modal/branch selection flow,
    - faction journal localized timeline labels in DOM,
    - settings voice toggle behavior with real store interactions.
  - Updated scripts so `npm test` runs unit + UI suites.
  - Current summary after this pass: unit `11/11` + UI `3/3` passing.

### 13.19 Time-of-Day Gameplay Effects (Morning/Day/Evening/Night)
- Implemented full time-of-day modifiers in core gameplay loop (`client/src/game/store.ts`):
  - Added period-sensitive encounter/loot deltas:
    - night: higher ambush pressure,
    - morning: lower ambush pressure + better resource discovery,
    - evening: medium ambush growth,
    - day: slight visibility/detection pressure.

- Enemy spawn pools now react to period:
  - morning blocks unnatural-origin enemies where possible,
  - day increases humanoid encounter weight,
  - evening increases twilight enemy weight,
  - night increases non-animal encounter pressure.

- Economy events are now more night-conflict weighted:
  - `rollMajorEconomyEvent` now has explicit night branch with higher war/caravan/crisis odds and lower prosperity odds.
  - Black market chance already period-aware and kept active.

- Combat visibility at night:
  - player damage reduced at night (existing),
  - enemy outgoing damage now also reduced at night for non-animal enemies.

- Trade windows by period:
  - night: trade is unavailable (buy/sell blocked),
  - evening: partial merchant closures per merchant/time hash,
  - morning: extra buy discount,
  - evening: rare-item special pricing behavior.

- Selling economy by period:
  - day grants better sale prices for material/common resource flow (`item.type === "material"`).

- Reputation progression by period:
  - morning gives a small bonus to diplomacy outcomes,
  - morning gives slight bonus to quest turn-in rewards/reputation effects.

- Contraband/hostile actions at night:
  - night scales raid/sabotage economy impact/intensity upward.

- Rest behavior by period:
  - night field rest is less effective (partial HP/energy recovery, lower fatigue reduction),
  - hub/rest-to-morning behavior preserved.

- Validation:
  - `npm run check` passed.
  - `npm test` passed (unit `11/11`, UI `3/3`).

### 13.20 SFX Integration Pass (Manifest + Available Files Only)
- Audited `assets/audio/audio_manifest.json` against actual files on disk.
- Current physical availability:
  - Available now: `ui/*`, `economy/*`, `ambience/*`, `weather/*` listed in manifest.
  - Missing now: most `combat/*`, `dialogue/*`, `items/*`, `skills/*`, `music/*` entries referenced by manifest.

- Added runtime SFX helper:
  - New file: `client/src/game/audio.ts`.
  - Loads manifest once, resolves path/volume, and safely plays by sound ID.
  - Guards playback to currently-available sound IDs to avoid noisy missing-file calls.

- Connected currently-available SFX to gameplay/UI:
  - `travel_whoosh_short` on travel start.
  - `shop_buy` / `shop_sell` for successful merchant transactions.
  - `ui_error_denied` when trade is closed by time-of-day.
  - `ui_reward_claim` + `coin_jingle` on quest turn-in rewards.
  - `ui_tab_switch` when switching mobile/desktop tabs.
  - `ui_panel_open` / `ui_panel_close` and `ui_click_soft` in merchant panel open/close flow.

- Fixed audio preload parsing in `GameLayout`:
  - Preload now correctly reads `manifest.sounds[*].path` (previously parsed wrong top-level shape).

- Validation:
  - `npm run check` passed.
  - `npm test` passed (unit + UI).

### 13.21 Combat Mechanics: Dodge + Stun (Player and Enemy)
- Added dynamic dodge and stun mechanics in combat core (`client/src/game/store.ts`).

- New combat helpers:
  - `getEnemyDodgeChance(...)` — enemy dodge chance from level diff, energy state, role, and block state.
  - `getPlayerDodgeChance(...)` — player dodge chance from defense, level diff, energy/fatigue/overload, weather, and day period.
  - `getPlayerStunChance(...)` — player stun chance by action source (`attack` / `skill` / `throw`) with adrenaline and level scaling.
  - `getEnemyStunChance(...)` — enemy stun chance with role/level scaling and player guard mitigation.
  - `enemyIsImmuneToStatus(...)` — respects phase-based status immunity (including stun immunity on phases).

- Integrated into player actions:
  - Basic attack can now be dodged by enemy.
  - Active/ultimate skill hit can now be dodged by enemy.
  - Thrown combat items can now be dodged by enemy.
  - Successful player hits can apply dynamic stun to enemy (if not immune).

- Integrated into enemy turn:
  - Player can dodge enemy hit before damage resolution.
  - Enemy can apply dynamic stun to player even without native `statusInflict: stunned` entry (native stun stays respected, no duplicate stacking path).

- Balancing notes:
  - Dodge and stun use clamped probabilities to avoid extreme RNG spikes.
  - Blocking reduces player dodge effectiveness during incoming enemy strike resolution.
  - Existing status system (`stunned`) and turn-skip behavior reused; no schema migration needed.

- Validation:
  - `npm run check` passed.
  - `npm test` passed (unit `11/11`, UI `3/3`).

### 13.22 World Map Modal + Fog of War
- Reworked travel entry point into a modal world map flow:
  - Added new component: `client/src/components/game/WorldMapModal.tsx`.
  - Location map button now opens a dedicated modal map instead of relying only on travel cards.

- Implemented "real map" graph view:
  - Shows all current locations from `LOCATIONS`.
  - Draws route links based on `connectedLocations`.
  - Highlights current position.
  - Travel is allowed only to directly connected nodes from current location.

- Implemented fog of war behavior:
  - Undiscovered locations are present on map but hidden with fog overlay and generic labels.
  - Discovered/current locations show full names and state.
  - Supports progressive reveal via existing `player.discoveredLocations` state.

- Integrated into location screen:
  - `client/src/components/game/LocationScreen.tsx` now uses `WorldMapModal`.
  - Mobile travel icon opens modal.
  - Desktop travel button opens modal as "World Map".

- Validation:
  - `npm run check` passed.
  - `npm test` passed (unit + UI).

### 13.23 Economy Notice Lifetime Fix (3s Real-Time)
- Fixed economy notification lifetime logic in `client/src/components/game/GameLayout.tsx`.
- Previous behavior depended on economy ticks, which could cause stacking/stuck notices.
- New behavior uses real-time timestamps per notice:
  - `createdAtMs`
  - `expiresAtMs = createdAtMs + 3000`
- Added timeout-driven cleanup so each notice closes ~3 seconds after appearance regardless of tick cadence.
- Validation:
  - `npm run check` passed.
  - `npm test` passed.
- Bestiary:
  - client/src/components/game/BestiaryPanel.tsx
- Audio manifest:
  - assets/audio/audio_manifest.json
- Voice scripts:
  - assets/audio/voice/*
- Backlog plan:
  - ui_next_steps.txt

## 11) Handoff Prompt Template For New Chat
Use this exact starter in a new chat:
"Read PROJECT_MEMORY.md and continue implementation from section 8, step 1 in section 9. Preserve existing style and mobile-first UX. Update PROJECT_MEMORY.md after each major milestone."
