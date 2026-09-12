# Brain Rush

A fast-paced brain-training puzzle game for Android. Twelve puzzle types, five to
fifteen seconds each, three lives, and a daily challenge that works in airplane
mode.

- **Package** `com.vantyralabs.brainrush`
- **Version** 1.0.0 (versionCode 1)
- **Stack** React Native 0.87 / Expo SDK 57 / TypeScript (strict) / expo-router

---

## Quick start

```bash
npm install
npm test              # 96 unit tests, no device needed
npm run typecheck

npm run prebuild      # generate the native Android project
npm run android       # build and run on a connected device or emulator
```

Brain Rush uses native modules (AdMob, AsyncStorage, expo-av), so it needs a
development build rather than Expo Go:

```bash
npx expo run:android            # local build
eas build --profile preview     # cloud build (see eas.json)
```

## Layout

```
app/                  expo-router screens: home, daily, game, game over, stats, settings
src/engine/           the game itself - pure TypeScript, no React, no Expo
  generators/         one file per puzzle type
  numericRules.ts     the closed universe of number rules puzzles are posed against
  puzzleKit.ts        cell/option helpers and the one-valid-answer guarantee
  session.ts          the run state machine: score, lives, streak, rewards
  daily.ts            date-seeded daily challenge
src/storage/          AsyncStorage persistence with validation and migration
src/ads/              AdMob wrapper + the interstitial frequency policy
src/audio/            sound effects and haptics, both fail-soft
src/components/       rendering primitives; all puzzles draw through Glyph
src/state/            React bindings for the engine and the save file
tools/                generate-sounds.py - synthesises the audio assets
backend/              minimal NestJS service exposing GET /health
```

The engine never imports React Native, which is why it can be exercised by fast
node-only tests and why the UI is a pure projection of engine state.

## How "exactly one valid answer" is guaranteed

The hardest requirement in a generated puzzle game is that no puzzle has two
defensible answers. Brain Rush enforces this structurally rather than by
inspection:

- **`finalizePuzzle` rejects duplicates.** Every option is reduced to a canonical
  signature of exactly what will be drawn. If two options would render
  identically, the puzzle is thrown away. *Which Is Different?* opts into a
  second mode where all tiles but one are identical by design, and the check
  instead proves the answer is the single outlier.
- **Number puzzles are posed against a closed rule set** (arithmetic, geometric,
  quadratic, fibonacci, alternating). A run is only shipped when every rule that
  fits it agrees on one continuation, and a distractor is only offered if
  appending it would *not* produce another rule-consistent run.
- **Pattern puzzles must show their cycle at least twice**, and every period that
  the visible run actually demonstrates must predict the same next item.
- **Colour Logic is a bijection**, so the one missing result is forced by
  elimination. **Spatial Reasoning** only ships grids whose four rotations are
  all distinct. **Missing Number** grids are rejected unless the visible rows rule
  out every operator but one.
- **Generators refuse rather than compromise.** A generator that cannot find a
  clean puzzle for a seed throws; the factory retries with a different type. The
  player can never be shown an ambiguous puzzle, and never a crash either.

The test suite hammers every generator with 150 seeds per difficulty and
re-derives each answer from the rendered board using logic written independently
of the generator, so a generator that drifted from what it draws would fail.

## Game rules

| Event | Reward |
| --- | --- |
| Correct answer | +10 points (plus up to +5 for speed), +5 coins |
| Streak of 5 (and every 5th after) | +20 coins |
| Streak of 10 (and every 10th after) | +50 coins |
| Daily challenge completed | +50 coins, once per day |
| Wrong answer or expired clock | -1 life |

Players start with 300 coins and 3 lives. Difficulty ramps by question index:
easy for the first five, medium through twelve, hard after that — and within the
hard band the decision window keeps tightening to a floor of five seconds.

Coins are credited the instant they are earned, so closing the app on the game
over screen never costs a player what they just won.

## Offline

Everything except adverts works with no connection:

- puzzles are generated on the device from a seeded PRNG;
- the daily challenge is derived from the local date alone, so every device
  produces the same ten puzzles with no server involved;
- progress lives in AsyncStorage;
- there is no account, no login, no leaderboard and no cloud sync.

Ad calls are made in the background, never awaited by the UI, and resolve to a
definite "no" on failure. A rewarded ad grants its reward only when the SDK
reports the reward was actually earned.

## Adverts

Google's public **test** unit IDs are the default, so a development build can
never serve real inventory. Production IDs are supplied entirely through the
environment — game logic never names an ad unit:

```bash
ADS_USE_TEST_IDS=false \
ADMOB_APP_ID=ca-app-pub-xxx~yyy \
ADMOB_INTERSTITIAL_ID=ca-app-pub-xxx/yyy \
ADMOB_REWARDED_ID=ca-app-pub-xxx/yyy \
npx expo prebuild --platform android --clean
```

`app.config.ts` writes the app ID into `AndroidManifest.xml` as
`com.google.android.gms.ads.APPLICATION_ID` and passes the unit IDs to the app
through `expo-constants`. See `.env.example`; `eas.json` wires the same switch
into the EAS build profiles.

**Interstitials** appear on at most every third eligible trigger, never within 60
seconds of the previous one, and never while a puzzle is on screen — an
interstitial is only ever offered at a game over. The counter resets only when an
ad actually opens, so unsold inventory does not silently eat the allowance. The
rules live in `src/ads/interstitialPolicy.ts` as pure functions and are unit
tested.

**Rewarded ads** can restore a life, reveal the current answer, or continue a run
with its streak intact. Each is offered behind a sheet with a visible decline,
and no reward is applied unless the ad completes.

Android permissions are trimmed to what the game actually uses: `INTERNET`,
`ACCESS_NETWORK_STATE`, `MODIFY_AUDIO_SETTINGS` and `VIBRATE`. The advertising ID
permission is blocked and requests are non-personalised by default.

## Sound

The seven effects under `assets/sounds/` are synthesised from scratch by
`tools/generate-sounds.py` using only the Python standard library — unambiguously
royalty-free, and 112 KB in total. Regenerate them with:

```bash
python3 tools/generate-sounds.py
```

## Backend

`backend/` is a minimal NestJS service exposing `GET /health` →
`{"status":"ok"}`. The game never calls it. See `backend/README.md`.

## Testing

```bash
npm test                 # game engine, scoring, persistence, ad frequency
npm run typecheck
cd backend && npm test   # health endpoint
```
