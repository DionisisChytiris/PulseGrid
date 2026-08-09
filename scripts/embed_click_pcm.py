"""Embed all metronome click samples as PCM16 mono C++ constexpr arrays.

Banks and order must stay synchronized with
src/domain/metronome/ClickSoundCatalog.ts:

  Normal / Click: classic, soft, digital, bright, cowbell,
                  woodblock_medium, woodblock_high, woodblock_low
  Accent / Bar:   classic_accent, strong_accent, digital_accent,
                  cowbell_accent, woodblock_medium, woodblock_high,
                  woodblock_low

Bar embeds the same source WAV files as Accent (no click_bar_* assets yet).
Accent/Bar woodblock options reuse click_normal_woodblock_*.wav.

Subdivision PCM is embedded for the native player; selection continues to
use NormalSound indices (no SubdivisionSound enum).
"""
from __future__ import annotations

import struct
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "modules/native-audio/android/src/main/res/raw"
OUT = ROOT / "modules/native-audio/android/src/main/cpp/ClickSampleData.h"

# Must match NORMAL_CLICK_SOUNDS / SUBDIVISION_CLICK_SOUNDS order in TypeScript.
NORMAL_SAMPLES = [
    ("NormalClassic", RAW_DIR / "click_normal_classic.wav"),
    ("NormalSoft", RAW_DIR / "click_normal_soft.wav"),
    ("NormalDigital", RAW_DIR / "click_normal_digital.wav"),
    ("NormalBright", RAW_DIR / "click_normal_bright.wav"),
    ("NormalCowbell", RAW_DIR / "click_normal_cowbell.wav"),
    ("NormalWoodblockMedium", RAW_DIR / "click_normal_woodblock_medium.wav"),
    ("NormalWoodblockHigh", RAW_DIR / "click_normal_woodblock_high.wav"),
    ("NormalWoodblockLow", RAW_DIR / "click_normal_woodblock_low.wav"),
]

# Shared Accent/Bar sources (TS ACCENT_CLICK_SOUNDS / BAR_CLICK_SOUNDS).
# Woodblock slots reuse click_normal_woodblock_*.wav until dedicated accent files exist.
ACCENT_SOURCE_WAVS = [
    RAW_DIR / "click_accent_classic.wav",
    RAW_DIR / "click_accent_strong.wav",
    RAW_DIR / "click_accent_digital.wav",
    RAW_DIR / "click_accent_cowbell.wav",
    RAW_DIR / "click_normal_woodblock_medium.wav",
    RAW_DIR / "click_normal_woodblock_high.wav",
    RAW_DIR / "click_normal_woodblock_low.wav",
]

ACCENT_SAMPLES = [
    ("AccentClassic", ACCENT_SOURCE_WAVS[0]),
    ("AccentStrong", ACCENT_SOURCE_WAVS[1]),
    ("AccentDigital", ACCENT_SOURCE_WAVS[2]),
    ("AccentCowbell", ACCENT_SOURCE_WAVS[3]),
    ("AccentWoodblockMedium", ACCENT_SOURCE_WAVS[4]),
    ("AccentWoodblockHigh", ACCENT_SOURCE_WAVS[5]),
    ("AccentWoodblockLow", ACCENT_SOURCE_WAVS[6]),
]

# Separate BarSound enum + PCM bank; same WAV sources as Accent.
BAR_SAMPLES = [
    ("BarClassic", ACCENT_SOURCE_WAVS[0]),
    ("BarStrong", ACCENT_SOURCE_WAVS[1]),
    ("BarDigital", ACCENT_SOURCE_WAVS[2]),
    ("BarCowbell", ACCENT_SOURCE_WAVS[3]),
    ("BarWoodblockMedium", ACCENT_SOURCE_WAVS[4]),
    ("BarWoodblockHigh", ACCENT_SOURCE_WAVS[5]),
    ("BarWoodblockLow", ACCENT_SOURCE_WAVS[6]),
]

SUBDIVISION_SAMPLES = [
    ("SubdivisionClassic", RAW_DIR / "click_subdivision_classic.wav"),
    ("SubdivisionSoft", RAW_DIR / "click_subdivision_soft.wav"),
    ("SubdivisionDigital", RAW_DIR / "click_subdivision_digital.wav"),
    ("SubdivisionBright", RAW_DIR / "click_subdivision_bright.wav"),
    ("SubdivisionCowbell", RAW_DIR / "click_subdivision_cowbell.wav"),
    ("SubdivisionWoodblockMedium", RAW_DIR / "click_subdivision_woodblock_medium.wav"),
    ("SubdivisionWoodblockHigh", RAW_DIR / "click_subdivision_woodblock_high.wav"),
    ("SubdivisionWoodblockLow", RAW_DIR / "click_subdivision_woodblock_low.wav"),
]

EXPECTED_NORMAL_IDS = (
    "classic",
    "soft",
    "digital",
    "bright",
    "cowbell",
    "woodblock_medium",
    "woodblock_high",
    "woodblock_low",
)

EXPECTED_ACCENT_BAR_IDS = (
    "classic_accent",
    "strong_accent",
    "digital_accent",
    "cowbell_accent",
    "woodblock_medium",
    "woodblock_high",
    "woodblock_low",
)


def collect_missing(samples: list[tuple[str, Path]]) -> list[Path]:
    return [path for _, path in samples if not path.is_file()]


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
        print(f"  {name}: {len(pcm)} frames @ {rate} Hz ({path.name})")
    return lines


def emit_enum(enum_name: str, entries: list[tuple[str, Path]], prefix: str) -> list[str]:
    lines = [f"enum class {enum_name} : int {{"]
    for index, (name, _) in enumerate(entries):
        case_name = name[len(prefix) :]
        lines.append(f"  {case_name} = {index},")
    lines.append("};")
    return lines


def validate_catalog_sync() -> None:
    """Fail if bank lengths diverge from documented TypeScript ID lists."""
    if len(NORMAL_SAMPLES) != len(EXPECTED_NORMAL_IDS):
        raise SystemExit(
            "Normal bank length mismatch vs TypeScript NORMAL_CLICK_SOUNDS: "
            f"{len(NORMAL_SAMPLES)} != {len(EXPECTED_NORMAL_IDS)}"
        )
    if len(SUBDIVISION_SAMPLES) != len(EXPECTED_NORMAL_IDS):
        raise SystemExit(
            "Subdivision bank length mismatch vs TypeScript SUBDIVISION_CLICK_SOUNDS: "
            f"{len(SUBDIVISION_SAMPLES)} != {len(EXPECTED_NORMAL_IDS)}"
        )
    if len(ACCENT_SAMPLES) != len(EXPECTED_ACCENT_BAR_IDS):
        raise SystemExit(
            "Accent bank length mismatch vs TypeScript ACCENT_CLICK_SOUNDS: "
            f"{len(ACCENT_SAMPLES)} != {len(EXPECTED_ACCENT_BAR_IDS)}"
        )
    if len(BAR_SAMPLES) != len(EXPECTED_ACCENT_BAR_IDS):
        raise SystemExit(
            "Bar bank length mismatch vs TypeScript BAR_CLICK_SOUNDS: "
            f"{len(BAR_SAMPLES)} != {len(EXPECTED_ACCENT_BAR_IDS)}"
        )
    for accent, bar in zip(ACCENT_SAMPLES, BAR_SAMPLES, strict=True):
        if accent[1] != bar[1]:
            raise SystemExit(
                f"Accent/Bar source WAV mismatch: {accent[0]} -> {accent[1].name}, "
                f"{bar[0]} -> {bar[1].name}"
            )


def main() -> None:
    validate_catalog_sync()

    all_banks = (
        ("Normal", NORMAL_SAMPLES),
        ("Bar", BAR_SAMPLES),
        ("Accent", ACCENT_SAMPLES),
        ("Subdivision", SUBDIVISION_SAMPLES),
    )
    missing: list[Path] = []
    for _, bank in all_banks:
        missing.extend(collect_missing(bank))
    if missing:
        unique = sorted({str(path.relative_to(ROOT)) for path in missing})
        print("Missing WAV file(s) under modules/native-audio/android/src/main/res/raw:", file=sys.stderr)
        for path in unique:
            print(f"  - {path}", file=sys.stderr)
        raise SystemExit(1)

    print("Embedding click samples (TypeScript-synced banks):")
    print(f"  Normal IDs: {', '.join(EXPECTED_NORMAL_IDS)}")
    print(f"  Accent/Bar IDs: {', '.join(EXPECTED_ACCENT_BAR_IDS)}")

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
    header_lines.extend(emit_enum("BarSound", BAR_SAMPLES, "Bar"))
    header_lines.append("")
    header_lines.extend(emit_enum("AccentSound", ACCENT_SAMPLES, "Accent"))
    header_lines.append("")
    header_lines.append(f"inline constexpr int kNormalSoundCount = {len(NORMAL_SAMPLES)};")
    header_lines.append(f"inline constexpr int kBarSoundCount = {len(BAR_SAMPLES)};")
    header_lines.append(f"inline constexpr int kAccentSoundCount = {len(ACCENT_SAMPLES)};")
    header_lines.append("")

    header_lines.extend(emit_group("Normal click variants", NORMAL_SAMPLES))
    header_lines.append("")
    header_lines.extend(emit_group("Bar click variants (same sources as Accent)", BAR_SAMPLES))
    header_lines.append("")
    header_lines.extend(emit_group("Accent click variants", ACCENT_SAMPLES))
    header_lines.append("")
    header_lines.extend(
        emit_group(
            "Subdivision click variants (selected via NormalSound indices)",
            SUBDIVISION_SAMPLES,
        )
    )

    _, rate = read_pcm16_mono(NORMAL_SAMPLES[0][1])
    header_lines.append("")
    header_lines.append(f"inline constexpr int32_t kSampleRate = {rate};")
    header_lines.extend(["", "}  // namespace click_sample_data", ""])

    OUT.write_text("\n".join(header_lines), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
