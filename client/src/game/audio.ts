type SoundEntry = {
  path: string;
  volume?: number;
  loop?: boolean;
};

type SoundManifest = {
  sounds?: Record<string, SoundEntry>;
};

type LoopChannel = 'ambience' | 'weather' | 'music';

let manifestCache: SoundManifest | null = null;
let manifestPromise: Promise<SoundManifest | null> | null = null;
const activeLoops: Partial<Record<LoopChannel, { id: string; audio: HTMLAudioElement }>> = {};
const isDevRuntime = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

async function loadSoundManifest(): Promise<SoundManifest | null> {
  if (manifestCache) return manifestCache;
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch('/assets/audio/audio_manifest.json')
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((json) => {
      manifestCache = (json && typeof json === 'object') ? (json as SoundManifest) : null;
      return manifestCache;
    })
    .catch(() => null)
    .finally(() => {
      manifestPromise = null;
    });
  return manifestPromise;
}

export async function playSfx(id: string, volumeMult = 1): Promise<void> {
  if (typeof window === 'undefined') return;
  const manifest = await loadSoundManifest();
  const entry = manifest?.sounds?.[id];
  if (!entry?.path) {
    if (typeof console !== 'undefined' && isDevRuntime) {
      console.warn(`[audio] unknown sound id: ${id}`);
    }
    return;
  }
  const src = entry.path.startsWith('/') ? entry.path : `/${entry.path}`;
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.loop = Boolean(entry.loop);
  audio.onerror = () => {
    if (typeof console !== 'undefined' && isDevRuntime) {
      console.warn(`[audio] failed to load sound: ${id} -> ${src}`);
    }
  };
  const baseVolume = typeof entry.volume === 'number' ? entry.volume : 0.7;
  audio.volume = Math.max(0, Math.min(1, baseVolume * volumeMult));
  void audio.play().catch(() => undefined);
}

export async function playLoop(
  id: string,
  channel: LoopChannel,
  volumeMult = 1,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const manifest = await loadSoundManifest();
  const entry = manifest?.sounds?.[id];
  if (!entry?.path) {
    if (typeof console !== 'undefined' && isDevRuntime) {
      console.warn(`[audio] unknown loop sound id: ${id}`);
    }
    return;
  }

  const existing = activeLoops[channel];
  if (existing?.id === id) {
    const baseVolume = typeof entry.volume === 'number' ? entry.volume : 0.5;
    existing.audio.volume = Math.max(0, Math.min(1, baseVolume * volumeMult));
    return;
  }

  if (existing) {
    existing.audio.pause();
    existing.audio.currentTime = 0;
  }

  const src = entry.path.startsWith('/') ? entry.path : `/${entry.path}`;
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.loop = true;
  audio.onerror = () => {
    if (typeof console !== 'undefined' && isDevRuntime) {
      console.warn(`[audio] failed to load loop sound: ${id} -> ${src}`);
    }
  };
  const baseVolume = typeof entry.volume === 'number' ? entry.volume : 0.5;
  audio.volume = Math.max(0, Math.min(1, baseVolume * volumeMult));
  activeLoops[channel] = { id, audio };
  void audio.play().catch(() => undefined);
}

export function stopLoop(channel?: LoopChannel) {
  if (channel) {
    const active = activeLoops[channel];
    if (!active) return;
    active.audio.pause();
    active.audio.currentTime = 0;
    delete activeLoops[channel];
    return;
  }
  (Object.keys(activeLoops) as LoopChannel[]).forEach((key) => {
    const active = activeLoops[key];
    if (!active) return;
    active.audio.pause();
    active.audio.currentTime = 0;
    delete activeLoops[key];
  });
}

export function getAvailableSoundIds(): string[] {
  return Object.keys(manifestCache?.sounds || {});
}
