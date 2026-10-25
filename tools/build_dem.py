"""Convert the downloaded USGS 3DEP float TIFF to a compact height grid.

The query bounds below must match the source export. TIFF row 0 is north.
The game subtracts a local datum only when creating Three.js coordinates.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/data/michigan-usgs-dem.tif"
DESTINATION = ROOT / "public/data/michigan-dem.json"


def main():
    pixels = np.asarray(Image.open(SOURCE), dtype=np.float32)
    if pixels.ndim != 2 or not np.isfinite(pixels).all():
        raise ValueError("Expected a finite, single-band float elevation raster")
    west, south, east, north = (-86.256, 43.034, -86.226, 43.058)
    payload = {
        "name": "Lake Michigan Dunes — Grand Haven Area",
        "source": "USGS 3DEP / The National Map 3DEPElevation ImageServer",
        "sourceUrl": "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer",
        "bounds": {"west": west, "south": south, "east": east, "north": north},
        "sampleOrder": "north-to-south, west-to-east",
        "units": "meters above sea level",
        "width": int(pixels.shape[1]),
        "height": int(pixels.shape[0]),
        "minimum": round(float(pixels.min()), 2),
        "maximum": round(float(pixels.max()), 2),
        "samples": [[round(float(v), 1) for v in row] for row in pixels],
    }
    DESTINATION.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"Generated {DESTINATION} ({pixels.shape[1]}x{pixels.shape[0]})")


if __name__ == "__main__":
    main()

