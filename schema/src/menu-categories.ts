export interface MenuCategoryInfo {
  /** The `menuCategory.category` value. */
  id: string;
  /** Construction menu the category belongs to, for example `ROAD`. */
  menu: string;
  /** Display name in the construction menu. */
  label: string;
}

/**
 * The categories the base game registers as `menu_category` resources in
 * `gui.zip` under `gui/construction/menu/menu_categories/`. The `.d.tl` type
 * definitions only type `category` as `string`, so this list is the value set.
 */
export const MENU_CATEGORIES: readonly MenuCategoryInfo[] = [
  { id: "air_buildings", menu: "AIR", label: "Buildings" },
  { id: "air_assets", menu: "AIR", label: "Assets" },
  { id: "air_tools", menu: "AIR", label: "Tools" },
  { id: "industries", menu: "INDUSTRY", label: "Industries" },
  { id: "industries_assets", menu: "INDUSTRY", label: "Assets" },
  { id: "landmarks", menu: "PERKS", label: "Landmarks" },
  { id: "perks_mechanics", menu: "PERKS", label: "Mechanics" },
  { id: "prospections", menu: "PERKS", label: "Prospecting" },
  { id: "landscaping_terrain", menu: "LANDSCAPING", label: "Terrain" },
  { id: "landscaping_vegetation", menu: "LANDSCAPING", label: "Vegetation" },
  { id: "landscaping_ground", menu: "LANDSCAPING", label: "Ground" },
  { id: "landscaping_animals", menu: "LANDSCAPING", label: "Animals" },
  { id: "landscaping_people", menu: "LANDSCAPING", label: "People" },
  { id: "landscaping_vehicles", menu: "LANDSCAPING", label: "Vehicles" },
  { id: "landscaping_assets", menu: "LANDSCAPING", label: "Assets" },
  {
    id: "town_buildings_res",
    menu: "LANDSCAPING",
    label: "Residential Town Buildings",
  },
  {
    id: "town_buildings_com",
    menu: "LANDSCAPING",
    label: "Commercial Town Buildings",
  },
  {
    id: "town_buildings_ind",
    menu: "LANDSCAPING",
    label: "Industrial Town Buildings",
  },
  {
    id: "town_buildings_other",
    menu: "LANDSCAPING",
    label: "Other Town Buildings",
  },
  { id: "town_tools", menu: "TOWN", label: "Tools" },
  { id: "rail_buildings", menu: "RAIL", label: "Buildings" },
  { id: "tracks", menu: "TRACKS", label: "Tracks" },
  { id: "rail_signals", menu: "TRACKS", label: "Signals" },
  { id: "rail_constructions", menu: "TRACKS", label: "Rail Constructions" },
  { id: "rail_tools", menu: "TRACKS", label: "Tools" },
  { id: "rail_assets", menu: "TRACKS", label: "Assets" },
  { id: "road_buildings", menu: "ROAD", label: "Buildings" },
  { id: "road_tools", menu: "ROAD", label: "Tools" },
  { id: "road_assets", menu: "ROAD", label: "Assets" },
  { id: "street_constructions", menu: "ROADS", label: "Road Constructions" },
  { id: "roads_tools", menu: "ROADS", label: "Tools" },
  { id: "water_buildings", menu: "WATER", label: "Buildings" },
  { id: "water_tools", menu: "WATER", label: "Tools" },
  { id: "water_assets", menu: "WATER", label: "Assets" },
  { id: "warehouses", menu: "WAREHOUSE", label: "Warehouses" },
];

const MENU_LABELS: Record<string, string> = {
  AIR: "Air",
  INDUSTRY: "Industry",
  LANDSCAPING: "Landscaping",
  PERKS: "Perks",
  RAIL: "Rail",
  ROAD: "Road",
  ROADS: "Roads",
  TOWN: "Town",
  TRACKS: "Tracks",
  WAREHOUSE: "Warehouse",
  WATER: "Water",
};

export function menuLabel(menu: string): string {
  return MENU_LABELS[menu] ?? menu;
}

export function isMenuCategory(id: string): boolean {
  return MENU_CATEGORIES.some((c) => c.id === id);
}
