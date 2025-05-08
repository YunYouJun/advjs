import type { S3ClientConfig } from '@aws-sdk/client-s3'
import type { RunwareBaseType, RunwareClient } from '@runware/sdk-js'
import { Runware } from '@runware/sdk-js'
import { consola } from 'consola'
import { S3Service } from './s3'

export class RunwareService {
  /**
   * @see https://runware.ai/docs/en/libraries/javascript
   */
  public runware: RunwareClient
  public s3Service?: S3Service

  constructor(public options: {
    runwareOptions?: RunwareBaseType
    /**
     * upload to s3
     */
    upload: {
      bucketName: string
      s3ClientConfig: S3ClientConfig
    }
  }) {
    // eslint-disable-next-line node/prefer-global/process
    const apiKey = process.env.RUNWARE_API_KEY || options.runwareOptions?.apiKey || ''

    if (!apiKey) {
      throw new Error('Runware API key is required')
    }

    this.runware = new Runware({
      ...options.runwareOptions,
      apiKey,
    })

    if (this.options.upload) {
      this.s3Service = new S3Service({
        s3ClientConfig: {
          ...this.options.upload.s3ClientConfig,
        },
      })
    }
  }

  async init() {
    await this.runware.ensureConnection()
    consola.success('Runware connection established')
  }

  /**
   * generate images parallel
   */
  async generateImages(imageOptions: Parameters<RunwareClient['requestImages']>[0][]) {
    const signedUrl = await this.s3Service?.getSignedUrl({
      Bucket: this.options.upload.bucketName,
      Key: 'test.webp',
      ContentType: 'image/webp',
    })
    consola.success('Generated S3 Put Signed URL')

    const promiseArr = imageOptions.map((options) => {
      return this.runware.requestImages({
        ...options,
        positivePrompt: options.positivePrompt,
        width: options.width || 512,
        height: options.height || 512,
        model: options.model || '',
        outputFormat: options.outputFormat || 'WEBP',

        uploadEndpoint: signedUrl,
      })
    })
    try {
      const images = await Promise.all(promiseArr)
      return images
    }
    catch (error) {
      console.error(error)
      throw error
    }
  }
}
