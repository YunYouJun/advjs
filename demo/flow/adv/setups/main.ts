import { defineAppSetup } from '@advjs/client'
import { consola } from 'consola'

export default defineAppSetup(() => {
  consola.info('[ADV] App setup')
})
