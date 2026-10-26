#!/usr/bin/env python3
"""Build static Stony Creek terrain and OSM geometry for GitHub Pages.

Outputs are sourced from public elevation raster services and OpenStreetMap.
No synthetic terrain is silently substituted for real geography.
"""
import json
import math
import os
import time
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
WEST, SOUTH, EAST, NORTH = -83.125, 42.704, -83.045, 42.787
CENTER_LAT = (NORTH + SOUTH) / 2
CENTER_LON = (WEST + EAST) / 2
SIZE = 257
HEADERS = {"User-Agent": "Sunward-Stony-Creek-Explorer/1.0 (static open-data exhibit)", "Accept": "*/*"}


def request(url, params=None, data=None, timeout=75):
    if params:
        url += ("&" if "?" in url else "?") + urlencode(params)
    payload = urlencode(data).encode("utf-8") if data else None
    req = Request(url, data=payload, headers=HEADERS)
    with urlopen(req, timeout=timeout) as result:
        return result.read()


def export_usgs():
    url = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
    params = {
        "bbox": f"{WEST},{SOUTH},{EAST},{NORTH}",
        "bboxSR": 4326, "imageSR": 4326, "size": f"{SIZE},{SIZE}",
        "format": "tiff", "pixelType": "F32", "interpolation": "RSP_Bilinear",
        "f": "image"
    }
    raw = request(url, params=params, timeout=120)
    image = Image.open(BytesIO(raw))
    if image.size != (SIZE, SIZE):
        raise ValueError(f"USGS returned unexpected raster size {image.size}")
    values = list(image.getdata())
    samples = [[round(float(values[y * SIZE + x]), 3) for x in range(SIZE)]
               for y in range(SIZE)]
    flattened = [v for row in samples for v in row]
    if min(flattened) < 0 or max(flattened) > 1000 or max(flattened)-min(flattened) < 5:
        raise ValueError("USGS elevation raster has implausible values")
    return samples, "USGS 3DEP ImageServer (real elevation, meters)"


def mercator_tile(lon, lat, zoom):
    latrad = math.radians(lat)
    size = 2 ** zoom
    x = (lon + 180) / 360 * size
    y = (1 - math.asinh(math.tan(latrad)) / math.pi) / 2 * size
    return x, y


def export_terrarium():
    zoom = 12
    tiles = {}
    samples = []
    for iy in range(SIZE):
        lat = NORTH + (SOUTH-NORTH) * iy / (SIZE-1)
        row = []
        for ix in range(SIZE):
            lon = WEST + (EAST-WEST) * ix / (SIZE-1)
            tx, ty = mercator_tile(lon, lat, zoom)
            tile_x, tile_y = int(tx), int(ty)
            key = tile_x, tile_y
            if key not in tiles:
                url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{tile_x}/{tile_y}.png"
                img = Image.open(BytesIO(request(url, timeout=45))).convert("RGB")
                tiles[key] = img.load()
            pixel_x = min(255, max(0, int((tx - tile_x)*256)))
            pixel_y = min(255, max(0, int((ty - tile_y)*256)))
            r,g,b = tiles[key][pixel_x,pixel_y]
            row.append(round(r*256+g+b/256-32768,3))
        samples.append(row)
    return samples, "Mapzen terrain tiles (public real elevation, Terrarium encoding)"


def terrain():
    try:
        samples, source = export_usgs()
    except Exception as error:
        print(f"USGS 3DEP export unavailable, trying real Mapzen DEM: {error}", flush=True)
        samples, source = export_terrarium()
    heights = [v for row in samples for v in row]
    result = {
        "source": source,
        "bounds": {"west": WEST,"south":SOUTH,"east":EAST,"north":NORTH},
        "width": SIZE, "height": SIZE, "samples": samples,
        "minimum": round(min(heights),3), "maximum": round(max(heights),3)
    }
    assert 170 < result["minimum"] < 330 and 200 < result["maximum"] < 420
    (DATA/"stony-creek-dem.json").write_text(json.dumps(result,separators=(",",":")))
    print(f"Terrain: {source}, {result['minimum']}–{result['maximum']}m",flush=True)
    return result


BBOX = f"({SOUTH},{WEST},{NORTH},{EAST})"
QUERY = f"""[out:json][timeout:125];
(
 way["highway"~"^(path|footway|cycleway|track|pedestrian|service|residential)$"]{BBOX};
 way["natural"="water"]{BBOX};
 relation["natural"="water"]{BBOX};
 way["water"~"^(lake|reservoir|pond)$"]{BBOX};
 way["natural"~"^(wood|wetland|grassland)$"]{BBOX};
 way["landuse"~"^(forest|meadow)$"]{BBOX};
 nwr["name"~"Nature Center|Eastwood Beach|Baypoint Beach|Stony Creek Lake|Mt. Shelden|Reflection Pond",i]{BBOX};
);
out geom;"""


def coords(geometry):
    if not geometry:
        return []
    return [[round(p["lon"],7),round(p["lat"],7)] for p in geometry
            if WEST-.005 <= p.get("lon",0) <= EAST+.005
            and SOUTH-.005 <= p.get("lat",0) <= NORTH+.005]


def is_closed(points):
    return len(points)>=4 and points[0]==points[-1]


def join_outer_members(members):
    chains = []
    for member in members:
        if member.get("role") != "outer" or not member.get("geometry"):
            continue
        seq=coords(member["geometry"])
        if len(seq)>2:
            chains.append(seq)
    result=[]
    while chains:
        line=chains.pop(0)
        while not is_closed(line):
            match=None
            for i,other in enumerate(chains):
                if line[-1] == other[0]:
                    line+=other[1:];match=i;break
                if line[-1] == other[-1]:
                    line+=list(reversed(other[:-1]));match=i;break
                if line[0] == other[-1]:
                    line=other[:-1]+line;match=i;break
                if line[0] == other[0]:
                    line=list(reversed(other[1:]))+line;match=i;break
            if match is None:break
            chains.pop(match)
        if is_closed(line):result.append(line)
    return result


def osm():
    payload=None
    providers=[
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.nchc.org.tw/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://overpass.private.coffee/api/interpreter"
    ]
    for endpoint in providers:
        try:
            payload=json.loads(request(endpoint,data={"data":QUERY},timeout=150))
            if len(payload.get("elements",[]))<25:raise RuntimeError("Unexpectedly sparse OSM result")
            print(f"OSM: {len(payload['elements'])} features from {endpoint}",flush=True)
            break
        except Exception as error:
            print(f"OSM mirror unavailable: {endpoint}: {error}",flush=True)
    if payload is None:
        raise RuntimeError("No OpenStreetMap Overpass service returned real trails; stopping deployment.")
    paths=[]; water=[]; woods=[]; landmarks=[]
    used_polygons=set()
    for el in payload["elements"]:
        tags=el.get("tags") or {}
        name=tags.get("name","")
        kind=el.get("type")
        if kind in ("node","way") and name and (
            "Nature Center" in name or "Beach" in name or "Shelden" in name
            or "Stony Creek Lake" in name):
            position=el if kind=="node" else (el.get("geometry") or [None])[0]
            if position and "lat" in position:
                landmarks.append({"name":name,"lat":position["lat"],"lon":position["lon"]})
        if kind=="relation" and tags.get("natural")=="water":
            for polygon in join_outer_members(el.get("members",[])):
                key=(polygon[0][0],polygon[0][1],len(polygon))
                if key not in used_polygons:
                    water.append(polygon);used_polygons.add(key)
        if kind!="way":continue
        poly=coords(el.get("geometry",[]))
        if len(poly)<2:continue
        highway=tags.get("highway","")
        if highway in ("path","footway","cycleway","track","pedestrian","service","residential"):
            paths.append({"coords":poly,"name":name,"kind":highway,
                          "surface":tags.get("surface",""),"foot":tags.get("foot","")})
        if is_closed(poly):
            natural=tags.get("natural","")
            if natural=="water" or tags.get("water") in ("lake","reservoir","pond"):
                key=(poly[0][0],poly[0][1],len(poly))
                if key not in used_polygons:
                    water.append(poly);used_polygons.add(key)
            if natural in ("wood","wetland","grassland") or tags.get("landuse") in ("forest","meadow"):
                woods.append({"coords":poly,"kind": natural or tags.get("landuse")})
    if not paths:
        raise RuntimeError("OSM had no usable walking paths, refusing to fake a map.")
    output={"source":"© OpenStreetMap contributors, Open Database License",
            "bounds":{"west":WEST,"south":SOUTH,"east":EAST,"north":NORTH},
            "paths":paths,"water":water,"habitats":woods,"landmarks":landmarks}
    (DATA/"stony-creek-map.json").write_text(json.dumps(output,separators=(",",":")))
    print(f"Paths {len(paths)}, water polygons {len(water)}, habitat polygons {len(woods)}, landmarks {len(landmarks)}",flush=True)
    return output


if __name__=="__main__":
    DATA.mkdir(parents=True,exist_ok=True)
    terrain()
    osm()
