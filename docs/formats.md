# Format Facts

Facts the editor relies on. Source and verification status sit in the last
column of each table. Longer notes live in `.agents/research/mdl-findings.md`.

## Mod Folder

| Path                             | Content                                                   | Source                                                                                       |
| -------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `mod.json`                       | `modId`, `revision`, severity, `visible`, `cosmetic`, ... | [Mod definition](https://wiki.transportfever3.com/doku.php?id=modding:general:moddefinition) |
| `_metadata/modinfo.json`         | `name` (32), `summary` (100), `description`, `authors`    | same                                                                                         |
| `strings.json`                   | language code to key/value strings                        | same                                                                                         |
| `content/`                       | game resources, mirrors the base game folders             | same                                                                                         |
| `_metadata/constructions/`       | editor documents (app only, the game ignores them)        | this project                                                                                 |
| `_metadata/export-manifest.json` | paths the exporter owns                                   | this project                                                                                 |

Names: a `modId` uses `a-z`, `0-9`, `_`. Resource names use lowercase `a-z`,
`0-9`, `_`, `-`. Text files are UTF-8 without BOM.

## Resource IDs

| Form                    | Meaning                                   | Status                                                            |
| ----------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| `/dir/file.mdl`         | from the base content root or mod root    | wiki                                                              |
| `::/dir/file.mdl`       | base game                                 | wiki                                                              |
| `mod_id::/dir/file.mdl` | another mod (the editor writes this form) | wiki shows `mod_id::path`. The slash form is not checked in game. |
| relative `msh/x.msh`    | from the referencing file                 | wiki                                                              |

A base game zip mounts at its folder: `stations/air.zip` holding
`air/airfield/apron.mdl` provides `/stations/air/airfield/apron.mdl`. A zip at
the content root (`placeholders.zip`) provides `/placeholders/...`.

## Image IDs

Images use the same id forms as models. The editor indexes `.tga`, `.dds`, and
`.png` files from the base game zips, the open mod's `content/`, and its
dependencies, about 20,900 images in the base game.

- The shipped zips hold UI icons mostly as `name@2x.tga`, while shipped
  constructions write `icon = "/placeholders/generic.tga"`. `@2x` marks the same
  icon at a higher resolution. The editor indexes both under the base id
  (`/placeholders/generic.tga`), accepts either form when checking a value, and
  reads thumbnails from the smaller base file when there is one, and from the
  `@2x` file only when that is all the game ships.
- Most UI icons live under `/gui`. The type-ahead lists `/gui` first.
- Formats seen in the base game: TGA types 2, 3, 10, and 11; DDS BC1, BC3, BC4,
  BC5, uncompressed R8 and BGRA8, and BC7 (not decoded, about 1.2% of files).

## Construction Files

| File             | Content                                                                                               | Status                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `<id>.con.lua`   | `function data() return { description, availability, menuCategory, order, params, updateScript } end` | wiki and shipped `airfield.con.lua`                                                  |
| `<id>.script.tl` | `data.updateFn(captureParams, params)` returns `ConstructionUtilSerialized.ConstructionResult`        | shipped scripts include `.script.tl`. `updateScript` pointing at one is open item 8. |
| `updateScript`   | `{ fileName = "<id>.script@updateFn", params = {} }`                                                  | wiki                                                                                 |

The tealdef has no record for the `.con` file. It defines only the `updateFn`
result in `construction_util_serialized.d.tl`.

## `.mdl`

Lua text: `function data() return { ... } end`. Data table with `version = 2`,
`boundingInfo.bbMin/bbMax`, `collider`, `lods[]`, `metadata`. A LOD holds
`node { name, transf, children, mesh, materials }` plus `visibleFrom` and
`visibleTo`. `transf` is a column-major 4x4. A node's world transform is the
parent times the child.

`metadata` can hold `_("KEY")` localization calls (seen in
`placeholders/missing_generic.mdl`). The reader treats `_("KEY")` as its key.

## `.msh` and `.msh.blob`

`.msh` is a Lua table, `.msh.blob` is raw little-endian binary.

- `vertexAttr.<name> { offset, count, numComp }`: float32 array. `offset` and
  `count` are bytes.
- `subMeshes[i].indices.<name> { offset, count }`: uint32 array.
- Each attribute has its own index list. `indices.position` indexes
  `vertexAttr.position`.
- Only 32-bit indices were seen. The reader rejects an index outside the
  position array and names the 32-bit limit.

## Ground Textures

`.gtex.lua` holds `texture`, `texSize` (meters), and `materialIndexMap` (gray
value to `.tmat`). The mask is an uncompressed 8-bit grayscale TGA (image type
3). `texCoords` per face vertex normalize over the face bounding box. The tiling
meaning of `texSize` against `texCoords` is not verified (open item 2).

## Paths

| Field                        | Shape                                                                                                                 | Source                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `edgeLists[].edges`          | Two `{ position, tangent }` entries per edge. A tangent's length equals the edge length.                              | [Construction basics](https://wiki.transportfever3.com/doku.php?id=modding:constructions:basics), tealdef |
| `edgeLists[].params.type`    | Street template id such as `/infrastructure/street/airport/airport_runway_small.street_template`. Not in the tealdef. | shipped `air/airfield.script.lua`. Not checked in game.                                                   |
| `edgeLists[].snapNodes`      | Entry indices. The editor writes the first entry that holds the node.                                                 | wiki. Not checked in game.                                                                                |
| `trafficLightNodePreference` | Pairs of entry index and `"YES"`, `"NO"`, or `"AUTO"`. The tealdef has `trafficLightYes` and `trafficLightNo`.        | wiki (open item 4)                                                                                        |
| `runways[].node`, `.edges`   | `{ -1, n }`: `-1` means the n-th node or edge of all `edgeLists`, counted in order.                                   | wiki, shipped airfield. Not checked in game.                                                              |
| `edgeObjects[]`              | `{ edge, param, left, model }`. `edge` counts edges across all edge lists. `param` is meters from the start node.     | wiki, shipped airfield. Item 9.                                                                           |
| `laneLists[].nodes`          | Two `{ position, tangent, width }` entries per edge.                                                                  | wiki, tealdef                                                                                             |
| Edge object `.con.lua`       | Declares `edgeObject = {}`. The id is the path without `.lua`, for example `/assets/stations/air/signs/sign_a.con`.   | shipped `stations.zip`                                                                                    |

## Model Silhouette

The server rasterizes the LOD 0 triangles top-down into at most 160 cells on the
long side, traces the cell boundary, and simplifies it. The result is an outline
for display only. It is not a collision or ground face.
