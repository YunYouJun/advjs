import type { SpeechCreateParams } from 'openai/resources/audio/speech'

import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { openai } from '../src'
import { logsDir } from './config'

import 'dotenv/config'

/**
 * 生成各种预置音色语音
 */
export async function main() {
  const exampleText = '今天是一个美好的日子，来做一些让人开心的事情吧！'

  const voices: SpeechCreateParams['voice'][] = [
    'alloy',
  ]

  for (const voice of voices) {
    const mp3 = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      // voice: 'coral',
      voice,
      // input: "Today is a wonderful day to build something people love!",
      input: exampleText,
      instructions: 'Speak in a sad tone.',
    })
    const buffer = Buffer.from(await mp3.arrayBuffer())

    const speechFile = path.resolve(logsDir, `test-speech-${voice}.mp3`)
    await writeFile(speechFile, buffer)
  }
}

main()
