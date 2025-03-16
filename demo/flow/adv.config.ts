import type { AdvCharacter } from '@advjs/types'
import { defineAdvConfig } from 'advjs'

import { assetsManifest } from './config/assets'
import yourName1 from './public/data/your-name-01.json'

yourName1.characters.forEach((character: AdvCharacter) => {
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

export default defineAdvConfig({
  format: 'flow',
  theme: 'default',

  features: {
    babylon: false,
  },

  assets: {
    manifest: assetsManifest,
  },

  // title: yourName1.title,
  title: 'asd',
  characters: yourName1.characters,

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
