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
  tachies?: Record<string, AdvTachie>

  /**
   * 外貌特征
   */
  appearance?: string
  /**
   * 人物背景
   */
  background?: string
  /**
   * 人物理念
   *
   * @example 犹豫不决
   */
  concept?: string
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
