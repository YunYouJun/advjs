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
