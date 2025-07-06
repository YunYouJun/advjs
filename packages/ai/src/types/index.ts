import type { AdvAIChapter } from './chapter'

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
