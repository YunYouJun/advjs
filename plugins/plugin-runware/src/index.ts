import type { RunwareBaseType } from '@runware/sdk-js'
import process from 'node:process'
import { Runware } from '@runware/sdk-js'

/**
 * @see https://runware.ai/docs/en/libraries/javascript
 */
export async function main(options: {
  // apiKey?: string
  runwareOptions?: RunwareBaseType
} = {
  runwareOptions: {
    apiKey: process.env.RUNWARE_API_KEY || '',
  },
}) {
  const apiKey = process.env.RUNWARE_API_KEY || options.runwareOptions?.apiKey || ''

  if (!apiKey) {
    throw new Error('Runware API key is required')
  }

  const runware = await Runware.initialize({
    ...options.runwareOptions,
    apiKey,
  })
  return runware
}
