// The second half of the timeline (after scene.js, whose helpers it uses): what the owner gets, both looks and every
// language, the end card — and CUES, the sound effects, each at the moment it belongs to (sfx.py makes them).

// 6 · For the owner (owner, 2026-10-15: "show benefits for owner"). Each line is something the app really does.
const BENEFITS = [
  'See sales and cash live, from anywhere',
  'Cash that adds up, every night',
  'Staff pay and commission worked out for you',
  'Licence and visa reminders, on time',
  'Low-stock alerts before you run out',
  'Reports ready for your accountant',
];
const BENEFIT_AT = (i) => 28.8 + i * 0.6;
const benefitRows = BENEFITS.map((text) => {
  const row = document.createElement('div');
  row.className = 'benefit';
  row.innerHTML = `<div class="tick"><svg width="38" height="38" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0B0916" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><span></span>`;
  row.querySelector('span').textContent = text;
  $('benefits').appendChild(row);
  return row;
});
words('w-owners', [{ text: 'Made for salon owners', start: 27.85 }], 92);

// 7 · Both looks, every language (6.5 s after where it was before the owner's scene).
const LATE = 6.5;
words('w-barber', [{ text: '✦ Barber shops', start: 28.0 + LATE }], 112);
words('w-ladies', [{ text: '✦ Ladies salons & spas', start: 29.55 + LATE }], 112);

function late(t) {
  // 6 · The owner's Home on the phone; what they get, ticked off one by one.
  const ph = out3(prog(t, 27.7, 28.8));
  const away = inOut(prog(t, 33.6, 34.2));
  place($('p-owner'), {
    x: -560 - away * 200, y: lerp(560, 70, ph), ry: lerp(30, 16, ph), rx: lerp(20, 4, ph), rz: -2, s: 0.86,
    o: ph * (1 - away), blur: away * 18,
  });
  reveal('w-owners', t);
  $('w-owners').style.color = '#BDEFE8';
  place($('w-owners'), { x: 220, y: -370, o: win(t, 27.8, 34.1, 0.01, 0.45) });
  place($('benefits'), { x: 240, y: 60, o: 1 - away, blur: away * 14 });
  benefitRows.forEach((row, i) => {
    const p = out3(prog(t, BENEFIT_AT(i) - 0.1, BENEFIT_AT(i) + 0.4));
    row.style.opacity = p;
    row.style.transform = `translateX(${((1 - p) * 70).toFixed(1)}px)`;
    const tick = back(prog(t, BENEFIT_AT(i), BENEFIT_AT(i) + 0.4));
    row.firstChild.style.transform = `scale(${lerp(0.2, 1, tick).toFixed(3)})`;
  });

  // 7 · Both looks, every language.
  const u = t - LATE;
  const fan = out3(prog(u, 27.7, 28.9));
  const fanOut = inOut(prog(u, 31.0, 31.6));
  [['p-gents', -470, -9], ['p-ar', 0, 0], ['p-ladies', 470, 9]].forEach(([id, x, rz], i) => {
    place($(id), {
      x: x * fan, y: lerp(220, 150, fan) - fanOut * 80 + (i === 1 ? 0 : 30),
      z: i === 1 ? -200 : -80, rz: rz * fan, rx: 14, s: 0.78,
      o: out3(prog(u, 27.6 + i * 0.15, 28.4 + i * 0.15)) * (1 - fanOut), blur: (i === 1 ? 3 : 0) + fanOut * 18,
    });
  });
  reveal('w-barber', t);
  $('w-barber').style.color = '#B7A4FB';
  place($('w-barber'), { y: -360, o: win(u, 27.9, 29.5, 0.01, 0.3) });
  reveal('w-ladies', t);
  $('w-ladies').style.color = '#F8B4B6';
  place($('w-ladies'), { y: -360, o: win(u, 29.45, 31.4, 0.01, 0.35) });
  place($('langs'), { y: -250, o: win(u, 29.9, 31.4, 0.5, 0.35) });

  // 8 · End card.
  const e = out3(prog(u, 31.6, 32.6));
  place($('end-star'), { y: lerp(-150, -210, e), s: lerp(0.6, 1, e), rz: lerp(-60, 0, e), o: e });
  place($('wordmark'), { y: 20, o: out3(prog(u, 32.1, 32.9)), blur: (1 - out3(prog(u, 32.1, 32.9))) * 14 });
  place($('tagline'), { y: 150, o: out3(prog(u, 32.7, 33.4)) * 0.85 });
  const tryIn = back(prog(u, 33.3, 33.9));
  place($('try'), { y: 270, s: lerp(0.6, 1, tryIn), o: clamp(tryIn * 2) });
  place($('url'), { y: 375, o: out3(prog(u, 33.8, 34.4)) });
}

// The sound effects: [seconds, sound, options]. sfx.py has the sounds; render.mjs hands this list over. The music
// carries the video, so only the key moments get a sound: the screens flying in on the drop, the star's streak, the
// icon, the Checkout tap, "Sale saved", "Balanced" and the logo.
window.CUES = [
  [8.1, 'whoosh', { dur: 0.8, pan: 0.4, gain: -4 }],
  [12.0, 'whoosh', { dur: 3.3, peak: 0.45, gain: -2 }],
  [15.95, 'pop'],
  [19.05, 'click'],
  [20.55, 'chime'],
  [24.35, 'pop'],
  [38.1, 'boom'], [38.15, 'shimmer', { dur: 3.2, gain: -4 }],
];
