import type { AdvAIConfig } from '../src'

export const aiFormatJSONData: AdvAIConfig = {
  title: 'AI Generated ADVJS',
  description: 'An AI generated adventure game using ADVJS framework.',
  characters: [
    {
      id: 'character_01',
      name: 'YunYouJun',
      appearance: 'A young man with black hair.',
      background: 'A mysterious figure with a hidden past.',
      concept: 'Like science, but indecisive.',
    },
  ],
  chapters: [
    {
      id: 'chapter_01',
      title: 'The Beginning',
      description: 'The start of an adventure.',
      nodes: [
        {
          id: 'node_01',
          dialogues: [
            {
              speakerId: 'character_01',
              text: 'Hello, world!',
            },
          ],
          target: 'node_02',
        },
      ],
    },
  ],
}
