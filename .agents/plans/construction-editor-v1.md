# Construction Editor v1 Plan

A browser app (MobX + Lit) that edits the static Transport Fever 3 constructions
of one mod and exports them into the mod folder as `.con.lua` and `.script.tl`
files.

## Sources

- Wiki:
  [Introduction](https://wiki.transportfever3.com/doku.php?id=modding:introduction),
  [Mod definition](https://wiki.transportfever3.com/doku.php?id=modding:general:moddefinition),
  [Resource types](https://wiki.transportfever3.com/doku.php?id=modding:general:resourcetypes),
  [Construction basics](https://wiki.transportfever3.com/doku.php?id=modding:constructions:basics),
  [Ground textures](https://wiki.transportfever3.com/doku.php?id=modding:constructions:groundtextures)
- Reference mod layout: `mod.json`, `strings.json`, `_metadata/modinfo.json`,
  `content/` (example: the user's `enigma_signal_timing_studio`)
- Type defs:
  `D:\Steam\steamapps\common\Transport Fever 3\base\tealdef\scripts\construction\construction_util_serialized.d.tl`
- Format research: `.agents/research/mdl-findings.md` (copy the key facts into
  `docs/formats.md` in phase 1)
- Shipped examples: `stations/air.zip`, `air/airfield.script.lua` (groundFaces,
  edgeLists, runways, edgeObjects, laneLists)

## Decisions

| Area       | Decision                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Output     | Each construction's JSON under `_metadata/constructions/` is the source of truth. Export writes `.con.lua`, `.script.tl`, `.gtex.lua`, and mask TGA into the mod's `content/` tree.                |
| TGA        | Uncompressed 8-bit grayscale: 18-byte header (image type 3, bits per pixel 8, descriptor 0), then raw rows, bottom-up. Matches the header of shipped `rail_depot.tga`.                             |
| Params     | None. One static result table.                                                                                                                                                                     |
| Schema     | Union of wiki and `construction_util_serialized.d.tl`. The wiki wins on conflict. Unverified fields carry a flag.                                                                                  |
| Scope      | models, groundFaces, colliders, terrainAlignmentLists, laneLists, runways, edgeLists, edgeObjects, metadata                                                                                        |
| Paint      | One raster per FILL polygon. Brightness 1..255 indexes `materialIndexMap`. Default 0.5 m per pixel, a construction setting. STROKE modes draw as edge highlights only.                             |
| Document   | A mod folder. App files live in `_metadata/`: `constructions/<id>.json`, `constructions/<id>/masks/` (binary rasters), `export-manifest.json`. Exported output goes under the mod `content/` tree. |
| Models     | Server indexes base game zips, the open mod's `content/`, and the mods in its `dependencies`. Canvas draws silhouette outline plus bounding box from `.msh.blob`, LOD 0.                           |
| Rendering  | SVG inside Lit components.                                                                                                                                                                         |
| Runtime    | Browser app plus local Deno server. The server reads the install and mod folders. Server config holds `installRoot` and `modsRoot` (default: the user's Documents mods folder).                    |
| Stack      | Deno workspace, Vite, TypeScript, Lit, MobX.                                                                                                                                                       |
| History    | Command objects with do/undo. Drags merge into one command.                                                                                                                                        |
| Snapping   | Grid (0.1, 0.5, 1, 5 m), vertex/node/origin, edge tangent, angle steps (1, 5, 15, 45, 90).                                                                                                         |
| Height     | Z is a numeric inspector field per item, plus a Z-band layer filter.                                                                                                                               |
| Metadata   | Typed forms for known keys (`ConstructionConfig`, stocks, effects), generic key/value tree for the rest.                                                                                           |
| Validation | Live lint panel. Errors block export. Warnings do not.                                                                                                                                             |
| Layout     | Start flow: Choose a Mod, Mod Details, Construction. Editor page: Assets aside, canvas, Inspector aside (scene tree with properties, Problems footer).                                             |

## Mod Project

- The app opens a mod folder that holds `mod.json`, or creates
  `<modsRoot>/<modId>/` with the New Mod card. A wizard then shows Mod Details
  and a construction chooser before the editor page opens.
- The Mod Details step edits `mod.json` (`modId`, `revision`, `severityAdd`,
  `severityRemove`, `visible`, `cosmetic`, `dependencies`, `incompatibilities`)
  and `_metadata/modinfo.json` (`name`, `summary`, `description`, `authors`,
  `tags`, `localization`). Unknown keys survive a write. `strings.json` is never
  edited.
- One mod holds many constructions. The tree lists them and one is open at a
  time.
- The construction inspector edits the `.con.lua` fields: `description` (`name`,
  `description`), `availability` (`yearFrom`, `yearTo`), `menuCategory`
  (`category`, `order`), and the `content/` folder.
- Export writes `content/<folder>/<id>.con.lua` (data only, `updateScript`
  points at the script) and `content/<folder>/<id>.script.tl` (`updateFn`
  returns the data).
- Export writes only files listed in `_metadata/export-manifest.json`, or new
  files. It refuses to overwrite any other file.
- A model id from a dependency mod uses the `mod_id::` prefix. Placing one adds
  the mod to `dependencies`.
- Resource names use lowercase `a-z`, `0-9`, `_`, and `-`. Text files are UTF-8
  without BOM.

## Folders

Each folder sits at the repo root and is a Deno workspace member.

| Folder     | Role                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| `./schema` | Types, JSON schema, defaults, lint rules, no DOM                       |
| `./export` | JSON to `.con.lua`, `.script.tl`, `.gtex.lua`, mask TGA, export report |
| `./server` | Zip index, `.mdl`/`.msh` readers, file API, export writer              |
| `./app`    | Lit components, MobX stores, commands, canvas                          |

## Phases (Export-First Vertical Slice)

### Phase 0: Scaffold (Done)

- Deno workspace, Vite dev and bundle tasks, `deno fmt`, `deno test` tasks.
- `AGENTS.md` with a `CLAUDE.md` symlink (same turn).
- Verify: `deno task test` runs an empty suite.

### Phase 1: Thin Slice (Models + Metadata, End to End) (Done)

- Schema for `models`, `metadata`, `tag`, top-level cost fields, `snapPoint`.
- Schema for the mod (`mod.json`, `modinfo.json`) and the `.con.lua`
  description, availability, and menu category fields.
- Server: config (`installRoot`, `modsRoot`), mod open and create, dependency
  lookup by `modId`, zip central-directory index, single-file streaming, `.mdl`
  reader (Lua text table).
- App: mod picker and mod inspector, shell layout, asset browser list, place a
  model as a bounding box, inspector for `transf`.
- Export: `.con.lua`, `.script.tl` with `updateFn` returning the data,
  key-merged `mod.json` and `modinfo.json`, and the export manifest.
- Tests: schema round trip, export golden file, `.mdl` reader against 3 real
  files, manifest refusal to overwrite an unowned file.

### Phase 2: Editing Core (Done)

- Command stack, undo/redo, selection, move/rotate/scale gizmos.
- Snapping engine with the four modes.
- `.msh` and `.msh.blob` reader, silhouette outline in the server, cached per
  model.
- Multiple subconstructions with `tag` and layer visibility.

### Phase 3: Ground Faces (Done)

- Polygon draw/edit, counterclockwise enforcement.
- Paint mode list per face (FILL, STROKE, STROKE_INNER, STROKE_OUTER), texture
  key picker from the gtex index.
- `loop`, `alignmentOffsetMode`, `alignmentOffset`, `alignmentDirMode`,
  `alignmentDir` fields.

Decisions:

| Area         | Decision                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draw         | A Ground Face tool clicks points. Clicking the first vertex, double-click, or Enter closes the face, and Esc cancels. A rectangle tool drags an axis-aligned 4-point face.             |
| New face     | A closed face gets one FILL mode and the texture picker opens. Cancelling leaves an empty key, which lint reports as an error.                                                         |
| Winding      | The editor always stores counterclockwise points and reverses a clockwise face without a notice.                                                                                       |
| Height       | A face has no Z. The game ignores it, and export writes every point at 0.                                                                                                              |
| Vertices     | Dragging merges into one command. Removing one vertex needs no confirm and is blocked below 3 points. Removing a face or a paint mode needs no confirm either, since undo restores it. |
| Snapping     | A vertex snaps to other face vertices and model silhouette corners, besides the grid. Angle steps apply to the edge being drawn.                                                       |
| Texture keys | The server indexes `.gtex.lua` files in base zips, the open mod, and its dependencies. The picker is a searchable name list with thumbnails.                                           |
| Thumbnails   | The server decodes the preview image, returns PNG, and caches it per texture, like silhouettes. The app has no image decoders.                                                         |
| texCoords    | Auto: one `{u,v}` per vertex, normalized 0..1 over the face bounding box, recomputed when vertices move. A toggle per mode makes each vertex's u and v editable.                       |
| Alignment    | `loop` and the alignment fields are face fields in the wiki. They sit in a collapsible Alignment group on the face. Lint warns when one is in use (unverified field).                  |
| Canvas       | FILL shows the texture thumbnail tiled inside the polygon at reduced opacity with an outline. STROKE modes draw as edge highlights.                                                    |
| Scene tree   | Each layer lists Models and Ground Faces. Selecting a face moves it whole with the gizmo, and selecting a vertex drags it. Hiding a layer hides both.                                  |
| Z band       | A face has no Z, so the band never hides it. Only hiding its layer does.                                                                                                               |
| Lint         | Self-intersecting polygon is a warning. Empty texture key is an error.                                                                                                                 |
| Manual tests | A Phase 3 section is added to the V1 Manual Tests artifact.                                                                                                                            |

### Phase 4: Paths (Lane Lists, Runways, Edge Lists, Edge Objects)

- Placement: `laneLists` and `runways` belong to a subconstruction (a layer).
  `edgeLists` and `edgeObjects` sit at the construction top level, outside any
  layer. `construction_util_serialized.d.tl` lists neither at any level, so both
  carry the unverified flag (Open Verification Item 9).
- Drawing: click to add nodes. Tangents are automatic (from the neighbor nodes,
  straight by default). A selected node overrides its tangent with a drag handle
  or two numeric fields. Z is a numeric field per node. A new node copies the Z
  of the previous node in its path, or 0 for the first. The Z band shows a path
  when any of its points is inside the band.
- Lane lists: nodes (position, tangent, width, default 3), `transf`,
  `transportModes` (multi-select, default `PERSON`), `speedLimit` (default 3),
  `linkable` (default on), `forwardOnly`, `needsReservation` (both default off),
  `pedestrianWalkPenalty` (default 1). The canvas colors a lane by transport
  mode and draws direction arrows.
- Edge lists: each draw is a polyline chain of edges. A node placed on an
  existing node snaps and joins it, and the editor derives the node indices. A
  node toggles snap node or free node. A picker lists the street and track types
  of the install and the mods, and the pick sets `type` and `edgeTypeName`.
  Fields: `alignTerrain`, a per-node traffic light choice (YES, NO, AUTO, wiki
  form), and a generic `tag2nodes` editor (tag name, node list).
- Runways: `LANDING` or `TAKEOFF`, one chosen edge list, and `node` and `edges`
  filled with Pick Node buttons that read a click on the canvas. Lint errors on
  an index out of range.
- Edge objects: the server indexes edge object `.con` files from the install and
  the mods, and the Assets pane lists them as their own kind with a chip. An
  object stores its edge list, edge, `param`, and `left`, and export computes
  the numeric `edge` index. Lint warns on more than one object per edge.
- References: a runway or edge object stores a reference, and export computes
  the indices. Deleting a node, edge, or edge list that has dependents confirms
  in `ce-confirm-dialog`, then removes all dependents and theirs. One undo
  restores everything.
- Scene tree: each layer holds Lanes and Runways. A top-level Edges section
  holds edge lists and edge objects. The canvas draws edges as street or track
  strokes with node dots, and a runway as a highlight on its edges.

### Phase 5: Colliders and Terrain Alignment

- Placement: `colliders` and `terrainAlignmentLists` belong to a subconstruction
  (a layer). The `NONE` collider type is not offered.
- Colliders: BOX, CYLINDER, and POINT_CLOUD. A BOX or CYLINDER has a `transf`,
  so it moves and rotates with the model gizmos and snapping. Half extents (x,
  y, z) are handles on the outline plus Inspector fields. The cylinder axis (X,
  Y, Z) is a dropdown that sets the rotation. A POINT_CLOUD uses the ground face
  vertex tool (move, insert, remove) and a Z field per point.
- Fit Box: on a selected model or layer, creates a BOX from the world-aligned
  bounding box of the mesh 3D extents (a layer sums its models, hidden models
  are skipped, no padding). Extrude Face: on a ground face, opens a popover with
  two Z offsets (defaults 0 and 3) and creates a POINT_CLOUD like
  `extrudePoints`. Each is one undoable command.
- Terrain alignment lists: `type` (EQUAL, LESS, GREATER; default EQUAL),
  `slopeLow` (default 0.275), `slopeHigh` (default 0.6), `faces`, and
  `optional`. `optional` is not in the tealdef, so it carries the unverified
  flag. `triangles` is not in v1. A face entry is a reference to a ground face
  of the same layer or an own polygon. An own point has a Z field, and a
  reference takes one Z for the list. The form constrains `slopeLow` and
  `slopeHigh` against each other live.
- Canvas: colliders draw as dashed outlines (rectangle, ellipse, or point dots).
  Alignment lists draw as translucent fills colored by type, with the slope
  range in the label. Both follow layer visibility and the Z band.
- Removing a ground face that a list references confirms in `ce-confirm-dialog`
  and names the lists. On yes, the face and its references go, and a list left
  with no faces is deleted. One undo restores everything. A face with no
  dependents removes at once.
- Lint: errors for a list with no faces, `slopeLow` above `slopeHigh` (the form
  prevents it, but a hand-edited file can hold it), a half extent at or below 0,
  and a POINT_CLOUD with no points. A warning for `optional` in use.

### Phase 6: Paint Terrain

- "Paint Terrain" mode: brush writes brightness values into the polygon's
  raster.
- Material list per raster (`materialIndexMap`, keys 1..255).
- Mask RLE storage in `masks/`, TGA export (uncompressed 8-bit grayscale, image
  type 3), `.gtex.lua` writer with `texSize`, `priority`.
- Paint strokes are commands that merge per stroke.

Decisions:

| Area           | Decision                                                                                                                                                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source         | A face's FILL has a Source of Texture (the picker key) or Painted (a generated `.gtex.lua` and mask). A face never mixes the two. A Painted face has exactly one FILL and no other modes, so switching to Painted removes the rest. Undo restores them.                                                           |
| Switch back    | Switching a Painted FILL back to Texture discards the raster and its materials. Undo restores the raster and the modes it replaced, so no dialog.                                                                                                                                                                 |
| Raster extent  | A fixed rectangle in construction meters, set from the face bounding box when painting starts. Moving a vertex never moves or stretches pixels. A vertex outside the rectangle grows it, and new pixels are 0. The mode's texCoords lock to 0..1 over the rectangle.                                              |
| Size cap       | 2048 px a side. Growth past the cap is refused with a status bar message, and the pixel size field warns before a change that would pass it.                                                                                                                                                                      |
| Pixel size     | One value per construction, default 0.5 m. Changing it resamples with nearest neighbor, and undo restores the old pixels.                                                                                                                                                                                         |
| Priority       | A per-raster field, default 14 (the shipped asphalt value), written to the `.gtex.lua`.                                                                                                                                                                                                                           |
| Materials      | A picker lists `.tmat` files from base zips, the open mod, and its dependencies, with the thumbnails and search of the texture picker. The editor assigns the next free value 1..255, and the user never sees it.                                                                                                 |
| Material color | The server decodes the `.tmat` preview image, averages it, and caches the color per material. The canvas draws each painted pixel in that flat color, with the Phase 3 outline and reduced opacity.                                                                                                               |
| Remove         | Removing a material that has pixels opens `ce-confirm-dialog` with the percentage of the raster's pixels it clears. Undo restores them. Like a path node with dependents, it confirms although undo restores it.                                                                                                  |
| Tools          | A Paint Terrain tool in the canvas toolbar, enabled while a Painted face is selected (a disabled title says why). Round brush in meters (default 2, range 0.5 to 20, `[` and `]` change it), eraser (writes 0), and flood fill. A ring cursor shows the brush, and Alt-click picks the material under the cursor. |
| Paint area     | Brush and fill clip to the face polygon, so every painted pixel is visible.                                                                                                                                                                                                                                       |
| Face id        | Each ground face gets an editor-only id on creation, stable across reorder and delete.                                                                                                                                                                                                                            |
| Storage        | RLE rasters at `_metadata/constructions/<id>/masks/<faceId>`.                                                                                                                                                                                                                                                     |
| Export         | `content/<folder>/masks/<id>_<name>.tga` and `.gtex.lua`. `<name>` is the face label forced to lowercase `a-z`, `0-9`, `_`, `-`, or the face id when empty, with `_2`, `_3` on a collision. The mode `key` is relative to the `.con.lua`. `texSize` is the raster rectangle in meters.                            |
| Stale files    | A rename leaves old files. Export removes manifest-owned files it no longer writes and lists them in the export report. Files outside the manifest are never touched.                                                                                                                                             |
| Lint           | Raster over 2048 px a side is an error. Raster with no painted pixels and material with no pixels are warnings.                                                                                                                                                                                                   |
| Manual tests   | A Phase 6 section is added to the V1 Manual Tests artifact.                                                                                                                                                                                                                                                       |

### Phase 7: Lint, Report, In-Game Checklist

- Full lint rules (see below).
- Export report: written files, unverified fields used.
- Manual checklist file `docs/in-game-checklist.md`.

## Lint Rules

| Rule                                    | Severity |
| --------------------------------------- | -------- |
| Ground face has at least 3 points       | Error    |
| Ground face winding is counterclockwise | Error    |
| Lane list has at least 2 nodes          | Error    |
| Runway lane list and node indices exist | Error    |
| Edge indices are in range               | Error    |
| Model id resolves in the asset index    | Error    |
| More than one edge object on an edge    | Warning  |
| Field marked unverified is in use       | Warning  |
| Raster has no painted pixels            | Warning  |
| Raster material has no pixels           | Warning  |
| Raster is over 2048 px on a side        | Error    |
| Export target file is not owned         | Error    |

## Tests

- Fixtures: tests read real game files in place and skip when the install is
  absent. A few small files from `placeholders.zip` (including the unit cube)
  are copied to `server/testdata/` so CI runs without the install.
- `deno test` units: schema, commands, snapping math, export text, mask RLE
  round trip.
- Golden-file export tests: reference JSON for a real shipped construction,
  compare exported Teal to a stored file.
- Manual in-game checklist: construction loads, colliders block, lanes show with
  Right Alt + L, ground texture appears.

## Open Verification Items

Each item is a task with an in-game or script-source check. The result goes into
`docs/formats.md`.

1. `texCoords` rule. Research says one `{u,v}` per face vertex, normalized 0..1
   over the face bounding box. Source: `scripts.zip` `modulesutil.lua`. Check in
   game.
2. `texSize` versus `texCoords` tiling semantics. Not determined by the
   research.
3. Exported mask TGA loads in game. Header bytes match a shipped mask, but no
   in-game load is recorded yet.
4. Wiki `trafficLightNodePreference` versus tealdef
   `trafficLightYes`/`trafficLightNo`. Export the wiki form, check in game.
5. `tag2Nodes` and `tag2nodes` casing and meaning. Undocumented on the wiki,
   present in tealdef.
6. `.mdl` skinned meshes, `.ani` files, and `.dds` decoding. Not needed for
   silhouettes, but model ids may point at them.
7. Index width in `.msh.blob`. Sample showed 32-bit only. Reader must reject
   other widths with a clear error.
8. Teal update script: confirm the game loads a `.script.tl` named by
   `updateScript` and accepts an `updateFn` that returns the data table. The
   `.con.lua` shape follows the wiki and shipped `airfield.con.lua`.
9. Level of `edgeLists` and `edgeObjects`. The tealdef lists neither on a
   subconstruction nor on the construction result. The plan puts both at the top
   level of the result, and a runway indexes nodes and edges of one edge list.
   Check in game, and check that `edgeObjects.edge` counts edges across all edge
   lists.

## Out of Scope

- Construction params, modules, slots.
- Station, industry, depot, warehouse, and town building subconstruction
  properties.
- Round-trip import of hand-written `.con` scripts.
- Compressed (RLE) or color TGA output.
- Rendering STROKE paint as textured edges.
- Textured or lit 3D model preview.
- UI to override the export manifest or take ownership of existing files.
- `strings.json` editing.
- Multiple constructions open at once.
