/**
 * Sound effects.
 *
 * Every call is fire-and-forget and swallows its own failures: a sound that
 * cannot play is never a reason to interrupt a puzzle.
 *
 * Do NOT reintroduce `expo-audio`'s module-level `preload()` here. It looks like
 * the obvious cure for a first-play gap, but on this stack a player built from a
 * preloaded source reports `isLoaded: true`, accepts `play()` without throwing,
 * and emits no audio at all — verified on device against the platform's own
 * audio service, which logged no AudioTrack for any effect until the preload was
 * removed. The first-play problem is solved below instead, by not seeking.
 */

import { ensureAudioMode, noteAudio, resolveAudio } from './expoAudio';
import type { PlayableSound, Subscription } from './expoAudio';

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
  correct: 0.8,
  wrong: 0.65,
  streak: 0.8,
  levelComplete: 0.85,
  gameOver: 0.75,
  coin: 0.55,
};

const loaded = new Map<SoundName, PlayableSound>();
const subscriptions: Subscription[] = [];
let enabled = true;
let initialising: Promise<void> | null = null;

/**
 * Rewinds a player so its next `play()` starts from the beginning.
 *
 * A player parked at the end of its clip will not restart on `play()` alone —
 * there is nothing left to play — so every effect would fire once per session
 * and then go silent. The pause before the seek matters too: seeking a player
 * still in its finished state is unreliable, and a paused one always accepts it.
 */
function rearm(sound: PlayableSound, name: SoundName): void {
  try {
    sound.pause();
    void sound.seekTo(0).catch((error: unknown) => {
      noteAudio(`could not rewind "${name}"`, error);
    });
  } catch (error) {
    noteAudio(`could not rewind "${name}"`, error);
  }
}

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

    await ensureAudioMode();

    for (const name of SOUND_NAMES) {
      try {
        const player = audio.createAudioPlayer(SOURCES[name]);
        player.volume = VOLUMES[name];
        // Rewind the moment it finishes, so the player is always sitting at
        // zero and ready for the next firing rather than parked at the end.
        subscriptions.push(
          player.addListener('playbackStatusUpdate', (status) => {
            if (status.didJustFinish) rearm(player, name);
          }),
        );
        loaded.set(name, player);
      } catch (error) {
        // One effect failing to load costs that effect, nothing else.
        noteAudio(`could not load "${name}"`, error);
      }
    }

    noteAudio(`effects ready: ${loaded.size}/${SOUND_NAMES.length}`);
  })();

  return initialising;
}

/**
 * Plays an effect. Never awaited by callers and never throws.
 */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  const sound = loaded.get(name);
  if (sound === undefined) return;

  const start = (): void => {
    try {
      sound.play();
    } catch (error) {
      noteAudio(`could not play "${name}"`, error);
    }
  };

  try {
    // Only rewind a player that has actually advanced — normally one caught
    // mid-clip, since the finish listener returns it to zero otherwise.
    // Seeking a player that has never started, or is still preparing, leaves
    // ExoPlayer in a state where the following `play()` is dropped, which is
    // what used to cost the first firing of every effect.
    if (sound.currentTime > 0) {
      sound.pause();
      void sound.seekTo(0).then(start, start);
    } else {
      start();
    }
  } catch (error) {
    // Reading status or seeking can throw outright on a player mid-prepare.
    noteAudio(`falling back to a plain play for "${name}"`, error);
    start();
  }
}

export async function unloadSounds(): Promise<void> {
  const sounds = [...loaded.values()];
  loaded.clear();
  initialising = null;
  for (const subscription of subscriptions.splice(0)) {
    try {
      subscription.remove();
    } catch {
      // Already detached.
    }
  }
  for (const sound of sounds) {
    try {
      sound.remove();
    } catch {
      // Already released; nothing to do.
    }
  }
}
