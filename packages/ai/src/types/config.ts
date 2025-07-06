/**
 * 你是一名为视觉小说编写对话的专业人员。
 * 你需要为每一章节中的每一个节点编写引人入胜的对话，这些对话要能够反映角色的性格特点，并推动剧情的发展。
 */
export interface AdvAIChapter {
  /**
   * Chapter ID
   * @example chapter_01
   */
  id: string
  /**
   * 章节标题
   */
  title: string
  /**
   * 章节剧情概要
   */
  description?: string
  /**
   * 故事节点列表
   */
  nodes: {
    /**
     * Node ID
     * @example ch1_node_01
     */
    id: string
    /**
     * 情节总结
     */
    plotSummary?: string
    /**
     * 场景氛围和内容描述
     *
     * 您是一名专业的文本转图像提示生成者。
     *
     * - 根据当前 plotSummary，生成一个详细的图像提示，描述场景、角色、光线、风格、氛围、构图等。
     */
    scenePrompt?: string
    /**
     * 对话列表
     */
    dialogues: {
      /**
       * 对话内容
       */
      text: string
      /**
       * 对话角色 ID
       * 角色 ID 应该与 `characters` 中的人物相匹配
       * @example character_01
       */
      speakerId: string
    }[]
    /**
     * 目标节点 ID
     * 指向下一个节点
     */
    target?: string
  }[]

  /**
   * Start Node ID
   *
   * Defaults to the first node
   */
  startNodeId?: string
}

/**
 * 人物角色设定
 */
export interface AdvAICharacter {
  /**
   * 角色 ID
   */
  id: string
  /**
   * 角色名称
   */
  name: string
  /**
   * 角色头像
   */
  // avatar?: string
  /**
   * 角色描述
   */
  description?: string

  /**
   * 外貌特征
   */
  appearance?: string
  /**
   * 人物背景
   */
  background?: string
  /**
   * 人物特质
   *
   * @example 犹豫不决
   */
  concept?: string
}

/**
 * Generate AI Content
 */
export interface AdvAIConfig {
  /**
   * 引人入胜的故事标题
   */
  title: string
  /**
   * 故事简介
   * 概述主要情节
   */
  description?: string
  /**
   * 多个主要角色初始设定
   */
  characters: AdvAICharacter[]
  /**
   * 章节列表
   */
  chapters: AdvAIChapter[]
}
