// The timeline of the Saloqo product video: seek(t) puts every element where it is at t seconds (scene.html).
// Nothing animates by itself, so each frame render.mjs records is exact.
const DURATION = 36.6;
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const lerp = (a, b, x) => a + (b - a) * x;
/** Shown from a to b, fading in over fi and out over fo seconds. */
const win = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(out3(prog(t, a, a + fi)), 1 - inOut(prog(t, b - fo, b)));

function place(el, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, o = 1, blur = 0 } = {}) {
  el.style.opacity = o;
  el.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
  el.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
  el.style.filter = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : 'none';
  // Nearer in front (the stage is not one 3D space: each element is drawn flat, in this order).
  el.style.zIndex = String(Math.round(2000 + z));
}

// Words that arrive letter by letter, out of a blur, as in the reference.
const kinetic = {};
function words(id, parts, size) {
  const el = $(id);
  if (size) el.style.fontSize = `${size}px`;
  kinetic[id] = [];
  for (const p of parts)
    for (const ch of p.text) {
      const span = document.createElement('span');
      span.textContent = ch;
      if (p.cls) span.className = p.cls;
      el.appendChild(span);
      kinetic[id].push({ span, start: p.start });
    }
  let i = 0;
  let last = null;
  for (const k of kinetic[id]) {
    if (k.start !== last) (i = 0), (last = k.start);
    k.at = k.start + i++ * 0.045;
  }
}
function reveal(id, t) {
  for (const k of kinetic[id]) {
    const p = out3(prog(t, k.at, k.at + 0.55));
    k.span.style.opacity = p;
    k.span.style.filter = p < 0.99 ? `blur(${((1 - p) * 14).toFixed(1)}px)` : 'none';
    k.span.style.transform = `translateY(${((1 - p) * 26).toFixed(1)}px)`;
  }
}

words('w-many', [{ text: 'Too many', start: 0.15 }]);
words('w-walkins', [{ text: 'walk-ins', start: 4.35, cls: 'accent' }]);
words('w-time', [{ text: 'Too little ', start: 5.95 }, { text: 'time', start: 6.75, cls: 'accent' }]);
words('w-oneapp', [{ text: 'One app', start: 13.55 }], 110);
words('w-salon', [{ text: 'for the whole salon', start: 14.45 }], 110);
words('w-sell', [{ text: 'Sell', start: 16.7 }], 300);
words('w-close', [{ text: 'Close the day', start: 23.4 }], 104);
words('w-pay', [{ text: 'Pay your team', start: 25.75 }], 104);
words('w-barber', [{ text: '✦ Barber shops', start: 28.0 }], 112);
words('w-ladies', [{ text: '✦ Ladies salons & spas', start: 29.55 }], 112);

// Soft rings behind "Too little time".
const rings = [...Array(5)].map((_, i) => {
  const r = document.createElement('div');
  r.className = 'center ring';
  r.style.width = r.style.height = `${360 + i * 300}px`;
  $('stage').insertBefore(r, $('q1'));
  return r;
});

// Confetti after the sale: the same pieces every render.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const COLORS = ['#6C45F2', '#F2777A', '#7FE0D2', '#0B0916', '#B892DB'];
const confetti = [...Array(54)].map((_, i) => {
  const c = document.createElement('div');
  c.className = 'confetti';
  c.style.position = 'absolute';
  c.style.background = COLORS[i % COLORS.length];
  $('confetti').appendChild(c);
  const a = rand() * Math.PI * 2;
  const v = 700 + rand() * 900;
  return { c, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 500, spin: (rand() - 0.5) * 1400, blur: rand() < 0.3 ? 4 : 0 };
});

const trail = $('trail-path');
const trailLength = trail.getTotalLength();
trail.style.strokeDasharray = `${trailLength}`;

/** The navy ground: none, all, or a circle growing from (x, y) — of navy (in) or of light (a hole, out). */
function ground(t) {
  const edge = (r, inside) => `radial-gradient(circle at var(--gx) var(--gy), ${inside ? 'black' : 'transparent'} ${r}px, ${inside ? 'transparent' : 'black'} ${r + 80}px)`;
  let mask = 'none';
  let visible = false;
  let at = [960, 540];
  if (t >= 7.8 && t < 8.4) (visible = true), (mask = edge(2300 * inOut(prog(t, 7.8, 8.4)), true));
  else if (t >= 8.4 && t < 12.95) visible = true;
  else if (t >= 12.95 && t < 13.9) {
    const p = trail.getPointAtLength(trailLength * inOut(prog(13.0, 12.0, 15.2)));
    at = [p.x, p.y];
    visible = true;
    mask = edge(2400 * Math.pow(prog(t, 12.95, 13.9), 1.6), false);
  } else if (t >= 22.4 && t < 23.0) (at = [1290, 560]), (visible = true), (mask = edge(2300 * inOut(prog(t, 22.4, 23.0)), true));
  else if (t >= 23.0) visible = true;
  for (const id of ['bg-dark', 'grid']) {
    const el = $(id);
    el.style.visibility = visible ? 'visible' : 'hidden';
    el.style.setProperty('--gx', `${at[0]}px`);
    el.style.setProperty('--gy', `${at[1]}px`);
    el.style.webkitMaskImage = el.style.maskImage = mask;
  }
}

function seek(t) {
  // Grounds: light, then navy (8–13), light again from the star (13–22.4), navy to the end. The navy spreads in a
  // circle from where the eye is (no grey cross-fades).
  ground(t);
  $('grid').style.opacity = t > 31.4 ? 1 - prog(t, 31.4, 32.2) : 1;

  // 1 · "Too many walk-ins. Too little time."
  reveal('w-many', t);
  place($('w-many'), { y: lerp(0, -40, prog(t, 0, 2)), o: win(t, 0, 2.0, 0.01, 0.45), blur: prog(t, 1.6, 2.0) * 16 });
  const cards = ['q1', 'q2', 'q3', 'q4', 'q5'];
  cards.forEach((id, i) => {
    const start = 1.7 + i * 0.32;
    const p = out3(prog(t, start, start + 1.3));
    const drift = prog(t, start, 5.4);
    const depth = [0, -380, -700, -260, -900][i];
    const col = [0, -560, 520, 430, -380][i];
    place($(id), {
      x: col + lerp(0, -60, drift),
      y: lerp(700, [80, -150, -300, 260, 330][i], p) - drift * 120,
      z: depth,
      rx: lerp(38, 18, p),
      rz: [-2, 4, -5, 3, -3][i],
      o: p * win(t, 0, 5.5, 0.01, 0.6),
      blur: Math.abs(depth) / 90 + prog(t, 4.2, 5.4) * 18,
    });
  });
  reveal('w-walkins', t);
  place($('w-walkins'), { o: win(t, 4.2, 5.75, 0.01, 0.35), blur: prog(t, 5.45, 5.75) * 14 });
  reveal('w-time', t);
  place($('w-time'), { s: lerp(1, 1.04, prog(t, 5.9, 7.9)), o: win(t, 5.8, 7.95, 0.01, 0.3) });
  rings.forEach((r, i) => {
    const p = out3(prog(t, 6.2 + i * 0.12, 7.6 + i * 0.12));
    place(r, { s: lerp(0.6, 1.08, p), o: p * win(t, 6.2, 8.0, 0.01, 0.35) * 0.9 });
  });

  // 2 · On dark: the day's screens fly in; the mark lights up out of the middle one.
  const fly = [['p-checkout', -560, 8.15], ['p-closing', 0, 8.45], ['p-payroll', 560, 8.75]];
  for (const [id, x, start] of fly) {
    const p = out3(prog(t, start, start + 1.1));
    const away = inOut(prog(t, 10.9, 12.0));
    place($(id), {
      x: lerp(x + 900, x, p) * lerp(1, 1.5, away),
      y: lerp(140, 0, p) + Math.sin((t - start) * 1.3) * 10,
      z: lerp(-500, 0, p) + away * (x === 0 ? 900 : -400),
      ry: lerp(-38, -14, p),
      rx: 6,
      o: p * (1 - away),
      blur: away * 24,
    });
  }

  // 3 · The star travels on a light trail, the ground turns light, and it becomes the app icon.
  const tp = inOut(prog(t, 12.0, 15.2));
  trail.style.strokeDashoffset = `${trailLength * (1 - tp)}`;
  $('trail').style.opacity = win(t, 11.9, 15.9, 0.2, 0.6);
  const pt = trail.getPointAtLength(trailLength * tp);
  const toCenter = inOut(prog(t, 15.0, 15.9));
  place($('star'), {
    x: lerp(pt.x - 960, 0, toCenter),
    y: lerp(pt.y - 540, -10, toCenter),
    s: lerp(lerp(0.4, 0.75, tp), 1, toCenter) * (1 + 0.06 * Math.sin(t * 5)),
    rz: tp * 200 + toCenter * 160,
    o: win(t, 11.4, 16.25, 0.5, 0.25),
  });
  reveal('w-oneapp', t);
  place($('w-oneapp'), { x: -250, y: 140, o: win(t, 13.4, 15.2, 0.01, 0.4) });
  reveal('w-salon', t);
  place($('w-salon'), { x: 120, y: 290, o: win(t, 14.3, 15.4, 0.01, 0.35) });
  const tile = back(prog(t, 15.95, 16.5));
  place($('tile'), { y: -10, s: lerp(0.5, 1, tile), o: win(t, 15.95, 16.95, 0.25, 0.35), blur: prog(t, 16.65, 16.95) * 20 });

  // 4 · Sell: a tap on Checkout, the sale is saved.
  reveal('w-sell', t);
  place($('w-sell'), { x: -430, y: -40, o: win(t, 16.6, 22.5, 0.01, 0.4) * 0.92 });
  const phoneIn = out3(prog(t, 17.0, 18.1));
  const done = inOut(prog(t, 20.3, 20.8));
  place($('p-sale'), {
    x: 330, y: lerp(700, 40, phoneIn) + done * 40,
    rx: lerp(30, 0, phoneIn), ry: lerp(-24, -6, phoneIn), rz: lerp(6, 0, phoneIn),
    s: 1 - done * 0.06, o: phoneIn * win(t, 16.9, 22.5, 0.01, 0.4), blur: done * 16,
  });
  $('sale-img').src = t < 19.35 ? 'shots/gents-sale.png' : 'shots/gents-checkout.png';
  const tap = { x: 330 + 151, y: 40 + 336 };
  const cur = out3(prog(t, 18.2, 19.0));
  const curOut = prog(t, 19.6, 20.1);
  place($('cursor'), {
    x: lerp(tap.x + 380, tap.x, cur) + 22, y: lerp(tap.y + 220, tap.y, cur) + 26,
    s: t > 19.0 && t < 19.2 ? 0.88 : 1, o: win(t, 18.2, 20.1, 0.25, 0.4) * (1 - curOut),
  });
  const rp = prog(t, 19.05, 19.6);
  place($('ripple'), { x: tap.x, y: tap.y, s: lerp(0.3, 1.6, out3(rp)), o: rp > 0 && rp < 1 ? 1 - rp : 0 });
  const badge = back(prog(t, 20.55, 21.15));
  place($('badge'), { x: 330, y: 20, s: lerp(0.4, 1, badge), o: clamp(badge * 2) * win(t, 20.5, 22.5, 0.01, 0.4) });
  const ct = t - 20.6;
  confetti.forEach((k) => {
    if (ct < 0 || t > 22.6) return (k.c.style.opacity = 0);
    k.c.style.opacity = 1 - prog(t, 21.8, 22.5);
    k.c.style.transform = `translate(${k.vx * ct * 0.55}px, ${k.vy * ct * 0.55 + 900 * ct * ct}px) rotate(${k.spin * ct}deg)`;
    k.c.style.filter = k.blur ? `blur(${k.blur}px)` : 'none';
  });
  place($('confetti'), { x: 330, y: 20 });

  // 5 · Close the day (it balances), then pay the team.
  const c2 = out3(prog(t, 22.7, 23.8));
  const swap = inOut(prog(t, 25.3, 26.1));
  place($('p-closing2'), {
    x: lerp(-1100, -380, c2) - swap * 900, y: 20, ry: lerp(40, 20, c2), rz: -3, rx: 4,
    o: c2 * (1 - swap), blur: swap * 20,
  });
  place($('p-payroll2'), {
    x: lerp(-1300, -380, swap), y: 20, ry: lerp(44, 20, swap), rz: -3, rx: 4,
    o: swap * win(t, 25.3, 27.65, 0.01, 0.4),
  });
  const bal = back(prog(t, 24.35, 24.85));
  place($('balanced'), { x: -300, y: -250, z: 120, s: lerp(0.3, 1, bal), o: clamp(bal * 2) * (1 - swap) });
  reveal('w-close', t);
  place($('w-close'), { x: 420, y: -30, o: win(t, 23.3, 25.55, 0.01, 0.35) });
  reveal('w-pay', t);
  place($('w-pay'), { x: 420, y: -30, o: win(t, 25.6, 27.6, 0.01, 0.4) });
  for (const id of ['w-close', 'w-pay']) $(id).style.color = id === 'w-close' ? '#BDEFE8' : '#F8B4B6';

  // 6 · Both looks, every language.
  const fan = out3(prog(t, 27.7, 28.9));
  const fanOut = inOut(prog(t, 31.0, 31.6));
  [['p-gents', -470, -9], ['p-ar', 0, 0], ['p-ladies', 470, 9]].forEach(([id, x, rz], i) => {
    place($(id), {
      x: x * fan, y: lerp(220, 150, fan) - fanOut * 80 + (i === 1 ? 0 : 30),
      z: i === 1 ? -200 : -80, rz: rz * fan, rx: 14, s: 0.78,
      o: out3(prog(t, 27.6 + i * 0.15, 28.4 + i * 0.15)) * (1 - fanOut), blur: (i === 1 ? 3 : 0) + fanOut * 18,
    });
  });
  reveal('w-barber', t);
  $('w-barber').style.color = '#B7A4FB';
  place($('w-barber'), { y: -360, o: win(t, 27.9, 29.5, 0.01, 0.3) });
  reveal('w-ladies', t);
  $('w-ladies').style.color = '#F8B4B6';
  place($('w-ladies'), { y: -360, o: win(t, 29.45, 31.4, 0.01, 0.35) });
  place($('langs'), { y: -250, o: win(t, 29.9, 31.4, 0.5, 0.35) });

  // 7 · End card.
  const e = out3(prog(t, 31.6, 32.6));
  place($('end-star'), { y: lerp(-150, -210, e), s: lerp(0.6, 1, e), rz: lerp(-60, 0, e), o: e });
  place($('wordmark'), { y: 20, o: out3(prog(t, 32.1, 32.9)), blur: (1 - out3(prog(t, 32.1, 32.9))) * 14 });
  place($('tagline'), { y: 150, o: out3(prog(t, 32.7, 33.4)) * 0.85 });
  const tryIn = back(prog(t, 33.3, 33.9));
  place($('try'), { y: 270, s: lerp(0.6, 1, tryIn), o: clamp(tryIn * 2) });
  place($('url'), { y: 375, o: out3(prog(t, 33.8, 34.4)) });
  $('stage').style.filter = t > DURATION - 0.6 ? `brightness(${1 - prog(t, DURATION - 0.6, DURATION)})` : 'none';
}

// The wordmark, lifted out of the logo artwork's navy ground (docs/brand/saloqo-logo.jpg; it sits at 194–702 × 735–851).
async function wordmark() {
  const img = new Image();
  img.src = '/docs/brand/saloqo-logo.jpg';
  await img.decode();
  const [x, y, w, h] = [184, 725, 528, 136];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, x, y, w, h, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
    d.data[i + 3] = clamp((l - 40) / 170) * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
  }
  g.putImageData(d, 0, 0);
  const url = c.toDataURL();
  $('wordmark').style.webkitMaskImage = $('wordmark').style.maskImage = `url(${url})`;
}

window.DURATION = DURATION;
window.seek = seek;
window.ready = (async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  await wordmark();
  // Both screens of the sale phone, so the swap does not wait for a load.
  await Promise.all(['shots/gents-checkout.png'].map((s) => Object.assign(new Image(), { src: s }).decode()));
  seek(0);
  return true;
})();
