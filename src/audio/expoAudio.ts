/**
 * The slice of `expo-audio` this app uses, resolved defensively.
 *
 * Both the effects and the music bed go through here so there is one place that
 * knows how the native module is reached and one place that decides what
 * happens when it is missing: the app plays silently rather than failing to
 * start. Audio is a garnish — it must never be able to take down a puzzle.
 *
 * `expo-audio` rather than `expo-av`: expo-av is outside Expo SDK 57's tested
 * set and its prebuilt library targets an older JSI ABI than React Native 0.86
 * exports, which throws `UnsatisfiedLinkError` out of `AVManager.<clinit>` and
 * crashes the app on every launch.
 */

/** Status delivered by `playbackStatusUpdate`; only the fields we act on. */
export interface PlaybackStatus {
  readonly didJustFinish: boolean;
}

export interface Subscription {
  remove(): void;
}

/** The subset of `AudioPlayer` the app touches. */
export interface PlayableSound {
  volume: number;
  loop: boolean;
  /** False until the native player has finished preparing the source. */
  readonly isLoaded: boolean;
  /** Seconds played so far; 0 on a player that has never started. */
  readonly currentTime: number;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: PlaybackStatus) => void,
  ): Subscription;
  remove(): void;
}

export interface AudioModule {
  createAudioPlayer(source: number): PlayableSound;
  setAudioModeAsync(mode: Record<string, unknown>): Promise<unknown>;
}

/**
 * Reports a swallowed audio failure, in development only.
 *
 * Every failure path in this layer is deliberately non-fatal, but silence in
 * *both* senses is a trap: with bare `catch {}` blocks a broken audio pipeline
 * looks exactly like a player who turned the sound off, and the reason never
 * reaches anyone. Shipping builds still say nothing.
 */
export function noteAudio(what: string, error?: unknown): void {
  if (!__DEV__) return;
  if (error === undefined) console.log(`[audio] ${what}`);
  else console.warn(`[audio] ${what}:`, error);
}

let cached: AudioModule | null | undefined;

export function resolveAudio(): AudioModule | null {
  if (cached !== undefined) return cached;
  try {
    // Required lazily: a missing native module must degrade to silence rather
    // than taking down the bundle at import time.
    cached = require('expo-audio') as AudioModule;
  } catch (error) {
    noteAudio('expo-audio is unavailable, running silent', error);
    cached = null;
  }
  return cached;
}

let modeApplied: Promise<void> | null = null;

/**
 * Applies the app-wide audio mode once, shared by effects and music.
 */
export function ensureAudioMode(): Promise<void> {
  if (modeApplied !== null) return modeApplied;

  modeApplied = (async () => {
    const audio = resolveAudio();
    if (audio === null) return;
    try {
      await audio.setAudioModeAsync({
        // `mixWithOthers` requests no audio focus at all, which is what a game
        // bed and short blips want: they should sit on top of whatever the
        // player is already listening to rather than ducking it every few
        // seconds.
        interruptionMode: 'mixWithOthers',
        // Must be true on Android. The flag keys off the *ringer* mode, not the
        // media volume, so `false` silences everything whenever the phone is on
        // silent *or vibrate* — which is how most phones spend their lives.
        // Audio still obeys the media slider and the in-app toggles.
        playsInSilentMode: true,
      });
    } catch (error) {
      // Audio focus is advisory; carry on without it.
      noteAudio('could not set the audio mode', error);
    }
  })();

  return modeApplied;
}

/** Test seam: forget the cached module and mode between suites. */
export function __resetAudioForTests(): void {
  cached = undefined;
  modeApplied = null;
}
