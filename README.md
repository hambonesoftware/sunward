# Stony Creek Explorer — Sunward

An early **first-person geographic walking prototype** of **Stony Creek Metropark** in Oakland and Macomb counties, Michigan. Built with static Three.js and hosted on GitHub Pages.

**[Open the live explorer](https://hambonesoftware.github.io/sunward/)**

## Experience
- Walk using **WASD** or the touch thumbstick. Drag over the world to look around.
- Hold **Shift** to jog or tap **Walk/Jog** on touch devices.
- **Map** opens a park overview with real OSM paths/lakes and fast travel to representative access points: Nature Center, Eastwood Beach, Baypoint Beach, Shelden Trails and Trolley Trails.
- **There are no quests, NPC goals, mission windows, discovery counters or challenge systems.**
- Scene is first-person, with visual foliage as an evolving illustration rather than photorealistic digital twinning.

## Real-world data
Every Pages deployment runs `python tools/build_stony_creek.py` to assemble:
- `public/data/stony-creek-dem.json`: **real elevation** for latitudes 42.704–42.787 and longitudes −83.125 to −83.045. USGS 3DEP is attempted first; public Mapzen Terrarium elevation is used if USGS is unavailable. Deployment fails rather than substituting fictitious elevation if both are unavailable.
- `public/data/stony-creek-map.json`: **actual mapped ways, water polygons, and habitat polygons** from [OpenStreetMap](https://www.openstreetmap.org/copyright), retrieved through the Overpass API. Deployment fails rather than presenting invented trail alignments if all OSM providers are unavailable.

**Attribution:** © OpenStreetMap contributors (ODbL). Elevation from USGS 3DEP or Mapzen public elevation tiles (source recorded in the JSON). Site structure informed by the [official Huron-Clinton Metroparks 2024 Stony Creek map](https://www.metroparks.com/wp-content/uploads/2024/04/2024StonyCreekParkMap.pdf).

## Limitations (important)
- OpenStreetMap geometry is community-maintained, not an authoritative, real-time trail-closure source. Consult [Metroparks](https://www.metroparks.com/stony-creek-metropark/) before actual visits.
- Park boundaries in this early prototype are an exploratory geographic bounding rectangle, **not a surveyed park boundary**.
- Kenney Nature Kit CC0 trees, shrubs and rocks are stylized placeholders with approximated distribution. Individual real-world trees, buildings, benches, signage and paths' surface textures have not been site-surveyed. Do not treat the current scene as a photo-realistic reproduction or navigation device.
- Start locations are approximate coordinate-based access points, snapped to a nearby mapped route when available. It is not safe for real hiking directions.
- Current ground shading and water reflect broad terrain and mapped water polygons, not ground-scanned reality.

## Modules
- `public/src/main.js`: explorer scene, first-person walk, settings, maps, destinations.
- `public/src/world/StonyTerrain.js`: DEM interpolation, local geographic projection, textured ground and OSM water polygons.
- `public/src/world/StonyTrails.js`: OSM way geometry and path surface meshes.
- `public/src/world/StonyPlants.js`: efficient foliage/scenery distribution with habitat and trail-clearance rules.
- `public/src/world/KenneyPlants.js`: license-documented Kenney Nature Kit models, instancing and model normalization.
- `tools/build_stony_creek.py`: reproducible build-time public geographic data retrieval.
- `tools/validate_stony.mjs`: truthfulness and integrity checks for published geography.

The historical Bayberry Cove source/data remains in the repository for potential reuse, but it **is not invoked by this explorer build**. This is a GitHub Pages static site with no backend, server-side tracking or sign-in.
