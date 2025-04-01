export interface AdvBaseScene {
  /**
   * @zh ID 唯一标识
   */
  id: string
  /**
   * @zh 场景名称（可展示给用户的名称）
   */
  name?: string
  /**
   * assets alias
   */
  alias?: string
  /**
   * @zh 场景描述
   */
  description?: string
  /**
   * Image Prompt
   * @zh 场景提示词
   * @description 生成图片的提示词
   * @example "A small, cluttered Tokyo apartment with morning light filtering through curtains."
   */
  imagePrompt?: string
  /**
   * @default 'image'
   * @zh 场景类型
   */
  type?: 'image' | 'model'
}

export interface AdvSceneImage extends AdvBaseScene {
  /**
   * 场景背景图片
   */
  type: 'image'
  /**
   * @zh 图片路径
   * @description 图片路径或url
   * @example "/img/your-name/scene-1.jpg"
   */
  src: string
}

export interface AdvSceneModel extends AdvBaseScene {
  /**
   * 场景模型
   */
  type: 'model'
}

export type AdvScene = AdvSceneImage | AdvSceneModel
