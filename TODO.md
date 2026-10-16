# Todo List

## Assets Browser

- A "State: Idle" tag on a canonicalized model assumes that the model has an animated variant, so the canonicalized model asset should also include the "Animated" tag
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
