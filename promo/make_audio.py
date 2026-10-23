"""Build the promo soundtrack: voiceover lines placed on the master timeline, a quiet synthesized
music bed (plucked chords + soft bass, ducked under the voice) and small UI sounds.

Usage: python make_audio.py <vo_dir> <out_wav>
  vo_dir: the wavs written by make_vo.py. Timings come from timeline.js (shared with index.html).
Only numpy and soundfile are needed; everything musical is synthesized here, so there is nothing to license.
"""
import json, sys, pathlib
import numpy as np
import soundfile as sf

SR = 48000
HERE = pathlib.Path(__file__).parent
TL = json.loads((HERE / "timeline.js").read_text().split("window.TL =", 1)[1].strip().rstrip(";"))
DUR = TL["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def add(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += gain * sig[: j - i]


def load(path):
    x, sr = sf.read(path, dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        n = int(len(x) * SR / sr)
        x = np.interp(np.arange(n) * sr / SR, np.arange(len(x)), x).astype(np.float32)
    return x / (np.abs(x).max() + 1e-9)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def pluck(f, sec=1.4, bright=1.0):
    """Ukulele-ish pluck: decaying harmonics with a soft attack."""
    t = t_axis(sec)
    s = np.zeros_like(t)
    for k in range(1, 9):
        if f * k > 12000:
            break
        s += (1 / k ** (1.2 / bright)) * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (2.6 + 1.7 * k))
    s *= np.minimum(1, t / 0.004)
    return s


def bell(f, sec=1.2):
    t = t_axis(sec)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 4) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 9)
    return s * np.minimum(1, t / 0.002)


def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def sweep(f0, f1, sec, decay=8.0):
    t = t_axis(sec)
    f = np.geomspace(f0, f1, len(t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay) * np.minimum(1, t / 0.003)


SFX = {
    "pop": lambda: sweep(500, 1300, 0.12, 25),
    "tap": lambda: sweep(900, 600, 0.05, 60) * 0.8,
    "hop": lambda: sweep(320, 820, 0.16, 14),
    "boing": lambda: np.sin(2 * np.pi * np.cumsum(260 * np.exp(-t_axis(0.45) * 2.2) * (1 + 0.12 * np.sin(2 * np.pi * 14 * t_axis(0.45)))) / SR) * np.exp(-t_axis(0.45) * 5),
    "whoosh": lambda: lowpass(rng.standard_normal(int(0.55 * SR)), 9) * np.sin(np.linspace(0, np.pi, int(0.55 * SR))) ** 2 * 0.6,
}


def ding():
    out = np.zeros(int(0.9 * SR))
    add(out, bell(hz(88), 0.8), 0.0, 0.7)   # E6
    add(out, bell(hz(93), 0.8), 0.075, 0.8)  # A6
    return out


def chime():
    out = np.zeros(int(1.8 * SR))
    for i, m in enumerate([84, 88, 91, 96]):  # C6 E6 G6 C7
        add(out, bell(hz(m), 1.4), i * 0.09, 0.55)
    return out


SFX["ding"], SFX["chime"] = ding, chime
SFX_GAIN = {"pop": .22, "tap": .25, "hop": .18, "boing": .25, "whoosh": .16, "ding": .22, "chime": .24}


def music():
    """Light plucked arpeggios at 104 bpm: tentative in the nest, fuller once she lands on the phone."""
    bpm = 104
    beat = 60 / bpm
    prog = [  # (bass root, chord tones) per bar; C G Am F
        (48, [60, 64, 67, 72]), (43, [59, 62, 67, 71]), (45, [60, 64, 69, 72]), (41, [60, 65, 69, 72]),
    ]
    m = np.zeros(N)
    land = TL["scene"]["land"]
    end_hit = TL["scene"]["logo"]
    t = 0.0
    bar = 0
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]  # eighth-note arpeggio order
    while t < end_hit - 0.05:
        root, tones = prog[bar % 4]
        full = t >= land - 0.2
        for e in range(8):
            at = t + e * beat / 2
            if at >= end_hit - 0.05:
                break
            if not full and e % 2:  # opening: only the on-beats, sparser and softer
                continue
            g = (0.5 if e % 2 else 0.75) * (1.0 if full else 0.6)
            add(m, pluck(hz(tones[pattern[e]]), 1.1), at, g * 0.5)
        if full:
            for b in (0, 2):  # soft bass on 1 and 3
                tb = t_axis(beat * 1.8)
                add(m, np.sin(2 * np.pi * hz(root) * tb) * np.exp(-tb * 2.2) * np.minimum(1, tb / 0.01), t + b * beat, 0.55)
            for e in range(8):  # brushed shaker on the off-eighths
                if e % 2:
                    nz = lowpass(rng.standard_normal(int(0.05 * SR)), 2) * np.exp(-t_axis(0.05) * 70)
                    add(m, nz, t + e * beat / 2, 0.05)
        t += 4 * beat
        bar += 1
    # final resolution: a strummed C chord that rings out under the logo
    for i, n in enumerate([48, 55, 60, 64, 67, 72]):
        add(m, pluck(hz(n), 3.6, 1.2), end_hit + i * 0.025, 0.45)
    # and a soft sustained pad so the end card doesn't fall into silence
    tp = t_axis(DUR - end_hit)
    pad = sum(np.sin(2 * np.pi * hz(n) * tp + n) for n in (48, 60, 64, 67)) / 4
    add(m, pad * np.minimum(1, tp / 0.8) * 0.35, end_hit)
    # fade out the tail
    tail = int((DUR - 1.2) * SR)
    m[tail:] *= np.linspace(1, 0, N - tail)
    return m


def main():
    vo_dir, out = pathlib.Path(sys.argv[1]), sys.argv[2]
    voice = np.zeros(N)
    active = np.zeros(N)
    for lid, at in TL["vo"].items():
        x = load(vo_dir / f"{lid}.wav")
        add(voice, x, at, 0.9)
        i = int(at * SR)
        active[i: i + len(x)] = 1
    # duck the music under the voice (smoothed so it breathes, not pumps)
    k = int(0.25 * SR)
    duck = 1 - 0.55 * np.convolve(active, np.ones(k) / k, mode="same")
    bed = music() * duck * 0.17
    fx = np.zeros(N)
    for name, at in TL["sfx"]:
        add(fx, SFX[name](), at, SFX_GAIN[name])
    mix = voice + bed + fx
    mix /= np.abs(mix).max() / 0.95
    stereo = np.stack([mix, mix], axis=1).astype(np.float32)
    sf.write(out, stereo, SR)
    print("wrote", out, f"{DUR:.1f}s")


if __name__ == "__main__":
    main()
