import { Assets } from 'pixi.js'

const prefix = '/hex-tiles/isle-of-lore-2'
export const tileSources = {
  ocean: `${prefix}/ocean/ocean_small_0.png`,
  mountain_oak_forest: `${prefix}/mountain_oak_forest/mountain_oak_forest_0.png`,
  grassland_dense_0: `${prefix}/grassland/green/grassland_dense_0.png`,
  grassland_clearing_0: `${prefix}/grassland/winter/grassland_clearing_0.png`,
} as const
export type TileName = keyof typeof tileSources

export async function loadTiles() {
  // Assets caches by URL; repeated mounts must not overwrite global aliases.
  await Assets.load(Object.values(tileSources))
}
