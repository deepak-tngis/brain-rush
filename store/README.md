# Play Store listing assets

Everything Google asks for at upload time, at the exact pixel sizes it asks for.

## What to upload

| File | Size | Play field |
| --- | --- | --- |
| `play/icon-512.png` | 512 × 512 | App icon |
| `play/feature-graphic-1024x500.png` | 1024 × 500 | Feature graphic |
| `play/screenshot-01..08.png` | 1080 × 1920 | Phone screenshots |

All are PNG and well under the 8 MB per-image cap.

## Where they come from

- **Icon** — `tools/make-icon.js` reduces `assets/icon.png` (1024²) to 512² with an
  exact 2× box filter, so the listing icon and the launcher icon are the same
  artwork rather than two drawings that drift apart.
- **Feature graphic and screenshots** — `tools/build-pages.js` emits one HTML
  page per asset, sized in CSS pixels to the target dimensions, which
  `tools/render.sh` rasterises with headless Chrome at
  `--force-device-scale-factor=1`. Colours come from `src/theme/theme.ts` and
  the mark is the geometry in `src/components/BrainLogo.tsx`.
- **`captures/`** — unretouched 1080 × 2412 screen captures from a physical
  device, taken with SystemUI demo mode on so the status bar carries no personal
  notifications. These are composited whole; nothing is cropped into, so no
  gameplay element is hidden behind a headline.

## Regenerating

```sh
node store/tools/build-pages.js "$PWD/store/captures"
sh store/tools/render.sh
```

`render.sh` fails loudly if any output lands at the wrong size or over 8 MB.
Intermediate HTML goes to `store/build/`, which is not tracked.

## Headline claims

Each headline describes only what the screenshot underneath it shows, and every
number visible in the captures is real play data. There are no review quotes,
no download counts and no features the build does not have.

| Shot | Screen | Claim it makes |
| --- | --- | --- |
| 01 | Home | 12 puzzle types, timed rounds |
| 02 | Number sequence | answer before the timer bar empties |
| 03 | Shape pattern | pattern recognition |
| 04 | Missing number | difficulty escalates (`EASY` → `MEDIUM` is visible) |
| 05 | Spatial reasoning | mental rotation |
| 06 | Colour logic | streak and coin rewards (streak 10, 425 coins shown) |
| 07 | Daily challenge | ten daily puzzles, works offline |
| 08 | Statistics | per-type accuracy tracking |
