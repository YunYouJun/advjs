import type { AssetsBundle, AssetsManifest, UnresolvedAsset } from 'pixi.js'
import type { AdvContext } from '../types'
import { consola } from 'consola'
import { Application, Assets } from 'pixi.js'
import { BackgroundSystem } from './system/background'
import { TachieSystem } from './system/tachie'

const gameBundleName = '@advjs/game/bundle'

export class PixiGame {
  app: Application
  // wait init
  BgSystem!: BackgroundSystem
  TachieSystem!: TachieSystem

  assetsManifest: AssetsManifest | null = null

  constructor(public $adv: AdvContext) {
    const app = new Application()
    this.app = app
    this.$adv = $adv

    // @ts-expect-error debug
    window.__PIXI_APP__ = app
  }

  initGameAssetsBundle() {
    const assets: UnresolvedAsset[] = []
    const gameBundle: AssetsBundle = {
      name: gameBundleName,
      assets,
    }
    if (this.$adv.gameConfig.value.scenes?.length) {
      this.$adv.gameConfig.value.scenes.forEach((scene) => {
        if (scene.type === 'image') {
          const sceneAsset: UnresolvedAsset = {
            alias: scene.alias || scene.id,
            src: scene.src,
          }
          assets.push(sceneAsset)
        }
      })
    }
    return gameBundle
  }

  initAssetsManifest() {
    const manifest: AssetsManifest = {
      bundles: [],
    }
    const gameBundle = this.initGameAssetsBundle()
    manifest.bundles.push(gameBundle)
    return manifest
  }

  /**
   * 合并自定义资源清单
   * @param manifest
   */
  setAssetsManifest(manifest?: AssetsManifest) {
    const defaultManifest = this.initAssetsManifest()
    if (manifest) {
      defaultManifest.bundles.push(...manifest.bundles)
    }
    this.assetsManifest = defaultManifest
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
      consola.start('assets manifest', this.assetsManifest)
      await Assets.init({
        manifest: this.assetsManifest,
      })
    }

    await this.loadBundle()

    this.BgSystem = new BackgroundSystem(this)
    // this.BgSystem.load('stacked-steps-haikei')

    this.TachieSystem = new TachieSystem(this)
    this.TachieSystem.init()
    // this.TachieSystem.showCharacter('xiao-yun')
  }

  async loadBundle(name = gameBundleName) {
    await Assets.loadBundle(name)
  }
}
