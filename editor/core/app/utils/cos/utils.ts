import COS from 'cos-js-sdk-v5'

export const GLOBAL_COS: {
  /**
   * 全局 COS 实例
   */
  instance: COS | null
} = {
  instance: null,
}

/**
 * init cos
 * @param cosOptions
 */
export function createCOS(cosOptions: COS.COSOptions) {
  /**
   * 可在前端 settings 填写永久密钥
   */
  // stsUrl 是上方搭建的临时密钥服务
  // const stsUrl = `http://127.0.0.1:3000/getKeyAndCredentials?filename=${file.name}`
  // const data = await fetch(stsUrl).then(res => res.json())

  // 服务端接口需要返回：上传的存储桶、地域、随机路径的对象键、临时密钥
  // console.log('getKeyAndCredentials:', data)

  // 取临时密钥示例1：如果通过 qcloud-cos-sts-sdk 获取临时密钥字段的格式。在返回值里取临时密钥信息，上传的文件路径信息
  // const { credentials = {}, startTime, expiredTime, bucket, region, key } = data
  // const { tmpSecretId, tmpSecretKey, sessionToken } = credentials

  // 取临时密钥示例2：如果直接走请求云 API，或使用云 API SDK 调用临时密钥接口，返回的是大写驼峰格式
  // const tmpSecretId = data.Credentials.TmpSecretId;
  // const tmpSecretKey= data.Credentials.TmpSecretKey;
  // const sessionToken = data.Credentials.Token;
  // const expiredTime= data.ExpiredTime;

  // 校验 getUploadParams 返回参数，以实际返回格式为准
  // const params = { tmpSecretId, tmpSecretKey, sessionToken, bucket, region, key }
  // const emptyParam = Object.keys(params).find(key => !params[key])
  // if (emptyParam) {
  //   reject(`参数错误: ${emptyParam} 不能为空`)
  //   return
  // }

  if (!cosOptions.SecretId) {
    console.error('请在设置中填写 SecretId')
    return
  }
  if (!cosOptions.SecretKey) {
    console.error('请在设置中填写 SecretKey')
    return
  }

  // 创建 JS SDK 实例，传入临时密钥参数
  // 其他配置项可参考下方 初始化配置项
  const cos = new COS({
    SecretId: cosOptions.SecretId,
    SecretKey: cosOptions.SecretKey,
    // SecurityToken: sessionToken,
    // StartTime: startTime,
    // ExpiredTime: expiredTime,
  })
  GLOBAL_COS.instance = cos
  return cos
}
