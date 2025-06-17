import type { AssetsManifest } from 'pixi.js'
import type { AdvChapter, AdvCharacter, AdvMusic, AdvScene } from '../game'

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
   * Cover image URL
   * 开始界面封面
   * @zh 游戏封面
   */
  cover: string

  bgm: {
    /**
     * auto play first bgm
     */
    autoplay: boolean
    /**
     * custom collection
     */
    collection?: AdvMusic[]
    /**
     * @zh 音乐库
     *
     * @example
     * https://cos.advjs.yunle.fun/bgms/bgm-library.json
     *
     * one of the bgm
     * https://cos.advjs.yunle.fun/bgms/library/%E6%B8%9A%EF%BD%9E%E5%9D%82%E3%81%AE%E4%B8%8B%E3%81%AE%E5%88%A5%E3%82%8C.mp3
     */
    library?: Record<string, AdvMusic | AdvMusic[]> | string
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
   * adv/characters/*.character.ts
   * chapters
   * @zh 章节配置
   * @default []
   */
  chapters: AdvChapter[]
  /**
   * adv/characters/*.character.ts
   * all characters appear in the game
   * @zh 角色配置
   */
  characters: AdvCharacter[]
  /**
   * adv/scenes/*.scene.ts
   * @zh 场景配置
   * @default []
   */
  scenes: AdvScene[]
}
