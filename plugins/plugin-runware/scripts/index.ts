import process from 'node:process'
import { RunwareService } from '../src'
import 'dotenv/config'

async function run() {
  const runwareService = new RunwareService({
    runwareOptions: {
      apiKey: process.env.RUNWARE_API_KEY || '',
    },
    upload: {
      /**
       * tencent cos
       */
      bucketName: 'advjs-1325586649',

      s3ClientConfig: {
        endpoint: 'https://cos.ap-guangzhou.myqcloud.com',
        credentials: {
          accessKeyId: process.env.TENCENT_COS_SECRET_ID || '',
          secretAccessKey: process.env.TENCENT_COS_SECRET_KEY || '',
        },
      },
    },
  })
  await runwareService.init()

  const images = await runwareService.generateImages([
    {
      positivePrompt: 'ghibli style, A beautiful landscape with mountains and a river',
      negativePrompt: 'blurry, low quality',
      width: 512,
      height: 512,
      // AnyLoRA SD1.5
      model: 'civitai:23900@28614',
      scheduler: 'DPM++ 2M Karras',
      outputType: 'URL',
      lora: [
        {
          model: 'civitai:6526@7657',
          weight: 1,
        },
      ],
      numberResults: 1,
      steps: 20,
      CFGScale: 7,
      includeCost: true,
    },
  ])

  console.log(images)
}

run()
