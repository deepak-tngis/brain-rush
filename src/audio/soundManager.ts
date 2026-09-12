/**
 * Sound effects.
 *
 * Audio is a garnish: it must never be able to delay, block or crash gameplay.
 * Every call here is fire-and-forget and swallows its own failures, and the
 * native module is resolved defensively so a build without it simply plays
 * nothing instead of throwing at import time.
 */

export const SOUND_NAMES = [
  'tap',
  'correct',
  'wrong',
  'streak',
  'levelComplete',
  'gameOver',
  'coin',
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

const SOURCES: Record<SoundName, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  streak: require('../../assets/sounds/streak.wav'),
  levelComplete: require('../../assets/sounds/level-complete.wav'),
  gameOver: require('../../assets/sounds/game-over.wav'),
  coin: require('../../assets/sounds/coin.wav'),
};

const VOLUMES: Record<SoundName, number> = {
  tap: 0.35,
  correct: 0.7,
  wrong: 0.55,
  streak: 0.75,
  levelComplete: 0.8,
  gameOver: 0.7,
  coin: 0.5,
};

/** The slice of expo-av this module actually uses. */
interface PlayableSound {
  replayAsync(): Promise<unknown>;
  unloadAsync(): Promise<unknown>;
  setVolumeAsync(volume: number): Promise<unknown>;
}

interface AudioModule {
  Sound: {
    createAsync(
      source: number,
      status?: { volume?: number; shouldPlay?: boolean },
    ): Promise<{ sound: PlayableSound }>;
  };
  setAudioModeAsync(mode: Record<string, unknown>): Promise<unknown>;
}

function resolveAudio(): AudioModule | null {
  try {
    // Required lazily: a missing native module must degrade to silence, not
    // take down the bundle at import time.
    const module = require('expo-av') as { Audio?: AudioModule };
    return module.Audio ?? null;
  } catch {
    return null;
  }
}

const loaded = new Map<SoundName, PlayableSound>();
let enabled = true;
let initialising: Promise<void> | null = null;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/**
 * Loads every effect once. Safe to call repeatedly; concurrent callers share the
 * same in-flight promise.
 */
export function initSounds(): Promise<void> {
  if (initialising !== null) return initialising;

  initialising = (async () => {
    const audio = resolveAudio();
    if (audio === null) return;

    try {
      await audio.setAudioModeAsync({
        // Effects should mix under music rather than stopping it.
        shouldDuckAndroid: true,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
      });
    } catch {
      // Audio focus is advisory; carry on without it.
    }

    await Promise.all(
      SOUND_NAMES.map(async (name) => {
        try {
          const { sound } = await audio.Sound.createAsync(SOURCES[name], {
            volume: VOLUMES[name],
            shouldPlay: false,
          });
          loaded.set(name, sound);
        } catch {
          // One effect failing to load costs that effect, nothing else.
        }
      }),
    );
  })();

  return initialising;
}

/**
 * Plays an effect. Never awaited by callers and never throws — a sound that
 * cannot play is not a reason to interrupt a puzzle.
 */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  const sound = loaded.get(name);
  if (sound === undefined) return;
  void sound.replayAsync().catch(() => undefined);
}

export async function unloadSounds(): Promise<void> {
  const sounds = [...loaded.values()];
  loaded.clear();
  initialising = null;
  await Promise.all(sounds.map((sound) => sound.unloadAsync().catch(() => undefined)));
}
