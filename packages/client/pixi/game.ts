import type { AssetsBundle, AssetsManifest, UnresolvedAsset } from 'pixi.js'
import type { AdvContext } from '../types'
import { consola } from 'consola'
import { Application, Assets } from 'pixi.js'
import { SceneSystem } from './system/scene'
import { TachieSystem } from './system/tachie'

const gameBundleName = '@advjs/game/bundle'

export class PixiGame {
  app: Application
  // wait init
  SceneSystem!: SceneSystem
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
      resolution: window.devicePixelRatio,
    })

    if (this.assetsManifest) {
      consola.debug('assets manifest', this.assetsManifest)
      await Assets.init({
        manifest: this.assetsManifest,
      })
    }

    const preload = this.$adv.config.value.preload
    if (typeof preload === 'object') {
      if (['all', 'chapter'].includes(preload.type)) {
        // 加载第一张图片
        const gameBundleAssets = this.assetsManifest?.bundles.find(b => b.name === gameBundleName)?.assets
        if (Array.isArray(gameBundleAssets) && gameBundleAssets.length > 0) {
          await Assets.load({
            alias: gameBundleAssets?.[0]?.alias,
            src: gameBundleAssets?.[0]?.src,
          })
        }
        if (preload.background) {
          Assets.backgroundLoadBundle(gameBundleName)
        }
        else {
          await Assets.loadBundle(gameBundleName)
        }
      }
    }

    this.SceneSystem = new SceneSystem(this)

    this.TachieSystem = new TachieSystem(this)
    this.TachieSystem.init()
    // this.TachieSystem.showCharacter('xiao-yun')
  }
}
