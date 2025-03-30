import OpenAI from 'openai'
import { playAudio } from 'openai/helpers/audio'

const openai = new OpenAI()

const response = await openai.audio.speech.create({
  model: 'gpt-4o-mini-tts',
  voice: 'coral',
  input: 'Today is a wonderful day to build something people love!',
  instructions: 'Speak in a cheerful and positive tone.',
  response_format: 'wav',
})

await playAudio(response)
