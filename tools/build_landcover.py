"""Build the optional Michigan habitat mask from the small annual NLCD raster.

Source imagery: USGS Annual NLCD 2024, served by Esri USA_NLCD_Annual_LandCover.
The provided source tile was exported by nearest-neighbor sampling in EPSG:4326.
Run: python3 tools/build_landcover.py
"""

import json
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/data/michigan-nlcd-source.tif'
OUTPUT = ROOT / 'public/data/michigan-landcover.json'

with Image.open(SOURCE) as raster:
    img = raster.convert('L')
    width, height = img.size
    pixels = list(img.getdata())

classes = [pixels[row*width:(row+1)*width] for row in range(height)]
payload = {
    'source': 'USGS Annual National Land Cover Database 2024, Collection 1; Esri image service export',
    'sourceURL': 'https://di-nlcd.img.arcgis.com/arcgis/rest/services/USA_NLCD_Annual_LandCover/ImageServer',
    'year': 2024,
    'bounds': {'west': -86.256, 'south': 43.034, 'east': -86.226, 'north': 43.058},
    'width': width,
    'height': height,
    'classes': classes,
    'legend': {
        '11': 'Open Water', '21': 'Developed, Open Space',
        '22': 'Developed, Low Intensity', '23': 'Developed, Medium Intensity',
        '24': 'Developed, High Intensity', '31': 'Barren Land',
        '41': 'Deciduous Forest', '42': 'Evergreen Forest', '43': 'Mixed Forest',
        '52': 'Shrub/Scrub', '71': 'Grassland/Herbaceous',
        '81': 'Pasture/Hay', '82': 'Cultivated Crops',
        '90': 'Woody Wetlands', '95': 'Emergent Herbaceous Wetlands'
    }
}
OUTPUT.write_text(json.dumps(payload, separators=(',', ':'))+'\n', encoding='utf8')
print(f'Wrote {OUTPUT.name} ({width}x{height}), classes: {dict(Counter(pixels))}')
