import test from 'node:test';
import assert from 'node:assert/strict';
import { playVoiceText, stopVoicePlayback } from '../client/src/game/voice';

test('does not speak when channel disabled and cancels only matching active channel', () => {
  let speakCalls = 0;
  let cancelCalls = 0;
  const originalWindow = (globalThis as any).window;
  const originalUtterance = (globalThis as any).SpeechSynthesisUtterance;
  try {
    (globalThis as any).window = {
      speechSynthesis: {
        speak: () => { speakCalls += 1; },
        cancel: () => { cancelCalls += 1; },
      },
    };
    (globalThis as any).SpeechSynthesisUtterance = function FakeUtterance(this: any, text: string) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
    };
    playVoiceText('quests', 'Hello', 'en', false);
    assert.equal(speakCalls, 0);
    playVoiceText('npcDialogue', 'NPC line', 'en', true);
    assert.equal(speakCalls, 1);
    stopVoicePlayback('quests');
    assert.equal(cancelCalls, 0);
    stopVoicePlayback('npcDialogue');
    assert.ok(cancelCalls >= 1);
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).SpeechSynthesisUtterance = originalUtterance;
  }
});
