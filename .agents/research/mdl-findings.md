# TF3 model / mesh / ground texture findings

All paths below are inside archives under
`D:\Steam\steamapps\common\Transport Fever 3\base\content\`. Extracted copies
live in `...\scratchpad\x_<name>\`. Helper scripts in the same scratchpad:
`luatab.ts` (Lua data-table parser, parses all 308 sampled .msh files),
`readmesh.ts` (reads .msh + .blob), `blob.ts`, `survey.ts`, `scanzips.ts`.

## 1. `.mdl`

Text file. A Lua chunk `function data() return { ... } end` containing a pure
data table (no function calls, no expressions). Parseable by a ~40 line
Lua-table parser (see `luatab.ts`); `version = 2`.

Example `placeholders.zip` : `placeholders/unit_cube.mdl`

```lua
function data()
return {
  boundingInfo = { bbMax = { 1.5, 1.5, 1.5, }, bbMin = { -1.5, -1.5, -1.5, }, },
  collider = {
    params = { halfExtents = { 1.5, 1.5, 1.5, }, },
    transf = { 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1, },
    type = "BOX",
  },
  lods = {
    { node = { children = { {
          materials = { "mat/missing_object.mtl", },
          mesh = "msh/cube_1x1_lod0.msh",
          name = "cube_1x1",
          transf = { 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1, },
        }, },
        name = "RootNode",
        transf = { ...identity... }, },
      visibleFrom = 0, visibleTo = 1000, },
  },
  metadata = { },
  version = 2,
}
end
```

Fields:

- `boundingInfo.bbMin/bbMax`: `{x,y,z}`, model space, Z up. Matches mesh extents
  (heliport_hangar mesh max Y 48.828, Z 16.482 equals mdl bbMax).
- `collider`: `type` (seen `"BOX"`), `params.halfExtents`, `transf` 16 floats.
- `lods`: array. Each `{ node, visibleFrom, visibleTo }`. `visibleFrom = 0` for
  LOD 0; child-level `visibleFrom = -1`/`visibleTo = -1` also occurs. Distances
  like 1384.26, 1730.33, 2500, 5000. Use `lods[1]` for the highest detail.
- `node`: recursive tree. Fields: `name`, `transf`, `children` (nested nodes),
  and on mesh nodes `mesh` (path relative to the .mdl directory, e.g.
  `msh/foo_lod0.msh`), `materials` (array of `.mtl` paths relative to the .mdl,
  one per submesh, in submesh order), optional `animations`
  (`{ open = { type="FILE_REF", params={id="ani/x.ani"} } }`).
- `transf`: 16 floats, column-major 4x4 (translation is elements 13,14,15; e.g.
  `..., -20.312, 0.233002, 0.101598, 1`). Node world transform = parent * child.
- `metadata`: usually `{ }`; can hold
  `transportNetworkProvider.laneLists = { { linkable=false, nodes={ { {x,y,z}, {tx,ty,tz}, width }, ... } } }`
  (seen in `depots/rail.zip`: `rail/rail_depot.mdl`,
  `rail/rail_maint_station/rail_maint_station.mdl`).
- Other metadata hits (curves, firework) not examined: `game_mechanics.zip`
  `game_mechanics/fun_elements/firework/firework1.mdl`.

Multi-LOD / large examples: `stations/air.zip`: `air/heliport/heliport.mdl` (24
lods entries, many children), `stations/street.zip`:
`street/underground_station/models/underground_station_stairs.mdl` (29
visibleFrom entries), `depots/rail.zip`: `rail/rail_depot.mdl`.

Material file `.mtl` (also Lua data table):
`placeholders/mat/missing_object.mtl`

```lua
return { order = 0, type = "PHYSICAL_NRML_MAP",
  params = {
    map_albedo = { fragmentSamplers = { albedoTex = { fileName = "tex/unknown_albedo_1k.dds", type="TWOD", wrapS="REPEAT", wrapT="REPEAT" } } },
    map_metal_gloss_ao = { ... metalGlossAoTex ... }, map_normal = { ... normalTex ... redGreen = true },
    texcoord_scale = { fragmentProperties = { { texCoordScale = 1 } } },
    two_sided = { fragmentProperties = { { flipNormal = false } } },
  } }
```

Textures are `.dds` (and `.tga`), paths relative to the .mtl. Not needed for a
top-down silhouette.

## 2. `.msh` + `.msh.blob`

Each mesh is two files side by side: `foo_lod0.msh` (text Lua table, index) and
`foo_lod0.msh.blob` (raw little-endian binary, no header). Verified on 308
`.msh` files (game_mechanics, warehouses, model_editor, placeholders): 0 parse
failures, and for every file `max(offset+count)` over all attributes and index
sets equals the `.blob` size exactly.

`placeholders.zip`: `placeholders/msh/cube_1x1_lod0.msh`

```lua
return {
  subMeshes = { { indices = {
      normal   = { count = 144, offset = 952 },
      position = { count = 144, offset = 664 },
      tangent  = { count = 144, offset = 1096 },
      uv0      = { count = 144, offset = 808 },
  } } },
  vertexAttr = {
    normal   = { count = 72,  numComp = 3, offset = 208 },
    position = { count = 96,  numComp = 3, offset = 0 },
    tangent  = { count = 384, numComp = 4, offset = 280 },
    uv0      = { count = 112, numComp = 2, offset = 96 },
  },
}
```

Layout (verified by decoding the cube blob, 1240 bytes):

- `count` and `offset` are BYTES into the blob. `position.count = 96` is 8
  unique positions x 3 floats x 4 bytes.
- `vertexAttr.<name>`: float32 little-endian array, `numComp` floats per
  element. Attributes seen: `position`(3), `normal`(3), `tangent`(4), `uv0`(2),
  `uv1`(2).
- Each attribute has its OWN unique-value array and its OWN index list
  (OBJ-style, not one shared vertex buffer). Cube: 8 positions, 14 uvs, 6
  normals, 24 tangents.
- `subMeshes[i].indices.<name>`: uint32 little-endian array. `count/4` indices;
  triangle list (3 per triangle). `indices.position[k]` indexes the `position`
  array, `indices.uv0[k]` indexes `uv0`, etc. All index lists of a submesh have
  equal length. Index lists of different submeshes are stored consecutively;
  there is no per-submesh vertex range.
- `subMeshes[i]` corresponds to `materials[i]` of the mdl node that references
  the mesh. Max seen: 26 submeshes (`game_mechanics.zip`:
  `.../pollution_cleanup_facility/msh/clnp_main_building_lod0.msh`).
- Real mesh check: `stations/air.zip`
  `air/heliport/msh/heliport_hangar_lod0.msh`: 9 submeshes, 29417 positions, max
  index 29416, 42620 triangles, extents x -35.67..15.41, y -0.70..48.83, z
  -0.02..16.48.

JS reader sketch:

```js
const P = new Float32Array(
  blob,
  m.vertexAttr.position.offset,
  m.vertexAttr.position.count / 4,
);
for (const sm of m.subMeshes) {
  const ix = sm.indices.position;
  const I = new Uint32Array(blob.slice(ix.offset, ix.offset + ix.count)); // slice to guarantee 4-byte alignment is not needed if offsets are multiples of 4 (they were)
  for (let t = 0; t < I.length; t += 3) { /* P[I[t]*3..] */ }
}
```

Top-down 2D: take x,y of triangles after applying the node transform chain, fill
triangles, ignore z or sort by z.

## 3. Ground textures

Definition files `*.gtex.lua` (Lua data table, with
`require "/scripts/tex_util.tl"`; the
`tu.makeMaterialIndexTexture(file, wrapS, wrapT)` result is just
`{type="TWOD", fileName=file, magFilter="NEAREST", minFilter="NEAREST", wrapS, wrapT, mipmapAlphaScale=0, compressionAllowed=false, redGreen=false, scaleDownAllowed=false}`;
source in `scripts.zip`: `scripts/tex_util.tl`).

Two forms:

A. Mask-based (stations/buildings): `stations/air.zip`
`air/airfield/airfield.gtex.lua`

```lua
local tu = require "/scripts/tex_util.tl"
function data() return {
  texture = tu.makeMaterialIndexTexture("airfield.tga", "CLAMP_TO_EDGE", "CLAMP_TO_EDGE"),
  texSize = { 400, 110 },          -- world size in meters (matches the 400x110 px mask)
  materialIndexMap = {             -- grayscale pixel value -> terrain material
    [95]  = "::/terrain/materials/asphalt_01/asphalt_01.tmat",
    [8]   = "::/terrain/materials/asphalt_04/asphalt_04.tmat",
    [163] = "::/terrain/materials/dirt/dirt.tmat",
    [130] = "::/terrain/materials/grass_gravel/grass_gravel.tmat",
    [65]  = "::/terrain/materials/gravel_03/gravel_03.tmat",
  } } end
```

The mask `airfield.tga` is an uncompressed 8-bit grayscale TGA (header bytes
`00 00 03 ...`, width 0x0190=400, height 0x006e=110, 8 bpp, 44018 bytes). Pixel
value = key into `materialIndexMap`. Unmapped values are transparent (wiki).
`.tmat` refs resolve to `<name>.tmat.lua`.

B. Single-material (terrain materials): `terrain/materials/asphalt_01.zip` ->
`asphalt_01/asphalt_01.gtex.lua`

```lua
return { priority = 14,
  indices = { data = "1", size = { 1, 1 } },
  texSize = { 1, 1 },
  materialIndexMap = { "asphalt_01.tmat" } }
```

`indices.data` is a string with one digit per pixel (index into
materialIndexMap), `size` the pixel grid. The sibling `asphalt_01.tmat.lua` has
`name`, `icon`/`previewIcon` (`asphalt_01@2x.tga`, a 144044 byte preview icon),
`detailColorTexture` (`tex/asphalt_01_albedo.dds`), `detailSize = 1/32`,
`priority`, `categories`.

Key resolution (`groundFaces[].modes[].key`): the string is a gtex path without
`.lua`. Absolute (`/terrain/materials/asphalt_02/asphalt_02.gtex`,
`/industries/shared/gtex/cut_grass_mix.gtex`,
`/infrastructure/street/shared/street_border.gtex`) resolves from the content
root (zip mount root, so `/terrain/materials/asphalt_02.zip` containing
`asphalt_02/asphalt_02.gtex.lua` provides
`/terrain/materials/asphalt_02/asphalt_02.gtex`). Relative
(`airfield/airfield.gtex` in `air/airfield.script.lua`) resolves from the
construction's directory to `air/airfield/airfield.gtex.lua`. The `::/` prefix
in `.tmat` references means the base content root.

`groundFaces` entry (from `stations/air.zip` `air/airfield.script.lua` lines
392-403):

```lua
result.groundFaces = { {
  face = field_face,   -- list of {x,y,z} polygon points, construction-local meters
  modes = { { type = "FILL", key = "airfield/airfield.gtex",
              texCoords = { {.0,.0}, {1.0,.0}, {1.0,1.0}, {0.0,1.0} } } },
} }
```

- `type`: `FILL`, `STROKE`, `STROKE_OUTER`, `STROKE_INNER` seen (`STROKE_OUTER`
  with `/infrastructure/street/shared/street_border.gtex` in
  `modular_station.script.lua`).
- `texCoords`: one `{u,v}` per face vertex, same order as `face`. Normalized
  0..1 over the face's axis-aligned bounding box in
  `scripts/construction/modulesutil.lua` `addGroundFaces`:
  `u=(x-minX)/(maxX-minX)`, `v=(y-minY)/(maxY-minY)`. With `texCoords`
  {0,0},{1,0},{1,1},{0,1} the whole mask image is stretched across the rectangle
  (mask pixel grid = u,v). `texSize` then is the intended size in meters;
  REPEAT-wrapped textures would use coords beyond 1. Exact use of `texSize`
  against `texCoords` for tiled materials was not verified in-engine.
- `texCoords` may be omitted or empty (`constructionutil.lua`: `texCoords = {}`
  when not `withTexCoord`).

Related data sources for faces: scripts embed a `generatedData` table from the
model editor, e.g. `depots/rail.zip` `rail/rail_maint_station.script.lua`:
`["static"] = { curves = { ["ground_face"] = { { {14.3,7.05,0}, {14.3,-5.7,0}, {-15.5,-5.7,0}, {-15.5,7.05,0} } }, ["collider"] = {...} }, meshes = { ["equal"] = ..., ["greater"] = ... } }`.
Curve names containing `.gtex` (optionally `;`-separated
fill;strokeOuter;strokeInner, `withTexCoord`) become groundFaces
(`constructionutil.lua` `addGroundFaces`).

Other `.con.lua` constructs (real examples, all in `stations/air.zip`
`air/airfield.script.lua`):

- `edgeLists = { { type = "STREET", params = { type = runway_street }, edges = runway, snapNodes = {}, alignTerrain = false } }`,
  `edges` = array of `{ {px,py,pz}, {tx,ty,tz} }` (position, tangent), each list
  item 2 entries per edge.
- `runways = { { type = "LANDING", node = {-1, 4}, edges = { {-1, 1} } }, { type = "TAKEOFF", node = {-1,2}, edges = { {-1,1} } } }`.
- `edgeObjects = { { edge = n, param = 0.9, left = false, model = "/assets/stations/air/signs/signal_runway_old.con" } }`.
- `laneLists = { laneutil.createLane({ { {x,y,z}, {x,y,z}, ... } }, { "PERSON" }, 3, 3, true) }`
  (helper in `scripts`).
- `terrainAlignmentLists = { { type = "EQUAL"|"LESS"|"GREATER", faces = { face }, slopeLow = 0.275, slopeHigh = 0.6 } }`.
- `models = { { id = "/stations/air/airfield/apron.mdl", transf = <16 floats> } }`,
  `colliders`, `slots`,
  `subconstructions[].{runways,models,colliders,terrainAlignmentLists,groundFaces,labelText,laneLists,tag}`.
- The .con.lua itself (`air/airport.con.lua`) only holds `params`,
  `soundConfig`, `updateScript = { fileName = "airport.script@updateFn" }`,
  `preProcessScript`. Geometry comes from the `.script.lua`. A `.con.lua` for
  small buildings (`buildings/a/c1/1x1_01.zip`) is similar.

## 4. Archive map (relative to `base\content\`)

Loose directories (`assets/`, `buildings/`, `stations/`, ...) contain many small
`.zip` files; top-level zips: animal, base, characters, climates, economy,
game_mechanics, gui, locale, mission, model_editor, music, names, placeholders,
scripts, warehouses.

- Models (`.mdl`, `.msh`, `.mtl`):
  - `placeholders.zip` (11 mdl, cube + missing_* models; simplest)
  - `assets/buildings/{com,ind,res,shared}.zip`, `assets/industries/*.zip`,
    `assets/landmarks.zip`, `assets/construction.zip`, `assets/markers.zip`,
    `assets/rocks/*.zip`
  - `buildings/<era>/<class>/<size>.zip` (e.g. `buildings/a/c1/1x1_01.zip`:
    con.lua, gtex.lua, mdl, msh)
  - `stations/air.zip`, `stations/rail.zip`, `stations/street.zip`,
    `stations/water.zip`, `depots/{rail,road,water}.zip`, `warehouses.zip`,
    `animal.zip`, `game_mechanics.zip`, `model_editor.zip`, `vehicle/*.zip`
- Ground textures (`.gtex.lua`):
  - `terrain/materials/<name>.zip` (90ish zips, each ~57-77 MB due to dds;
    contains `<name>.gtex.lua`, `<name>.tmat.lua`, `<name>@2x.tga` icon)
  - `infrastructure/shared.zip` (`shared/none.gtex.lua`,
    `shared/hole.gtex.lua`), `infrastructure/street.zip` (street_border.gtex,
    not extracted)
  - per-construction masks: `stations/air.zip`
    (`air/airfield/airfield.gtex.lua`, `tarmac.gtex.lua`, `af_hangar.gtex.lua`),
    `placeholders.zip` (`placeholders/missing_gtex.gtex.lua` with
    `missing_gtex.tga`), `industries/*.zip`, `assets/rocks/shared.zip`,
    `assets/vegetation/shared.zip`, `buildings/**` (each has a `.gtex.lua` and
    `.tga`)
  - `scripts.zip`: `scripts/tex_util.tl`
- `.con.lua` / script examples:
  - `stations/air.zip`: `air/airport.con.lua`, `air/airfield.con.lua`,
    `air/heliport.con.lua`, scripts `airfield.script.lua`, `airport.script.lua`,
    `airfield/airfield_modules.script.lua` (groundFaces, edgeLists, edgeObjects,
    runways, laneLists)
  - `stations/rail.zip`: `rail/modular_station/modular_station.script.lua`,
    `modules.script.lua`, `trainstationutil.lua` (groundFaces, edgeLists,
    laneLists)
  - `stations/street.zip`, `stations/water.zip`
    (`water/harbor_modular.script.lua`: runways)
  - `depots/{rail,road,water}.zip`: `*_maint_station.script.lua` (groundFaces),
    `rail_depot.script.lua` (edgeLists)
  - `warehouses.zip`: `warehouses/warehouse.script.lua` (groundFaces with
    texCoords)
  - `infrastructure/street_construction.zip`:
    `street_construction/street_constructions.script.lua`
  - `scripts.zip`: `scripts/construction/constructionutil.lua`,
    `modulesutil.lua`, `legacytransportnetworks.lua`
  - `edgeObjects` also in `game_mechanics.zip`
    `game_mechanics/towns/town_util.tl`

## Not determined

- Exact engine tiling semantics of `texSize` vs `texCoords` outside 0..1 (not
  verified in the engine).
- Whether index width is ever 16 bit: all 308 sampled meshes size-checked as
  uint32; `.msh` files in `animal.zip`, `characters.zip`, `vehicle/*`,
  `assets/*`, `buildings/*` were not sampled.
- Rendering of `.dds` textures in JS (BC compressed likely; not inspected).
  `.tga` masks are uncompressed 8-bit grayscale type 3 (checked one header only;
  others not checked).
- `.ani` format, `.mtl` non-PHYSICAL types, skinned meshes (no bone/weight
  attributes appeared in sampled meshes).
- Exact precedence of `lods` selection and meaning of child-level
  `visibleFrom=-1`.
- Whether `.con.lua` in `buildings/` use `groundFaces` directly (only scripts
  were scanned by keyword; `buildings/**` .con.lua files did not match
  `groundFaces` in the scan).
- Full wiki page
  https://wiki.transportfever3.com/doku.php?id=modding:constructions:groundtextures
  does not mention groundFaces modes or texCoords.
