export const yourNameData = {
  title: 'Your Name: A Tale of Fate and Love',
  startNode: 'node_01',
  characters: [
    {
      id: 'taki',
      name: 'Taki Tachibana',
      appearance: 'A 17-year-old boy with short, messy black hair, wearing a high school uniform consisting of a white shirt, black blazer, and gray trousers. He has sharp, expressive eyes and a lean build.',
      appearance_prompt: 'A Japanese high school boy with short black hair, wearing a white shirt, black blazer, and gray trousers. Sharp, expressive eyes, lean build, standing confidently in an urban setting.',
      background: 'Taki is a high school student living in Tokyo. He works part-time at an Italian restaurant and has a passion for architecture. He is practical and determined, but often feels disconnected from his surroundings until he starts swapping bodies with Mitsuha.',
    },
    {
      id: 'mitsuha',
      name: 'Mitsuha Miyamizu',
      appearance: 'A 17-year-old girl with long, dark brown hair tied in a red ribbon, wearing her school uniform: a white blouse, green pleated skirt, and red ribbon. She has gentle, kind eyes and a petite frame.',
      appearance_prompt: 'A Japanese high school girl with long dark brown hair tied in a red ribbon, wearing a white blouse and green pleated skirt. Gentle, kind eyes, petite frame, standing in a rural setting with mountains in the background.',
      background: 'Mitsuha is a high school girl living in the rural town of Itomori. She helps her family run a shrine and often feels stifled by the small-town life. She dreams of living in Tokyo and experiencing the excitement of the city.',
    },
  ],
  nodes: [
    {
      id: 'node_01',
      type: 'dialogues',
      data: {
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
    },
    {
      id: 'node_02',
      type: 'choices',
      data: {
        choices: [
          {
            text: 'Check your phone for clues',
            target: 'node_03',
          },
          {
            text: 'Go to school and see if anything feels off',
            target: 'node_04',
          },
        ],
      },
    },
    {
      id: 'node_03',
      type: 'dialogues',
      data: {
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
    },
    {
      id: 'node_04',
      type: 'dialogues',
      data: {
        sceneDescription: 'Taki arrives at school, feeling out of place. His friends notice his strange behavior and ask if he\'s feeling okay.',
        imagePrompt: 'A bustling high school hallway in Tokyo. Taki stands awkwardly, surrounded by curious classmates. The hallway is filled with students in uniforms, and sunlight streams through the windows.',
        children: [
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
    },
    {
      id: 'node_05',
      type: 'narration',
      data: {
        content: 'As Taki navigates his day, he can\'t shake the feeling of disconnection. He notices small details that seem out of place, like unfamiliar memories and strange habits. The world around him feels both familiar and foreign, and he struggles to make sense of his shifting reality.',
      },
    },
  ],
  edges: [
    { id: 'edge_01', source: 'node_01', target: 'node_02' },
    { id: 'edge_02', source: 'node_02', target: 'node_03' },
    { id: 'edge_03', source: 'node_02', target: 'node_04' },
    { id: 'edge_04', source: 'node_04', target: 'node_05' },
  ],
}
