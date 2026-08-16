"""Embed metronome click samples as PCM16 mono C++ constexpr arrays.

Banks and order must stay synchronized with
src/domain/metronome/ClickSoundCatalog.ts and ClickSoundMapping.kt:

  Normal / Subdivision: classic=0, clave=1, bongo=2
  Accent: classic_accent=0, clave_accent=1, bongo_accent=2
  Bar: classic_bar=0, clave_bar=1, bongo_bar=2

Default Bar uses click_accent_classic.wav (no dedicated click_bar_classic.wav).
Subdivision clave/bongo reuse the matching click_normal_*.wav (no dedicated files).
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
    ("NormalClave", RAW_DIR / "click_normal_clave.wav"),
    ("NormalBongo", RAW_DIR / "click_normal_bongo.wav"),
]

ACCENT_SAMPLES = [
    ("AccentClassic", RAW_DIR / "click_accent_classic.wav"),
    ("AccentClave", RAW_DIR / "click_accent_clave.wav"),
    ("AccentBongo", RAW_DIR / "click_accent_bongo.wav"),
]

BAR_SAMPLES = [
    ("BarClassic", RAW_DIR / "click_accent_classic.wav"),
    ("BarClave", RAW_DIR / "click_bar_clave.wav"),
    ("BarBongo", RAW_DIR / "click_bar_bongo.wav"),
]

SUBDIVISION_SAMPLES = [
    ("SubdivisionClassic", RAW_DIR / "click_subdivision_classic.wav"),
    ("SubdivisionClave", RAW_DIR / "click_normal_clave.wav"),
    ("SubdivisionBongo", RAW_DIR / "click_normal_bongo.wav"),
]

EXPECTED_NORMAL_IDS = ("classic", "clave", "bongo")
EXPECTED_ACCENT_IDS = ("classic_accent", "clave_accent", "bongo_accent")
EXPECTED_BAR_IDS = ("classic_bar", "clave_bar", "bongo_bar")


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


def resample_linear(samples: list[int], src_rate: int, dst_rate: int) -> list[int]:
    """Lightweight linear resample so mixed-rate WAV banks can share one engine rate."""
    if src_rate == dst_rate or len(samples) == 0:
        return samples
    out_len = max(1, int(round(len(samples) * dst_rate / src_rate)))
    if out_len == 1:
        return [samples[0]]
    result: list[int] = []
    last = len(samples) - 1
    for i in range(out_len):
        src_pos = i * (last) / (out_len - 1)
        i0 = int(src_pos)
        i1 = min(i0 + 1, last)
        frac = src_pos - i0
        value = samples[i0] * (1.0 - frac) + samples[i1] * frac
        result.append(int(max(-32768, min(32767, round(value)))))
    return result


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


def emit_group(
    title: str,
    samples: list[tuple[str, Path]],
    target_rate: int,
) -> list[str]:
    lines = [f"// {title}"]
    for name, path in samples:
        pcm, rate = read_pcm16_mono(path)
        if rate != target_rate:
            print(f"  resampling {path.name}: {rate} Hz -> {target_rate} Hz")
            pcm = resample_linear(pcm, rate, target_rate)
        lines.append("")
        lines.extend(emit_array(name, pcm))
        print(f"  {name}: {len(pcm)} frames @ {target_rate} Hz ({path.name})")
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
    if len(ACCENT_SAMPLES) != len(EXPECTED_ACCENT_IDS):
        raise SystemExit(
            "Accent bank length mismatch vs TypeScript ACCENT_CLICK_SOUNDS: "
            f"{len(ACCENT_SAMPLES)} != {len(EXPECTED_ACCENT_IDS)}"
        )
    if len(BAR_SAMPLES) != len(EXPECTED_BAR_IDS):
        raise SystemExit(
            "Bar bank length mismatch vs TypeScript BAR_CLICK_SOUNDS: "
            f"{len(BAR_SAMPLES)} != {len(EXPECTED_BAR_IDS)}"
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
    print(f"  Normal/Subdivision IDs: {', '.join(EXPECTED_NORMAL_IDS)}")
    print(f"  Accent IDs: {', '.join(EXPECTED_ACCENT_IDS)}")
    print(f"  Bar IDs: {', '.join(EXPECTED_BAR_IDS)}")

    _, rate = read_pcm16_mono(NORMAL_SAMPLES[0][1])

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

    header_lines.extend(emit_group("Normal click variants", NORMAL_SAMPLES, rate))
    header_lines.append("")
    header_lines.extend(emit_group("Bar click variants", BAR_SAMPLES, rate))
    header_lines.append("")
    header_lines.extend(emit_group("Accent click variants", ACCENT_SAMPLES, rate))
    header_lines.append("")
    header_lines.extend(
        emit_group(
            "Subdivision click variants (selected via NormalSound indices)",
            SUBDIVISION_SAMPLES,
            rate,
        )
    )

    header_lines.append("")
    header_lines.append(f"inline constexpr int32_t kSampleRate = {rate};")
    header_lines.extend(["", "}  // namespace click_sample_data", ""])

    OUT.write_text("\n".join(header_lines), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
