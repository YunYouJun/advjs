import { defineAdvCharacter } from '@advjs/types'

export default defineAdvCharacter({
  id: 'taki',
  name: 'Taki Tachibana',
  appearance: 'A 17-year-old boy with short, messy black hair, wearing a high school uniform consisting of a white shirt, black blazer, and gray trousers. He has sharp, expressive eyes and a lean build.',
  appearance_prompt: 'A Japanese high school boy with short black hair, wearing a white shirt, black blazer, and gray trousers. Sharp, expressive eyes, lean build, standing confidently in an urban setting.',
  background: 'Taki is a high school student living in Tokyo. He works part-time at an Italian restaurant and has a passion for architecture. He is practical and determined, but often feels disconnected from his surroundings until he starts swapping bodies with Mitsuha.',

  avatar: '/img/your-name/characters/taki.png',
  tachies: {
    default: { src: '/img/your-name/characters/taki.png', class: ['h-full'] },
  },
})
