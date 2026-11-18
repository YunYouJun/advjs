import type { AssetsManifest } from 'pixi.js'
import type { AudioMixerConfig } from '../audio/mixer'
import type { VoiceLedger } from '../audio/voice'
import type { AdvChapter, AdvCharacter, AdvMusic, AdvScene } from '../game'
import type { JsonObject } from '../runtime'

export interface AdvGameAudioSource {
  src: string
  sha256?: string
  bytes?: number
  mime?: string
  duration?: number
}

export interface AdvGameAudioAsset extends AdvGameAudioSource {
  kind: 'bgm' | 'ambience' | 'voice' | 'sfx' | 'ui'
  /** Player-facing name, e.g. for the music room. */
  title?: string
  /** Host-resolved processed transports; the master hash still identifies the selected take. */
  variants?: Partial<Record<'opus' | 'aac', AdvGameAudioSource>>
}

/** Host-resolved catalog and authoring documents. No providers or secrets enter the player. */
export interface AdvGameAudioConfig {
  assets: Record<string, AdvGameAudioAsset>
  mixer?: AudioMixerConfig
  voiceLedger?: VoiceLedger
  locale?: string
}

export interface AdvGalleryItem {
  id: string
  title: string
  src: string
  thumbnail?: string
  alt?: string
  chapterId?: string
}

export interface AdvGameGalleryConfig {
  /** Stable browser-storage namespace for gallery unlocks. */
  id: string
  version?: number
  allowDownload?: boolean
  items: AdvGalleryItem[]
}

export interface AdvGameExtraItem {
  /** Stable ID written into the progression key by `variables/push-unique`. */
  id: string
  title: string
  /** Shown while locked; omit to keep the entry fully secret. */
  hint?: string
  /** Shown after unlocking. */
  description?: string
}

/** Endings or achievements unlocked by IDs stored in one top-level runtime variable. */
export interface AdvGameUnlockListConfig {
  /** Top-level array variable, ideally listed in `progression.keys`. */
  key?: string
  items: AdvGameExtraItem[]
}

/** A replayable scene starting at an authored anchor. */
export interface AdvGameReplayConfig {
  id: string
  title: string
  hint?: string
  chapterId: string
  /** Anchor node ID; defaults to the chapter entry. */
  nodeId?: string
  /** Replay stops when this anchor of the same chapter is reached; otherwise at the chapter boundary. */
  endNodeId?: string
  /** Variables applied over `gameConfig.variables` for the isolated replay session. */
  variables?: JsonObject
}

export interface AdvGameMusicTrack {
  /** BGM asset ID in `audio.assets`. */
  id: string
  title?: string
  description?: string
}

export interface AdvGameMusicRoomConfig {
  /** Display order and metadata; omitted means every BGM asset in the catalog. */
  tracks?: AdvGameMusicTrack[]
}

export interface AdvGameProgressionConfig {
  /** Stable storage namespace for this game. */
  id: string
  /** Persistence schema version. Increment when stored value shapes change. */
  version?: number
  /** Top-level runtime variable keys persisted across new sessions. */
  keys: string[]
}

/**
 * 描述游戏具体内容的配置
 */
export interface AdvGameConfig {
  /** Exact canonical entry chapter shared by project builds and browser compilation. */
  entryChapterId?: string
  audio?: AdvGameAudioConfig
  /** Initial JSON-only variables installed into the deterministic runtime. */
  variables?: JsonObject
  /** Host-owned variables persisted across new runtime sessions. */
  progression?: AdvGameProgressionConfig
  /** Optional CG collection displayed by the client gallery. */
  gallery?: AdvGameGalleryConfig
  /** Named endings unlocked through a progression key. */
  endings?: AdvGameUnlockListConfig
  /** Achievements unlocked through a progression key. */
  achievements?: AdvGameUnlockListConfig
  /** Scenes replayable from the extras menu after their anchor was reached once. */
  replays?: AdvGameReplayConfig[]
  /** Heard BGM listed by the extras music room. */
  musicRoom?: AdvGameMusicRoomConfig
  /** Runtime plugin names and exact versions required by the compiled Program. */
  requiredPlugins?: Record<string, string>
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
  cover?: string

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
