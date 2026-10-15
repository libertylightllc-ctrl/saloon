"""The product video's sound effects, made from scratch (no recordings, so nothing to license).

    python3 sfx.py cues.json 43.1 out.wav

cues.json is scene-late.js's CUES: [[seconds, sound, {options}], ...]. Each sound is synthesised here (filtered noise
for whooshes, sine partials for chimes and pops), placed at its moment, then the mix gets a little room and a limiter.
"""
import json
import sys
import wave

import numpy as np

SR = 48_000
rng = np.random.default_rng(15)


def secs(d):
    return np.arange(int(d * SR)) / SR


def band_noise(dur, centers, width_oct=0.9):
    """Noise through a band-pass whose centre follows `centers` (Hz, one per STFT frame, interpolated)."""
    n = int(dur * SR)
    frame, hop = 2048, 512
    x = rng.standard_normal(n + frame)
    win = np.hanning(frame)
    starts = np.arange(0, n, hop)
    frames = np.stack([x[s:s + frame] * win for s in starts])
    spec = np.fft.rfft(frames, axis=1)
    freqs = np.fft.rfftfreq(frame, 1 / SR)
    c = np.interp(np.linspace(0, 1, len(starts)), np.linspace(0, 1, len(centers)), centers)
    mask = np.exp(-0.5 * ((np.log2(freqs[None, :] + 20) - np.log2(c[:, None])) / (width_oct / 2)) ** 2)
    out = np.fft.irfft(spec * mask, axis=1) * win
    y = np.zeros(n + frame)
    norm = np.zeros(n + frame)
    for i, s in enumerate(starts):
        y[s:s + frame] += out[i]
        norm[s:s + frame] += win ** 2
    y = y[:n] / np.maximum(norm[:n], 1e-3)
    return y / (np.abs(y).max() + 1e-9)


def pan(mono, p=0.0, to=None):
    """Equal-power stereo; `to` moves the sound from p to `to` over its length."""
    pos = np.linspace(p, p if to is None else to, len(mono))
    a = (pos + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def whoosh(dur=0.8, peak=0.55, down=False, pan_from=-0.5, **_):
    t = np.linspace(0, 1, 64)
    rise = np.minimum(t / peak, 1)
    centers = 350 + 3800 * (rise if not down else 1 - t) ** 1.6 * (1 - 0.5 * np.maximum(t - peak, 0) / (1 - peak))
    y = band_noise(dur, centers, 1.1)
    u = np.linspace(0, 1, len(y))
    env = np.where(u < peak, (u / peak) ** 2.2, np.exp(-(u - peak) / (1 - peak) * 4.5))
    if down:
        env = np.where(u < 0.08, u / 0.08, np.exp(-(u - 0.08) * 4))
    return pan(y * env, pan_from, -pan_from)


def swell(dur=0.8, **_):
    """A riser into a change of scene."""
    t = secs(dur)
    y = band_noise(dur, np.geomspace(250, 7000, 64), 1.3) * (t / dur) ** 3
    glide = np.sin(2 * np.pi * np.cumsum(np.linspace(110, 330, len(t))) / SR) * (t / dur) ** 2 * 0.35
    return pan(y + glide)


def blip(**_):
    t = secs(0.09)
    y = (np.sin(2 * np.pi * 1850 * t) + 0.5 * np.sin(2 * np.pi * 2775 * t)) * np.exp(-t * 55) * np.minimum(t / 0.003, 1)
    return pan(y * 0.6)


def pulse(**_):
    t = secs(1.2)
    y = np.sin(2 * np.pi * (70 - 15 * t) * t) * np.exp(-t * 3.2) * np.minimum(t / 0.01, 1)
    return pan(y + 0.25 * band_noise(1.2, [180, 120], 1.5) * np.exp(-t * 6))


def click(**_):
    t = secs(0.06)
    noise = np.diff(rng.standard_normal(len(t) + 1)) * np.exp(-t * 400)
    tone = np.sin(2 * np.pi * 3100 * t) * np.exp(-t * 120)
    return pan(0.5 * noise + tone, 0.15)


def pop(**_):
    t = secs(0.25)
    f = 260 + 900 * np.exp(-t * 60)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * np.minimum(t / 0.002, 1)
    return pan(y)


def bell(freq, dur, decay):
    t = secs(dur)
    y = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * decay * m ** 0.7)
            for m, a in [(1, 1), (2.0, 0.35), (3.01, 0.18), (4.2, 0.08)])
    return y * np.minimum(t / 0.004, 1)


def chime(**_):
    y = np.zeros(int(1.6 * SR))
    for start, f in [(0, 1318.5), (0.09, 1975.5)]:
        s = int(start * SR)
        b = bell(f, 1.6 - start, 2.2)
        y[s:s + len(b)] += b
    return pan(y * 0.6)


def tick(step=0, **_):
    """The tick beside each of the owner's benefits, a little higher each time."""
    f = 880 * 2 ** ([0, 2, 4, 7, 9, 12][step % 6] / 12)
    y = bell(f, 0.35, 9) * 0.7
    c = click()[:, 0]
    y[:len(c)] += c * 0.25
    return pan(y, -0.2 + 0.08 * step)


def sparkle(**_):
    y = np.zeros((int(1.3 * SR), 2))
    for _ in range(16):
        start = rng.uniform(0, 0.9)
        b = bell(rng.uniform(3200, 7200), 0.3, 14) * rng.uniform(0.2, 0.5)
        s = int(start * SR)
        y[s:s + len(b)] += pan(b, rng.uniform(-0.8, 0.8))
    return y


def shimmer(dur=1.8, **_):
    t = secs(dur)
    env = np.minimum(t / (dur * 0.35), 1) * np.exp(-np.maximum(t - dur * 0.35, 0) * 3 / dur)
    y = sum(a * np.sin(2 * np.pi * f * t + ph) * (1 + 0.3 * np.sin(2 * np.pi * (3 + k) * t))
            for k, (f, a, ph) in enumerate([(1046.5, 0.5, 0), (1568, 0.35, 1), (2093, 0.3, 2), (2637, 0.2, 3), (3136, 0.15, 4)]))
    air = band_noise(dur, [5000, 9000], 1.0) * 0.25
    return pan((y + air) * env * 0.5, -0.4, 0.4)


def boom(**_):
    t = secs(2.2)
    f = 42 + 50 * np.exp(-t * 7)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * np.minimum(t / 0.005, 1)
    thump = band_noise(2.2, [160, 70], 1.2) * np.exp(-t * 9) * 0.5
    return pan(y + thump)


SOUNDS = dict(whoosh=whoosh, swell=swell, blip=blip, pulse=pulse, click=click, pop=pop, chime=chime, tick=tick,
              sparkle=sparkle, shimmer=shimmer, boom=boom)
LEVEL_DB = dict(whoosh=-11, swell=-14, blip=-27, pulse=-14, click=-12, pop=-13, chime=-11, tick=-15, sparkle=-17,
                shimmer=-17, boom=-9)


def room(x):
    """A small, dark room (a decaying noise tail), mixed in lightly so the sounds sit together."""
    t = secs(0.9)
    ir = rng.standard_normal(len(t)) * np.exp(-t * 6)
    ir = np.convolve(ir, np.ones(12) / 12, mode='same')
    ir /= np.abs(ir).sum()
    n = len(x) + len(ir)
    size = 1 << (n - 1).bit_length()
    wet = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], size) * np.fft.rfft(ir, size), size)[:len(x)] for c in (0, 1)], axis=1)
    return x + wet * 6


def main():
    cues, duration, out = json.load(open(sys.argv[1])), float(sys.argv[2]), sys.argv[3]
    mix = np.zeros((int((duration + 3) * SR), 2))
    for at, name, *rest in cues:
        opts = rest[0] if rest else {}
        gain = opts.pop('gain', 0)
        if 'pan' in opts:
            opts['pan_from'] = opts.pop('pan')
        y = SOUNDS[name](**opts) * 10 ** ((LEVEL_DB[name] + gain) / 20)
        s = int(at * SR)
        mix[s:s + len(y)] += y[: len(mix) - s]
    mix = room(mix)[: int(duration * SR)]
    mix /= max(np.abs(mix).max(), 1e-9) / 0.9
    mix = np.tanh(mix * 1.4) / np.tanh(1.4) * 0.89
    fade = np.minimum(np.linspace(duration, 0, len(mix)) / 0.6, 1)[:, None]
    data = (mix * fade * 32767).astype('<i2')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == '__main__':
    main()
