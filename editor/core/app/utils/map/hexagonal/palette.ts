import type { Application } from 'pixi.js'
import type { TileName } from './assets'
import { Container, Sprite } from 'pixi.js'
import { tileSources } from './assets'
import { config } from './config'

export function createPalette(app: Application, onSelect: (tile: TileName) => void) {
  const palette = new Container({ label: 'hex-palette', eventMode: 'static' })
  const entries = Object.entries(tileSources)
  const sprites = entries.map(([tile, source], index) => {
    const sprite = Sprite.from(source)
    sprite.anchor.set(0.5)
    sprite.position.set(60 * (index - (entries.length - 1) / 2), 0)
    sprite.width = config.grid.size * 2
    sprite.height = config.grid.size * 2
    sprite.alpha = index === 0 ? 1 : 0.5
    sprite.eventMode = 'static'
    sprite.cursor = 'pointer'
    sprite.on('pointerdown', (event) => {
      event.stopPropagation()
      sprites.forEach(item => item.alpha = item === sprite ? 1 : 0.5)
      onSelect(tile as TileName)
    })
    palette.addChild(sprite)
    return sprite
  })
  palette.on('pointertap', event => event.stopPropagation())
  app.stage.addChild(palette)
  return () => palette.position.set(app.screen.width / 2, app.screen.height - 32)
}
