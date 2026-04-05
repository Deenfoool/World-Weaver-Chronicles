import type { SaveData, WorldEconomyEvent, WorldEconomyState } from "@shared/game-types";

type ServerGameAction =
  | { type: "raid_caravan"; hubId: string; currentHubId?: string }
  | { type: "invest_hub"; hubId: string; goldAmount: number }
  | { type: "run_diplomacy"; hubId: string; currentHubId?: string }
  | { type: "sabotage_hub"; hubId: string };

const ECONOMY_BALANCE = {
  playerActions: {
    raid: {
      supply: -6,
      demand: 5,
      stability: -5,
      relation: -8,
      wealth: -20,
      turnover: -12,
      routeFlow: -10,
      routeRisk: 12,
    },
    diplomacy: {
      stability: 3,
      relation: 6,
      relationLinkDelta: 12,
    },
    sabotage: {
      wealth: -60,
      stability: -9,
      supply: -6,
      demand: 6,
      relation: -12,
      turnover: -15,
    },
  },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDayPeriod(hour: number): "morning" | "day" | "evening" | "night" {
  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "day";
  if (hour >= 18 && hour <= 21) return "evening";
  return "night";
}

function updateHubEconomy(
  worldEconomy: WorldEconomyState,
  hubId: string,
  delta: Partial<Pick<WorldEconomyState["hubs"][string], "wealth" | "supply" | "demand" | "stability" | "playerRelation" | "treasury" | "tradeTurnover">>,
): WorldEconomyState {
  const hub = worldEconomy.hubs[hubId];
  if (!hub) return worldEconomy;
  const nextHub = {
    ...hub,
    wealth: clamp(hub.wealth + (delta.wealth || 0), 0, 5000),
    supply: clamp(hub.supply + (delta.supply || 0), 0, 100),
    demand: clamp(hub.demand + (delta.demand || 0), 0, 100),
    stability: clamp(hub.stability + (delta.stability || 0), 0, 100),
    playerRelation: clamp(hub.playerRelation + (delta.playerRelation || 0), -100, 100),
    treasury: clamp(hub.treasury + (delta.treasury || 0), 0, 500000),
    tradeTurnover: clamp(hub.tradeTurnover + (delta.tradeTurnover || 0), 0, 500000),
  };
  return {
    ...worldEconomy,
    hubs: {
      ...worldEconomy.hubs,
      [hubId]: nextHub,
    },
  };
}

function makeRelationKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function updateHubRelation(worldEconomy: WorldEconomyState, hubAId: string, hubBId: string, delta: number): WorldEconomyState {
  if (!hubAId || !hubBId || hubAId === hubBId) return worldEconomy;
  const key = makeRelationKey(hubAId, hubBId);
  const current = worldEconomy.hubRelations[key] || {
    hubAId,
    hubBId,
    status: "neutral" as const,
    strength: 0,
  };
  const strength = clamp(current.strength + delta, -100, 100);
  const status = strength >= 30 ? "allied" : strength <= -30 ? "conflict" : "neutral";
  return {
    ...worldEconomy,
    hubRelations: {
      ...worldEconomy.hubRelations,
      [key]: {
        hubAId,
        hubBId,
        status,
        strength,
      },
    },
  };
}

function appendEconomyEvent(
  worldEconomy: WorldEconomyState,
  event: Omit<WorldEconomyEvent, "id" | "tick">,
): WorldEconomyState {
  const fullEvent: WorldEconomyEvent = {
    ...event,
    id: `srv_evt_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    tick: worldEconomy.tick,
  };
  return {
    ...worldEconomy,
    events: [...(worldEconomy.events || []), fullEvent].slice(-24),
  };
}

export function applyServerGameAction(save: SaveData, action: ServerGameAction): SaveData {
  const worldEconomy = save.worldEconomy;
  const player = save.player;
  if (!worldEconomy || !player) return save;

  const hour = save.gameTime?.hour ?? 12;
  const dayPeriod = getDayPeriod(hour);
  let nextWorldEconomy = worldEconomy;
  let nextPlayer = { ...player };

  if (action.type === "raid_caravan") {
    if (!nextWorldEconomy.hubs[action.hubId]) return save;
    const nightMultiplier = dayPeriod === "night" ? 1.2 : 1;
    nextWorldEconomy = updateHubEconomy(nextWorldEconomy, action.hubId, {
      supply: Math.floor(ECONOMY_BALANCE.playerActions.raid.supply * nightMultiplier),
      demand: Math.floor(ECONOMY_BALANCE.playerActions.raid.demand * nightMultiplier),
      stability: Math.floor(ECONOMY_BALANCE.playerActions.raid.stability * nightMultiplier),
      playerRelation: Math.floor(ECONOMY_BALANCE.playerActions.raid.relation * nightMultiplier),
      wealth: Math.floor(ECONOMY_BALANCE.playerActions.raid.wealth * nightMultiplier),
      tradeTurnover: Math.floor(ECONOMY_BALANCE.playerActions.raid.turnover * nightMultiplier),
    });
    if (action.currentHubId && nextWorldEconomy.hubs[action.currentHubId] && action.currentHubId !== action.hubId) {
      nextWorldEconomy = updateHubRelation(nextWorldEconomy, action.currentHubId, action.hubId, -10);
    }
    nextWorldEconomy = {
      ...nextWorldEconomy,
      tradeRoutes: Object.entries(nextWorldEconomy.tradeRoutes || {}).reduce<WorldEconomyState["tradeRoutes"]>((acc, [routeId, route]) => {
        if (route.fromHubId === action.hubId || route.toHubId === action.hubId) {
          acc[routeId] = {
            ...route,
            flow: clamp(route.flow + ECONOMY_BALANCE.playerActions.raid.routeFlow, 0, 100),
            risk: clamp(route.risk + ECONOMY_BALANCE.playerActions.raid.routeRisk, 0, 100),
          };
        } else {
          acc[routeId] = route;
        }
        return acc;
      }, {}),
    };
    nextWorldEconomy = appendEconomyEvent(nextWorldEconomy, {
      type: "player_raid",
      hubId: action.hubId,
      targetHubId: action.currentHubId && action.currentHubId !== action.hubId ? action.currentHubId : undefined,
      intensity: clamp(Math.floor(61 * nightMultiplier), 20, 95),
    });
  }

  if (action.type === "invest_hub") {
    const amount = Math.max(0, Math.floor(action.goldAmount));
    if (amount <= 0) return save;
    if (!nextWorldEconomy.hubs[action.hubId]) return save;
    if (nextPlayer.gold < amount) return save;
    nextPlayer.gold -= amount;
    nextWorldEconomy = updateHubEconomy(nextWorldEconomy, action.hubId, {
      wealth: Math.floor(amount * 0.7),
      treasury: amount,
      stability: Math.max(1, Math.floor(amount / 35)),
      playerRelation: Math.max(1, Math.floor(amount / 45)),
      tradeTurnover: Math.max(1, Math.floor(amount / 25)),
    });
    nextWorldEconomy = appendEconomyEvent(nextWorldEconomy, {
      type: "player_investment",
      hubId: action.hubId,
      intensity: clamp(Math.floor(amount / 8), 8, 90),
    });
  }

  if (action.type === "run_diplomacy") {
    if (!nextWorldEconomy.hubs[action.hubId]) return save;
    const morningBonus = dayPeriod === "morning" ? 2 : 0;
    nextWorldEconomy = updateHubEconomy(nextWorldEconomy, action.hubId, {
      stability: ECONOMY_BALANCE.playerActions.diplomacy.stability,
      playerRelation: ECONOMY_BALANCE.playerActions.diplomacy.relation + morningBonus,
    });
    if (action.currentHubId && nextWorldEconomy.hubs[action.currentHubId] && action.currentHubId !== action.hubId) {
      nextWorldEconomy = updateHubRelation(nextWorldEconomy, action.currentHubId, action.hubId, ECONOMY_BALANCE.playerActions.diplomacy.relationLinkDelta);
    }
    nextWorldEconomy = appendEconomyEvent(nextWorldEconomy, {
      type: "player_diplomacy",
      hubId: action.hubId,
      targetHubId: action.currentHubId && action.currentHubId !== action.hubId ? action.currentHubId : undefined,
      intensity: 42,
    });
  }

  if (action.type === "sabotage_hub") {
    if (!nextWorldEconomy.hubs[action.hubId]) return save;
    const nightMultiplier = dayPeriod === "night" ? 1.18 : 1;
    nextWorldEconomy = updateHubEconomy(nextWorldEconomy, action.hubId, {
      wealth: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.wealth * nightMultiplier),
      stability: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.stability * nightMultiplier),
      supply: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.supply * nightMultiplier),
      demand: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.demand * nightMultiplier),
      playerRelation: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.relation * nightMultiplier),
      tradeTurnover: Math.floor(ECONOMY_BALANCE.playerActions.sabotage.turnover * nightMultiplier),
    });
    nextWorldEconomy = appendEconomyEvent(nextWorldEconomy, {
      type: "player_sabotage",
      hubId: action.hubId,
      intensity: clamp(Math.floor(74 * nightMultiplier), 24, 98),
    });
  }

  return {
    ...save,
    player: nextPlayer,
    worldEconomy: nextWorldEconomy,
    timestamp: Date.now(),
  };
}
