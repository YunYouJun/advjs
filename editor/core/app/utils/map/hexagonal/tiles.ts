import type { Hex } from 'honeycomb-grid'
import type { TileName } from './assets'
import type { TilesMap } from './global'
import { Sprite } from 'pixi.js'
import { tileSources } from './assets'
import { config } from './config'

export function drawTile(hex: Hex, tile: TileName, tilesMap: TilesMap) {
  const previous = tilesMap.get(hex.toString())
  if (previous && previous !== 'empty')
    previous.destroy()

  const sprite = Sprite.from(tileSources[tile])
  sprite.anchor.set(0.5)
  sprite.position.set(hex.x, hex.y)
  sprite.width = config.grid.size * 2
  sprite.height = config.grid.size * 2
  tilesMap.set(hex.toString(), sprite)
  return sprite
}

export function drawTwoTiles(hex: Hex, tilesMap: TilesMap) {
  return [
    drawTile(hex, 'grassland_dense_0', tilesMap),
    drawTile(hex.translate({ q: 1, r: 0, s: -1 }), 'mountain_oak_forest', tilesMap),
  ]
}
