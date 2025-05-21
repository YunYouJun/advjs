import type { AdvContext } from '../types'
import { PixiGame } from './game'

let pixiGameInstance: PixiGame | null = null

export async function initPixi($adv: AdvContext) {
  const canvas = document.getElementById('advjs-pixi-canvas') as any as HTMLCanvasElement
  if (!canvas)
    return

  pixiGameInstance = new PixiGame($adv)
  // console.log(renderer)
  pixiGameInstance.setAssetsManifest($adv.gameConfig.value.assets?.manifest)
  await pixiGameInstance.init(canvas)

  return pixiGameInstance
}
