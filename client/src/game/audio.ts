type SoundEntry = {
  path: string;
  volume?: number;
  loop?: boolean;
};

type SoundManifest = {
  sounds?: Record<string, SoundEntry>;
};

const AVAILABLE_SOUND_IDS = new Set([
  'travel_whoosh_short',
  'amb_town_day_loop',
  'amb_forest_loop',
  'amb_ruins_loop',
  'amb_swamp_loop',
  'amb_cave_loop',
  'footstep_dirt',
  'footstep_stone',
  'footstep_wood',
  'coin_jingle',
  'shop_buy',
  'shop_sell',
  'ui_click_soft',
  'ui_error_denied',
  'ui_hover_soft',
  'ui_panel_open',
  'ui_panel_close',
  'ui_reward_claim',
  'ui_tab_switch',
  'weather_rain_loop',
  'weather_storm_loop',
  'weather_wind_cold_loop',
  'thunder_strike_1',
  'thunder_strike_2',
]);

let manifestCache: SoundManifest | null = null;
let manifestPromise: Promise<SoundManifest | null> | null = null;

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
  if (!AVAILABLE_SOUND_IDS.has(id)) return;
  const manifest = await loadSoundManifest();
  const entry = manifest?.sounds?.[id];
  if (!entry?.path) return;
  const src = entry.path.startsWith('/') ? entry.path : `/${entry.path}`;
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.loop = Boolean(entry.loop);
  const baseVolume = typeof entry.volume === 'number' ? entry.volume : 0.7;
  audio.volume = Math.max(0, Math.min(1, baseVolume * volumeMult));
  void audio.play().catch(() => undefined);
}

export function getAvailableSoundIds(): string[] {
  return Array.from(AVAILABLE_SOUND_IDS);
}

