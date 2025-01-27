import type { Character } from '@advjs/types'
import type { PixiGame } from '../game'
import { Container, Sprite } from 'pixi.js'

export class TachieSystem {
  game: PixiGame

  container = new Container({
    label: 'TachiesContainer',
  })

  /**
   * todo data structure
   */
  characterMap = new Map<string, Character>()

  constructor(game: PixiGame) {
    this.game = game
    const app = game.app

    app.stage.addChild(this.container)
  }

  init() {
    const config = this.game.config
    config.characters.forEach((char) => {
      this.characterMap.set(char.id, char)
    })
  }

  /**
   * character id
   */
  showCharacter(id: string) {
    const app = this.game.app
    const character = this.characterMap.get(id)
    if (!character) {
      console.error(`Character ${id} not found!`)
      return
    }
    const sprite = Sprite.from(character.tachies.default.src)
    sprite.label = id

    const scale = (app.screen.width * 2 / 5) / sprite.width
    sprite.scale.set(scale)
    // todo dynamic calculate or config
    sprite.x = (app.screen.width - sprite.width) / 2
    sprite.y = app.screen.height - sprite.height * 4 / 5

    this.container.addChild(sprite)
  }
}
