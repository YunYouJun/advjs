import type { AssetsManifest } from 'pixi.js'
import type { AdvChapter, AdvCharacter, AdvMusic } from '../game'

/**
 * 描述游戏具体内容的配置
 */
export interface AdvGameConfig {
  /**
   * @zh 游戏标题
   * @default 'ADV.JS'
   */
  title: string
  /**
   * @zh 游戏描述
   * @default '面向未来与前端的 ADV 文字冒险游戏引擎'
   */
  description: string
  /**
   * @zh 游戏图标
   * @default '/favicon.svg'
   */
  favicon: string

  /**
   * all characters appear in the game
   */
  characters: AdvCharacter[]

  bgm: {
    /**
     * auto play first bgm
     */
    autoplay: boolean
    collection: AdvMusic[]
  }

  /**
   * @zh 资源配置
   */
  assets: {
    /**
     * @see https://pixijs.com/8.x/examples/assets/bundle
     * @zh 资源清单
     */
    manifest: AssetsManifest
    // /**
    //  * other images
    //  */
    // images: Record<string, string>
    // /**
    //  * background url
    //  */
    // background?: Record<string, string>
    // /**
    //  * audio url
    //  */
    // audios: Record<string, string>
  }

  /**
   * chapters
   */
  chapters: AdvChapter[]
}
