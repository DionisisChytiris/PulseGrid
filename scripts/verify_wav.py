import struct
import pathlib

raw = pathlib.Path(__file__).resolve().parents[1] / "modules/native-audio/android/src/main/res/raw"
for path in raw.glob("*.wav"):
    data = path.read_bytes()
    offset = 12
    found = None
    while offset + 8 <= len(data):
        chunk_id = data[offset : offset + 4].decode("ascii", errors="replace")
        chunk_size = struct.unpack_from("<I", data, offset + 4)[0]
        if chunk_id == "data":
            found = offset + 8
            break
        offset += 8 + chunk_size
    sample_count = (len(data) - found) // 2 if found else 0
    print(f"{path.name}: bytes={len(data)} data_offset={found} samples={sample_count}")
