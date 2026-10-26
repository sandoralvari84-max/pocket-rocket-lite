#!/usr/bin/env python3
"""
Persona UI sounds for Pocket Rocket — owned, procedural, tiny 22kHz mono WAVs in the
warm-90s-console spirit of the approved mockup. Two voices:
  SENTINEL = dry / sharp / robotic  -> square-wave blips, crisp envelopes.
  NOVA     = soft / warm            -> sine-wave chimes, gentle attack/decay.
Shared: a soft error "nope". Played via expo-audio, gated by settings.gameSound.

Regenerate: python tools/art/gen_sounds.py
"""
import os
import math
import struct
import wave

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "audio"))
os.makedirs(OUT, exist_ok=True)
SR = 22050


def tone(freq, dur, wave_type="sine", vol=0.5, a=0.006, d=None):
    """One enveloped tone. a=attack s, d=decay s (defaults to rest of the note)."""
    n = int(SR * dur)
    d = d if d is not None else dur
    out = []
    for i in range(n):
        t = i / SR
        ph = 2 * math.pi * freq * t
        if wave_type == "square":
            s = 1.0 if math.sin(ph) >= 0 else -1.0
        elif wave_type == "saw":
            s = 2.0 * (freq * t - math.floor(0.5 + freq * t))
        else:
            s = math.sin(ph)
        # attack
        env = min(1.0, t / a) if t < a else 1.0
        # decay toward the end
        rem = dur - t
        if rem < d:
            env *= max(0.0, rem / d)
        out.append(s * vol * env)
    return out


def seq(parts):
    out = []
    for p in parts:
        out.extend(p)
    return out


def mix(a, b):
    n = max(len(a), len(b))
    return [(a[i] if i < len(a) else 0) + (b[i] if i < len(b) else 0) for i in range(n)]


def save(name, samples):
    # soft clip + 16-bit
    frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32000)) for s in samples)
    with wave.open(os.path.join(OUT, name + ".wav"), "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(frames)


def main():
    SQ = "square"
    # --- SENTINEL: dry robotic square blips ---
    save("sentinel_wake", seq([tone(392, 0.07, SQ, 0.4), tone(587, 0.11, SQ, 0.42, d=0.10)]))
    save("sentinel_listen", seq([tone(520, 0.05, SQ, 0.35), tone(780, 0.09, SQ, 0.4, d=0.08)]))
    save("sentinel_send", seq([tone(760, 0.05, SQ, 0.4), tone(520, 0.08, SQ, 0.38, d=0.07)]))

    # --- NOVA: soft warm sine chimes ---
    save("nova_wake", seq([tone(523, 0.10, "sine", 0.5, a=0.012), tone(784, 0.20, "sine", 0.5, a=0.012, d=0.19)]))
    save("nova_listen", seq([tone(440, 0.08, "sine", 0.45, a=0.012), tone(660, 0.16, "sine", 0.45, a=0.012, d=0.15)]))
    save("nova_send", seq([tone(660, 0.08, "sine", 0.48, a=0.01), tone(523, 0.14, "sine", 0.46, a=0.01, d=0.13)]))

    # --- shared soft error "nope" (two slightly detuned low squares, descending) ---
    err = seq([mix(tone(180, 0.10, SQ, 0.28), tone(172, 0.10, SQ, 0.26)),
               mix(tone(150, 0.14, SQ, 0.26, d=0.13), tone(143, 0.14, SQ, 0.24, d=0.13))])
    save("ui_error", err)

    print("wrote 7 persona UI sounds to", OUT)


if __name__ == "__main__":
    main()
