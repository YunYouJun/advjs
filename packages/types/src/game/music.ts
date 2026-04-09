export interface AdvMusic {
  /**
   * @zh 音乐名称
   */
  name: string
  /**
   * @zh 音乐描述
   */
  description?: string
  /**
   * @zh 音乐链接
   * 自动拼接
   */
  src?: string
  /**
   * @zh 时长（秒）
   */
  duration?: number
  /**
   * @zh 标签
   */
  tags?: string[]
  /**
   * @zh 关联场景 ID 列表
   */
  linkedScenes?: string[]
  /**
   * @zh 关联章节文件列表
   */
  linkedChapters?: string[]
}
