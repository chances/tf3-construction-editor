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
| Paint      | One raster per FILL polygon. Brightness 1..255 indexes `materialIndexMap`. Default 0.5 m per pixel, a document setting. STROKE modes draw as edge highlights only.                                 |
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

### Phase 3: Ground Faces

- Polygon draw/edit, counterclockwise enforcement.
- Paint mode list per face (FILL, STROKE, STROKE_INNER, STROKE_OUTER), texture
  key picker from the gtex index.
- `loop`, `alignmentOffsetMode`, `alignmentOffset`, `alignmentDirMode`,
  `alignmentDir` fields.

### Phase 4: Colliders and Terrain Alignment

- BOX, CYLINDER, POINT_CLOUD colliders with `halfExtents` or `points`.
- Terrain alignment lists: `type`, `faces` or `triangles`, `slopeLow`,
  `slopeHigh`, `optional`.

### Phase 5: Lane Lists and Runways

- Lane nodes (position, tangent, width), `speedLimit`, `transportModes`,
  `linkable`, `forwardOnly`, `needsReservation`, `pedestrianWalkPenalty`.
- Runways: LANDING/TAKEOFF, `edges` and `node` pairs referencing lane list and
  node indices.

### Phase 6: Edge Lists and Edge Objects

- STREET/TRACK edge lists: `edges`, `snapNodes`, `freeNodes`, `edgeType`,
  `edgeTypeName`, `params`, `alignTerrain`.
- Traffic light preference per node (YES, NO, AUTO).
- Edge objects: `edge`, `param`, `left`, `model`. Lint warns on more than one
  object per edge.

### Phase 7: Paint Terrain

- "Paint Terrain" mode: brush writes brightness values into the polygon's
  raster.
- Material list per raster (`materialIndexMap`, keys 1..255).
- Mask RLE storage in `masks/`, TGA export (uncompressed 8-bit grayscale, image
  type 3), `.gtex.lua` writer with `texSize`, `priority`.
- Paint strokes are commands that merge per stroke.

### Phase 8: Lint, Report, In-Game Checklist

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
