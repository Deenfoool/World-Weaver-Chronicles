import { render, screen } from '@testing-library/react';
import FactionJournalPanel from '../../client/src/components/game/FactionJournalPanel';
import { createDefaultWorldEconomy, useGameStore } from '../../client/src/game/store';

test('renders localized delayed consequence kind and origin in journal timeline', () => {
  const eco = createDefaultWorldEconomy();
  eco.pendingConsequences = [
    {
      id: 'cons_ui_1',
      dueTick: eco.tick + 2,
      originQuestId: 'q1',
      originType: 'war',
      triggerHubId: 'town_oakhaven',
      kind: 'retaliation',
      intensity: 60,
      sourceBranch: 'punish',
      contextTag: 'war_side_backlash',
    },
  ];
  useGameStore.setState({
    settings: {
      language: 'ru',
      voice: { lore: false, quests: false, npcDialogue: false },
      tutorial: { enabled: false, completed: true, step: 5, seenHints: [] },
    },
    worldEconomy: eco,
  });
  render(<FactionJournalPanel />);
  expect(screen.getByText(/Ответные меры/)).toBeTruthy();
  expect(screen.getByText(/Война/)).toBeTruthy();
});

