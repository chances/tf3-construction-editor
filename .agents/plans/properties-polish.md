# Properties Polish: Icon Type-Ahead and Cost Inputs

Two changes to the Properties pane. The folder chooser button lives in
`server/src/folder-dialog.ts` and `ce-mod-picker`.

## Decisions

| Topic            | Decision                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Image sources    | Base game zips, the open mod's `content/`, and its dependencies. Same id scheme as models.                |
| Formats          | TGA, PNG, and DDS.                                                                                        |
| Delivery         | A backend route generates thumbnails and serves them as PNG. The browser never decodes game formats.      |
| Undecodable file | It stays in the type-ahead as a placeholder tile with its file name. The value still works.               |
| Fields           | `Icon` and `Preview icon` in the construction properties. Free text stays valid.                          |
| Index            | Built on first use, separate from the model index, so the model list never waits on 21,000 image entries. |
| Cost inputs      | Proposal below. Needs a yes before building.                                                              |

## Image Formats Found in the Base Game

A sample of 400 DDS and about 1,400 TGA files.

| Format | Variants seen                                                          | Decoder                       |
| ------ | ---------------------------------------------------------------------- | ----------------------------- |
| TGA    | type 2 (24 and 32 bit), type 3 (8 bit gray), type 10 and 11 (RLE)      | `server/src/image/tga.ts`     |
| DDS    | BC1 (DXT1), BC3 (DXT5), BC4 (ATI1), BC5 (ATI2, BC5U), R8, BGRA8, RGB24 | `server/src/image/dds.ts`     |
| DDS    | `DX10` header: DXGI 71, 77, 80, 83, 87, 61 mapped to the same decoders | `server/src/image/dds.ts`     |
| DDS    | BC7 (DXGI 98), float formats                                           | not decoded, placeholder tile |
| PNG    | 8 bit, filtered rows                                                   | `server/src/image/png.ts`     |

## Server

- `server/src/images.ts`: `ImageIndex` with `indexBaseImages`, `indexModImages`,
  and `search(query, limit)`. Entries carry `id`, `source`, `modId`, and
  `format`. Search matches the id as a substring and ranks matches on the file
  name first.
- `GET /api/mods/:dir/images?q=&limit=` returns `{ total, entries }`. The limit
  is capped at 100.
- `GET /api/mods/:dir/image?id=&size=` returns `image/png`. Size is clamped to
  16 through 256 and defaults to 64.
- Thumbnails come from mip 0 of a DDS, scaled down with a box filter and keeping
  alpha. The PNG encoder uses `CompressionStream("deflate")`.
- An in-memory LRU of 512 encoded thumbnails keyed by id and size. The response
  has an `ETag` from the archive path, entry name, and size, and
  `Cache-Control: max-age`.
- A file the decoders cannot read returns `415` with a message that names the
  file and the format, for example
  `The image /gui/foo.dds is BC7, which the
  thumbnail generator does not decode.`
- `server/deno.json` needs no new permission.

## App

- `ce-icon-picker`: a text input with a 28px thumbnail of the current value as
  an inset prefix. Typing opens a list below it, the same pattern as
  `ce-construction-switcher`. Each row has a 40px thumbnail, the file name, and
  the folder in muted text. At most 50 rows. Arrow keys move, Enter picks,
  Escape closes, and any typed text commits on blur.
- Thumbnails are `<img loading="lazy">` pointing at the image route, with
  `width` and `height` set so rows do not shift. A `415` shows the placeholder
  tile.
- `ce-properties` uses `ce-icon-picker` for `Icon` and `Preview icon`.
- `app/src/api.ts` gains `images(dir, query)` and `imageUrl(dir, id, size)`.
- An empty result shows `ce-empty-state` inside the list. The error state from
  `ce-error-state` covers an install folder that is not set.

## Cost Inputs (Proposal)

The three number boxes sit in a two-column grid, so Bulldoze is alone on a
second row and the spinners add noise.

- One row of three equal columns: Cost, Maintenance, Bulldoze.
- Labels above, numerals right-aligned with tabular figures, spinners hidden.
- Arrow keys step by 100. A thousands separator shows when the box is not
  focused.
- The disabled state under "No costs at all" dims the values and keeps them
  readable.

## Tests

- `tga.test.ts`, `dds.test.ts`, and `png.test.ts` decode tiny fixtures that are
  built in the test, not shipped files.
- `images.test.ts` covers ids, ranking, the limit, and dependency prefixes.
- `api.test.ts` covers the search route, the thumbnail route, the clamped size,
  and the `415` message.
- `ce-icon-picker.test.ts` runs under happy-dom: typing filters, arrow keys
  move, Enter commits, Escape restores, a failed thumbnail shows the tile.

## Not in This Change

- BC7 and float DDS decoding.
- The folder chooser button, which lives in `server/src/folder-dialog.ts`.
- Previews for any field other than the two icons.
