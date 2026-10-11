import { defineAdvSetup } from '@advjs/client'
import { consola } from 'consola'

export default defineAdvSetup(({ $adv }) => {
  consola.success('[ADV]', 'defineAdvSetup', $adv)
  // The canonical JSON chapter now runs through the ordinary game entry.
})
