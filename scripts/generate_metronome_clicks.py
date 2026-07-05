"""Generate ultra-short metronome click WAVs for dense subdivisions."""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44_100
ROOT = Path(__file__).resolve().parents[1]


def _render_click(
    duration_ms: float,
    frequency_hz: float,
    peak: float,
    decay_exponent: float = 10.0,
) -> list[int]:
    frame_count = max(1, int(SAMPLE_RATE * duration_ms / 1000.0))
    raw: list[float] = []

    for index in range(frame_count):
        progress = index / max(frame_count - 1, 1)
        envelope = (1.0 - progress) ** decay_exponent
        time_s = index / SAMPLE_RATE
        # cos(0) == 1 — peak energy on sample 0 (sin starts at 0 and sounds late/uneven).
        body = math.cos(2.0 * math.pi * frequency_hz * time_s)
        harmonic = 0.2 * math.cos(2.0 * math.pi * frequency_hz * 2.0 * time_s)
        raw.append(envelope * peak * (body + harmonic))

    max_abs = max(abs(sample) for sample in raw) or 1.0
    scale = 0.95 / max_abs
    return [
        int(max(-32_767, min(32_767, round(sample * scale * 32_767))))
        for sample in raw
    ]


def _write_wav(path: Path, samples: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(b"".join(struct.pack("<h", sample) for sample in samples))


def _duration_ms(path: Path) -> float:
    with wave.open(str(path), "rb") as wav_file:
        return wav_file.getnframes() / wav_file.getframerate() * 1000.0


def main() -> None:
    clicks = {
        # Same duration — accent differs only by pitch/loudness (avoids uneven downbeats).
        "click_normal.wav": _render_click(duration_ms=10.0, frequency_hz=2_400.0, peak=0.70),
        "click_accent.wav": _render_click(duration_ms=10.0, frequency_hz=3_200.0, peak=0.92),
        "click_subdivision.wav": _render_click(
            duration_ms=5.0,
            frequency_hz=2_100.0,
            peak=0.45,
            decay_exponent=12.0,
        ),
    }

    native_dirs = [
        ROOT / "modules" / "native-audio" / "android" / "src" / "main" / "res" / "raw",
        ROOT / "modules" / "native-audio" / "ios" / "Assets",
    ]

    for name, samples in clicks.items():
        targets = [ROOT / "assets" / "audio" / name]
        targets.extend(directory / name for directory in native_dirs)

        for target in targets:
            _write_wav(target, samples)
            print(f"wrote {target} ({_duration_ms(target):.2f}ms)")


if __name__ == "__main__":
    main()
