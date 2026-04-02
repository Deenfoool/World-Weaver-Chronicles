import { Language, VoiceChannel } from './types';

let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeChannel: VoiceChannel | null = null;

export function stopVoicePlayback(channel?: VoiceChannel) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (channel && activeChannel && activeChannel !== channel) return;
  window.speechSynthesis.cancel();
  activeUtterance = null;
  activeChannel = null;
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
  activeChannel = channel;
  window.speechSynthesis.speak(utterance);
}
