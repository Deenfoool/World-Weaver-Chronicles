import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestsPanel from '../../client/src/components/game/QuestsPanel';
import { useGameStore } from '../../client/src/game/store';
import { Quest } from '../../client/src/game/types';

function makeOfferedWarQuest(): Quest {
  return {
    id: 'event_quest_ui_war',
    name: { en: 'Warfront Response: Oakhaven', ru: 'Ответ на фронт войны: Окхейвен' },
    description: { en: 'Choose your branch', ru: 'Выберите ветку' },
    locationId: 'town_oakhaven',
    goals: [],
    rewards: { xp: 0, gold: 0 },
    isCompleted: false,
    offerState: 'offered',
    isEventQuest: true,
    sourceEventId: 'war_ui_1',
    eventQuest: {
      originType: 'war',
      targetHubId: 'town_oakhaven',
      opponentHubId: 'hub_emberwatch',
      sourceHubLevel: 3,
      branch: 'unselected',
    },
  };
}

test('opens contract modal and selects event branch via UI', async () => {
  useGameStore.setState({
    settings: {
      language: 'en',
      voice: { lore: false, quests: false, npcDialogue: false },
      tutorial: { enabled: false, completed: true, step: 5, seenHints: [] },
    },
    quests: [makeOfferedWarQuest()],
  });
  const user = userEvent.setup();
  render(<QuestsPanel />);
  await user.click(screen.getByRole('button', { name: /Open contract board/i }));
  await user.click(screen.getAllByRole('button', { name: /Choose branch/i })[0]);
  const updated = useGameStore.getState().quests.find((q) => q.id === 'event_quest_ui_war');
  expect(updated?.eventQuest?.branch).not.toBe('unselected');
});

