/**
 * Records the product video (scene.html) frame by frame into an MP4: 1920 × 1080, 30 frames a second, with the
 * sound effects sfx.py makes from the timeline's CUES.
 *   node marketing/motion/render.mjs                    → marketing/motion/out/saloqo-product.mp4 (picture + sound)
 *   node marketing/motion/render.mjs --sound            → only remakes the sound (sfx.py) onto the last picture
 *   node marketing/motion/render.mjs --stills 1,5.2,9   → a PNG of each moment in out/ (for checking)
 * The page is served from the repository (fonts, logo, app screens) without a server: requests are answered from disk.
 */
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(HERE, 'out');
const FPS = 30;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
mkdirSync(OUT, { recursive: true });

const stillsArg = process.argv.indexOf('--stills');
const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(',').map(Number) : null;
const soundOnly = process.argv.includes('--sound');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.route('http://motion.local/**', (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) return route.abort();
  try {
    route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? 'application/octet-stream' });
  } catch {
    route.fulfill({ status: 404, body: 'not found' });
  }
});
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto('http://motion.local/marketing/motion/scene.html');
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const stage = page.locator('#stage');

async function frame(t) {
  await page.evaluate((s) => new Promise((r) => { window.seek(s); requestAnimationFrame(() => requestAnimationFrame(r)); }), t);
  return stage.screenshot({ type: 'png' });
}

if (stills) {
  for (const t of stills) {
    const file = join(OUT, `still-${t.toFixed(2)}.png`);
    await page.evaluate((s) => window.seek(s), t);
    await stage.screenshot({ path: file });
    console.log('still', file);
  }
} else {
  const picture = join(OUT, 'picture.mp4');
  if (!soundOnly) await record(picture);
  // The sound effects, made from the timeline's cues, laid under the picture.
  const cues = join(OUT, 'cues.json');
  const sound = join(OUT, 'sfx.wav');
  writeFileSync(cues, JSON.stringify(await page.evaluate(() => window.CUES)));
  execFileSync('python3', [join(HERE, 'sfx.py'), cues, String(duration), sound], { stdio: 'inherit' });
  const file = join(OUT, 'saloqo-product.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', picture, '-i', sound, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', file], { stdio: 'inherit' });
  console.log('video', file);
}
await browser.close();

async function record(file) {
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(duration * FPS);
  for (let f = 0; f < frames; f++) {
    const png = await frame(f / FPS);
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on('close', r));
}
