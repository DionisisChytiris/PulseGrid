"""Embed all metronome click samples as PCM16 mono C++ constexpr arrays."""
from __future__ import annotations

import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "modules/native-audio/android/src/main/res/raw"
OUT = ROOT / "modules/native-audio/android/src/main/cpp/ClickSampleData.h"

SAMPLES = [
    ("accent", RAW_DIR / "click_accent.wav"),
    ("normal", RAW_DIR / "click_normal.wav"),
    ("subdivision", RAW_DIR / "click_subdivision.wav"),
]


def read_pcm16_mono(path: Path) -> tuple[list[int], int]:
    with wave.open(str(path), "rb") as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise SystemExit(f"Expected PCM16 mono WAV: {path}")
        frames = w.getnframes()
        rate = w.getframerate()
        data = struct.unpack("<" + "h" * frames, w.readframes(frames))
    return list(data), rate


def emit_array(name: str, samples: list[int]) -> list[str]:
    lines = [
        f"inline constexpr std::size_t k{name}FrameCount = {len(samples)};",
        f"inline constexpr int16_t k{name}Pcm16Mono[] = {{",
    ]
    for i in range(0, len(samples), 12):
        chunk = samples[i : i + 12]
        lines.append("    " + ", ".join(str(s) for s in chunk) + ",")
    lines.append("};")
    return lines


def main() -> None:
    header_lines = [
        "#pragma once",
        "",
        "#include <cstddef>",
        "#include <cstdint>",
        "",
        "namespace click_sample_data {",
    ]

    sample_rate: int | None = None
    for name, path in SAMPLES:
        samples, rate = read_pcm16_mono(path)
        if sample_rate is None:
            sample_rate = rate
        elif rate != sample_rate:
            raise SystemExit(f"Sample rate mismatch: {path} is {rate}, expected {sample_rate}")
        header_lines.append("")
        header_lines.extend(emit_array(name.capitalize(), samples))
        print(f"  {name}: {len(samples)} frames @ {rate} Hz")

    header_lines.append("")
    header_lines.append(f"inline constexpr int32_t kSampleRate = {sample_rate};")
    header_lines.extend(["", "}", ""])

    OUT.write_text("\n".join(header_lines), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
