import type * as Adv from '@advjs/types'

export function parseScene(text: string) {
  // 匹配场景
  // 以 【】开头结尾，且至少存在一个字段
  const re = /^【(.+)】$/
  const separator = '，'
  if (re.test(text)) {
    const metaInfo: Adv.SceneInfo = {
      type: 'scene',
      place: '',
      time: '',
      inOrOut: '',
    }
    const arr = text.slice(1, -1).split(separator)
    if (arr[0])
      metaInfo.place = arr[0]
    if (arr[1])
      metaInfo.time = arr[1]
    if (arr[2])
      metaInfo.inOrOut = arr[2]
    return metaInfo
  }
}

/**
 * 解析旁白
 * @param text
 */
export function parseNarration(text: string) {
  // 以 （） 开头结尾
  const re = /^（.+）$/
  if (re.test(text)) {
    const narration: Adv.Narration = {
      type: 'narration',
      children: [
        {
          type: 'text',
          value: text.slice(1, -1),
        },
      ],
    }
    return narration
  }
}
