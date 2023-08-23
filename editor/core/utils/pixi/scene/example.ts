import * as PIXI from 'pixi.js'

export async function createExampleScene(app: PIXI.Application) {
  const manifest: PIXI.ResolverManifest = {
    bundles: [
      {
        name: 'example-brush-scene',
        assets: [
          {
            name: 't1',
            srcs: 'https://pixijs.com/assets/bg_grass.jpg',
          },
          {
            name: 't2',
            srcs: 'https://pixijs.com/assets/bg_rotate.jpg',
          },
        ],
      },
    ],
  }

  await PIXI.Assets.init({ manifest })

  await PIXI.Assets.loadBundle('example-brush-scene')

  // setup
  const { width, height } = app.screen
  const stageSize = { width, height }
  const background = Object.assign(PIXI.Sprite.from('t1'), stageSize)
  // const imageToReveal = Object.assign(PIXI.Sprite.from('t2'), stageSize)
  // const renderTexture = PIXI.RenderTexture.create(stageSize)
  // const renderTextureSprite = new PIXI.Sprite(renderTexture)

  // imageToReveal.mask = renderTextureSprite

  app.stage.addChild(
    background,
    // imageToReveal,
    // renderTextureSprite,
  )
}
