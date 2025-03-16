import type { AdvData } from '@advjs/types'
import { PixiGame } from './game'

export async function initPixi(canvas: HTMLCanvasElement, advData: AdvData) {
  if (!canvas)
    return
  // console.log(renderer)

  const gameInstance = new PixiGame()
  gameInstance.setAssetsManifest(advData.gameConfig.assets.manifest)
  await gameInstance.init(canvas)

  return gameInstance
}
