import type { Application, Container, FederatedWheelEvent } from 'pixi.js'

export const MIN_MAP_SCALE = 0.25
export const MAX_MAP_SCALE = 4

/** Keep zoom positive and bounded, with the point under the cursor fixed. */
export function addMapScale(app: Application, target: Container) {
  function onWheel(event: FederatedWheelEvent) {
    event.preventDefault()
    event.stopPropagation()
    const local = event.getLocalPosition(target)
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? app.screen.height : 1)
    const scale = Math.max(MIN_MAP_SCALE, Math.min(MAX_MAP_SCALE, target.scale.x * Math.exp(-delta * 0.002)))
    target.scale.set(scale)
    const parentPoint = target.parent ? event.getLocalPosition(target.parent) : event.global
    target.position.set(parentPoint.x - local.x * scale, parentPoint.y - local.y * scale)
  }
  app.stage.on('wheel', onWheel)
  return () => app.stage.off('wheel', onWheel)
}
