# Sunward — Bayberry Cove (Michigan vertical slice)

A cozy third-person Three.js exploration game with six scheduled residents, a small
quest chain, regional flora discovery, a day/night clock, original procedural 3D
assets, and **real USGS elevation data** from the Lake Michigan dunes near Grand Haven.

The whole runtime uses ES modules and static JSON. It needs no backend, database,
API key, build step, sign-in, or CDN at runtime, and works on GitHub Pages.

## Play

- Desktop: WASD or arrow keys to move, mouse drag to rotate camera, Shift to run,
  Space to jump, E to talk or inspect.
- Phone or iPad: left thumbstick to move, drag the game world to rotate the camera,
  jump button, and contextual talk/discover button.
- Press **+2h** by the clock to watch daily schedules change.
- Meet June at the bakery, take a parcel to Mateo at the dock, then visit Ellen's
  garden. You can also discover five regional plant species and greet everyone.
- Quest and discovery progress are stored only in that browser's local storage.

## Start a local server

```bash
npm run serve
```

Then open http://localhost:8080. With Python instead:

```bash
python3 -m http.server 8080 --directory public
```

Don't double-click `index.html`: browsers commonly block ES module and JSON
fetches from `file://`.

## Test

```bash
npm run validate
```

This checks the real 129 × 129 height grid, source imports, plant and NPC data,
bundled Three.js dependencies, and representative HTTP asset routes.

## Put it on GitHub Pages

1. Create a **new repository**, for example `hambonesoftware/sunward`.
2. Upload the files in this project's root, **including `.github/workflows/pages.yml`**.
3. In repository **Settings → Pages**, select **GitHub Actions** as the source.
4. Push to `main`. The included workflow deploys the `public/` directory.
5. The game will be hosted under the repository's GitHub Pages project URL.

Asset paths and import maps use relative URLs so publishing under `/sunward/`
doesn't break module or heightmap loading.

## Architecture

| Module | Responsibility |
| --- | --- |
| `public/src/main.js` | Composition root and frame loop |
| `public/src/engine/` | Event bus and desktop/touch input |
| `public/src/world/Terrain.js` | Height-grid interpolation, mesh, terrain colors and village grading |
| `public/src/world/Vegetation.js` | Seeded flora distribution and GPU-instanced regional species |
| `public/src/world/Village.js` | Buildings, paths, dock, plaza, trees and walkable surfaces |
| `public/src/world/Atmosphere.js` | Lake water, daylight, birds and clouds |
| `public/src/actors/` | Third-person explorer and daily NPC movement |
| `public/src/systems/` | Local time, journal and interactions |
| `public/src/ui/HUD.js` | Quest panel, mini-map, dialogues and responsive controls |
| `public/data/michigan-world.json` | Modular region profile, species and residents |
| `public/data/michigan-dem.json` | Preprocessed USGS 3DEP height grid |

To create a new region, provide a new elevation grid and world profile, change
the profile URL in the composition root, and extend the region-specific village
config or replace the Village module. Plant rules and resident logic remain
reusable. The scene uses real landform heights with a small graded area for the
fictional town; it is **not a geographically accurate reconstruction of actual
streets, buildings or individual trees**.

## Terrain provenance

- **Source:** USGS The National Map, 3D Elevation Program ImageServer.
- **Bounding box (WGS84):** west −86.256, south 43.034, east −86.226, north 43.058.
- **Grid:** 129 × 129 elevation samples in meters above sea level.
- **Range:** approximately 175.85–232.76 m.
- **Conversion:** `tools/build_dem.py` reads the source Float32 TIFF and writes
  `michigan-dem.json` with north-to-south rows. The original TIFF is bundled.
- **Source endpoint:** https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer
- **Vegetation:** game-authored, region-appropriate Michigan species and
  terrain-based distribution—not mapped positions of actual plants.

Three.js 0.179.1 is bundled under its MIT license in `public/vendor/`. The game
code is designed for further extension rather than being tied to one town.

