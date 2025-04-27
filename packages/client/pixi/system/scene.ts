import type { PixiGame } from '../game'
import { Container, Sprite, Texture } from 'pixi.js'

export class SceneSystem {
  static instance: SceneSystem | null = null

  game: PixiGame

  container = new Container({
    label: 'BackgroundContainer',
  })

  bgSprite: Sprite

  constructor(game: PixiGame) {
    this.game = game
    const app = game.app

    const container = this.container
    app.stage.addChild(container)

    const bgSprite = new Sprite()
    bgSprite.label = 'bg'
    container.addChild(bgSprite)

    this.bgSprite = bgSprite

    SceneSystem.instance = this
  }

  load(alias: string) {
    const app = this.game.app
    const bgSprite = this.bgSprite

    bgSprite.texture = Texture.from(alias)
    bgSprite.width = app.screen.width
    bgSprite.height = app.screen.height
  }
}
