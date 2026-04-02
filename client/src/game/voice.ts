import { Language, VoiceChannel } from './types';

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function stopVoicePlayback() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  activeUtterance = null;
}

export function playVoiceText(
  channel: VoiceChannel,
  text: string,
  language: Language,
  enabled: boolean,
) {
  if (!enabled) return;
  if (!text || text.trim().length === 0) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = language === 'ru' ? 'ru-RU' : 'en-US';
  utterance.rate = channel === 'lore' ? 0.95 : 1;
  utterance.pitch = channel === 'npcDialogue' ? 1.03 : 1;
  if (activeUtterance) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

