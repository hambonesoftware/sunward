# Stony Creek Explorer — Foliage Pass 2

This document records **B: asset selections and precise authored placement rules**.
The working implementation is **A:** `StonyFoliagePass2.js`,
`StonyTreeLibrary.js`, `StonyBiomeRules.js`, `StonyUnderstory.js`,
`StonyGroundCover.js`, and `StonyLOD.js`.

## What is geographic fact and what is art direction

**Geographic inputs:** elevation is sourced from USGS 3DEP or the fallback real-elevation source already documented; paths, lakes and the available habitat polygons are OpenStreetMap geometry. The [official Nature Center page](https://www.metroparks.com/stony-creek-metropark/stony-creek-metropark-nature-center/) describes hardwood forests, restored prairie, wetland, old fields, ponds and streams. The [official park map](https://www.metroparks.com/wp-content/uploads/2024/04/2024StonyCreekParkMap.pdf) identifies Shelden, Eastwood, Baypoint and Trolley routes.

**Artistic approximation:** individual tree locations, trunk species identities, tree counts, and undergrowth densities are generated. The Nature Center coordinates and other selectors are approximate centers, not an authoritative GPS route. Zone composition applies only when real mapped habitat is missing. No invented tree location is represented as a surveyed fact.

## A — Code architecture

| Module | Active purpose |
| --- | --- |
| `StonyFoliagePass2.js` | Orchestrates seeded tree generation, renderer tiers, understory and ground cover |
| `StonyTreeLibrary.js` | Creates small textured bough clusters and branches for nearby, more organic tree crowns; future realistic GLB replacement point |
| `StonyBiomeRules.js` | Applies OSM water, slope, path, habitat and zone multipliers in that precedence order |
| `StonyGroundCover.js` | Instanced near-field grass and low-opacity litter/soil patches beneath trees |
| `StonyUnderstory.js` | Instanced shrubs, flowers and fungi near wooded and trail zones |
| `StonyLOD.js` | Mobile/desktop visibility rings, instance caps, deterministic sampling utilities |
| `KenneyPlants.js` | Loads CC0 GLBs; now supports minimum distance and nearest-first instance caps for middle/far LOD |

The new tree crowns are **procedural using the previously bundled project leaf/bark textures**. They improve silhouette and branch scale, but they are **not yet scanned, species-exact photorealistic models**. Kenney remains in the middle and far bands until new verified high-fidelity models are optimized and imported.

## B — Ready assets and realistic upgrade queue

Runtime asset catalog: [`public/data/stony-foliage-assets.json`](../public/data/stony-foliage-assets.json).
Source verification: [Kenney Nature Kit (CC0)](https://kenney.nl/assets/nature-kit);
[Poly Haven CC0 license](https://polyhaven.com/license).

| Role | Active today | Higher-fidelity candidate (not imported) |
| --- | --- | --- |
| Close deciduous branches | `oak.webp`, `maple.webp`, `birch.webp` plus branched procedural mesh | [Tree Small 02](https://polyhaven.com/a/tree_small_02), for topology/material reference after species review |
| Close pines | `pine.webp` + real-volume branch mesh | [Pine Tree 01](https://polyhaven.com/a/pine_tree_01), requiring massive simplification |
| Bark | `bark.webp` project texture | Replace with CC0 PBR bark/normal maps when optimized |
| Mid/far trees | Bundled Kenney CC0 trees | Game-ready decimated LODs of a curated healthy model set |
| Understory | Kenney `plant_bushDetailed`, `plant_flatShort`, flowers and mushrooms | Future native fern, sedge, meadow/forb models with validated licenses |
| Ground | Tiled terrain microtexture, instanced grass and tree-base soil patches | Separate measured woodland litter, damp ground and meadow materials |

The Poly Haven originals are very heavy (millions of triangles). **Do not link their original models directly into mobile gameplay.** Target retained LOD triangle ceilings: **hero 15k / mid 2.5k / far 350** triangles per tree, with 1K maximum foliage atlas edge for the hero tier until a measured Safari performance test approves more. These are proposed quality gates, not a statement that the two Poly Haven models have been downloaded or optimized.

## B — Exact initial placement configuration

The complete machine-readable rules are in
[`public/data/stony-foliage-zones.json`](../public/data/stony-foliage-zones.json).
Numbers here are deliberate visual density *budgets*, not estimates of the number of living trees on site.

| Zone | Art-direction center (lat, lon) | Sampling radius | Tree candidates | Mix (%) oak / maple / birch / pine / hickory | Tree clearance from paths |
| --- | --- | --- | --- | --- | --- |
| Nature Center | 42.76078, −83.0745 | 480 m | 2,550 | 35 / 34 / 12 / 11 / 8 | 5.5 m |
| Shelden / Mt. Shelden Pines | 42.73046, −83.1072 | 535 m | 2,350 | 27 / 23 / 10 / 32 / 8 | 6.2 m |
| Eastwood Beach | 42.722, −83.078 | 410 m | 950 | 33 / 23 / 14 / 26 / 4 | 9.0 m |
| Baypoint Beach | 42.7284, −83.09064 | 430 m | 800 | 34 / 27 / 12 / 21 / 6 | 9.0 m |
| Trolley Trails | 42.71823, −83.079 | 420 m | 1,400 | 33 / 29 / 11 / 18 / 9 | 7.0 m |

### Habitat multipliers

Configured relative *acceptance probabilities* after geographic water/steepness and trail clearance have been applied:

| Habitat | Tree | Shrub | Grass | Wildflower |
| --- | ---: | ---: | ---: | ---: |
| OSM hardwood/forest | 1.00 | 0.82 | 0.44 | 0.08 |
| Unclassified mixed | 0.78 | 0.62 | 0.72 | 0.27 |
| Meadow / grassland | 0.06–0.07 | 0.10–0.12 | 1.00 | 0.80–0.87 |
| Wetland | 0.035 | 0.26 | 0.60 | 0.14 |
| Trail edge | 0.22 | 0.34 | 0.74 | 0.40 |
| Open water / excessively steep | 0.00 | 0.00 | 0.00 | 0.00 |

**Selection precedence:** OpenStreetMap water polygons → slope threshold → trail corridor → OSM habitat polygons → approximate zone defaults. Tree height and plant shape vary randomly around their intended classes. A tree cannot enter the current footpath-clearance width. Tree positions use a seeded grid of 5.8-metre cells to reduce overlap.

### Zone visual intent

- **Nature Center:** dense hardwood pockets interrupted by authentic mapped wetlands and prairie; more undergrowth at wooded edges and fewer flowers deep in the forest. Meadow openings are preserved.
- **Shelden:** additional pine; rolling wooded terrain; avoid blocking bike/rustic trails. Existing mapped roads and paths remain legible.
- **Eastwood:** open lake views and recreational lawns; greatest clearance on the beach approach, dense trees only where a mapped wooded polygon supports them.
- **Baypoint:** more spaced shade trees, tall grass away from maintained shorefront and low shrubs near open lawn.
- **Trolley:** recognizable corridor of path visibility and a transition between mixed woods and meadow.

### Near / mid / far and iPhone budgets

| Distance class | iPhone / coarse pointer | Desktop |
| --- | --- | --- |
| Close procedural bark and branch geometry | 0–64 m; max 32 visible **per tree type** | 0–88 m; max 56 per type |
| Kenney background/mid instanced tree | 64–195 m; 145 per model | 88–245 m; 275 per model |
| Low-cost background trees | 195–335 m; 230 per model | 245–465 m; 480 per model |
| Grass draw radius | 80 m, max 4,700 clumps | 110 m, max 9,500 clumps |
| Litter draw cap | 480 | 900 |
| Placement/culling update after movement | 8 m | 11 m |

These are caps and targets, not measured FPS. A live WebGL smoke test guards against startup regressions; visual quality and phone performance still require actual iPhone/iPad evaluation.

## Next stage after Pass 2

Review the [Poly Haven pine](https://polyhaven.com/a/pine_tree_01) and additional realistic deciduous candidates for actual mesh detail, species resemblance, healthy silhouette, scale, triangles, opacity, and license. Generate three mobile LODs and replace the procedural close-tree asset slots **one at a time** after benchmarking. The grounds will remain a geographic approximation until park imagery or field survey informs the species and terrain materials.
