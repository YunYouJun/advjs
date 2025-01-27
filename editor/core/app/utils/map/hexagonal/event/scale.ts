import type { Application, Container } from 'pixi.js'

/**
 * add global scale
 */
export function addMapScale(app: Application, target: Container) {
  app.stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    e.stopPropagation()

    const delta = e.deltaY
    const scale = target.scale.x + delta * 0.01
    target.scale.set(scale)
  })
}
