import type { Hex } from 'honeycomb-grid'
import { Sprite } from 'pixi.js'
import consola from 'consola'
import { config } from './config'
import { tilesMap } from '.'

export function drawTwoTiles(hex: Hex) {
  if (tilesMap.has(hex.toString())) {
    consola.info('Tile already exists')
    return
  }

  const centerSprite = Sprite.from('grassland_dense_0')
  centerSprite.anchor.set(0.5)
  centerSprite.position.set(hex.x, hex.y)
  centerSprite.width = config.grid.size * 2
  centerSprite.height = config.grid.size * 2

  const secondSprite = Sprite.from('mountain_oak_forest')
  secondSprite.anchor.set(0.5)
  const newHex = hex.translate({ q: 1, r: 0, s: -1 })

  if (tilesMap.has(newHex.toString())) {
    consola.info('Tile already exists')
    return
  }

  secondSprite.position.set(newHex.x, newHex.y)
  secondSprite.width = config.grid.size * 2
  secondSprite.height = config.grid.size * 2

  tilesMap.set(hex.toString(), centerSprite)
  tilesMap.set(newHex.toString(), secondSprite)

  return [centerSprite, secondSprite]
}
