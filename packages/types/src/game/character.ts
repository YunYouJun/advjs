export interface AdvCharacter {
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
   * @zh 别名
   */
  alias?: string | string[]
  /**
   * @zh 立绘们，key为立绘名称
   */
  tachies?: Record<string, Tachie>

  /**
   * 外貌特征
   */
  appearance?: string
  /**
   * 外貌特征提示词
   */
  appearance_prompt?: string
  /**
   * 人物背景
   */
  background?: string
}

export interface Tachie {
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
