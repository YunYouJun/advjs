import type { Grid, Hex } from 'honeycomb-grid'
import { Direction } from 'honeycomb-grid'
import { Sprite } from 'pixi.js'
import { CustomHex, tilesMap } from './global'

export function getNeighbourTiles(grid: Grid<Hex>, hex: Hex) {
  return [
    grid.neighborOf(hex, Direction.W),
    grid.neighborOf(hex, Direction.E),
    grid.neighborOf(hex, Direction.NW),
    grid.neighborOf(hex, Direction.NE),
    grid.neighborOf(hex, Direction.SW),
    grid.neighborOf(hex, Direction.SE),
  ]
}

/**
 * 更新边界的 tiles
 * @param grid hex grid
 * @param hexes added hexes
 */
export function updateBorderTiles(grid: Grid<Hex>, hexes: Hex | Hex[]) {
  hexes = Array.isArray(hexes) ? hexes : [hexes]
  hexes.forEach((hex) => {
    const val = tilesMap.get(hex.toString())
    if (val instanceof Sprite) {
      const neighbours = getNeighbourTiles(grid, hex)
      neighbours.forEach((neighbour) => {
        const nKey = neighbour.toString()
        // 可以放置新的 tile
        if (!tilesMap.has(nKey))
          tilesMap.set(nKey, 'empty')
      })
    }
  })
}

export function hexFromString(str: string) {
  str = str.replace('(', '').replace(')', '')
  const [q, r] = str.split(',').map(Number)
  return new CustomHex({
    q,
    r,
  })
}

export function isEmptyTile(hex: Hex) {
  const key = hex.toString()
  return tilesMap.has(key) && tilesMap.get(key) === 'empty'
}
