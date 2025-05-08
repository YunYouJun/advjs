import type { PutObjectCommandInput, S3ClientConfig } from '@aws-sdk/client-s3'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class S3Service {
  s3Client: S3Client

  constructor(public options: {
    s3ClientConfig: S3ClientConfig
  }) {
    this.s3Client = new S3Client({
      ...this.options.s3ClientConfig,
    })
  }

  /**
   * get s3 signed url
   */
  async getSignedUrl(commandInput: PutObjectCommandInput) {
    // const command = new GetObjectCommand({})
    const putCommand = new PutObjectCommand({
      ...commandInput,
    })
    const url = await getSignedUrl(this.s3Client, putCommand, { expiresIn: 3600 })
    return url
  }
}
