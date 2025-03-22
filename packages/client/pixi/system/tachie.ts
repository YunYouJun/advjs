import type { AdvCharacter } from '@advjs/types'
import type { PixiGame } from '../game'
import consola from 'consola'
import { Container, Sprite } from 'pixi.js'

export class TachieSystem {
  pixiGame: PixiGame

  container = new Container({
    label: 'TachiesContainer',
  })

  /**
   * todo data structure
   */
  characterMap = new Map<string, AdvCharacter>()

  constructor(pixiGame: PixiGame) {
    this.pixiGame = pixiGame
    const app = pixiGame.app
    app.stage.addChild(this.container)
  }

  init() {
    const gameConfig = this.pixiGame.$adv.gameConfig.value
    gameConfig.characters.forEach((char) => {
      this.characterMap.set(char.id, char)
    })
  }

  /**
   * character id
   */
  showCharacter(id: string) {
    consola.info('Show Character', id)

    const app = this.pixiGame.app
    const character = this.characterMap.get(id)
    if (!character) {
      console.error(`Character ${id} not found!`)
      return
    }

    if (!character.tachies?.default) {
      console.error(`Character ${id} tachie not found!`)
      return
    }

    const sprite = Sprite.from(character.tachies?.default.src)
    sprite.label = id

    const scale = (app.screen.width * 2 / 5) / sprite.width
    sprite.scale.set(scale)
    // todo dynamic calculate or config
    sprite.x = (app.screen.width - sprite.width) / 2
    sprite.y = app.screen.height - sprite.height * 4 / 5

    this.container.addChild(sprite)
  }
}
