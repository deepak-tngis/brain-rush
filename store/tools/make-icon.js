/**
 * Play Store listing icon: exactly 512x512, derived from the launcher icon.
 *
 * The listing icon and the icon on the device have to be recognisably the same
 * artwork, so this downsamples `assets/icon.png` rather than redrawing it.
 * That source is 1024x1024, so the reduction is an exact 2x box filter — every
 * output pixel is the mean of a clean 2x2 block, with no resampling blur and no
 * arbitrary-ratio artefacts.
 *
 * Play rejects transparency in the listing icon, so the alpha channel is
 * composited onto the brand blue and dropped.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'assets', 'icon.png');
const OUT = path.join(ROOT, 'store', 'play', 'icon-512.png');

/** Brand blue, used only where the source icon is not fully opaque. */
const MATTE = [47, 128, 237];

const src = PNG.sync.read(fs.readFileSync(SRC));
if (src.width !== 1024 || src.height !== 1024) {
  throw new Error(`expected a 1024x1024 source, got ${src.width}x${src.height}`);
}

const size = 512;
const out = new PNG({ width: size, height: size, colorType: 2 });

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;

    // Average the 2x2 source block, compositing each sample over the matte so
    // semi-transparent edges average in their real colour rather than black.
    for (let dy = 0; dy < 2; dy += 1) {
      for (let dx = 0; dx < 2; dx += 1) {
        const i = ((y * 2 + dy) * src.width + (x * 2 + dx)) << 2;
        const a = src.data[i + 3] / 255;
        r += src.data[i] * a + MATTE[0] * (1 - a);
        g += src.data[i + 1] * a + MATTE[1] * (1 - a);
        b += src.data[i + 2] * a + MATTE[2] * (1 - a);
      }
    }

    const o = ((y * size) + x) << 2;
    out.data[o] = Math.round(r / 4);
    out.data[o + 1] = Math.round(g / 4);
    out.data[o + 2] = Math.round(b / 4);
    out.data[o + 3] = 255;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(out));
console.log(`wrote ${OUT} (${fs.statSync(OUT).size} bytes)`);
