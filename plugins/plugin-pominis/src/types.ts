import type { AdvConfig } from '@advjs/types'

/**
 * visual novel
 */
export interface PominisAIVSConfig {
  /**
   * 游戏 ID
   */
  id: string
  /**
   * 游戏标题
   */
  title: string
  /**
   * 游戏封面
   */
  cover: string
  /**
   * 开始节点
   */
  startNode: string
  /**
   * 游戏人物
   */
  characters: Character[]
  /**
   * 游戏章节
   */
  chapters: Chapter[]

  /**
   * @adv
   * 扩展的 ADV.JS 引擎配置
   */
  advConfig?: Partial<AdvConfig>
}

interface Character {
  id: string
  name: string
  appearance: string
  appearance_prompt: string
  background: string
  concept: string

  /**
   * 角色头像
   */
  avatar?: string
}

interface Chapter {
  id: string
  title: string
  startNodeId: string
  description: string
  nodes: VSNode[]
  entryPoints: Record<string, string>
}

export interface VSNode {
  id: string
  /**
   * 场景图片
   */
  sceneImage?: string
  plot_summary: string
  imagePrompt: string
  dialogues: Dialogue[]
  choices?: Choice[]
  next?: string | null
  /**
   * background music theme id
   * from library
   */
  bgmThemeId?: string
}

interface Dialogue {
  speaker: string
  text: string
}

interface Choice {
  text: string
  targetId: string
}
