import { openai } from './global'

export async function createSpeechFromText(text: string) {
  const mp3 = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    // voice: 'coral',
    voice: 'echo',
    // input: "Today is a wonderful day to build something people love!",
    input: text,
    instructions: 'Speak in a cheerful and positive tone.',
  })
  return mp3
}

/**
 * 批量生成语音
 */
