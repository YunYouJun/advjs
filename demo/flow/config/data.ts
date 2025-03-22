import type { AdvCharacter } from '@advjs/types'

const characters: AdvCharacter[] = [
  {
    id: 'taki',
    name: 'Taki Tachibana',
    appearance: 'A 17-year-old boy with short, messy black hair, wearing a high school uniform consisting of a white shirt, black blazer, and gray trousers. He has sharp, expressive eyes and a lean build.',
    appearance_prompt: 'A Japanese high school boy with short black hair, wearing a white shirt, black blazer, and gray trousers. Sharp, expressive eyes, lean build, standing confidently in an urban setting.',
    background: 'Taki is a high school student living in Tokyo. He works part-time at an Italian restaurant and has a passion for architecture. He is practical and determined, but often feels disconnected from his surroundings until he starts swapping bodies with Mitsuha.',

    avatar: '/img/your-name/characters/taki.png',
    tachies: {
      default: { src: '/img/your-name/characters/taki.png', class: ['h-full'] },
    },
  },
  {
    id: 'mitsuha',
    name: 'Mitsuha Miyamizu',
    appearance: 'A 17-year-old girl with long, dark brown hair tied in a red ribbon, wearing her school uniform: a white blouse, green pleated skirt, and red ribbon. She has gentle, kind eyes and a petite frame.',
    appearance_prompt: 'A Japanese high school girl with long dark brown hair tied in a red ribbon, wearing a white blouse and green pleated skirt. Gentle, kind eyes, petite frame, standing in a rural setting with mountains in the background.',
    background: 'Mitsuha is a high school girl living in the rural town of Itomori. She helps her family run a shrine and often feels stifled by the small-town life. She dreams of living in Tokyo and experiencing the excitement of the city.',

    avatar: '/img/your-name/characters/mitsuha.png',
    tachies: {
      default: { src: '/img/your-name/characters/mitsuha.png', class: ['h-full'] },
    },
  },
]

/**
 * for runtime hmr
 */
export const data = {
  title: 'Your Name: A Tale of Fate and Love',
  startNode: 'node_01',
  characters,
  nodes: [
    {
      // 背景
      id: 'background_01',
      type: 'background',
      name: 'taki-bedroom',
      src: '/img/your-name/node1.jpg',
    },
    {
      // 人物出场
      id: 'tachie_01',
      type: 'tachie',
      name: 'taki',
      status: 'default',
      action: 'enter',
    },
    {
      id: 'node_01',
      type: 'dialogues',
      sceneDescription: 'Taki wakes up in his small Tokyo apartment, feeling disoriented. The morning light filters through the curtains, and the sounds of the bustling city outside fill the air.',
      imagePrompt: 'A small, cluttered Tokyo apartment with morning light filtering through curtains. A teenage boy with short black hair sits on a bed, looking confused. The room is filled with posters and sketches of buildings.',
      dialogues: [
        {
          speaker: 'Taki',
          text: 'What... what happened last night? Why do I feel so strange?',
        },
        {
          speaker: 'Taki',
          text: 'My head feels heavy, like I’ve been dreaming for hours, but I can’t remember a thing.',
        },
        {
          speaker: 'Taki',
          text: 'And why does my room feel... different? Like it’s not entirely mine.',
        },
        {
          speaker: 'Taki',
          text: 'I need to shake this off. Maybe some water will help.',
        },
        {
          speaker: 'Taki',
          text: 'But... why does my reflection in the mirror look so unfamiliar?',
        },
      ],
    },
    {
      id: 'node_02',
      type: 'choices',
      choices: [
        {
          text: 'Check your phone for clues',
          target: 'tachie_02',
        },
        {
          text: 'Go to school and see if anything feels off',
          target: 'background_03',
        },
      ],
    },
    {
      // 立绘退出
      id: 'tachie_02',
      type: 'tachie',
      name: 'taki',
      action: 'exit',
    },
    {
      // 背景
      id: 'background_02',
      type: 'background',
      name: 'tokyo-phone',
      src: '/img/your-name/node2.jpg',
    },
    {
      // 背景
      id: 'background_03',
      type: 'background',
      name: 'tokyo-school',
      src: '/img/your-name/node3.jpg',
    },
    {
      // 人物退出
      id: 'tachie_exit_02',
      type: 'tachie',
      name: 'mitsuha',
      status: 'default',
      action: 'enter',
    },
    {
      // 人物退出
      id: 'tachie_exit_03',
      type: 'tachie',
      name: 'mitsuha',
      status: 'default',
      action: 'enter',
    },
    {
      id: 'node_03',
      type: 'dialogues',
      sceneDescription: 'Taki picks up his phone and notices a strange note in his notes app. It\'s written in a handwriting he doesn\'t recognize, detailing events he doesn\'t remember.',
      imagePrompt: 'A close-up of a smartphone screen showing a handwritten note in a neat, feminine script. The room is dimly lit, with the phone\'s glow illuminating Taki\'s confused expression.',
      dialogues: [
        {
          speaker: 'Taki',
          text: 'Who wrote this? This isn’t my handwriting... Did someone break into my phone?',
        },
        {
          speaker: 'Taki',
          text: 'Wait, this note... it’s about my day, but I don’t remember doing any of this.',
        },
        {
          speaker: 'Taki',
          text: 'Did I sleepwalk? Or... is this some kind of prank?',
        },
        {
          speaker: 'Taki',
          text: 'No, it’s too detailed. Someone was in my body. But how?',
        },
        {
          speaker: 'Taki',
          text: 'I need to figure this out. This can’t be real... can it?',
        },
      ],
    },
    {
      id: 'node_04',
      type: 'dialogues',
      sceneDescription: 'Taki arrives at school, feeling out of place. His friends notice his strange behavior and ask if he\'s feeling okay.',
      imagePrompt: 'A bustling high school hallway in Tokyo. Taki stands awkwardly, surrounded by curious classmates. The hallway is filled with students in uniforms, and sunlight streams through the windows.',
      dialogues: [
        {
          speaker: 'Friend',
          text: 'Hey, Taki, you look like you’ve seen a ghost. Are you okay?',
        },
        {
          speaker: 'Taki',
          text: 'I... I don’t know. Something feels really off today.',
        },
        {
          speaker: 'Friend',
          text: 'You’ve been spacing out all morning. Did you pull an all-nighter or something?',
        },
        {
          speaker: 'Taki',
          text: 'No, it’s not that. It’s like... I’m not entirely myself.',
        },
        {
          speaker: 'Friend',
          text: 'Well, you’re acting weird, that’s for sure. Maybe you’re coming down with something.',
        },
        {
          speaker: 'Taki',
          text: 'Maybe... but it feels deeper than that. Like something’s missing.',
        },
      ],
    },
    {
      id: 'node_05',
      type: 'narration',
      content: 'As Taki navigates his day, he can\'t shake the feeling of disconnection. He notices small details that seem out of place, like unfamiliar memories and strange habits. The world around him feels both familiar and foreign, and he struggles to make sense of his shifting reality.',
    },
  ],
  edges: [
    { id: 'edge_00', source: 'background_01', target: 'tachie_01' },
    { id: 'edge_01', source: 'tachie_01', target: 'node_01' },
    { id: 'edge_02', source: 'node_01', target: 'node_02' },
    { id: 'edge_03', source: 'tachie_02', target: 'background_02' },
  ],
}

data.nodes.forEach((node, _index) => {
  if (node.type === 'dialogues') {
    node.character = {
      type: 'character',
      name: node.dialogues![0].speaker,
    }
    node.children = node.dialogues!.map((dialogue) => {
      return {
        type: 'text',
        value: dialogue.text,
        speaker: dialogue.speaker,
      }
    }) as any
  }
})
