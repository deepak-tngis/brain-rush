#!/usr/bin/env python3
"""Synthesises Brain Rush's sound effects.

The effects are generated from scratch with the Python standard library rather
than sourced from a sample pack, which makes them unambiguously royalty-free and
keeps them tiny: mono, 22.05 kHz, 16-bit, none longer than 0.9 s.

Run from the repository root:

    python3 tools/generate-sounds.py

Output: assets/sounds/*.wav
"""

from __future__ import annotations

import math
import os
import struct
import wave

SAMPLE_RATE = 22050
AMPLITUDE = 0.55
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")


def envelope(position: float, attack: float, release: float) -> float:
    """Attack/release shaping so no effect starts or ends on a click."""
    if position < attack:
        return position / attack
    if position > 1.0 - release:
        return max(0.0, (1.0 - position) / release)
    return 1.0


def tone(
    frequency: float,
    duration: float,
    *,
    wave_shape: str = "sine",
    gain: float = 1.0,
    attack: float = 0.02,
    release: float = 0.35,
    sweep: float = 1.0,
    harmonics: tuple[tuple[float, float], ...] = (),
) -> list[float]:
    frames = int(SAMPLE_RATE * duration)
    out: list[float] = []
    phase = 0.0
    for index in range(frames):
        position = index / frames
        current = frequency * (sweep ** position)
        phase += 2.0 * math.pi * current / SAMPLE_RATE

        if wave_shape == "square":
            value = 1.0 if math.sin(phase) >= 0 else -1.0
        elif wave_shape == "triangle":
            value = 2.0 / math.pi * math.asin(math.sin(phase))
        else:
            value = math.sin(phase)

        for multiple, level in harmonics:
            value += level * math.sin(phase * multiple)

        out.append(value * gain * envelope(position, attack, release))
    return out


def silence(duration: float) -> list[float]:
    return [0.0] * int(SAMPLE_RATE * duration)


def mix(*layers: list[float]) -> list[float]:
    length = max(len(layer) for layer in layers)
    out = [0.0] * length
    for layer in layers:
        for index, value in enumerate(layer):
            out[index] += value
    return out


def sequence(*parts: list[float]) -> list[float]:
    out: list[float] = []
    for part in parts:
        out.extend(part)
    return out


def write(name: str, samples: list[float]) -> None:
    peak = max((abs(value) for value in samples), default=1.0) or 1.0
    scale = AMPLITUDE / peak
    frames = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, value * scale)) * 32767)) for value in samples
    )

    path = os.path.join(OUT_DIR, name)
    with wave.open(path, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(frames)
    print(f"{name}: {len(frames) + 44} bytes")


# Equal-tempered pitches used across the set.
C5, E5, G5, A5, C6, E6, G6 = 523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1568.0
G3, C4, E4, G4 = 196.0, 261.63, 329.63, 392.0


def build() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    # A soft, short click for every button press.
    write("tap.wav", tone(A5, 0.055, wave_shape="triangle", attack=0.05, release=0.7))

    # Rising two-note chime: unmistakably "yes".
    write(
        "correct.wav",
        sequence(
            tone(E5, 0.085, harmonics=((2.0, 0.2),), release=0.5),
            tone(A5, 0.18, harmonics=((2.0, 0.25), (3.0, 0.1)), release=0.6),
        ),
    )

    # Low detuned buzz: clearly negative without being harsh.
    write(
        "wrong.wav",
        mix(
            tone(G3, 0.2, wave_shape="square", gain=0.5, release=0.5, sweep=0.82),
            tone(G3 * 1.03, 0.2, wave_shape="square", gain=0.35, release=0.5, sweep=0.82),
        ),
    )

    # Bright ascending sparkle for a streak milestone.
    write(
        "streak.wav",
        sequence(
            tone(C6, 0.07, release=0.6),
            tone(E6, 0.07, release=0.6),
            tone(G6, 0.16, harmonics=((2.0, 0.15),), release=0.65),
        ),
    )

    # Four-note fanfare for finishing the daily challenge.
    write(
        "level-complete.wav",
        sequence(
            tone(C5, 0.1, harmonics=((2.0, 0.2),), release=0.4),
            tone(E5, 0.1, harmonics=((2.0, 0.2),), release=0.4),
            tone(G5, 0.1, harmonics=((2.0, 0.2),), release=0.4),
            mix(
                tone(C6, 0.34, harmonics=((2.0, 0.2), (3.0, 0.08)), release=0.6),
                tone(G5, 0.34, gain=0.4, release=0.6),
            ),
        ),
    )

    # Descending minor run: the run is over.
    write(
        "game-over.wav",
        sequence(
            tone(G4, 0.13, wave_shape="triangle", release=0.45),
            tone(E4, 0.13, wave_shape="triangle", release=0.45),
            tone(C4, 0.34, wave_shape="triangle", harmonics=((2.0, 0.15),), release=0.6),
        ),
    )

    # Two-tone blip, the sound every player already associates with coins.
    write(
        "coin.wav",
        sequence(
            tone(C6, 0.055, wave_shape="triangle", release=0.4),
            tone(G6, 0.13, wave_shape="triangle", release=0.6),
        ),
    )


if __name__ == "__main__":
    build()
