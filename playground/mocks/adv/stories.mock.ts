import { consola } from 'consola'
import { HttpResponse } from 'msw'
import { defineHttpMockery } from 'unplugin-mockery'
import threePigJson from '../../public/games/three-pigs.json'

export default defineHttpMockery({
  url: '/v1/adv/stories/:storyId',
  method: 'post',
  resolver: ({ params }) => {
    consola.info('params', params.storyId)
    return HttpResponse.json(threePigJson)
  },
})
