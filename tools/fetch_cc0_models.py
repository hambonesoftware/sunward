"""Download the self-contained CC0 Dense Temperate Forest Flora GLBs.

The provenance, attribution and exact source URL are recorded in
public/data/model-library.json. This script is idempotent and validates GLB
headers, so repeated runs only retry failed or missing downloads.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json
import struct
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public/data/model-library.json"
DESTINATION = ROOT / "public/assets/models"
SOURCE = "https://3dassets.dev/download/dense-temperate-forest-flora-"


def is_valid_glb(path):
    if not path.exists() or path.stat().st_size < 128:
        return False
    with path.open("rb") as handle:
        header = handle.read(12)
    if len(header) < 12:
        return False
    magic, version, length = struct.unpack("<4sII", header)
    return magic == b"glTF" and version == 2 and length == path.stat().st_size


def fetch(model):
    path = DESTINATION / f"{model['id']}.glb"
    if is_valid_glb(path):
        return model["id"], path.stat().st_size, "cached"

    url = SOURCE + model["slug"]
    request = urllib.request.Request(url, headers={"User-Agent": "SunwardCC0AssetFetcher/1.0"})
    with urllib.request.urlopen(request, timeout=55) as response:
        payload = response.read()

    temporary = path.with_suffix(".download")
    temporary.write_bytes(payload)
    if not is_valid_glb(temporary):
        temporary.unlink(missing_ok=True)
        raise ValueError(f"Invalid GLB received for {model['id']}")
    temporary.replace(path)
    return model["id"], len(payload), "downloaded"


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    models = json.loads(MANIFEST.read_text(encoding="utf-8"))["models"]
    failures = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(fetch, model): model["id"] for model in models}
        for future in as_completed(futures):
            name = futures[future]
            try:
                model_id, size, status = future.result()
                print(f"{model_id}: {status} ({size:,} bytes)", flush=True)
            except Exception as error:
                failures.append(name)
                print(f"{name}: FAILED {error}", flush=True)
    if failures:
        raise SystemExit(f"Unable to fetch {len(failures)} assets: {', '.join(failures)}")
    print(f"Validated {len(models)} CC0 GLB models.")


if __name__ == "__main__":
    main()
