import { Application } from 'pixi.js'
import { loadTiles } from './assets'
import { addMapScale } from './event'
import { createMap } from './map'
import { createPalette } from './palette'

/** Experimental hex map; callers must destroy the returned runtime on unmount. */
export async function init(canvas: HTMLCanvasElement) {
  await loadTiles()
  const app = new Application()
  const host = canvas.parentElement ?? canvas
  try {
    await app.init({
      canvas,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    })
  }
  catch (error) {
    if (app.renderer)
      app.destroy(false, { children: true })
    throw error
  }
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  const { map, tilesMap, selectTile } = createMap(app)
  const placePalette = createPalette(app, selectTile)
  const removeScale = addMapScale(app, map)
  let destroyed = false
  const resize = () => {
    if (destroyed)
      return
    app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
    placePalette()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  placePalette()
  return {
    app,
    tilesMap,
    destroy() {
      if (destroyed)
        return
      destroyed = true
      observer.disconnect()
      removeScale()
      tilesMap.clear()
      // Shared cached textures remain available to other maps and future mounts.
      app.destroy(false, { children: true })
    },
  }
}
