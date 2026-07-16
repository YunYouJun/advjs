import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  theme: 'default',
  features: {
    babylon: false,
  },
  gameConfig: {
    title: 'ADV.JS Starter',
    description: '一个最小、可复制的 ADV.JS 示例',
    variables: {
      greeted: false,
    },
    chapters: [
      {
        id: 'hello',
        title: '你好，ADV.JS',
        nodes: [
          {
            id: 'hello-start',
            type: 'fountain',
            src: '/md/chapters/hello.adv.md',
            order: 0,
          },
        ],
      },
    ],
    characters: [
      {
        id: 'guide',
        name: '向导',
      },
    ],
  },
})
