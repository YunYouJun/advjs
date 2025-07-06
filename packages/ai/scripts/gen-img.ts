import { consola } from 'consola'
import { colors } from 'consola/utils'

import { HUNYUAN_STYLES, hunyuanClient } from '../src'

const textToImagePrompts = [
  // '一只可爱的猫咪在草地上玩耍',
  '黄花、黄头发、花田、雨、雨伞、水坑、反射器、水手服',
]

/**
 * 测试生成混元文生图 Lite
 */
async function main() {
  // promise.all
  await Promise.all(textToImagePrompts.map((prompt) => {
    return hunyuanClient.TextToImageLite({
      Prompt: prompt,
      Resolution: '1920:1080', // 宽高比 16:9
      Style: HUNYUAN_STYLES['日系动漫'],
      RspImgType: 'url',
      LogoAdd: 0, // 不添加水印
    })
      .then((data) => {
        consola.info(`Prompt: ${colors.blue(prompt)}`)
        consola.success(`Image URL: ${colors.green(data.ResultImage || '')}`)
      })
      .catch((error) => {
        consola.error(`Prompt: ${colors.blue(prompt)} - Image generation failed:`, error)
      })
  }))
}

main()
