/**
 * 示例数据
 *
 * https://api.pominis.com/doc#tag/adv/get/adv/stories/{id}
 *
 * api: curl 'https://api.pominis.com/v1/adv/stories/{id}'
 */
export const EXAMPLE_STORY = {
  public: {
    id: 'ad2a67ce-12ea-4cb9-bddf-6ca7446045ef',
  },
  private: {
    id: 'e0faa09a-ff2b-481f-902a-a8f4aa4b23c9',
    authToken: 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Ijlwd2cwRlBMUndIaGFKZ0RvRUFDMiIsImlhdCI6MTc1MDUzMTAwMCwiZXhwIjoxNzUxMTM1ODAwLCJpc3MiOiJwb21pbmlzIiwiYXVkIjoicG9taW5pc19hcHAiLCJqdGkiOiJ3S3J6b2lBTlNXSlVjV2FwazVEVGoifQ.osRe46164ykMCCYCF-dBeEAkWW7JO5t08ynhMxi55mM',
  },
}

export const exampleStories = [
  [
    {
      id: 'cbe9acdd-5f75-4bfd-981b-b79fa4dedf36',
      title: 'The Ravenwood Enigma',
      description: 'It was supposed to be a celebratory weekend. Five guests arrived at Ravenwood Manor, invited by the reclusive billionaire, Gregory Langford. But before dinner could be served, Gregory was found dead in his study—poisoned. The door was locked from the inside. The butler, the maid, and five guests… one of them is the killer.',
      tags: ['Mystery', 'Science Fiction'],
      cover: 'https://pominis-mvp.s3.us-west-1.amazonaws.com/generated_images/e8742815-9eb4-4c96-bb71-1bb447b2c8a7.jpg',
      publishedAt: 1750558508639,
      authorName: 'jessica yuan',
      userId: '1raJflmqqJRoAtHGxV7JL',
      likesCount: 1,
    },
    {
      id: '4b05763a-2f9b-4ee9-aed6-5a2f1f2d1670',
      title: '拉斯维加斯的霓虹魅影',
      description: 'Labubu的全球之旅系列',
      tags: ['Horror', 'Romance'],
      cover: 'https://pominis-mvp.s3.us-west-1.amazonaws.com/generated_images/1d4acd4f-9138-4fdb-80af-c8168519e68d.jpg',
      publishedAt: 1750469156100,
      authorName: 'Sheng Rong',
      userId: 'yC-nuTdsCM0-VV4eex66G',
      likesCount: 3,
    },
    {
      id: '5718535e-a942-47c3-ad90-a6259a0832da',
      title: '东方快车上的午夜幽灵',
      description: '基于原著的故事，增加了恐怖和犯罪元素',
      tags: ['Horror', 'Fantasy'],
      cover: 'https://pominis-mvp.s3.us-west-1.amazonaws.com/generated_images/1a25b0d1-7dd9-4d12-83e8-fde8a68a5e4d.jpg',
      publishedAt: 1750465676850,
      authorName: 'Sheng Rong',
      userId: 'yC-nuTdsCM0-VV4eex66G',
      likesCount: 2,
    },
    {
      id: '03404cf8-c532-48bb-a30e-4fbb0a526d0a',
      title: '契约的代价：威尔的救赎之路',
      description: '',
      tags: ['Drama', 'Adventure'],
      cover: 'https://pominis-mvp.s3.us-west-1.amazonaws.com/generated_images/5e68df3a-e6a9-4481-b884-61b18ad7ac92.jpg',
      publishedAt: 1750298660417,
      authorName: 'Sheng Rong',
      userId: 'yC-nuTdsCM0-VV4eex66G',
      likesCount: 1,
    },
    {
      id: '77a1e67c-3604-41fb-8336-6730d62445c6',
      title: '末日深渊：恶魔的低语',
      description: '基于英雄无敌3恶魔族的游戏',
      tags: ['Fantasy', 'Thriller'],
      cover: 'https://pominis-mvp.s3.us-west-1.amazonaws.com/generated_images/01ed8848-5919-433b-bd23-5327021e3147.jpg',
      publishedAt: 1750279489195,
      authorName: 'Sheng Rong',
      userId: 'yC-nuTdsCM0-VV4eex66G',
      likesCount: 3,
    },
    {
      id: 'fb11a0f8-ce05-43e6-8cff-1b9498b80b59',
      title: '伦敦迷雾：血色开端',
      description: '一个关于伦敦谋杀案的探案故事',
      tags: ['mystery', 'detective', 'adventure'],
      publishedAt: 1750273800286,
      authorName: 'Colin的创作空间',
      userId: 'Ub_W89Uld4ss0ys0mM4ZO',
      likesCount: 3,
    },
    {
      id: 'ad2a67ce-12ea-4cb9-bddf-6ca7446045ef',
      title: 'AI Story Spinners: Glitches in the Narrative',
      description: 'kev test desc 4',
      tags: ['Fantasy', 'Adventure'],
      cover: 'https://pominis-mvp.s3.us-west-1.amazonaws.com/pominis-story-cover-image/otJxMi16rZ-lvTNuFHT80/fZwP6TSy-wBTQ1I6rrjg8-K.jpg',
      publishedAt: 1750036124985,
      authorName: 'Kev',
      userId: '9pwg0FPLRwHhaJgDoEAC2',
      likesCount: 2,
    },
  ],
]
