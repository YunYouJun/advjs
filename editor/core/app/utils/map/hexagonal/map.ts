import type { Application, FederatedPointerEvent } from 'pixi.js'
import type { TileName } from './assets'
import type { TilesMap } from './global'
import { Grid, rectangle } from 'honeycomb-grid'
import { Container, Graphics } from 'pixi.js'
import { addTileDrag } from './event/drag'
import { CustomHex } from './global'
import { drawTile } from './tiles'
import { hexFromString, updateBorderTiles } from './utils'

export function createMap(app: Application) {
  const grid = new Grid(CustomHex, rectangle({ width: 20, height: 10 }))
  const tilesMap: TilesMap = new Map()
  const map = new Container({ label: 'hex-map' })
  const layer = new Container()
  const border = new Graphics({ eventMode: 'none' })
  const highlight = new Graphics({ eventMode: 'none' })
  map.addChild(layer, border, highlight)
  app.stage.addChild(map)
  let currentTile: TileName = 'ocean'
  let suppressTap = false

  function refreshBorder() {
    for (const [key, value] of tilesMap) {
      if (value === 'empty')
        tilesMap.delete(key)
    }
    updateBorderTiles(grid, [...tilesMap.keys()].map(hexFromString), tilesMap)
    border.clear()
    for (const [key, value] of tilesMap) {
      if (value === 'empty')
        border.poly(hexFromString(key).corners)
    }
    border.stroke({ color: 0x999999, width: 1 })
  }
  function getHex(event: FederatedPointerEvent) {
    return grid.pointToHex(event.getLocalPosition(map), { allowOutside: false })
  }
  app.stage.on('pointerdown', () => suppressTap = false)
  app.stage.on('pointertap', (event: FederatedPointerEvent) => {
    const hex = getHex(event)
    if (suppressTap || event.button !== 0 || !hex)
      return
    layer.addChild(drawTile(hex, currentTile, tilesMap))
    refreshBorder()
  })
  app.stage.on('pointermove', (event: FederatedPointerEvent) => {
    highlight.clear()
    const hex = getHex(event)
    if (hex)
      highlight.poly(hex.corners).stroke({ color: 0xFFFFFF, width: 1 })
  })
  app.stage.on('pointerleave', () => highlight.clear())
  addTileDrag({ app, map, layer, grid, tilesMap, onStart: () => suppressTap = true, onChange: refreshBorder })
  refreshBorder()
  return { map, tilesMap, selectTile: (tile: TileName) => currentTile = tile }
}
