/**
 * Emits the HTML for every Play Store graphic. Each page is sized to the exact
 * pixel dimensions Google asks for and is then rasterised by headless Chrome at
 * a device scale factor of 1, so what the browser lays out is what ships.
 *
 * Everything is drawn from the app's own palette (src/theme/theme.ts) and the
 * app's own logo geometry (src/components/BrainLogo.tsx) so the listing and the
 * installed game are visibly the same product.
 *
 * The gameplay images are real, unretouched device captures. Nothing here
 * invents a feature, a review or a statistic: the headlines only describe
 * mechanics the screenshot underneath is showing.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'build');
const SHOTS = process.argv[2];
if (!SHOTS) throw new Error('usage: build-pages.js <device-screenshot-dir>');

/** Straight from src/theme/theme.ts. */
const BRAND = { blue: '#2f80ed', deep: '#1b57b3', purple: '#7b5cf0', orange: '#ff8c1a', pink: '#f83f8f' };

/**
 * The app mark, transcribed from BrainLogo.tsx. The only change is the lobe
 * stroke: blue-on-white in the app, white here because the store art sits on
 * the dark brand gradient.
 */
const mark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="60" r="56" fill="#ffffff" opacity="0.12"/>
  <g stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M46 30 C33 30 25 39 25 49 C18 53 16 62 21 69 C17 77 22 87 32 88 C36 95 47 97 53 91 L53 30 C51 28 48 30 46 30 Z"/>
    <path d="M74 30 C87 30 95 39 95 49 C102 53 104 62 99 69 C103 77 98 87 88 88 C84 95 73 97 67 91 L67 30 C69 28 72 30 74 30 Z"/>
    <path d="M60 26 L60 96" opacity="0.35"/>
  </g>
  <path d="M66 42 L48 68 H60 L54 88 L74 60 H62 Z" fill="${BRAND.orange}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

/**
 * Corner accents, as rgba strings.
 *
 * All four sit in the blue-violet-magenta family and are *lighter* than the
 * ground they wash over. Warm accents were tried first and had to go: orange
 * alpha-composited over deep navy lands on grey-brown mud, and screen-blending
 * it only produced a colourless haze. Orange survives where it belongs — the
 * bolt in the mark, and the rule under the wordmark.
 */
const ACCENT = {
  azure: 'rgba(122,190,255,.42)',
  indigo: 'rgba(104,126,255,.46)',
  violet: 'rgba(158,124,255,.46)',
  magenta: 'rgba(248,99,168,.38)',
};

/**
 * Shared chrome. The two radial layers are painted as part of the background
 * stack rather than as blurred elements, which keeps the falloff smooth without
 * a filter and leaves the gradient's own colour intact underneath.
 */
const base = (w, h, a = ACCENT.azure, b = ACCENT.violet) => `
  html,body{margin:0;padding:0}
  body{width:${w}px;height:${h}px;overflow:hidden;position:relative;
       background:
         radial-gradient(72% 56% at 6% 2%, ${a}, transparent 66%),
         radial-gradient(76% 60% at 96% 99%, ${b}, transparent 68%),
         linear-gradient(153deg,#17408c 0%,${BRAND.deep} 32%,${BRAND.blue} 60%,#6b5bf0 100%);
       font-family:"Segoe UI","Segoe UI Variable Display",system-ui,Roboto,Arial,sans-serif;
       -webkit-font-smoothing:antialiased;color:#fff}
`;

/* ---------------------------------------------------------------- feature */

const feature = `<!doctype html><html><head><meta charset="utf-8"><style>
${base(1024, 500, ACCENT.azure, ACCENT.magenta)}
  .wrap{position:relative;height:100%;display:flex;align-items:center;gap:56px;padding:0 78px;box-sizing:border-box}
  .markbox{flex:none;display:flex;align-items:center;justify-content:center;
           filter:drop-shadow(0 18px 40px rgba(0,0,0,.32))}
  /* One line, always: the wordmark is the brand and must not break across two. */
  .name{font-size:88px;font-weight:900;letter-spacing:-2.5px;line-height:1;white-space:nowrap;
        text-shadow:0 6px 28px rgba(0,0,0,.3)}
  .tag{margin-top:20px;font-size:31px;font-weight:600;color:rgba(255,255,255,.88);letter-spacing:.2px}
  .rule{margin-top:26px;width:132px;height:7px;border-radius:99px;
        background:linear-gradient(90deg,${BRAND.orange},${BRAND.pink})}
</style></head><body>
  <div class="wrap">
    <div class="markbox">${mark(256)}</div>
    <div>
      <div class="name">BRAIN RUSH</div>
      <div class="tag">12 puzzle types &middot; one racing clock</div>
      <div class="rule"></div>
    </div>
  </div>
</body></html>`;

/* ------------------------------------------------------------ screenshots */

/**
 * `accent` only tints the background glows, so the eight frames read as a set
 * while still varying. `shot` is the raw device capture, shown whole — never
 * cropped into, so no gameplay element is hidden behind the headline.
 */
const SCREENS = [
  { file: 'home.png',  a: ACCENT.azure,   b: ACCENT.violet,  head: 'TWELVE PUZZLE TYPES.<br>ONE RACING CLOCK.', sub: 'Quick-fire brain training that fits in a coffee break.' },
  { file: 'g01.png',   a: ACCENT.azure,   b: ACCENT.indigo,  head: 'WHAT COMES NEXT?',                          sub: 'Read the sequence and answer before the bar runs out.' },
  { file: 'g03.png',   a: ACCENT.magenta, b: ACCENT.violet,  head: 'SPOT THE PATTERN',                          sub: 'Shapes, symbols and colours &mdash; find the rule at a glance.' },
  { file: 'g06.png',   a: ACCENT.violet,  b: ACCENT.indigo,  head: 'IT GETS HARDER<br>AS YOU GO',               sub: 'Clear the early rounds and the difficulty steps up.' },
  { file: 'g07.png',   a: ACCENT.indigo,  b: ACCENT.azure,   head: 'ROTATE IT<br>IN YOUR HEAD',                 sub: 'Spatial puzzles that stretch more than arithmetic.' },
  { file: 'g11.png',   a: ACCENT.violet,  b: ACCENT.magenta, head: 'BUILD A STREAK,<br>BANK THE COINS',         sub: 'Answer in a row and the streak bonus keeps climbing.' },
  { file: 'daily.png', a: ACCENT.magenta, b: ACCENT.indigo,  head: 'A NEW CHALLENGE<br>EVERY DAY',              sub: 'Ten puzzles, the same for everyone &mdash; and it works offline.' },
  { file: 'stats.png', a: ACCENT.violet,  b: ACCENT.azure,   head: 'SEE WHERE<br>YOU ARE STRONGEST',            sub: 'Accuracy tracked for all twelve puzzle types.' },
];

const screenPage = ({ file, a, b, head, sub }) => `<!doctype html><html><head><meta charset="utf-8"><style>
${base(1080, 1920, a, b)}
  /* Centred in the band above the phone rather than pinned to the top, so a
     one-line headline sits closer to the device instead of leaving a void. */
  .head{position:absolute;left:0;right:0;top:0;height:384px;padding:0 74px;box-sizing:border-box;
        display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  h1{margin:0;font-size:74px;font-weight:900;line-height:1.06;letter-spacing:-1.8px;
     text-shadow:0 5px 26px rgba(0,0,0,.34)}
  p{margin:22px auto 0;max-width:840px;font-size:31px;font-weight:600;line-height:1.35;
    color:rgba(255,255,255,.82)}
  /* The phone: a thin light bezel and a deep shadow lift the capture off the
     gradient so the screen edge stays obvious at thumbnail size. */
  .phone{position:absolute;left:50%;transform:translateX(-50%);top:384px;
         width:664px;padding:9px;box-sizing:border-box;background:rgba(255,255,255,.92);
         border-radius:50px;box-shadow:0 34px 80px rgba(6,16,48,.52)}
  .phone img{display:block;width:100%;border-radius:42px}
</style></head><body>
  <div class="head"><h1>${head}</h1><p>${sub}</p></div>
  <div class="phone"><img src="${path.join(SHOTS, file).replace(/\\/g, '/')}"></div>
</body></html>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'feature.html'), feature);
SCREENS.forEach((s, i) => {
  const name = `shot-${String(i + 1).padStart(2, '0')}`;
  fs.writeFileSync(path.join(OUT, `${name}.html`), screenPage(s));
});
console.log(`wrote ${SCREENS.length + 1} pages to ${OUT}`);
