/**
 * The app's line icons (lucide, 1.75 stroke, as src/ui/Icon.tsx) as inline SVG for the website: the drawing is read
 * from the installed lucide package, so the two never differ. Names are the app's names.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILES = {
  banknote: 'banknote',
  boxes: 'boxes',
  calendarPlus: 'calendar-plus',
  chart: 'chart-column',
  check: 'check',
  chevronDown: 'chevron-down',
  chevronRight: 'chevron-right',
  clock: 'clock',
  languages: 'languages',
  menu: 'menu',
  messageCircle: 'message-circle',
  minus: 'minus',
  play: 'play',
  plus: 'plus',
  receipt: 'receipt-text',
  repeat: 'repeat-2',
  shield: 'shield-check',
  smartphone: 'smartphone',
  sparkles: 'sparkles',
  userCheck: 'user-check',
  users: 'users',
};

const cache = new Map();

function shapes(root, name) {
  if (!cache.has(name)) {
    const file = FILES[name];
    if (!file) throw new Error(`Unknown icon: ${name}`);
    const source = readFileSync(join(root, 'node_modules', 'lucide-react-native', 'dist', 'esm', 'icons', `${file}.mjs`), 'utf8');
    const literal = /node:\s*(\[[\s\S]*?\])\s*,\s*aliases|node:\s*(\[[\s\S]*?\])\s*\n\};/.exec(source);
    if (!literal) throw new Error(`Cannot read the icon ${file}`);
    // The package's own data: an array of [tag, attributes] pairs.
    const node = new Function(`return ${literal[1] ?? literal[2]}`)();
    cache.set(
      name,
      node
        .map(([tag, attrs]) => {
          const list = Object.entries(attrs)
            .filter(([key]) => key !== 'key')
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
          return `<${tag} ${list}/>`;
        })
        .join(''),
    );
  }
  return cache.get(name);
}

/** An icon as inline SVG; decorative (hidden from screen readers). `flip`: mirrored in right-to-left pages. */
export function icon(root, name, { size = 20, stroke = 1.75, cls = '', flip = false } = {}) {
  const classes = ['i', cls, flip ? 'flip' : ''].filter(Boolean).join(' ');
  return `<svg class="${classes}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes(root, name)}</svg>`;
}
