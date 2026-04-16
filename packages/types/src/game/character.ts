/**
 * 角色关系
 */
export interface AdvCharacterRelationship {
  /**
   * 目标角色 ID
   */
  targetId: string
  /**
   * 关系类型
   * @example '恋人', '宿敌', '师徒'
   */
  type: string
  /**
   * 关系描述
   */
  description?: string
}

/**
 * .character.md frontmatter 的类型定义
 * 每个字段与 YAML frontmatter 键一一对应
 */
export interface AdvCharacterFrontmatter {
  /**
   * @zh ID 唯一标识
   */
  id: string
  /**
   * @zh 姓名
   */
  name: string
  /**
   * @zh 头像
   */
  avatar?: string
  /**
   * @zh 演员
   */
  actor?: string
  /**
   * @zh 声优
   */
  cv?: string
  /**
   * @zh 别名列表
   */
  aliases?: string[]
  /**
   * @zh 角色标签
   */
  tags?: string[]
  /**
   * @zh 阵营/组织
   */
  faction?: string
  /**
   * @zh 立绘们，key为立绘名称
   */
  tachies?: Record<string, AdvTachie>
  /**
   * @zh 角色关系
   */
  relationships?: AdvCharacterRelationship[]
  /**
   * @zh 角色对话语言
   * 用于 AI 系统提示词，指定角色使用的对话语言
   */
  language?: 'zh' | 'en' | 'ja'
}

/**
 * Human-readable display name for each supported character language.
 */
export const LANGUAGE_LABELS: Record<string, string> = {
  zh: '中文',
  ja: '日本語',
  en: 'English',
}

/**
 * Markdown body 中按 ## 标题解析出的描述性字段
 */
export interface AdvCharacterBody {
  /**
   * 外貌特征（## 外貌 / ## Appearance）
   */
  appearance?: string
  /**
   * 性格描述（## 性格 / ## Personality）
   */
  personality?: string
  /**
   * 人物背景（## 背景 / ## Background）
   */
  background?: string
  /**
   * 人物理念（## 理念 / ## Concept）
   *
   * @example 犹豫不决
   */
  concept?: string
  /**
   * 语气/说话风格（## 说话风格 / ## Speech Style）
   */
  speechStyle?: string
  /**
   * 知识领域（## 知识领域 / ## Knowledge Domain）
   */
  knowledgeDomain?: string
  /**
   * 专业提示（## 专业提示 / ## Expertise Prompt）
   */
  expertisePrompt?: string
}

/** 角色的可变运行时状态（世界模拟用，不写入 .character.md） */
export interface AdvCharacterDynamicState {
  /** 当前位置 */
  location?: string
  /** 健康状态 */
  health?: string
  /** 当前活动 */
  activity?: string
  /** 自定义数值属性（如体力、魔力等） */
  attributes?: Record<string, number>
  /** 最近发生的事件摘要 */
  recentEvents?: string[]
  /** 状态最后更新时间 (ISO string) */
  lastUpdated?: string
}

/**
 * 完整角色数据 = frontmatter + body + 元数据
 */
export interface AdvCharacter extends AdvCharacterFrontmatter, AdvCharacterBody {
  /**
   * 创建时间
   */
  createdAt?: string
  /**
   * 更新时间
   */
  updatedAt?: string
  /**
   * 飞书 record_id（同步用）
   */
  feishuRecordId?: string
  /**
   * 动态运行时状态（不持久化到 .character.md）
   */
  dynamicState?: AdvCharacterDynamicState
}

export interface AdvTachie {
  description?: string
  /**
   * tachie path or url
   * when 2d: img url
   * when 3d: pose json data url
   */
  src: string
  class?: string | string[]
  style?: Record<string, string>
}
