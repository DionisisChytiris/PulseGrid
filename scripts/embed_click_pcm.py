"""Embed all metronome click samples as PCM16 mono C++ constexpr arrays."""
from __future__ import annotations

import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "modules/native-audio/android/src/main/res/raw"
OUT = ROOT / "modules/native-audio/android/src/main/cpp/ClickSampleData.h"

NORMAL_SAMPLES = [
    ("NormalClassic", RAW_DIR / "click_normal_classic.wav"),
    ("NormalSoft", RAW_DIR / "click_normal_soft.wav"),
    ("NormalDigital", RAW_DIR / "click_normal_digital.wav"),
    ("NormalBright", RAW_DIR / "click_normal_bright.wav"),
    ("NormalCowbell", RAW_DIR / "click_normal_cowbell.wav"),
]

ACCENT_SAMPLES = [
    ("AccentClassic", RAW_DIR / "click_accent_classic.wav"),
    ("AccentStrong", RAW_DIR / "click_accent_strong.wav"),
    ("AccentDigital", RAW_DIR / "click_accent_digital.wav"),
    ("AccentCowbell", RAW_DIR / "click_accent_cowbell.wav"),
]

SUBDIVISION_SAMPLES = [
    ("SubdivisionClassic", RAW_DIR / "click_subdivision_classic.wav"),
    ("SubdivisionSoft", RAW_DIR / "click_subdivision_soft.wav"),
    ("SubdivisionDigital", RAW_DIR / "click_subdivision_digital.wav"),
    ("SubdivisionBright", RAW_DIR / "click_subdivision_bright.wav"),
    ("SubdivisionCowbell", RAW_DIR / "click_subdivision_cowbell.wav"),
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


def emit_group(title: str, samples: list[tuple[str, Path]]) -> list[str]:
    lines = [f"// {title}"]
    sample_rate: int | None = None
    for name, path in samples:
        pcm, rate = read_pcm16_mono(path)
        if sample_rate is None:
            sample_rate = rate
        elif rate != sample_rate:
            raise SystemExit(f"Sample rate mismatch: {path} is {rate}, expected {sample_rate}")
        lines.append("")
        lines.extend(emit_array(name, pcm))
        print(f"  {name}: {len(pcm)} frames @ {rate} Hz")
    return lines


def emit_enum(enum_name: str, entries: list[tuple[str, Path]], prefix: str) -> list[str]:
    lines = [f"enum class {enum_name} : int {{"]
    for index, (name, _) in enumerate(entries):
        case_name = name[len(prefix) :]
        lines.append(f"  {case_name} = {index},")
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
        "",
    ]

    header_lines.extend(emit_enum("NormalSound", NORMAL_SAMPLES, "Normal"))
    header_lines.append("")
    header_lines.extend(emit_enum("AccentSound", ACCENT_SAMPLES, "Accent"))
    header_lines.append("")
    header_lines.append(f"inline constexpr int kNormalSoundCount = {len(NORMAL_SAMPLES)};")
    header_lines.append(f"inline constexpr int kAccentSoundCount = {len(ACCENT_SAMPLES)};")

    header_lines.extend(emit_group("Normal click variants", NORMAL_SAMPLES))
    header_lines.extend(emit_group("Accent click variants", ACCENT_SAMPLES))
    header_lines.extend(emit_group("Subdivision click variants", SUBDIVISION_SAMPLES))

    _, rate = read_pcm16_mono(NORMAL_SAMPLES[0][1])
    header_lines.append("")
    header_lines.append(f"inline constexpr int32_t kSampleRate = {rate};")
    header_lines.extend(["", "}", ""])

    OUT.write_text("\n".join(header_lines), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
