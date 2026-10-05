import type { Grid, Hex } from 'honeycomb-grid'
import type { Application, FederatedPointerEvent } from 'pixi.js'
import type { TilesMap } from '../global'
import { Container } from 'pixi.js'
import { CustomHex } from '../global'
import { drawTwoTiles } from '../tiles'

interface TileDragOptions {
  app: Application
  map: Container
  layer: Container
  grid: Grid<Hex>
  tilesMap: TilesMap
  onStart: () => void
  onChange: () => void
}

/** The initial two-tile group can be moved repeatedly; invalid drops restore it. */
export function addTileDrag({ app, map, layer, grid, tilesMap, onStart, onChange }: TileDragOptions) {
  let origin: Hex = new CustomHex({ q: 0, r: 0 })
  let group: Container
  let pointerId: number | undefined
  let offset = { x: 0, y: 0 }

  function start(event: FederatedPointerEvent) {
    if (event.button !== 0 || pointerId !== undefined)
      return
    event.stopPropagation()
    onStart()
    pointerId = event.pointerId
    const point = event.getLocalPosition(map)
    offset = { x: point.x - origin.x, y: point.y - origin.y }
    group.alpha = 0.5
  }
  function createGroup() {
    group = new Container({ eventMode: 'static', cursor: 'grab' })
    group.addChild(...drawTwoTiles(origin, tilesMap))
    group.on('pointerdown', start)
    layer.addChild(group)
  }
  function move(event: FederatedPointerEvent) {
    if (event.pointerId !== pointerId)
      return
    const point = event.getLocalPosition(map)
    group.position.set(point.x - offset.x - origin.x, point.y - offset.y - origin.y)
  }
  function end(event: FederatedPointerEvent) {
    if (event.pointerId !== pointerId)
      return
    pointerId = undefined
    const point = event.getLocalPosition(map)
    const hex = grid.pointToHex({ x: point.x - offset.x, y: point.y - offset.y }, { allowOutside: false })
    const second = hex && grid.getHex(hex.translate({ q: 1, r: 0 }))
    if (event.type === 'pointercancel' || !app.screen.contains(event.global.x, event.global.y) || !hex || !second) {
      group.position.set(0, 0)
      group.alpha = 1
      return
    }
    for (const [key, sprite] of tilesMap) {
      if (sprite !== 'empty' && sprite.parent === group)
        tilesMap.delete(key)
    }
    group.destroy({ children: true })
    origin = hex
    createGroup()
    onChange()
  }
  createGroup()
  app.stage.on('globalpointermove', move)
  app.stage.on('pointerup', end)
  app.stage.on('pointerupoutside', end)
  app.stage.on('pointercancel', end)
}
