import { defineAdvChapter } from '@advjs/types'

/**
 * for runtime hmr
 */
export const data = {
  title: 'Your Name: A Tale of Fate and Love',
  startNode: 'node_01',
  nodes: [
    {
      // 背景
      id: 'background_01',
      type: 'background',
      name: 'taki-bedroom',
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
          speaker: 'taki',
          text: 'What... what happened last night? Why do I feel so strange?',
        },
        {
          speaker: 'taki',
          text: 'My head feels heavy, like I’ve been dreaming for hours, but I can’t remember a thing.',
        },
        {
          speaker: 'taki',
          text: 'And why does my room feel... different? Like it’s not entirely mine.',
        },
        {
          speaker: 'taki',
          text: 'I need to shake this off. Maybe some water will help.',
        },
        {
          speaker: 'taki',
          text: 'But... why does my reflection in the mirror look so unfamiliar?',
        },
        {
          speaker: 'Others',
          text: 'Others Text',
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
      name: 'taki-phone',
      target: 'node_03',
    },
    {
      // 背景
      id: 'background_03',
      type: 'background',
      name: 'taki-school',
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
          speaker: 'taki',
          text: 'Who wrote this? This isn’t my handwriting... Did someone break into my phone?',
        },
        {
          speaker: 'taki',
          text: 'Wait, this note... it’s about my day, but I don’t remember doing any of this.',
        },
        {
          speaker: 'taki',
          text: 'Did I sleepwalk? Or... is this some kind of prank?',
        },
        {
          speaker: 'taki',
          text: 'No, it’s too detailed. Someone was in my body. But how?',
        },
        {
          speaker: 'taki',
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
          speaker: 'taki',
          text: 'I... I don’t know. Something feels really off today.',
        },
        {
          speaker: 'Friend',
          text: 'You’ve been spacing out all morning. Did you pull an all-nighter or something?',
        },
        {
          speaker: 'taki',
          text: 'No, it’s not that. It’s like... I’m not entirely myself.',
        },
        {
          speaker: 'Friend',
          text: 'Well, you’re acting weird, that’s for sure. Maybe you’re coming down with something.',
        },
        {
          speaker: 'taki',
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
    // @ts-expect-error character
    node.character = {
      type: 'character',
      name: node.dialogues![0].speaker,
    }
    // @ts-expect-error children
    node.children = node.dialogues!.map((dialogue) => {
      return {
        type: 'dialog',
        text: dialogue.text,
        speaker: dialogue.speaker,
      }
    }) as any
  }
})

export default defineAdvChapter({
  id: 'intro',
  title: 'Introduction',
  description: 'Welcome to the world of AdvJS!',
  nodes: data.nodes as any,
  // edges: data.edges,
})
