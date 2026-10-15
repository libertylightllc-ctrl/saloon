// The Saloqo reel's timeline, second half (after reel.js, whose helpers it uses): shots 5–9, the caption, seek(t)
// and CUES. Every figure on the screen is the demo salon's own (Al Barsha Gents) or a plain claim the app keeps.

// ── 5 · The week's sales on white: a number counting up, a donut and bars growing on the beat ───────────────────
const s5 = $('s5');
s5.style.background = '#F7F6FB';
make(s5, 'Sales this week — Al Barsha Gents', 'abs mono', 'left:140px;top:170px;color:#0B0916;opacity:.7');
const amount = make(s5, '', 'abs', 'left:132px;top:215px;font:800 150px/1 Pop;color:#0B0916;letter-spacing:-0.035em;white-space:nowrap');
const pill5 = make(s5, '▲ 18% vs last week', 'abs', 'left:140px;top:405px;padding:12px 26px;border-radius:999px;background:#F2777A;color:#fff;font:600 30px Pop;white-space:nowrap');
const donut = make(s5, '<svg width="250" height="250" viewBox="0 0 250 250"><circle cx="125" cy="125" r="100" fill="none" stroke="#E7E4F0" stroke-width="24"/>' +
  '<circle id="arc" cx="125" cy="125" r="100" fill="none" stroke="#F2777A" stroke-width="24" stroke-linecap="round" transform="rotate(-90 125 125)" stroke-dasharray="628.3" stroke-dashoffset="628.3"/></svg>' +
  '<div id="pct" style="position:absolute;left:0;top:78px;width:250px;text-align:center;font:800 64px/1 Pop;color:#0B0916"></div>' +
  '<div class="mono" style="position:absolute;left:0;top:152px;width:250px;text-align:center;font-size:15px;color:#0B0916;opacity:.6">chairs busy</div>', 'abs', 'left:140px;top:540px;width:250px;height:250px');
const BARS = [0.42, 0.55, 0.47, 0.64, 0.7, 0.92, 0.78];
const chart = make(s5, '', 'abs', 'left:800px;top:260px;width:680px;height:560px');
make(chart, 'Sales by day', 'abs mono', 'left:0;top:-90px;color:#0B0916;opacity:.7');
const bars = BARS.map((v, i) => make(chart, '', 'abs', `left:${i * 98}px;bottom:0;width:62px;border-radius:10px 10px 4px 4px;background:${i === 6 ? '#F2777A' : '#0B0916'}`));
['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].forEach((d, i) => make(chart, d, 'abs mono', `left:${i * 98 + 2}px;top:575px;font-size:15px;color:#0B0916;opacity:.6`));
const line = make(chart, `<svg width="680" height="560" style="overflow:visible"><polyline id="trend" fill="none" stroke="#6C45F2" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"
  points="${BARS.map((v, i) => `${i * 98 + 31},${560 - v * 560 - 40}`).join(' ')}"/></svg>`, 'abs', 'left:0;top:0');
const today = make(chart, 'Today', 'abs mono', `left:${6 * 98 - 18}px;top:${560 - 0.78 * 560 - 120}px;padding:6px 12px;border-radius:8px;background:#0B0916;color:#fff;font-size:14px`);
function shot5(t) {
  const c = CUTS[4];
  const n = Math.round(12480 * out3(prog(t, c + 0.05, c + 0.95)));
  amount.innerHTML = `<span style="font-size:64px;font-weight:600;letter-spacing:0">AED </span>${n.toLocaleString('en-US')}`;
  const pp = back(prog(t, c + 0.55, c + 0.85));
  pill5.style.transform = `scale(${pp})`;
  pill5.style.opacity = clamp(pp * 2);
  const d = out3(prog(t, c + 0.1, c + 1.0));
  $('arc').setAttribute('stroke-dashoffset', (628.3 * (1 - 0.78 * d)).toFixed(1));
  $('pct').textContent = `${Math.round(78 * d)}%`;
  bars.forEach((b, i) => (b.style.height = `${(BARS[i] * 560 * out3(prog(t, c + 0.08 + i * 0.07, c + 0.45 + i * 0.07))).toFixed(1)}px`));
  const tr = $('trend');
  const len = tr.getTotalLength();
  tr.style.strokeDasharray = `${len}`;
  tr.style.strokeDashoffset = `${len * (1 - inOut(prog(t, c + 0.55, c + 1.25)))}`;
  today.style.opacity = out3(prog(t, c + 0.85, c + 1.05));
}

// ── 6 · Light pulled into the centre, then a burst around the star (on the half bar) ────────────────────────────
const s6 = $('s6');
const canvas = Object.assign(document.createElement('canvas'), { width: 1600, height: 1000 });
canvas.className = 'abs';
s6.appendChild(canvas);
const ctx = canvas.getContext('2d');
const sparks = [...Array(520)].map(() => ({ a: rand() * Math.PI * 2, r: 160 + rand() * 1000, len: 30 + rand() * 120, w: 0.6 + rand() * 2.2, l: 0.4 + rand() * 0.6 }));
const star6 = make(s6, '<img src="/assets/images/splash-icon.png" style="width:100%">', 'c', 'width:200px;height:200px;filter:drop-shadow(0 0 40px rgba(127,224,210,1)) drop-shadow(0 0 90px rgba(80,160,255,.8))');
function shot6(t) {
  const c = CUTS[5];
  const mid = AT(22);
  const burst = prog(t, mid, CUTS[6]);
  const bg = t < mid ? 0 : 0.92 * Math.exp(-burst * 2.2);
  ctx.fillStyle = `rgb(${[11, 9, 22].map((v) => Math.round(lerp(v, 245, bg))).join(',')})`;
  ctx.fillRect(0, 0, 1600, 1000);
  ctx.lineCap = 'round';
  for (const p of sparks) {
    let r;
    let len;
    if (t < mid) (r = p.r * (1 - Math.pow(prog(t, c, mid), 1.6) * 0.92)), (len = p.len * (1 + prog(t, c, mid) * 2));
    else (r = lerp(40, p.r * 1.7, out3(burst))), (len = p.len * (4 - 2.5 * burst));
    const [cx, cy] = [800 + Math.cos(p.a) * r, 500 + Math.sin(p.a) * r * 0.75];
    const [ex, ey] = [800 + Math.cos(p.a) * (r + len), 500 + Math.sin(p.a) * (r + len) * 0.75];
    const ink = t < mid ? 255 : Math.round(lerp(40, 255, 1 - bg));
    ctx.strokeStyle = `rgba(${ink},${ink},${ink},${p.l})`;
    ctx.lineWidth = p.w;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  place(star6, { s: t < mid ? 0.35 + 0.4 * prog(t, c, mid) : 0.75 + 0.35 * Math.exp(-burst * 4), rz: (t - c) * 40, o: out3(prog(t, c + 0.3, mid)) });
}

// ── 7 · Close the day: the cash counted, sent to the owner, balanced ────────────────────────────────────────────
const s7 = $('s7');
s7.style.background = 'radial-gradient(1000px 700px at 50% 50%, #5a40f0, #2a1aa8)';
make(s7, '<img src="shots/gents-closing.png" style="width:100%">', 'c', 'width:760px;opacity:.28;filter:blur(18px);transform:translate(-50%,-50%) rotate(-8deg)');
const card = make(s7, `
  <div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font:600 44px Pop;color:#0B0916">Close the day</div><div class="mono" style="font-size:15px;color:#0B0916;opacity:.55">Thu 15 Oct</div></div>
  <div style="font:400 24px Pop;color:#8C8A99;margin:2px 0 26px">Al Barsha Gents</div>
  <div class="row7"><span>Cash counted</span><b>AED 474.50</b></div>
  <div class="row7"><span>Expected</span><b>AED 474.50</b></div>
  <div class="row7"><span>Send to the owner</span><div id="toggle" style="width:70px;height:40px;border-radius:20px;position:relative"><div id="knob" style="position:absolute;top:4px;width:32px;height:32px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25)"></div></div></div>
  <div id="bar7" style="margin-top:26px;height:70px;border-radius:35px;background:#15121F;position:relative;overflow:hidden">
    <div id="fill7" style="position:absolute;inset:0 auto 0 0;background:#2f2b3d"></div>
    <div id="label7" style="position:relative;line-height:70px;text-align:center;font:600 28px Pop;color:#fff"></div></div>`,
'c', 'width:680px;padding:42px 44px;border-radius:34px;background:#fff;box-shadow:0 40px 90px rgba(10,0,60,.45)');
for (const r of card.querySelectorAll('.row7')) r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font:400 28px Pop;color:#15121F;padding:13px 0;border-top:1px solid #EEECF4';
function shot7(t) {
  const c = CUTS[6];
  const p = out3(prog(t, c, c + 0.28));
  place(card, { s: lerp(0.86, 1, p), o: p, blur: (1 - p) * 14, y: -6 * Math.sin((t - c) * 3) });
  const on = out3(prog(t, c + 0.4, c + 0.55));
  $('toggle').style.background = on > 0.5 ? '#F2777A' : '#D9D6E2';
  $('knob').style.left = `${lerp(4, 34, on)}px`;
  const f = inOut(prog(t, c + 0.35, c + 1.08));
  const done = t >= c + 1.1;
  $('fill7').style.width = `${(f * 100).toFixed(1)}%`;
  $('bar7').style.background = done ? '#7FE0D2' : '#15121F';
  $('fill7').style.visibility = done ? 'hidden' : 'visible';
  $('label7').style.color = done ? '#0B0916' : '#fff';
  $('label7').textContent = done ? '✓ Balanced' : `Closing… ${Math.round(f * 100)}%`;
}

// ── 8 · Everything the salon runs on, pulled into one ───────────────────────────────────────────────────────────
const s8 = $('s8');
s8.style.background = '#F2777A';
place(make(s8, '<svg width="760" height="760" style="display:block"><circle cx="380" cy="380" r="360" fill="none" stroke="#fff" stroke-width="3"/></svg>', 'c'));
const PARTS = ['Queue', 'Sales', 'Stock', 'Staff', 'Payroll', 'VAT', 'Reports'];
const parts = PARTS.map((name, i) => ({
  dot: make(s8, '', 'c', `width:${[86, 64, 50, 72, 44, 40, 58][i]}px;height:${[86, 64, 50, 72, 44, 40, 58][i]}px;border-radius:50%;background:#0B0916`),
  label: make(s8, name, 'c mono', 'color:#0B0916;font-size:18px'),
  a: (i / PARTS.length) * Math.PI * 2 + 0.4, r: [150, 250, 200, 90, 270, 170, 230][i],
}));
const one = make(s8, '', 'c', 'width:120px;height:120px;border-radius:50%;background:#0B0916;z-index:5');
function shot8(t) {
  const c = CUTS[7];
  const m = inOut(prog(t, c + 0.8, c + 1.2));
  for (const p of parts) {
    const a = p.a + (t - c) * 0.5;
    const [x, y] = [Math.cos(a) * p.r * (1 - m), Math.sin(a) * p.r * (1 - m)];
    place(p.dot, { x, y, o: 1 - prog(t, c + 1.15, c + 1.25), s: 1 + 0.12 * kick(t) });
    place(p.label, { x: x + 20, y: y - 52, o: out3(prog(t, c + 0.1, c + 0.35)) * (1 - prog(t, c + 0.7, c + 0.85)) });
  }
  const g = Math.pow(prog(t, c + 1.25, CUTS[8]), 2.2);
  place(one, { s: (t < c + 1.15 ? 0 : back(prog(t, c + 1.15, c + 1.3))) * (1 + g * 30) });
}

// ── 9 · The end card ────────────────────────────────────────────────────────────────────────────────────────────
const s9 = $('s9');
s9.style.background = 'radial-gradient(900px 600px at 50% 45%, #182235, #0B0916)';
const mark = make(s9, '<img src="/assets/images/splash-icon.png" style="width:150px;filter:drop-shadow(0 0 26px rgba(127,224,210,.9))"><div id="wm" style="width:470px;height:121px;background:#fff;-webkit-mask-size:100% 100%;mask-size:100% 100%"></div>', 'c', 'display:flex;align-items:center;gap:6px');
const serif9 = make(s9, 'salon software', 'c', 'font:italic 400 78px/1 ReelSerif;color:#F2777A;white-space:nowrap');
const rule9 = make(s9, '', 'c', 'width:440px;height:2px;background:rgba(255,255,255,.3)');
const claim9 = make(s9, 'Every sale, on record.', 'c mono', 'color:#7FE0D2;font-size:26px;letter-spacing:.3em');
const foot9 = make(s9, 'saloqo.com · free for 7 days · barber shops & ladies salons', 'c mono', 'color:#fff;opacity:.5;font-size:16px');
function shot9(t) {
  const c = CUTS[8];
  const a = out3(prog(t, c + 0.1, c + 0.5));
  place(mark, { y: -120, s: lerp(0.9, 1, a), o: a, blur: (1 - a) * 16 });
  const b = out3(prog(t, c + 0.45, c + 0.85));
  place(serif9, { x: lerp(60, 0, b), y: 20, o: b, blur: (1 - b) * 10 });
  place(rule9, { y: 105, s: 1, o: out3(prog(t, c + 0.7, c + 1.0)) });
  rule9.style.transform += ` scaleX(${out3(prog(t, c + 0.7, c + 1.1))})`;
  place(claim9, { y: 160, o: out3(prog(t, c + 0.9, c + 1.2)) });
  place(foot9, { y: 395, o: out3(prog(t, c + 1.3, c + 1.7)) });
}

// ── The caption, and its reflection in the desk ────────────────────────────────────────────────────────────────
Object.assign($('cap').style, { left: '60px', top: '300px', transform: 'rotate(3.5deg)' });
Object.assign($('cap-mirror').style, { left: '60px', top: '1660px', transform: 'scaleY(-1) rotate(-3.5deg)', filter: 'blur(1.5px)' });
function caption(t) {
  const o = out3(prog(t, 0, 0.25));
  $('cap').style.opacity = o;
  $('cap-mirror').style.opacity = 0.32 * o;
}

const SHOTS = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9];
window.DURATION = DURATION;
window.seek = (t) => {
  const i = shotAt(t);
  shotEls.forEach((el, k) => (el.style.display = k === i ? 'block' : 'none')); // display, not visibility: a child shown stays seen
  SHOTS[i](t);
  room(t);
  hud(t);
  caption(t);
  $('frame').style.filter = t > DURATION - 0.3 ? `brightness(${1 - prog(t, DURATION - 0.3, DURATION)})` : 'none';
};
// Music only: the reel's sound is its track (MUSIC_REEL in render.mjs), with no effects over it.
window.CUES = [];

// The wordmark, lifted out of the logo artwork's navy ground (as in scene.js).
async function wordmark() {
  const img = new Image();
  img.src = '/docs/brand/saloqo-logo.jpg';
  await img.decode();
  const [x, y, w, h] = [184, 725, 528, 136];
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d');
  g.drawImage(img, x, y, w, h, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    d.data[i + 3] = clamp(((d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3 - 40) / 170) * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
  }
  g.putImageData(d, 0, 0);
  $('wm').style.webkitMaskImage = $('wm').style.maskImage = `url(${c.toDataURL()})`;
}
window.ready = (async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  await wordmark();
  window.seek(0);
  return true;
})();
