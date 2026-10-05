// @vitest-environment node
import type { FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js'
import { Application, Assets, Cache, Container, Point, Rectangle, Texture } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { init } from '../app/utils/map/hexagonal'
import { tileSources } from '../app/utils/map/hexagonal/assets'
import { addMapScale } from '../app/utils/map/hexagonal/event/scale'
import { CustomHex } from '../app/utils/map/hexagonal/global'
import { createMap } from '../app/utils/map/hexagonal/map'

function application() {
  return { stage: new Container(), screen: new Rectangle(0, 0, 800, 500) } as Application
}
function pointer(x: number, y: number, type = 'pointertap') {
  const global = new Point(x, y)
  return { global, type, button: 0, pointerId: 1, stopPropagation: vi.fn(), getLocalPosition: (container: Container) => container.toLocal(global) } as unknown as FederatedPointerEvent
}
function painted(tilesMap: ReturnType<typeof createMap>['tilesMap']) {
  return [...tilesMap.values()].filter(value => value !== 'empty')
}

beforeEach(() => {
  Object.values(tileSources).forEach(source => Cache.set(source, Texture.EMPTY))
})
afterEach(() => {
  Object.values(tileSources).forEach(source => Cache.remove(source))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('experimental hex map', () => {
  it('bounds wheel zoom, preserves the cursor anchor and removes its listener', () => {
    const app = application()
    const map = new Container()
    app.stage.addChild(map)
    map.position.set(50, 30)
    const event = { ...pointer(180, 140), deltaY: 100_000, deltaMode: 0, preventDefault: vi.fn() } as unknown as FederatedWheelEvent
    const anchor = event.getLocalPosition(map)
    const remove = addMapScale(app, map)
    app.stage.emit('wheel', event)
    expect(map.scale.x).toBe(0.25)
    expect(event.getLocalPosition(map).x).toBeCloseTo(anchor.x)
    expect(event.getLocalPosition(map).y).toBeCloseTo(anchor.y)
    event.deltaY = -100_000
    app.stage.emit('wheel', event)
    expect(map.scale.x).toBe(4)
    remove()
    event.deltaY = 100_000
    app.stage.emit('wheel', event)
    expect(map.scale.x).toBe(4)
    app.stage.destroy({ children: true })
  })

  it('paints the pointed hex after zoom and replaces old sprites', () => {
    const app = application()
    const { map, tilesMap } = createMap(app)
    map.scale.set(2)
    map.position.set(70, 15)
    const hex = new CustomHex({ q: 3, r: 2 })
    const point = map.toGlobal(new Point(hex.x, hex.y))
    app.stage.emit('pointertap', pointer(point.x, point.y))
    const first = tilesMap.get(hex.toString())
    expect(painted(tilesMap)).toHaveLength(3)
    app.stage.emit('pointertap', pointer(point.x, point.y))
    expect(first && first !== 'empty' && first.destroyed).toBe(true)
    expect(painted(tilesMap)).toHaveLength(3)
    expect([...tilesMap.keys()].every(key => !key.includes('NaN'))).toBe(true)
    app.stage.destroy({ children: true })
  })

  it('cancels outside drops and moves the pair repeatedly without stale tiles or tap painting', () => {
    const app = application()
    const { map, tilesMap } = createMap(app)
    const layer = map.children[0] as Container
    const origin = new CustomHex({ q: 0, r: 0 })
    const group = layer.children[0] as Container
    group.emit('pointerdown', pointer(origin.x, origin.y, 'pointerdown'))
    app.stage.emit('globalpointermove', pointer(900, 700, 'globalpointermove'))
    app.stage.emit('pointerupoutside', pointer(900, 700, 'pointerupoutside'))
    expect(group.position.x).toBe(0)
    expect(group.alpha).toBe(1)
    expect(painted(tilesMap)).toHaveLength(2)
    for (const q of [3, 5]) {
      const currentGroup = layer.children[0] as Container
      const first = currentGroup.children[0]
      currentGroup.emit('pointerdown', pointer(first.x, first.y, 'pointerdown'))
      const hex = new CustomHex({ q, r: 1 })
      app.stage.emit('pointerup', pointer(hex.x, hex.y, 'pointerup'))
      app.stage.emit('pointertap', pointer(hex.x, hex.y))
      expect(painted(tilesMap)).toHaveLength(2)
      expect(tilesMap.get(hex.toString())).toBe(layer.children[0].children[0])
      expect(currentGroup.destroyed).toBe(true)
    }
    expect(tilesMap.get(origin.toString())).toBeUndefined()
    app.stage.destroy({ children: true })
  })

  it('keeps map state independent across instances', () => {
    const first = createMap(application())
    const second = createMap(application())
    first.tilesMap.clear()
    expect(painted(second.tilesMap)).toHaveLength(2)
    first.map.destroy({ children: true })
    second.map.destroy({ children: true })
  })

  it('resizes with the host and disposes observers and the renderer once', async () => {
    let onResize: (() => void) | undefined
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { onResize = callback }
      observe() {}
      disconnect = disconnect
    })
    vi.spyOn(Assets, 'load').mockResolvedValue({})
    const resize = vi.fn()
    vi.spyOn(Application.prototype, 'init').mockImplementation(async function (this: Application) {
      this.renderer = { screen: new Rectangle(0, 0, 800, 500), resize } as unknown as Application['renderer']
    })
    const destroy = vi.spyOn(Application.prototype, 'destroy').mockImplementation(function (this: Application) {
      this.stage.destroy({ children: true })
    })
    vi.stubGlobal('window', { devicePixelRatio: 2 })
    const host = { clientWidth: 320, clientHeight: 240 }
    const canvas = { parentElement: host } as HTMLCanvasElement
    const runtime = await init(canvas)
    onResize?.()
    expect(resize).toHaveBeenCalledWith(320, 240)
    runtime.destroy()
    runtime.destroy()
    onResize?.()
    expect(resize).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledOnce()
    expect(runtime.tilesMap.size).toBe(0)
  })
})
