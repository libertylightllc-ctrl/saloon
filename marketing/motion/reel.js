// The Saloqo reel's timeline, first half: the room, the camera, the laptop, the screen's labels and shots 1–4.
// seek(t) (in reel-late.js) puts everything where it is at t seconds; nothing animates by itself, so every frame
// render.mjs records is exact. The cuts fall on the music's bars: BPM and the drop (beat 8) set them.
const BPM = 150; // Trap Modern (render.mjs): 75 BPM half-time, its drop on beat 8
const BEAT = 60 / BPM;
const AT = (beats) => beats * BEAT;
const CUTS = [0, 4, 8, 12, 16, 20, 24, 28, 32].map(AT); // shot i runs from CUTS[i] to CUTS[i + 1]
const DURATION = +AT(40).toFixed(2);

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const lerp = (a, b, x) => a + (b - a) * x;
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** How hard the beat is hitting: 1 on each beat after the drop, falling away before the next. */
const kick = (t) => (t < CUTS[2] ? 0 : Math.exp(-((t - CUTS[2]) % BEAT) * 9));

function place(el, { x = 0, y = 0, rz = 0, s = 1, o = 1, blur = 0 } = {}) {
  el.style.opacity = o;
  el.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
  el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rz}deg) scale(${s})`;
  el.style.filter = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : 'none';
}
function make(parent, html, cls = 'c', style = '') {
  const el = document.createElement('div');
  el.className = cls;
  el.style.cssText = style;
  el.innerHTML = html;
  parent.appendChild(el);
  return el;
}
const shotEls = CUTS.map((_, i) => make($('shots'), '', 'shot', ''));
shotEls.forEach((el, i) => (el.id = `s${i + 1}`));

// ── The room, the camera and the laptop ──────────────────────────────────────────────────────────────────────────
// What each shot throws on the wall and the desk: its main colour and how bright the screen is.
const LIGHT = [['#2a3550', 0.35], ['#F2777A', 1], ['#9a4fd0', 0.65], ['#6C45F2', 0.95], ['#f4f2ff', 0.9],
  ['#cfe9ff', 0.6], ['#5a3cf0', 0.85], ['#F2777A', 1], ['#2a5560', 0.4]];
function room(t) {
  const i = shotAt(t);
  const [color, level] = LIGHT[i];
  const flash = i === 5 ? 0.5 * Math.exp(-Math.max(0, t - AT(22)) * 3) * (t > AT(22) ? 1 : 0) : 0;
  $('frame').style.setProperty('--glow', color);
  $('glow-wall').style.opacity = (0.22 + 0.4 * level + flash) * (1 + 0.12 * kick(t));
  $('glow-desk').style.opacity = 0.18 + 0.45 * level + flash;
  // A handheld phone: a slow push in, a little drift and sway, a nudge on the drop.
  const drop = t > CUTS[2] ? Math.exp(-(t - CUTS[2]) * 7) : 0;
  const x = 7 * Math.sin(t * 0.7) + 3 * Math.sin(t * 1.9 + 1);
  const y = 6 * Math.sin(t * 0.9 + 2) + 2 * Math.sin(t * 2.3);
  const rz = 0.45 * Math.sin(t * 0.6 + 0.5) + 0.15 * Math.sin(t * 1.7);
  $('cam').style.transform = `translate(${x}px, ${y}px) rotate(${rz}deg) scale(${1 + 0.06 * (t / DURATION) + 0.02 * drop})`;
  $('rig').style.transform = 'rotateX(-7deg) rotateY(15deg) scale(0.58)';
  $('lid').style.transform = 'rotateX(7deg)';
  $('deck').style.transform = 'rotateX(90deg)';
}
const shotAt = (t) => Math.max(0, CUTS.findLastIndex((c) => t >= c));

// ── The screen's labels: corner text, a shot counter and a running timecode, in the shot's ink ───────────────────
const HUD = {
  tl: make($('hud'), '● Saloqo — product reel 2026', 'abs mono', 'left:40px;top:34px'),
  tr: make($('hud'), '', 'abs mono', 'right:40px;top:34px'),
  bl: make($('hud'), '', 'abs mono', 'left:40px;bottom:32px'),
  br: make($('hud'), '', 'abs mono', 'right:40px;bottom:32px'),
};
const LABELS = ['Dubai · UAE', 'Salon software', 'All in one', 'Walk-in queue', 'Sales', 'Saloqo', 'Close the day',
  'Queue · Sales · Stock · Staff', 'saloqo.com'];
const INK = ['#ffffff', '#0B0916', '#ffffff', '#ffffff', '#0B0916', '#ffffff', '#ffffff', '#0B0916', '#ffffff'];
function hud(t) {
  const i = shotAt(t);
  const f = Math.floor(t * 30);
  const tc = [Math.floor(f / 1800), Math.floor(f / 30) % 60, f % 30].map((n) => String(n).padStart(2, '0')).join(':');
  HUD.tr.textContent = `${String(i + 1).padStart(2, '0')} / 09`;
  HUD.bl.textContent = `${String(i + 1).padStart(2, '0')} / ${LABELS[i]}`;
  HUD.br.textContent = `00:${tc}`;
  for (const el of Object.values(HUD)) (el.style.color = INK[i]), (el.style.opacity = i === 8 ? 0.45 : 0.75);
}

// ── 1 · A dot on the dark grid, then a streak of light across ───────────────────────────────────────────────────
const s1 = $('s1');
s1.style.background = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cpath d='M50 44v12M44 50h12' stroke='%23ffffff' stroke-opacity='.28' stroke-width='1.6'/%3E%3C/svg%3E\") center, radial-gradient(900px 600px at 50% 50%, #17213a, #0B0916)";
const dot1 = make(s1, '', 'c', 'width:30px;height:30px;border-radius:50%;background:#BDEFE8;box-shadow:0 0 30px 10px rgba(127,224,210,.8)');
const streak = make(s1, '', 'c', 'width:1300px;height:10px;border-radius:10px;background:linear-gradient(90deg,transparent,rgba(127,224,210,.5) 60%,#fff);box-shadow:0 0 40px 8px rgba(127,224,210,.55)');
function shot1(t) {
  const pulse = 1 + 0.25 * Math.sin(t * 9);
  place(dot1, { s: pulse * (1 - prog(t, 0.72, 0.8)), o: out3(prog(t, 0.05, 0.3)) });
  const p = inOut(prog(t, 0.7, 1.45));
  place(streak, { x: lerp(-1500, 1500, p), o: p > 0 && p < 1 ? 1 : 0 });
}

// ── 2 · SALOQO. on coral, letters slamming in; the dot swallows the screen on the drop ──────────────────────────
const s2 = $('s2');
s2.style.background = '#F2777A';
const title = make(s2, '', 'c', 'display:flex;align-items:flex-end;color:#0B0916;font:900 250px/1 Pop;letter-spacing:-0.035em');
const letters = [...'SALOQO'].map((ch) => make(title, ch, '', 'display:inline-block'));
const dot2 = make(title, '', '', 'width:62px;height:62px;border-radius:50%;background:#0B0916;margin:0 0 30px 14px;flex:none');
const kicker = make(s2, 'Salon software &nbsp;———&nbsp; 2026', 'c mono', 'color:#0B0916;font-size:22px');
const sub2 = make(s2, 'salon software', 'c', 'font:italic 400 108px/1 ReelSerif;color:#fff;white-space:nowrap');
function shot2(t) {
  const c = CUTS[1];
  letters.forEach((el, i) => {
    const p = out3(prog(t, c + 0.06 + i * 0.05, c + 0.3 + i * 0.05));
    el.style.opacity = p;
    el.style.transform = `scale(${lerp(1.7, 1, p)})`;
    el.style.filter = p < 0.99 ? `blur(${((1 - p) * 18).toFixed(1)}px)` : 'none';
  });
  place(title, { x: -20, y: -40 });
  place(kicker, { x: -380, y: -200, o: out3(prog(t, c + 0.05, c + 0.3)) });
  const sp = out3(prog(t, c + 0.45, c + 0.85));
  place(sub2, { x: lerp(320, 250, sp), y: 130, o: sp, blur: (1 - sp) * 10 });
  // The dot grows over everything from beat 7: the screen is navy when the beat drops.
  const g = Math.pow(prog(t, AT(6.6), CUTS[2]), 2.2);
  dot2.style.transform = `scale(${1 + g * 70})`;
  dot2.style.position = 'relative';
  dot2.style.zIndex = '5';
}

// ── 3 · The drop: a wave of tiles in the app's colours, the Saloqo star floating over it ─────────────────────────
const s3 = $('s3');
s3.style.cssText += ';background:radial-gradient(1000px 700px at 50% 45%, #2a1a40, #0B0916);perspective:1500px';
const wave = make(s3, '', 'c', 'width:1406px;height:962px;transform-style:preserve-3d');
const COLS = 19;
const ROWS = 13;
const tiles = [];
for (let j = 0; j < ROWS; j++)
  for (let i = 0; i < COLS; i++) {
    const el = make(wave, '', 'abs', `left:${i * 74}px;top:${j * 74}px;width:64px;height:64px;border-radius:12px`);
    tiles.push({ el, r: Math.hypot(i - (COLS - 1) / 2, j - (ROWS - 1) / 2), d: (i + j) / (COLS + ROWS - 2) });
  }
const orb = make(s3, '<img src="/assets/images/splash-icon.png" style="width:100%">', 'c',
  'width:230px;height:230px;filter:drop-shadow(0 0 30px rgba(127,224,210,.9)) drop-shadow(0 0 70px rgba(127,224,210,.5))');
const rings3 = make(s3, '<svg width="560" height="560" viewBox="-280 -280 560 560"><g fill="none" stroke="#fff" stroke-width="3"><ellipse id="r3a" rx="250" ry="70"/><ellipse id="r3b" rx="250" ry="70" transform="rotate(60)"/></g></svg>', 'c');
const flash3 = make(s3, '', 'fill', 'background:#fff;z-index:30');
function shot3(t) {
  const u = t - CUTS[2];
  const amp = 0.55 + 0.45 * kick(t);
  wave.style.transform = `translate(-50%, -50%) translateY(90px) rotateX(58deg) rotateZ(${-28 + u * 4}deg)`;
  for (const k of tiles) {
    const h = Math.sin(k.r * 0.55 - u * 5.5) * 70 * amp + 40;
    const light = clamp((h + 40) / 160);
    const hue = lerp(352, 262, k.d);
    k.el.style.transform = `translateZ(${h.toFixed(1)}px)`;
    k.el.style.background = `hsl(${hue.toFixed(0)} 85% ${(38 + light * 32).toFixed(0)}%)`;
    k.el.style.boxShadow = `0 ${(h * 0.25 + 6).toFixed(0)}px ${(h * 0.3 + 10).toFixed(0)}px rgba(0,0,0,.45)`;
  }
  place(orb, { y: -150 + 14 * Math.sin(u * 4), s: 1 + 0.06 * kick(t), rz: u * 20 });
  place(rings3, { y: -150 + 14 * Math.sin(u * 4), rz: u * 60, s: 0.95 });
  flash3.style.opacity = 0.75 * (1 - prog(t, CUTS[2], CUTS[2] + 0.18));
  flash3.style.visibility = t < CUTS[2] + 0.2 ? 'visible' : 'hidden';
}

// ── 4 · The walk-in queue on violet, glitching into the viewfinder ──────────────────────────────────────────────
const s4 = $('s4');
s4.style.background = 'repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 6px), radial-gradient(1000px 700px at 60% 50%, #7d5cff, #4a2bd0)';
const q4text = make(s4, '<div class="mono" style="color:#fff;opacity:.8;margin-bottom:26px">Walk-in queue · live</div>' +
  '<div style="font:800 128px/1 Pop;color:#fff;letter-spacing:-0.03em">3 waiting.</div>' +
  '<div style="font:italic 400 64px/1.3 ReelSerif;color:#fff;opacity:.9;margin-top:18px">1 booked, 0 no-shows</div>', 'c', 'white-space:nowrap');
const bands = [...Array(7)].map((_, i) => make(s4, '<img src="shots/gents-queue.png">', 'c phone',
  `clip-path:inset(${(i * 100) / 7}% 0 ${100 - ((i + 1) * 100) / 7}% 0)`));
const ghosts = ['hue-rotate(160deg) saturate(3)', 'hue-rotate(-60deg) saturate(3)'].map((f) =>
  make(s4, '<img src="shots/gents-queue.png">', 'c phone', `mix-blend-mode:screen;filter:${f}`));
const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
  const b = make(s4, '', 'c bracket');
  b.style[sy < 0 ? 'borderTopWidth' : 'borderBottomWidth'] = '5px';
  b.style[sx < 0 ? 'borderLeftWidth' : 'borderRightWidth'] = '5px';
  return { b, sx, sy };
});
const jitter = bands.map(() => (rand() - 0.5) * 260);
function shot4(t) {
  const c = CUTS[3];
  const g = 1 - out3(prog(t, c, c + 0.42));
  const phone = { x: 330, y: 40, s: 0.86 };
  bands.forEach((el, i) => place(el, { ...phone, x: phone.x + jitter[i] * g * (i % 2 ? 1 : -0.6) }));
  ghosts.forEach((el, i) => place(el, { ...phone, x: phone.x + (i ? 1 : -1) * 26 * g, o: 0.7 * g }));
  const bp = out3(prog(t, c + 0.1, c + 0.45));
  corners.forEach(({ b, sx, sy }) => place(b, { x: phone.x + sx * lerp(330, 250, bp), y: phone.y + sy * lerp(520, 440, bp), o: bp }));
  const tp = out3(prog(t, c + 0.2, c + 0.55));
  place(q4text, { x: lerp(-420, -360, tp), y: -10, o: tp, blur: (1 - tp) * 12 });
}
