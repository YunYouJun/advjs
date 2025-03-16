import type { AdvCharacter } from '@advjs/types'
import { defineGameConfig } from 'advjs'

import { assetsManifest } from './config/assets'
import yourNameFlow from './public/data/your-name-flow.json'

yourNameFlow.characters.forEach((character: AdvCharacter) => {
  switch (character.id) {
    case 'taki': {
      character.tachies = {
        default: { src: '/img/your-name/1.jpg' },
      }
      break
    }
    case 'mitsuha': {
      character.tachies = {
        default: { src: '/img/your-name/2.jpg' },
      }
      break
    }
    default:
      break
  }
})

export default defineGameConfig({
  assets: {
    manifest: assetsManifest,
  },

  // title: yourName1.title,
  title: 'Your Name',
  characters: yourNameFlow.characters,

  // chapters: [
  //   {
  //     id: 'intro',
  //     title: 'Introduction',
  //     description: 'Welcome to the world of AdvJS!',
  //     data: {
  //       nodes: yourName1.nodes,
  //       edges: yourName1.edges,
  //     },
  //   },
  // ],
})
