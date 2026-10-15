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

## Model Silhouette

The server rasterizes the LOD 0 triangles top-down into at most 160 cells on the
long side, traces the cell boundary, and simplifies it. The result is an outline
for display only. It is not a collision or ground face.
