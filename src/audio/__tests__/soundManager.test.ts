import { __resetAudioForTests } from '../expoAudio';
import type { PlaybackStatus } from '../expoAudio';

/**
 * The effects layer.
 *
 * Three separate bugs have lived here, all invisible from outside because they
 * are indistinguishable from "the player turned the sound off":
 *
 *  1. `preload()` produced players that reported themselves loaded, accepted
 *     `play()` without throwing, and emitted nothing.
 *  2. Rewinding a player that had never started left it in a state where the
 *     following `play()` was dropped, costing the first firing of every effect.
 *  3. A player parked at the end of its clip will not restart on `play()`
 *     alone, so every effect fired once per session and then went quiet.
 *
 * The fake below models (2) and (3) faithfully — a player that has reached its
 * duration makes no sound — so the tests fail if either ever comes back.
 */

interface FakePlayer {
  volume: number;
  loop: boolean;
  isLoaded: boolean;
  currentTime: number;
  readonly duration: number;
  /** Times playback actually began, as opposed to `play()` merely being called. */
  sounded: number;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  addListener: jest.Mock;
  remove: jest.Mock;
}

const players: FakePlayer[] = [];
const preloaded: number[] = [];
let seekRejects = false;
/** When false, `play()` leaves the player mid-clip instead of completing it. */
let autoFinish = true;

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  preload: jest.fn((source: number) => {
    preloaded.push(source);
    return Promise.resolve();
  }),
  createAudioPlayer: jest.fn(() => {
    const listeners: ((status: PlaybackStatus) => void)[] = [];
    const player: FakePlayer = {
      volume: 1,
      loop: false,
      isLoaded: true,
      currentTime: 0,
      duration: 0.2,
      sounded: 0,
      play: jest.fn(() => {
        // The heart of it: a player sitting at the end has nothing left to
        // play, and a real one stays silent rather than restarting.
        if (player.currentTime >= player.duration) return;
        player.sounded += 1;
        if (autoFinish) {
          player.currentTime = player.duration;
          for (const listener of listeners) listener({ didJustFinish: true });
        } else {
          player.currentTime = 0.05;
        }
      }),
      pause: jest.fn(),
      seekTo: jest.fn((seconds: number) => {
        if (seekRejects) return Promise.reject(new Error('not ready'));
        player.currentTime = seconds;
        return Promise.resolve();
      }),
      addListener: jest.fn((_event: string, listener: (status: PlaybackStatus) => void) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      }),
      remove: jest.fn(),
    };
    players.push(player);
    return player;
  }),
}));

async function freshSoundManager(): Promise<typeof import('../soundManager')> {
  jest.resetModules();
  __resetAudioForTests();
  players.length = 0;
  preloaded.length = 0;
  seekRejects = false;
  autoFinish = true;
  const manager = require('../soundManager') as typeof import('../soundManager');
  await manager.initSounds();
  return manager;
}

/** Lets the seek promise chain inside `playSound` settle. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

/** The player that actually made a noise. */
function sounding(): FakePlayer | undefined {
  return players.find((player) => player.sounded > 0);
}

describe('the effects layer', () => {
  it('builds one player per effect and never preloads', async () => {
    const manager = await freshSoundManager();

    expect(players).toHaveLength(manager.SOUND_NAMES.length);

    // Preload looks like the obvious cure for a first-play gap and is actively
    // harmful here: on device, a player built from a preloaded source reports
    // itself loaded, accepts `play()` without throwing, and emits nothing at
    // all. This guards against it being reintroduced.
    expect(preloaded).toHaveLength(0);
  });

  it('plays on the very first call, without seeking first', async () => {
    const manager = await freshSoundManager();

    manager.playSound('wrong');

    const player = sounding();
    expect(player?.sounded).toBe(1);

    // A fresh player is already at zero, and seeking one that has never started
    // is what used to swallow this first firing. Any rewind here belongs to the
    // finish listener and must come *after* the sound, never before it.
    const playedAt = player?.play.mock.invocationCallOrder[0] ?? 0;
    const seeks = player?.seekTo.mock.invocationCallOrder ?? [];
    expect(seeks.every((order) => order > playedAt)).toBe(true);
  });

  it('keeps making a noise on every later firing, not just the first', async () => {
    const manager = await freshSoundManager();

    for (let round = 0; round < 4; round++) {
      manager.playSound('wrong');
      await settle();
    }

    // The regression that took the wrong-answer and game-over sounds out: the
    // player finished, stayed parked at the end, and every later `play()` was
    // a no-op.
    expect(sounding()?.sounded).toBe(4);
  });

  it('rewinds a sound retriggered before it has finished', async () => {
    autoFinish = false;
    const manager = await freshSoundManager();
    autoFinish = false;

    manager.playSound('tap');
    await settle();
    manager.playSound('tap');
    await settle();

    const player = sounding();
    // Caught mid-clip, so this one does need an explicit rewind.
    expect(player?.pause).toHaveBeenCalled();
    expect(player?.seekTo).toHaveBeenCalledWith(0);
    expect(player?.sounded).toBe(2);
  });

  it('still plays when the rewind fails', async () => {
    autoFinish = false;
    const manager = await freshSoundManager();
    autoFinish = false;

    manager.playSound('correct');
    await settle();
    seekRejects = true;
    manager.playSound('correct');
    await settle();

    // A seek that rejects must not cost the effect.
    expect(sounding()?.play.mock.calls.length).toBe(2);
  });

  it('plays nothing at all once sound is switched off', async () => {
    const manager = await freshSoundManager();
    manager.setSoundEnabled(false);

    manager.playSound('correct');
    manager.playSound('tap');

    expect(players.every((player) => player.sounded === 0)).toBe(true);
    manager.setSoundEnabled(true);
  });

  it('asks for a mode that survives a phone on vibrate', async () => {
    await freshSoundManager();

    // Required *after* the module registry reset, so this is the same mock
    // instance the manager under test just called.
    const audio = require('expo-audio') as { setAudioModeAsync: jest.Mock };

    // `playsInSilentMode: false` keys off the ringer, not the media volume, and
    // silenced the whole game whenever the phone was on vibrate.
    const mode = audio.setAudioModeAsync.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(mode.playsInSilentMode).toBe(true);
    expect(mode.interruptionMode).toBe('mixWithOthers');
  });
});
