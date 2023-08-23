import * as PIXI from 'pixi.js'

export interface BrushOptions {
  renderTexture?: PIXI.RenderTexture
  /**
   * The radius of the brush.
   */
  radius?: number
}

export const defaultBrushOptions = {
  renderTexture: PIXI.RenderTexture.create({ width: 1, height: 1 }),
}

export function createBrush(app: PIXI.Application, options: BrushOptions = defaultBrushOptions) {
  const brushStore = useBrushStore()

  // prepare circle texture, that will be our brush
  const brush = new PIXI.Graphics()
  brush.beginFill(0xFFFFFF)

  // Create a line that will interpolate the drawn points
  // const line = new PIXI.Graphics()

  app.stage.addChild(brush)

  function setup() {
    app.stage.eventMode = 'static'
    app.stage.hitArea = app.screen
    app.stage
      .on('pointerdown', pointerDown)
      .on('pointerup', pointerUp)
      .on('pointerupoutside', pointerUp)
      .on('pointermove', pointerMove)

    let dragging = false
    let lastDrawnPoint: PIXI.Point | null = null

    function pointerMove({ global: { x, y } }: PIXI.FederatedPointerEvent) {
      if (dragging) {
        // brush.beginFill(0xFFFFFF)
        // newBrush.beginFill(0xFFFFFF)
        // brush.position.set(x, y)
        // brush.drawCircle(0, 0, radius)
        brush.lineStyle({ width: 0, color: 0xFFFFFF })
        brush.drawCircle(x, y, brushStore.size)

        // brush.endFill()

        // app.renderer.render(brush, {
        //   // renderTexture,
        //   clear: false,
        //   skipUpdateTransform: false,
        // })

        // Smooth out the drawing a little bit to make it look nicer
        // this connects the previous drawn point to the current one
        // using a line
        if (lastDrawnPoint) {
          brush
            // .clear()
            .lineStyle({ width: brushStore.size * 2, color: 0xFFFFFF })
            .moveTo(lastDrawnPoint.x, lastDrawnPoint.y)
            .lineTo(x, y)

          // line.endFill()
          // app.renderer.render(line, {
          //   // renderTexture,
          //   clear: false,
          //   skipUpdateTransform: false,
          // })
        }
        lastDrawnPoint = lastDrawnPoint || new PIXI.Point()
        lastDrawnPoint.set(x, y)
      }
    }

    function pointerDown(event: PIXI.FederatedPointerEvent) {
      dragging = true
      pointerMove(event)
    }

    function pointerUp(_event: PIXI.FederatedPointerEvent) {
      dragging = false
      lastDrawnPoint = null

      // brush.endFill()
    }
  }
  setup()
}
