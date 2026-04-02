export const ECONOMY_BALANCE = {
  questResolution: {
    support: {
      wealth: 40,
      stability: 8,
      relation: 9,
      demand: -3,
      supply: 4,
    },
    punish: {
      wealth: -48,
      stability: -10,
      relation: -10,
      demand: 4,
      supply: -4,
    },
    neutralRelationPenalty: -3,
    sideRelationPenalty: -8,
  },
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

