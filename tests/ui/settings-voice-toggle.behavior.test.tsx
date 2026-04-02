import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from '../../client/src/components/game/SettingsPanel';
import { useGameStore } from '../../client/src/game/store';
import { playVoiceText } from '../../client/src/game/voice';

test('disabling quests voice does not interrupt active npc narration channel', async () => {
  let cancelCalls = 0;
  const originalWindow = (globalThis as any).window;
  const originalUtterance = (globalThis as any).SpeechSynthesisUtterance;
  try {
    (globalThis as any).window = {
      speechSynthesis: {
        speak: () => {},
        cancel: () => { cancelCalls += 1; },
      },
    };
    (globalThis as any).SpeechSynthesisUtterance = function FakeUtterance(this: any, text: string) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
    };
    useGameStore.setState({
      settings: {
        language: 'en',
        voice: { lore: true, quests: true, npcDialogue: true },
        tutorial: { enabled: false, completed: true, step: 5, seenHints: [] },
      },
    });
    playVoiceText('npcDialogue', 'npc line', 'en', true);
    const user = userEvent.setup();
    render(<SettingsPanel />);
    const row = screen.getByText('Quest voice lines').closest('div');
    if (!row) throw new Error('Quest voice row not found');
    const toggle = within(row).getByRole('button');
    await user.click(toggle);
    expect(useGameStore.getState().settings.voice.quests).toBe(false);
    expect(cancelCalls).toBe(0);
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).SpeechSynthesisUtterance = originalUtterance;
  }
});

