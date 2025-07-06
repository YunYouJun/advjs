import process from 'node:process'
import { hunyuan } from 'tencentcloud-sdk-nodejs-hunyuan'

/**
 * @see [文生图轻量版风格列表](https://cloud.tencent.com/document/product/1729/108992)
 *
 * hunyuanClient.TextToImageLite(params)
 */
export const hunyuanClient = new hunyuan.v20230901.Client({
  credential: {
    secretId: process.env.TENCENT_CLOUD_SECRET_ID || '',
    secretKey: process.env.TENCENT_CLOUD_SECRET_KEY || '',
  },
  region: process.env.TENCENT_CLOUD_REGION || 'ap-guangzhou',
  profile: {
    httpProfile: {
      reqMethod: 'POST',
      reqTimeout: 30,
      endpoint: 'hunyuan.tencentcloudapi.com',
    },
  },
})

// （不限定风格）
// 000
// 水墨画
// 101
// 概念艺术
// 102
// 油画1
// 103
// 油画2（梵高）
// 118
// 水彩画
// 104
// 像素画
// 105
// 厚涂风格
// 106
// 插图
// 107
// 剪纸风格
// 108
// 印象派1（莫奈）
// 109
// 印象派2
// 119
// 2.5D
// 110
// 古典肖像画
// 111
// 黑白素描画
// 112
// 赛博朋克
// 113
// 科幻风格
// 114
// 暗黑风格
// 115
// 3D
// 116
// 蒸汽波
// 117
// 日系动漫
// 201
// 怪兽风格
// 202
// 唯美古风
// 203
// 复古动漫
// 204
// 游戏卡通手绘
// 301
// 通用写实风格
// 401

export const HUNYUAN_STYLES = {
  '（不限定风格）': '000',
  '水墨画': '101',
  '概念艺术': '102',
  '油画1': '103',
  '油画2（梵高）': '118',
  '水彩画': '104',
  '像素画': '105',
  '厚涂风格': '106',
  '插图': '107',
  '剪纸风格': '108',
  '印象派1（莫奈）': '109',
  '印象派2': '119',
  '2.5D': '110',
  '古典肖像画': '111',
  '黑白素描画': '112',
  '赛博朋克': '113',
  '科幻风格': '114',
  '暗黑风格': '115',
  '3D': '116',
  '蒸汽波': '117',
  '日系动漫': '201',
  '怪兽风格': '202',
  '唯美古风': '203',
  '复古动漫': '204',
  '游戏卡通手绘': '301',
  '通用写实风格': '401',
}
