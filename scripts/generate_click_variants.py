"""Generate metronome click sound variants from the classic samples."""
from __future__ import annotations

import array
import shutil
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/audio"
ANDROID_RAW_DIR = ROOT / "modules/native-audio/android/src/main/res/raw"
IOS_ASSETS_DIR = ROOT / "modules/native-audio/ios/Assets"
TARGET_SAMPLE_RATE = 44100

NORMAL_VARIANTS = {
    "click_normal_classic": ("click_normal.wav", lambda samples: samples),
    "click_normal_soft": ("click_normal.wav", lambda samples: [int(max(-32768, min(32767, s * 0.55))) for s in samples]),
    "click_normal_digital": (
        "click_normal.wav",
        lambda samples: [
            int(max(-32768, min(32767, s * (1.8 if i < max(1, len(samples) // 8) else 0.45))))
            for i, s in enumerate(samples)
        ],
    ),
    "click_normal_bright": (
        "click_normal.wav",
        lambda samples: resample_linear(samples, 1.18),
    ),
    "click_normal_cowbell": ("cowbell-normal.wav", lambda samples: samples),
}

ACCENT_VARIANTS = {
    "click_accent_classic": ("click_accent.wav", lambda samples: samples),
    "click_accent_strong": (
        "click_accent.wav",
        lambda samples: resample_linear([int(max(-32768, min(32767, s * 1.25))) for s in samples], 1.08),
    ),
    "click_accent_digital": (
        "click_accent.wav",
        lambda samples: [
            int(max(-32768, min(32767, s * (2.0 if i < max(1, len(samples) // 6) else 0.5))))
            for i, s in enumerate(samples)
        ],
    ),
    "click_accent_cowbell": ("cowbell-accent.wav", lambda samples: samples),
}

SUBDIVISION_VARIANTS = {
    "click_subdivision_classic": ("click_subdivision.wav", lambda samples: samples),
    "click_subdivision_soft": ("click_subdivision.wav", lambda samples: [int(max(-32768, min(32767, s * 0.55))) for s in samples]),
    "click_subdivision_digital": (
        "click_subdivision.wav",
        lambda samples: [
            int(max(-32768, min(32767, s * (1.6 if i < max(1, len(samples) // 8) else 0.4))))
            for i, s in enumerate(samples)
        ],
    ),
    "click_subdivision_bright": (
        "click_subdivision.wav",
        lambda samples: resample_linear(samples, 1.18),
    ),
    "click_subdivision_cowbell": (
        "cowbell-normal.wav",
        lambda samples: [int(max(-32768, min(32767, s * 0.55))) for s in samples],
    ),
}


def read_pcm16_mono(path: Path) -> tuple[list[int], int]:
    with wave.open(str(path), "rb") as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise SystemExit(f"Expected PCM16 mono WAV: {path}")
        frames = w.getnframes()
        rate = w.getframerate()
        data = struct.unpack("<" + "h" * frames, w.readframes(frames))
    return list(data), rate


def write_pcm16_mono(path: Path, samples: list[int], sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(array.array("h", samples).tobytes())


def resample_linear(samples: list[int], ratio: float) -> list[int]:
    if not samples:
        return samples
    out_len = max(1, int(len(samples) / ratio))
    result: list[int] = []
    for i in range(out_len):
        src_pos = i * ratio
        left = int(src_pos)
        right = min(left + 1, len(samples) - 1)
        frac = src_pos - left
        value = samples[left] * (1 - frac) + samples[right] * frac
        result.append(int(max(-32768, min(32767, value))))
    return result


def resample_to_rate(samples: list[int], source_rate: int, target_rate: int) -> list[int]:
    if source_rate == target_rate or not samples:
        return samples
    ratio = source_rate / target_rate
    return resample_linear(samples, ratio)


def emit_variant(name: str, source_name: str, transform, targets: list[Path]) -> None:
    source_path = SOURCE_DIR / source_name
    samples, rate = read_pcm16_mono(source_path)
    transformed = transform(samples)
    if rate != TARGET_SAMPLE_RATE:
        transformed = resample_to_rate(transformed, rate, TARGET_SAMPLE_RATE)
        rate = TARGET_SAMPLE_RATE
    for target_dir in targets:
        write_pcm16_mono(target_dir / f"{name}.wav", transformed, rate)
    print(f"  {name}: {len(transformed)} frames @ {rate} Hz")


def main() -> None:
    targets = [SOURCE_DIR / "clicks", ANDROID_RAW_DIR, IOS_ASSETS_DIR]
    for target in targets:
        target.mkdir(parents=True, exist_ok=True)

    # Keep legacy filenames for existing classic behavior.
    shutil.copy2(SOURCE_DIR / "click_normal.wav", SOURCE_DIR / "clicks/click_normal_classic.wav")
    shutil.copy2(SOURCE_DIR / "click_accent.wav", SOURCE_DIR / "clicks/click_accent_classic.wav")
    shutil.copy2(SOURCE_DIR / "click_subdivision.wav", SOURCE_DIR / "clicks/click_subdivision_classic.wav")

    print("Normal variants:")
    for name, (source, transform) in NORMAL_VARIANTS.items():
        emit_variant(name, source, transform, targets)

    print("Accent variants:")
    for name, (source, transform) in ACCENT_VARIANTS.items():
        emit_variant(name, source, transform, targets)

    print("Subdivision variants:")
    for name, (source, transform) in SUBDIVISION_VARIANTS.items():
        emit_variant(name, source, transform, targets)

    # Legacy aliases used by current builds.
    shutil.copy2(ANDROID_RAW_DIR / "click_normal_classic.wav", ANDROID_RAW_DIR / "click_normal.wav")
    shutil.copy2(ANDROID_RAW_DIR / "click_accent_classic.wav", ANDROID_RAW_DIR / "click_accent.wav")
    shutil.copy2(ANDROID_RAW_DIR / "click_subdivision_classic.wav", ANDROID_RAW_DIR / "click_subdivision.wav")
    shutil.copy2(IOS_ASSETS_DIR / "click_normal_classic.wav", IOS_ASSETS_DIR / "click_normal.wav")
    shutil.copy2(IOS_ASSETS_DIR / "click_accent_classic.wav", IOS_ASSETS_DIR / "click_accent.wav")
    shutil.copy2(IOS_ASSETS_DIR / "click_subdivision_classic.wav", IOS_ASSETS_DIR / "click_subdivision.wav")


if __name__ == "__main__":
    main()
