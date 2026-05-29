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
 * 属性模板 ID
 * - `universal` 通用基础字段
 * - `galgame`   恋爱/视觉小说向扩展
 * - `rpg`       奇幻 / RPG 六维属性
 * - `mystery`   悬疑 / 剧本杀线索属性
 */
export type AdvCharacterTemplate = 'universal' | 'galgame' | 'rpg' | 'mystery'

/**
 * Universal 通用属性（所有模板共享的基础字段）
 */
export interface AdvCharacterProfile {
  /** 年龄（可为数字或描述，如 `17`、`不详`） */
  age?: number | string
  /** 性别 */
  gender?: string
  /** 职业 / 身份 */
  occupation?: string
  /** 性格关键词（tag 数组） */
  personalityTags?: string[]
  /** 外貌要点（一句话总结，详细描述仍放在 ## 外貌 body section） */
  appearanceSummary?: string
}

/**
 * Galgame / 恋爱向扩展字段
 */
export interface AdvCharacterGalgameAttrs {
  /** 生日（`MM-DD` 或自由文本） */
  birthday?: string
  /** 血型 */
  bloodType?: 'A' | 'B' | 'AB' | 'O' | string
  /** 星座 */
  zodiac?: string
  /** 身高（cm 或自由文本） */
  height?: string
  /** 喜好 */
  likes?: string[]
  /** 讨厌 */
  dislikes?: string[]
  /**
   * 玩家好感度的初始值（运行时数值请放 dynamicState，避免污染 frontmatter）
   */
  affinityInitial?: number
}

/**
 * RPG 六维属性
 */
export interface AdvCharacterRpgStats {
  /** 力量 Strength */
  str?: number
  /** 敏捷 Dexterity */
  dex?: number
  /** 智力 Intelligence */
  int?: number
  /** 体质 Constitution */
  con?: number
  /** 感知 Wisdom */
  wis?: number
  /** 魅力 Charisma */
  cha?: number
}

/**
 * RPG / 奇幻扩展字段
 */
export interface AdvCharacterRpgAttrs {
  /** 种族 */
  race?: string
  /** 职业 / 阶级 */
  class?: string
  /** 等级 */
  level?: number
  /** 六维属性 */
  stats?: AdvCharacterRpgStats
  /** 生命值初始值（运行时数值放 dynamicState） */
  hpInitial?: number
  /** 魔法值初始值（运行时数值放 dynamicState） */
  mpInitial?: number
  /** 技能列表 */
  skills?: string[]
  /** 装备 */
  equipment?: string[]
  /** 阵营（守序善良等） */
  alignment?: string
}

/**
 * Mystery / 剧本杀扩展字段
 */
export interface AdvCharacterMysteryAttrs {
  /** 公开身份 */
  publicIdentity?: string
  /** 隐藏秘密（可配合 ai.visibility = gm-only 使用） */
  secret?: string
  /** 动机 */
  motive?: string
  /** 不在场证明 */
  alibi?: string
  /** 关联线索 */
  clues?: string[]
  /** 烟雾弹 / 误导信息 */
  redHerrings?: string[]
  /** 初始嫌疑度（运行时变化放 dynamicState） */
  suspicionInitial?: number
}

export type AdvCharacterAttributesVisibility = 'public' | 'gm-only'

/**
 * 自定义字段条目（用户扩展）
 */
export interface AdvCharacterCustomField {
  /** 字段展示名 */
  label: string
  /** 字段值（简单值 / 数组） */
  value: string | number | string[]
}

/**
 * 属性面板的 AI 控制
 */
export interface AdvCharacterAttributesAi {
  /**
   * 是否整个 attributes 面板注入系统提示词
   * @default true
   */
  promptInject?: boolean
  /**
   * 属性可见性。`gm-only` 适合悬疑/剧本杀中的隐藏设定，由视角系统决定是否展示给玩家。
   * @default 'public'
   */
  visibility?: AdvCharacterAttributesVisibility
  /**
   * 字段级黑名单（以 `path.to.field` 表示，如 `galgame.bloodType`）
   * 列表中的字段不会注入 AI 上下文
   */
  excludeFields?: string[]
}

/**
 * 结构化角色属性
 *
 * @remarks
 * 本字段承载「作者手写的静态 Profile」，不要塞运行时状态或 AI 自动提取的记忆。
 * - 运行时状态 → `AdvCharacter.dynamicState`（不持久化到 `.character.md`）
 * - AI 记忆     → IndexedDB 的 `useCharacterMemoryStore`
 */
export interface AdvCharacterAttributes {
  /** 启用的模板 ID（影响 Studio UI 展示哪些字段组） */
  template?: AdvCharacterTemplate
  /** Universal 基础字段 */
  profile?: AdvCharacterProfile
  /** Galgame 扩展字段 */
  galgame?: AdvCharacterGalgameAttrs
  /** RPG 扩展字段 */
  rpg?: AdvCharacterRpgAttrs
  /** Mystery / 剧本杀扩展字段 */
  mystery?: AdvCharacterMysteryAttrs
  /** 自定义字段（key = 字段标识） */
  custom?: Record<string, AdvCharacterCustomField>
  /** AI 控制 */
  ai?: AdvCharacterAttributesAi
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
   * Image Prompt
   * @zh 立绘提示词
   * @description 生成角色立绘 / 头像的 AI 提示词（英文为佳）。与 scene.imagePrompt 对应
   * @example "anime portrait of a short-haired high-school girl, white scarf, gentle smile, watercolor"
   */
  imagePrompt?: string
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
  /**
   * @zh 结构化属性（可选）
   *
   * 作者手写的静态 profile，按模板分组存放。不要塞运行时状态或 AI 记忆。
   * @see AdvCharacterAttributes
   */
  attributes?: AdvCharacterAttributes
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
