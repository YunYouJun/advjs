export interface AdvScene {
  /**
   * @zh ID 唯一标识
   */
  id: string
  /**
   * @zh 场景描述
   */
  description?: string
  /**
   * @zh 场景提示词
   * @description 生成图片的提示词
   * @example "A small, cluttered Tokyo apartment with morning light filtering through curtains."
   */
  imagePrompt?: string
  /**
   * @zh 图片路径
   * @description 图片路径或url
   * @example "/img/your-name/scene-1.jpg"
   */
  src: string
}
