# Todo List

## Assets Browser

- Use cards for all the assets, like the mod/construction choosers
- Replace "base" category with "built-in", use chips for metadata like this
- Add a "Commercial"/"Industrial"/"Residential" chip (blue, yellow, and green
  text color and chip-outline, respectively) for `*/buildings/[com|ind|res]`
  assets
- Add generic title-case chips for subfolders otherwise, e.g.
  "building/com/awnings/b_awin_l_04.mdl" has a colored "Commercial" chip and a
  generic "Awnings" chip. Other path-based generic chips are pluralized, e.g.
  "/animal/*" becomes "Animals". Find the best English pluralization I18N library
  on JSR or NPM, based on web-standard pluralization utils and extended for our
  needs
- Add a filters suffix icon button to the "Search models" input. Clicking it
  toggles a filters overlay on top of the whole app, anchored below the search
  input
- Do .mdl files have human-readable names inside? If so, just use that and put
  the full path in an info icon with tooltip in the cards' top-right corner
- Generate the top-down silhouettes of all the models on the server
  asynchronously as PNG thumbnails

## Other Improvements

### Naming Assets

A lot of the asset names are redundant given the paths to the assets. For
example: `bird_crane/bird_crane.mdl`, `wolf/wolf.mdl`, etc.

### Prose & Pagination

- "Select one to place it." is rephrased to "Select an asset to place it in the
  scene." goes in the assets header, before the search row
- "100 of 4473 models" belongs in the Assets aside pane's footer, i.e. after the
  scrollable `main` list of assets
