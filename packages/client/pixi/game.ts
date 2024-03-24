import { Application, Assets } from 'pixi.js'
import type { AdvConfig } from '@advjs/types'
import { BackgroundSystem } from './system/background'
import { TachieSystem } from './system/tachie'

export class PixiGame {
  config: AdvConfig

  app: Application
  // wait init
  BgSystem!: BackgroundSystem
  TachieSystem!: TachieSystem

  constructor(config: AdvConfig) {
    const app = new Application()
    this.app = app
    this.config = config

    // @ts-expect-error debug
    window.__PIXI_APP__ = app
  }

  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      // background: '#FFFFFF',
      backgroundAlpha: 0,
      resizeTo: canvas,
      antialias: true,
      // resolution: window.devicePixelRatio,
    })

    await Assets.init({
      manifest: this.config.assets.manifest,
    })

    await Assets.loadBundle('game-screen')

    this.BgSystem = new BackgroundSystem(this)
    this.BgSystem.load('stacked-steps-haikei')

    this.TachieSystem = new TachieSystem(this)
    this.TachieSystem.init()
    this.TachieSystem.showCharacter('xiao-yun')
  }
}
