import type { AssetsManifest } from 'pixi.js'
import { Application, Assets } from 'pixi.js'
import { BackgroundSystem } from './system/background'
import { TachieSystem } from './system/tachie'

export class PixiGame {
  app: Application
  // wait init
  BgSystem!: BackgroundSystem
  TachieSystem!: TachieSystem

  assetsManifest: AssetsManifest | null = null

  constructor() {
    const app = new Application()
    this.app = app

    // @ts-expect-error debug
    window.__PIXI_APP__ = app
  }

  async setAssetsManifest(manifest: AssetsManifest) {
    this.assetsManifest = manifest
  }

  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      // background: '#FFFFFF',
      backgroundAlpha: 0,
      antialias: true,
      // resolution: window.devicePixelRatio,
    })

    if (this.assetsManifest) {
      await Assets.init({
        manifest: this.assetsManifest,
      })
    }

    await Assets.loadBundle('game-screen')

    this.BgSystem = new BackgroundSystem(this)
    this.BgSystem.load('stacked-steps-haikei')

    this.TachieSystem = new TachieSystem(this)
    this.TachieSystem.init()
    this.TachieSystem.showCharacter('xiao-yun')
  }
}
