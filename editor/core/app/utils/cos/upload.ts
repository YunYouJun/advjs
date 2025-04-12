import type COS from 'cos-js-sdk-v5'
import { useStorage } from '@vueuse/core'
import consola from 'consola'
import { GLOBAL_COS } from './utils'

export const cosOptions = useStorage<COS.COSOptions>('editor:cos:COSOptions', {
  SecretId: '',
  SecretKey: '',
})

export const cosObjectParams = useStorage<COS.ObjectParams>('editor:cos:ObjectParams', {
  Bucket: '',
  Region: '',
  Key: '',
})

// 获取存储桶列表
// cos.getService((err, data) => {})

/**
 * 上传文件，file 为选择的文件
 * @param file
 */
export async function uploadFile(file: File) {
  const cos = GLOBAL_COS.instance
  if (!cos) {
    consola.error('请先初始化 COS 实例')
    return
  }

  return new Promise((resolve, reject) => {
    // 上传文件
    cos.uploadFile({
      Bucket: cosObjectParams.value.Bucket,
      Region: cosObjectParams.value.Region,
      Key: cosObjectParams.value.Key,
      Body: file, // 要上传的文件对象。
      onProgress(progressData) {
        consola.info('上传进度：', progressData)
      },
    }, (err, data) => {
      if (err) {
        consola.error('上传失败：', err)
        reject(err)
      }
      else {
        consola.info('上传成功：', data)
        resolve(data)
      }
    })
  })
}
