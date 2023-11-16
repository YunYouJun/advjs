export async function initPixi(canvas: HTMLCanvasElement) {
  const PIXI = await import('pixi.js')

  if (!canvas)
    return
  // console.log(renderer)

  const app = new PIXI.Application()
  await app.init({
    canvas,
    // view: pixiCanvasRef.value,
    background: '#1099bb',
  })

  const bunny = PIXI.Sprite.from('https://pixijs.com/assets/bunny.png')
  app.stage.addChild(bunny)

  // center the sprite's anchor point
  bunny.anchor.set(0.5)

  // move the sprite to the center of the screen
  bunny.x = app.screen.width / 2
  bunny.y = app.screen.height / 2
}
