"""Convert editable foliage sources to small, alpha-safe game textures.

Run from the repository root: python3 tools/optimize_foliage.py
Requires Pillow. Sources are intentionally not published with GitHub Pages.
"""

from pathlib import Path
from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public' / 'assets' / 'foliage'


def foliage(name: str) -> None:
    original = Image.open(ART / f'{name}-source.png').convert('RGBA')
    alpha = original.getchannel('A')
    bounds = alpha.point(lambda a: 255 if a > 12 else 0).getbbox()
    if not bounds:
        raise ValueError(f'{name}: generated art has no opaque pixels')

    crop = original.crop(bounds)
    crop.thumbnail((716, 716), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (768, 768), (0, 0, 0, 0))
    out.alpha_composite(crop, ((768 - crop.width) // 2, (768 - crop.height) // 2))

    # Suppress stray near-transparent pixels around AI cutout edges.
    channel = out.getchannel('A').point(lambda a: 0 if a < 16 else a)
    out.putalpha(channel)
    out.save(ART / f'{name}.webp', 'WEBP', quality=84, method=6)
    print(f'{name}: 768x768 WebP, {(ART / f"{name}.webp").stat().st_size // 1024} KiB')


for species in ('maple', 'pine', 'oak', 'birch'):
    foliage(species)

bark = Image.open(ART / 'bark-source.png').convert('RGB')
bark = bark.resize((768, 768), Image.Resampling.LANCZOS)
bark.save(ART / 'bark.webp', 'WEBP', quality=82, method=6)
print(f'bark: 768x768 WebP, {(ART / "bark.webp").stat().st_size // 1024} KiB')
