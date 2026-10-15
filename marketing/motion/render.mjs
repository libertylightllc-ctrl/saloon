/**
 * Records a film frame by frame into an MP4, 30 frames a second, with the sound effects sfx.py makes from the
 * timeline's CUES over its music. The films (FILMS below): the product video (scene.html, 1920 × 1080) and the
 * Instagram reel (reel.html, 1080 × 1920).
 *   node marketing/motion/render.mjs                    → marketing/motion/out/saloqo-product.mp4 (picture + sound)
 *   node marketing/motion/render.mjs --film reel        → marketing/motion/out/saloqo-reel.mp4
 *   node marketing/motion/render.mjs --sound            → only remakes the sound (sfx.py) onto the last picture
 *   node marketing/motion/render.mjs --stills 1,5.2,9   → a PNG of each moment in out/ (for checking)
 * The page is served from the repository (fonts, logo, app screens) without a server: requests are answered from disk.
 */
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(HERE, 'out');
const FPS = 30;
// The music: "Pop Upbeat - Upbeat Pop" by The_Mountain, https://pixabay.com/music/dance-pop-upbeat-upbeat-pop-576584/
// (Pixabay Content License: free for commercial use, no credit needed; Pixabay marks it AI generated, and it is
// registered with YouTube Content ID, so keep the licence certificate for disputing claims). It is not in git: the
// repository is public and the licence doesn't allow sharing the track on its own, so download it into music/.
// It is 120 BPM; its first kick (the drop) is 9.54 s in, so starting 1.54 s in puts the drop on 8 s, where the navy
// ground spreads in, and the beat lands on the star's streak (12 s) and comes back from its break on the icon (16 s).
// Without the file the video has effects only.
// fxDb sets the sound effects under the music.
const MUSIC = { file: join(HERE, 'music', 'pop-upbeat-the-mountain.mp3'), from: 1.54, gainDb: -7, fxDb: -6, mixDb: 2.5, fadeFrom: 39.1 };
// The reel's music: "Trap Modern" by The_Mountain, https://pixabay.com/music/trap-trap-modern-139518/ (Pixabay Content
// License as above; registered with YouTube Content ID; not in git). 75 BPM half-time (150 in reel.js); its drop is the
// downbeat 6.46 s in, so starting 3.26 s in lands it on beat 8 (3.2 s), and every cut falls on its bar lines.
const MUSIC_REEL = { file: join(HERE, 'music', 'trap-modern-the-mountain.mp3'), from: 3.263, gainDb: -7.5, fxDb: 0, mixDb: 0, fadeFrom: 14.6 };
const FILMS = {
  product: { page: 'scene.html', stage: '#stage', width: 1920, height: 1080, name: 'saloqo-product', prefix: '', music: MUSIC },
  reel: { page: 'reel.html', stage: '#frame', width: 1080, height: 1920, name: 'saloqo-reel', prefix: 'reel-', music: MUSIC_REEL },
};
const filmArg = process.argv.indexOf('--film');
const film = FILMS[filmArg > 0 ? process.argv[filmArg + 1] : 'product'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
mkdirSync(OUT, { recursive: true });

const stillsArg = process.argv.indexOf('--stills');
const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(',').map(Number) : null;
const soundOnly = process.argv.includes('--sound');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: film.width, height: film.height } });
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
await page.goto(`http://motion.local/marketing/motion/${film.page}`);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const stage = page.locator(film.stage);

async function frame(t) {
  await page.evaluate((s) => new Promise((r) => { window.seek(s); requestAnimationFrame(() => requestAnimationFrame(r)); }), t);
  return stage.screenshot({ type: 'png' });
}

if (stills) {
  for (const t of stills) {
    const file = join(OUT, `${film.prefix}still-${t.toFixed(2)}.png`);
    await page.evaluate((s) => window.seek(s), t);
    await stage.screenshot({ path: file });
    console.log('still', file);
  }
} else {
  const picture = join(OUT, `${film.prefix}picture.mp4`);
  if (!soundOnly) await record(picture);
  // The sound effects, made from the timeline's cues, laid under the picture.
  const cues = join(OUT, `${film.prefix}cues.json`);
  const sound = join(OUT, `${film.prefix}sfx.wav`);
  writeFileSync(cues, JSON.stringify(await page.evaluate(() => window.CUES)));
  execFileSync('python3', [join(HERE, 'sfx.py'), cues, String(duration), sound], { stdio: 'inherit' });
  const file = join(OUT, `${film.name}.mp4`);
  const music = film.music;
  const inputs = ['-i', picture, '-i', sound];
  let audio = ['-map', '1:a'];
  if (music && existsSync(music.file)) {
    // The music under the effects: in at music.from, faded out over the end card. The whole mix is then lifted by
    // music.mixDb to about -14 LUFS (where YouTube and Instagram play), with a limiter so the hits don't clip.
    const m = `[2:a]atrim=start=${music.from},asetpts=PTS-STARTPTS,aresample=48000,volume=${music.gainDb}dB,` +
      `afade=t=in:d=0.3,afade=t=out:st=${music.fadeFrom}:d=${(duration - music.fadeFrom).toFixed(2)}[m]`;
    inputs.push('-i', music.file);
    audio = ['-filter_complex', `[1:a]volume=${music.fxDb}dB[fx];${m};[fx][m]amix=inputs=2:duration=first:normalize=0,` +
      `volume=${music.mixDb}dB,alimiter=limit=0.7:level=0[a]`, '-map', '[a]'];
  } else {
    console.log('no music:', music ? `download it into ${music.file} (see MUSIC in render.mjs)` : 'none chosen yet', '- making the video with the effects only');
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-map', '0:v', ...audio, '-c:v', 'copy',
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
