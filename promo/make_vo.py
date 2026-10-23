"""Generate voiceover segments with Kokoro TTS (offline, Apache-2.0).

Usage: python make_vo.py <model_dir> <out_dir>
  model_dir holds kokoro.onnx (kokoro-v1.0.int8.onnx) and voices.bin (voices-v1.0.bin) from
  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
Writes one wav per line plus durations.json (seconds, leading/trailing silence trimmed).
"""
import json, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

LINES = [
    # id, text, voice, lang, speed
    ("v1", "This is Odile. In March, she's leading thirty-five of us to Strasbourg. And honestly? She's a little nervous.", "af_heart", "en-us", 1.0),
    ("v2a", "So she starts with the nest.", "af_heart", "en-us", 1.0),
    ("v2b", "Passport? Check!", "af_heart", "en-us", 1.0),
    ("v2c", "Packing list? Check!", "af_heart", "en-us", 1.0),
    ("v2d", "One to-do at a time.", "af_heart", "en-us", 1.0),
    ("v3", "Next, she maps the trip. Every day, every tram, every meeting spot, right in your pocket.", "af_heart", "en-us", 1.05),
    ("v4", "Tickets, forms, insurance. Every document, tucked safely in the nest.", "af_heart", "en-us", 1.0),
    ("v5a", "Then, a few minutes a day. French...", "af_heart", "en-us", 1.0),
    ("v5fr", "Bonjour !", "ff_siwis", "fr-fr", 1.0),
    ("v5b", "scripture memory, and culture, with streaks that keep the whole team going.", "af_heart", "en-us", 1.05),
    ("v6", "By March, we won't just be packed. We'll be ready. Together.", "af_heart", "en-us", 0.95),
    ("v7", "Le Nid.", "af_heart", "en-us", 0.9),
    ("v7fr", "On y va !", "ff_siwis", "fr-fr", 1.0),
]


def trim(x, sr, thr=0.01, pad=0.04):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


def main():
    model_dir, out_dir = sys.argv[1], sys.argv[2]
    k = Kokoro(f"{model_dir}/kokoro.onnx", f"{model_dir}/voices.bin")
    durs = {}
    for lid, text, voice, lang, speed in LINES:
        s, sr = k.create(text, voice=voice, speed=speed, lang=lang)
        s = trim(np.asarray(s, dtype=np.float32), sr)
        sf.write(f"{out_dir}/{lid}.wav", s, sr)
        durs[lid] = round(len(s) / sr, 3)
        print(lid, durs[lid], text)
    with open(f"{out_dir}/durations.json", "w") as f:
        json.dump(durs, f, indent=1)


if __name__ == "__main__":
    main()
