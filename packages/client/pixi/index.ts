import type { AdvConfig } from '@advjs/types'
import { PixiGame } from './game'

export async function initPixi(canvas: HTMLCanvasElement, advConfig: AdvConfig) {
  if (!canvas)
    return
  // console.log(renderer)

  const gameInstance = new PixiGame(advConfig)
  await gameInstance.init(canvas)

  return gameInstance
}
