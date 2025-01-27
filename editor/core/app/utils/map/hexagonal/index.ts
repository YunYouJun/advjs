import type { FederatedPointerEvent } from 'pixi.js'
import { Grid, rectangle } from 'honeycomb-grid'
import { Application, Assets, Container, Graphics, Sprite } from 'pixi.js'
import { config } from './config'
import { addMapScale } from './event'
import { CustomHex, tilesMap } from './global'
import { drawTwoTiles } from './tiles'
import { hexFromString, updateBorderTiles } from './utils'

const spriteSize = config.grid.size * 2

export async function init(canvas: HTMLCanvasElement) {
  tilesMap.clear()

  // you may want the origin to be the top left corner of a hex's bounding box
  // instead of its center (which is the default)
  const grid = new Grid(CustomHex, rectangle({ width: 20, height: 10 }))

  // load assets
  const prefix = '/hex-tiles/isle-of-lore-2'
  Assets.addBundle('tiles', {
    ocean: `${prefix}/ocean/ocean_small_0.png`,
    mountain_oak_forest: `${prefix}/mountain_oak_forest/mountain_oak_forest_0.png`,

    grassland_dense_0: `${prefix}/grassland/green/grassland_dense_0.png`,
    grassland_clearing_0: `${prefix}/grassland/winter/grassland_clearing_0.png`,
  })
  await Assets.loadBundle('tiles')

  const app = new Application()
  await app.init({
    canvas,
    backgroundAlpha: 0,
    resizeTo: canvas,
    antialias: true,
    resolution: window.devicePixelRatio,
  })

  // create assets box
  const assetsBox = new Container()
  assetsBox.position.set(app.screen.width / 2, app.screen.height - 30)

  let curTiles = 'ocean'
  const tiles = ['ocean', 'mountain_oak_forest', 'grassland_dense_0', 'grassland_clearing_0']
  const tileSprites: Sprite[] = []
  tiles.forEach((tile, i) => {
    const sprite = Sprite.from(tile)
    sprite.anchor.set(0.5)
    sprite.position.set(60 * (i - tiles.length / 2), 0)
    sprite.width = spriteSize
    sprite.height = spriteSize
    sprite.alpha = 0.5
    assetsBox.addChild(sprite)
    tileSprites.push(sprite)

    sprite.eventMode = 'static'
    sprite.addEventListener('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation()
      tileSprites.forEach(sprite => sprite.alpha = 0.5)
      sprite.alpha = 1

      curTiles = tile
    })
  })
  app.stage.addChild(assetsBox)

  const map = new Container()
  app.stage.addChild(map)

  // border
  const graphics = new Graphics()
  graphics.setStrokeStyle({
    color: 0x000000,
    width: 1,
  })

  // grid.forEach((hex: Hex) => {
  // PIXI.Polygon happens to be compatible with hex.corners
  // graphics.poly(hex.corners)

  // const sprite = Sprite.from('ocean')
  // sprite.anchor.set(0.5)
  // sprite.position.set(hex.x, hex.y)
  // sprite.width = spriteSize
  // sprite.height = spriteSize
  // app.stage.addChild(sprite)
  // })
  // graphics.fill()
  graphics.stroke()

  map.addChild(graphics)

  // enable interaction
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen

  const highlightG = new Graphics()
  highlightG.setStrokeStyle({
    color: 0xFFFFFF,
    width: 1,
  })

  function highlightGrid(e: FederatedPointerEvent) {
    const { x, y } = e.global
    const hex = grid.pointToHex(
      { x, y },
      { allowOutside: false },
    )

    highlightG.clear()
    if (!hex)
      return
    highlightG.poly(hex.corners)

    const newHex = hex.translate({ q: 1, r: 0 })
    highlightG.poly(newHex.corners)

    highlightG.stroke()
  }

  app.stage.addEventListener('pointermove', highlightGrid)
  app.stage.addEventListener('pointercancel', highlightGrid)
  app.stage.addEventListener('pointerup', () => {
    // console.log('pointerup')
  })

  const targetHex = new CustomHex({
    q: 0,
    r: 0,
  })
  // console.log(targetHex)

  let dragTarget: Container | null = null
  function onDragMove(event: FederatedPointerEvent) {
    if (dragTarget) {
      dragTarget.position.x += event.movement.x
      dragTarget.position.y += event.movement.y
    }
  }

  function onDragEnd(e: FederatedPointerEvent) {
    if (!dragTarget)
      return

    const { x, y } = e.global
    const hex = grid.pointToHex(
      { x, y },
      { allowOutside: false },
    )
    const [centerSprite, secondSprite] = drawTwoTiles(hex!)!
    map.addChild(centerSprite)
    map.addChild(secondSprite)

    dragTarget.destroy()
    dragTarget = null

    app.stage.removeEventListener('pointermove', onDragMove)
  }

  app.stage.on('pointerup', onDragEnd)
  app.stage.on('pointerupoutside', onDragEnd)

  const gridContainer = new Container()
  const [centerSprite, secondSprite] = drawTwoTiles(targetHex)!
  gridContainer.addChild(centerSprite)
  gridContainer.addChild(secondSprite)
  gridContainer.eventMode = 'static'
  map.addChild(gridContainer)

  function onDragStart(_e: FederatedPointerEvent) {
    gridContainer.alpha = 0.5
    dragTarget = gridContainer
    app.stage.addEventListener('pointermove', onDragMove)
  }
  gridContainer.addEventListener('pointerdown', onDragStart)

  // 可以放置新的 tile
  const emptyTilesBorder = new Graphics()
  emptyTilesBorder.setStrokeStyle({
    color: 0x999999,
    width: 2,
  })
  map.addChild(emptyTilesBorder)
  map.addChild(highlightG)
  app.stage.addEventListener('pointertap', (e: FederatedPointerEvent) => {
    const { x, y } = e.global
    const hex = grid.pointToHex(
      { x, y },
      { allowOutside: false },
    )

    if (!hex)
      return

    // if (!isEmptyTile(hex)) {
    //   consola.info('Tile already exists')
    //   return
    // }

    const sprite = Sprite.from(curTiles)
    sprite.anchor.set(0.5)
    sprite.position.set(hex.x, hex.y)

    sprite.width = spriteSize
    sprite.height = spriteSize
    map.addChild(sprite)

    tilesMap.set(hex.toString(), sprite)

    // add new hex
    updateBorderTiles(grid, hex)
    emptyTilesBorder.clear()
    tilesMap.forEach((val, key) => {
      if (val === 'empty') {
        const hex = hexFromString(key)
        emptyTilesBorder.poly(hex.corners)
      }
    })
    emptyTilesBorder.stroke()
  })

  addMapScale(app, map)

  // @ts-expect-error globalThis
  globalThis.__PIXI_APP__ = app
}
