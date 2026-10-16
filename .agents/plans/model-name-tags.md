# Model Name Tags

The Assets pane shows a tag chip for each known abbreviation in a model file
name. The tables live in `schema/src/asset-chips.ts` (`PREFIXES` and
`SUFFIXES`). Search matches the text of every chip.

## Tagged

| Word              | Chip                     |
| ----------------- | ------------------------ |
| `cr` (prefix)     | Critter                  |
| `bird` (prefix)   | `(Bird)` after the title |
| `high`, `hi`      | High-Poly                |
| `low`             | Low-Poly                 |
| `idle`            | State: Idle              |
| `open`            | State: Open              |
| `closed`          | State: Closed            |
| `lft`             | Left                     |
| `rgt`             | Right                    |
| `tram`            | Tram                     |
| `cargo`           | Cargo                    |
| `input`, `output` | I/O                      |

## Canonical Models

Files in one folder whose names differ only by `high`, `hi`, `low`, `idle`,
`open`, `closed`, or `prod` are one model. The Assets pane shows one card with
all of their chips, and a click places the high-poly file, else the file with no
variant word. `lft`, `rgt`, `tram`, `cargo`, `input`, and `output` do not merge
files.

## Out of Scope

Variant numbers (`01`, `02`, `v01`, `lvl1`) stay in the title.

## Where Names Come From

| Source                                                       | What it holds                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `scripts.zip :: scripts/construction/asset_util.tl`          | Comment headings that label 72 groups of 624 models, such as `tf3 era_a awings color grp`.                                      |
| Building `*_assets.tl`, such as `/buildings/b/c1/1x1_01.zip` | The decor models a building places, as `::/assets/...mdl` paths with a transform. 1,439 models are referenced by a script file. |
| 586 `.con.lua` files                                         | No model names. A construction is named only by a pattern such as `{townName} Airport`, and buildings carry no display name.    |
| `base/strings/en/LC_MESSAGES/base.mo` (3,449 strings)        | No string for an awning, logo, sign, or other decor model.                                                                      |

No source gives a display name for a decor model. A readable name has to be
built from the words in the file name, using the groups above as evidence.

## Era Letters

A leading `a_`, `b_`, or `c_` is the era. Of the models that building files
place, 226 `b_` models come only from `/buildings/b/` zips, 201 `c_` models come
from `/buildings/c/` zips plus one from `/buildings/b/`, and 8 `a_` models come
from `/buildings/a/` zips plus one from `/buildings/b/`. Another 125 (66 `a_`,
22 `b_`, 37 `c_`) are placed only by `asset_util.tl`. `bc_` is shared by eras B
and C, and `a2_` is a second `a_` variant (`a2_wall_1m_l` beside `a_wall_1m_l`).

## Decoded Words

Confirmed means a comment or code states it. Inferred means the meaning comes
from a group heading or from names that sit together.

| Word                                   | Reads as                                        | Evidence  | Seen in                                                                                     |
| -------------------------------------- | ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `awin`                                 | Awning                                          | Confirmed | Headings `tf3 era a awnings`, spelled `awings` in the color and state groups.               |
| `in`, `med`, `out`                     | Awning extension state                          | Inferred  | The `state grp` lists `in_01`, `med_01`, and `out_01` together.                             |
| `01` to `04` after an awning state     | Color                                           | Inferred  | The `color grp` lists four numbers for each state.                                          |
| `s`, `m`, `l`                          | Small, Medium, Large                            | Inferred  | `a_advert_s_*`, `b_advert_m_*`, and `c_advert_l_*` sit in the poster groups.                |
| `top`, `side`, `frnt`, `front`         | Sign position on a building                     | Inferred  | `a_bake_top_l`, `b_bar1_frnt_m`, `b_burg_side_m`.                                           |
| `mrkt`, `store`, `rest`, `htl`, `cin`  | Market, Store, Restaurant, Hotel, Cinema        | Inferred  | Groups `era_a market`, `era_a restaurant`, `era_a hotel text`, `era_b cinema`.              |
| `bake`, `baker`, `coif`, `barber`      | Bakery, Bakery, Hair Salon, Barber              | Inferred  | Group `era_a small stores` and `era_a services`.                                            |
| `burg`, `cof`, `pizz`, `sup`, `supstr` | Burger, Coffee, Pizza, Supermarket              | Inferred  | Groups `era_b large restaurant franchise` and `era_c eat`.                                  |
| `gds`, `mkt_std`, `umbr`, `grd_frn`    | Goods, Market Stand, Umbrella, Garden Furniture | Inferred  | Groups `era a food grp`, `era a marketstand`, `era a umbrella`.                             |
| `rep`                                  | Repeat element                                  | Confirmed | `cable.bridge.lua` defines `cable_abut_bot_rep`. Bridge scripts decide "whether to repeat". |
| `no_cat`                               | No catenary                                     | Inferred  | `modular_terminal.script.lua:1364` sets `cat = "_no_cat"` when `tramTrack == 2`.            |
| `con`                                  | Connector                                       | Confirmed | `modular_station.script.lua` adds connectors with `conn = {"conn", "perron_5_head_con"}`.   |
| `gb`                                   | Filled garbage                                  | Inferred  | The dumpster list says the filled ones are referenced more often.                           |
| `spcl`                                 | Special end piece                               | Inferred  | The modular terminal script has a `special end` case for platform ends.                     |

## Proposed Readable Names

Not implemented. A word dictionary would replace the abbreviations in the card
title, with the era as a chip.

| File name            | Title today        | Readable name                  |
| -------------------- | ------------------ | ------------------------------ |
| `a_awin_in_01`       | A Awin In 1        | Awning, In, Color 1            |
| `a_awin_med_02`      | A Awin Med 2       | Awning, Medium, Color 2        |
| `b_awin_s_03`        | B Awin S 3         | Awning, Small, Color 3         |
| `a_baker_top_l`      | A Baker Top L      | Bakery Sign, Top, Large        |
| `b_bar1_frnt_m`      | B Bar1 Frnt M      | Bar Sign 1, Front, Medium      |
| `c_burg_front_m`     | C Burg Front M     | Burger Sign, Front, Medium     |
| `mkt_std_umbr_02`    | Mkt Std Umbr 2     | Market Stand Umbrella 2        |
| `cable_abut_bot_rep` | Cable Abut Bot Rep | Cable Abutment, Bottom, Repeat |

Each era letter would become a chip (`Era A`, `Era B`, `Era C`).

## Unclear Suffixes

Counts come from the full index of 4,473 models, last word of the name only. The
meaning column holds only what the file names show. Rows for `rep`, `cat`,
`con`, `spcl`, and `gb` are decoded above and stay listed for their counts.

| Suffix | Count | Where it appears                            | Examples                                     | Open question                     |
| ------ | ----- | ------------------------------------------- | -------------------------------------------- | --------------------------------- |
| `l`    | 225   | Logo signs, water stations, bridges         | `a_baker_top_l`, `pltfrm_l_btm_spcl`         | Left, large, or a length?         |
| `r`    | 134   | Water stations, bridges, signs              | `cargo_sign_nr_r`, `cable_abut_bot_r`        | Right, or a different axis?       |
| `rep`  | 116   | Tunnels, bridge parts                       | `cable_abut_rep_rep`, `pillar_2_rep_rep`     | Repeating segment?                |
| `cat`  | 93    | Modular street station, always after `no`   | `cargo_path_rep_no_cat`, `cntr_btm_l_no_cat` | Catenary, so `no_cat` means none? |
| `spcl` | 12    | Modular street station platforms            | `pltfrm_l_btm_spcl`                          | Special variant?                  |
| `gb`   | 12    | `/assets/buildings/ind/garbage` containers  | `dumpster_large_blue_a_gb`                   | Garbage bin?                      |
| `sd`   | 5     | Buoys and flowers                           | `nav_buoy_small_01_sd`, `flower_01_sd`       | Seed or shadow?                   |
| `con`  | 17    | Rail station parts                          | `rail_t_bulk_con`, `perron_10_head_con`      | Connection or concrete?           |
| `univ` | 9     | Vehicles                                    | `f_tram_univ`, `gaz_3307_univ`               | Universal?                        |
| `prod` | 33    | Animals, trees, `iron_ore_mine`, `sand_pit` | `cow_prod_high`, `confr_01_prod_low`         | Production? Dropped from titles.  |
| `n`    | 11    | `/model_editor/stage` street stages         | `stage_street_country_new_n`                 | North, or a direction?            |
| `f`    | 7     | Airfield decals, water docks, a tram        | `af_decal_patch_f`, `dock_100_25_end_f`      | A variant letter like `a`, `b`?   |
| `t`    | 7     | Pipes, air vents                            | `airvent_duct_round_t`, `pipe_copper_t`      | Pairs with `x`; a pipe junction?  |
| `x`    | 7     | Pipes, air vents                            | `airvent_duct_round_x`, `pipe_copper_x`      | Pairs with `t`; a pipe junction?  |
| `d`    | 5     | Airfield decals, bags                       | `af_decal_crack_d`, `bag_brown_var_d`        | A variant letter like `a`, `b`?   |
