import type { AssetsManifest } from 'pixi.js'
import { Assets, Sprite } from 'pixi.js'

export const basicManifest: AssetsManifest = {
  bundles: [
    {
      name: 'load-screen',
      assets: [],
    },
    {
      name: 'game-screen',
      assets: [],
    },
  ],
}

async function init() {
  await Assets.init({ manifest: basicManifest })
  await Assets.loadBundle('load-screen')
  // bundles can be loaded in the background too!
  // PIXI.Assets.backgroundLoadBundle(['load-screen', 'game-screen'])

  makeLoadScreen()
}

async function makeLoadScreen() {
  // get the assets from the load screen bundle.
  // If the bundle was already downloaded the promise resolves instantly!
  const loadScreenAssets = await Assets.loadBundle('load-screen')

  // create a new Sprite from the resolved loaded texture
  const goNext = new Sprite(loadScreenAssets.flowerTop)

  goNext.anchor.set(0.5)
  // goNext.x = app.screen.width / 2
  // goNext.y = app.screen.height / 2
  // app.stage.addChild(goNext)

  goNext.eventMode = 'static'
  goNext.cursor = 'pointer'

  goNext.on('pointertap', async () => {
    goNext.destroy()
    makeGameScreen()
  })
}

async function makeGameScreen() {
  // Wait here until you get the assets
  // If the user spends enough time in the load screen by the time they reach the game screen
  // the assets are completely loaded and the promise resolves instantly!
  const loadScreenAssets = await Assets.loadBundle('game-screen')

  // create a new Sprite from the resolved loaded texture
  const goBack = new Sprite(loadScreenAssets.eggHead)

  goBack.anchor.set(0.5)
  // goBack.x = app.screen.width / 2
  // goBack.y = app.screen.height / 2
  // app.stage.addChild(goBack)

  goBack.eventMode = 'static'
  goBack.cursor = 'pointer'

  goBack.on('pointertap', async () => {
    goBack.destroy()
    // The user can go back and the files are already downloaded
    makeLoadScreen()
  })
}

init()
