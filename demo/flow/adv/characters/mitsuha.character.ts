import { defineAdvCharacter } from '@advjs/client'

export default defineAdvCharacter({
  id: 'mitsuha',
  name: 'Mitsuha Miyamizu',
  appearance: 'A 17-year-old girl with long, dark brown hair tied in a red ribbon, wearing her school uniform: a white blouse, green pleated skirt, and red ribbon. She has gentle, kind eyes and a petite frame.',
  appearance_prompt: 'A Japanese high school girl with long dark brown hair tied in a red ribbon, wearing a white blouse and green pleated skirt. Gentle, kind eyes, petite frame, standing in a rural setting with mountains in the background.',
  background: 'Mitsuha is a high school girl living in the rural town of Itomori. She helps her family run a shrine and often feels stifled by the small-town life. She dreams of living in Tokyo and experiencing the excitement of the city.',

  avatar: '/img/your-name/characters/mitsuha.png',
  tachies: {
    default: { src: '/img/your-name/characters/mitsuha.png', class: ['h-full'] },
  },
})
