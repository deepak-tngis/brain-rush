/**
 * The background music bed.
 *
 * One looping player for the whole app, kept deliberately separate from the
 * effects: it has its own on/off switch and its own volume, because a bed the
 * player cannot turn down is a bed they turn the whole game off to escape.
 *
 * The track is synthesised from oscillators rather than sampled, so there is no
 * third-party licence attached to it.
 */

import { ensureAudioMode, noteAudio, resolveAudio } from './expoAudio';
import type { PlayableSound } from './expoAudio';

const SOURCE: number = require('../../assets/sounds/music-loop.wav');

/**
 * Ceiling applied on top of the player's own setting.
 *
 * The slider runs 0..1 over *this*, not over the raw output, so even at maximum
 * the bed stays under the effects. Music the player has to think over should
 * never be the loudest thing in the room.
 */
const HEADROOM = 0.55;

/**
 * How much the bed lifts when a puzzle is nearly out of time.
 *
 * Small on purpose: the countdown bar and the colour change already carry the
 * urgency, and this only has to make it *felt*. Anything bigger reads as the
 * volume misbehaving.
 */
const URGENCY_LIFT = 1.35;

let player: PlayableSound | null = null;
let initialising: Promise<void> | null = null;

let enabled = true;
let volume = 0.5;
let urgent = false;
/** Set while the app is backgrounded or an advert owns the screen. */
let suspended = false;

function targetVolume(): number {
  return Math.max(0, Math.min(1, volume)) * HEADROOM * (urgent ? URGENCY_LIFT : 1);
}

function applyVolume(): void {
  if (player === null) return;
  try {
    player.volume = targetVolume();
  } catch (error) {
    noteAudio('could not set the music volume', error);
  }
}

/** Starts or stops the loop to match the current settings. */
function sync(): void {
  if (player === null) return;
  const shouldPlay = enabled && !suspended;
  try {
    if (shouldPlay) {
      applyVolume();
      player.play();
    } else {
      player.pause();
    }
  } catch (error) {
    noteAudio('could not update music playback', error);
  }
}

/**
 * Creates the looping player. Safe to call repeatedly; concurrent callers share
 * the same in-flight promise.
 */
export function initMusic(): Promise<void> {
  if (initialising !== null) return initialising;

  initialising = (async () => {
    const audio = resolveAudio();
    if (audio === null) return;

    await ensureAudioMode();

    // No `preload()` here either — see the note in soundManager.ts. A player
    // built from a preloaded source silently produces no audio on this stack,
    // and the bed has no need of it: it starts once and then loops.
    try {
      const created = audio.createAudioPlayer(SOURCE);
      created.loop = true;
      created.volume = targetVolume();
      player = created;
      noteAudio(`music ready (volume ${(targetVolume() * 100).toFixed(0)}%)`);
      sync();
    } catch (error) {
      noteAudio('could not load the music', error);
    }
  })();

  return initialising;
}

export function setMusicEnabled(value: boolean): void {
  enabled = value;
  sync();
}

/** `value` is the player-facing 0..1 setting, not the raw output level. */
export function setMusicVolume(value: number): void {
  volume = Math.max(0, Math.min(1, value));
  applyVolume();
}

/**
 * Lifts the bed while a puzzle is running out of time, and drops it back
 * afterwards. Called from the board as the countdown crosses its threshold.
 */
export function setMusicUrgency(value: boolean): void {
  if (urgent === value) return;
  urgent = value;
  applyVolume();
}

/**
 * Pauses the bed without forgetting the player's setting — for backgrounding
 * and for full-screen adverts, which bring their own audio.
 */
export function suspendMusic(value: boolean): void {
  if (suspended === value) return;
  suspended = value;
  if (value) setMusicUrgency(false);
  sync();
}

export async function unloadMusic(): Promise<void> {
  const current = player;
  player = null;
  initialising = null;
  urgent = false;
  suspended = false;
  if (current === null) return;
  try {
    current.remove();
  } catch {
    // Already released; nothing to do.
  }
}
