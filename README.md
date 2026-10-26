# Sunward — Bayberry Cove (Michigan vertical slice)

A cozy third-person Three.js exploration game with six scheduled residents, a small
quest chain, regional flora discovery, a day/night clock, original procedural 3D
assets, a harmonized **Kenney Nature Kit (CC0) world**, and
**real USGS elevation and 2024 land-cover data** from the Lake Michigan dunes near Grand Haven.

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
| `public/src/world/Vegetation.js` | Seeded flora distribution and regional species logic |
| `public/src/world/HabitatMap.js` | 2024 USGS NLCD class mapping and artistic suitability rules |
| `public/src/world/KenneyPlants.js` | CC0 Kenney GLB catalog, warm palette normalization, species mapping, instancing and culling |
| `public/src/world/KenneyDecor.js` | Kenney rocks, flowers, shrubs and mushrooms using terrain habitat placement |
| `public/src/world/FoliageTextures.js` | Five optimized leaf/bark textures and GPU wind shader |
| `public/src/world/GroundCover.js` | Player-relative grass and leaf litter instancing |
| `public/src/world/FoliageModels.js` | Volumetric procedural fallback for cattails or missing Kenney assets |
| `public/src/world/Village.js` | Buildings, paths, dock, plaza, trees and walkable surfaces |
| `public/src/world/Atmosphere.js` | Lake water, daylight, birds and clouds |
| `public/src/actors/` | Third-person explorer and daily NPC movement |
| `public/src/systems/` | Local time, journal and interactions |
| `public/src/ui/HUD.js` | Quest panel, mini-map, dialogues and responsive controls |
| `public/data/michigan-world.json` | Modular region profile, species and residents |
| `public/data/michigan-dem.json` | Preprocessed USGS 3DEP height grid |
| `public/data/michigan-landcover.json` | 2024 USGS Annual NLCD grid (80 × 64) |
| `public/data/kenney-nature.json` | Source, license and 13 curated Kenney Nature Kit models |

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
- **Land cover:** USGS Annual National Land Cover Database 2024, Collection 1;
  downloaded from https://di-nlcd.img.arcgis.com/arcgis/rest/services/USA_NLCD_Annual_LandCover/ImageServer
  for the matching DEM bounds and saved locally as a classified 80 × 64 grid.
- **Vegetation:** game-authored, region-appropriate Michigan species and
  terrain/land-cover-based *probabilistic* placement—not mapped positions of actual plants.

## Foliage assets and free 3D models

- The game ships 48 individual low-poly glTF 2.0 models from the
  [Dense Temperate Forest Flora pack](https://3dassets.dev/packs/dense-temperate-forest-flora).
  The publisher releases the pack under **CC0 1.0**, so models can be bundled
  directly on GitHub Pages. Attribution is not required, but provenance is
  retained in `public/data/model-library.json`.
- The pack contains European species and has a faceted low-poly art style.
  These are visual stand-ins and ornamental features, not a scientific Michigan
  species inventory. Michigan botanical names in the field journal still come
  from the region's curated species list.
- Five photo-inspired WebP texture atlases (`maple`, `oak`, `birch`, `pine`,
  `bark`) are generated project assets. Cutout leaf cards and branches create
  additional volume alongside the imported models. A lightweight wind shader
  bends the cards, while plant instances use distance-appropriate mesh detail.
- Imported models load four at a time **after the game is ready**. If any one
  fails, players can still explore and use the original game mechanics.
- Mobile devices use fewer instances and shorter draw distances. Full desktop
  and iPad GPU rendering remains important to test on actual hardware.

To re-download CC0 models from their catalog slugs, run:

```bash
python3 tools/fetch_cc0_models.py
```

The original 2024 USGS classified TIFF and the original larger plant texture
sources are not necessary at runtime. Scripts to regenerate their optimized
outputs live under `tools/`.

Three.js 0.179.1, including its official `GLTFLoader` add-on, is bundled under
its MIT license in `public/vendor/`. The game
code is designed for further extension rather than being tied to one town.


## Kenney Nature Kit art direction (current build)

- The **active** trees, village shade trees, shrubs, flowers, rocks and mushrooms come from the self-hosted [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) (CC0 1.0). The initial set contains 13 validated GLB models, with trunk-bearing pine and broadleaf variants. All geometry is tiny, and each model is loaded only once.
- Colors and materials are replaced with one Michigan-inspired palette and physically lit flat-shaded materials. Trees are height-normalized despite Kenney's miniature source scale. Plant distribution is species-, terrain- and land-cover-aware. Identical plant geometry is batched with GPU instancing and distance culling.
- Cattail heads and nearby fine grass remain authored geometry in the same faceted style. The earlier texture-card foliage and the separate 48-model forest catalog are preserved in the repository for reference but **are not rendered in the active game**.
- Source meshes are visual stand-ins, not botanical scans. Model filenames are preserved under `public/assets/kenney/`, with licensing information in `public/data/kenney-nature.json`.
- If an individual Kenney GLB fails, the species falls back to original volumetric low-poly geometry. All six resident schedules, five journal discoveries, and real USGS elevation data remain unchanged.
- Run `npm run validate` for GLB structure, tree crown/trunk verification, and HTTP checks. GitHub Pages deployment runs validation before publishing.
