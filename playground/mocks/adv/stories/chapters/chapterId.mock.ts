import { consola } from 'consola'
import { HttpResponse } from 'msw'
import { defineHttpMockery } from 'unplugin-mockery'
import threePigJson from '../data/three-pigs.story.json'
import twoChaptersJson from '../data/two-chapters.story.json'

export default defineHttpMockery({
  url: '/v1/adv/stories/:storyId/chapters/:chapterId',
  method: 'get',

  statusMap: {
    'Normal Story': {
      resolver: ({ params }) => {
        consola.info('params', params.storyId)
        return HttpResponse.json(threePigJson)
      },
    },

    '续写': {
      resolver: ({ params }) => {
        consola.info('params', params.storyId)
        return HttpResponse.json(twoChaptersJson)
      },
    },
  },
})
