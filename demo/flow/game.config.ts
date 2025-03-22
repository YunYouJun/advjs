import type { UnresolvedAsset } from 'pixi.js'

import { defineGameConfig } from 'advjs'
import { assetsManifest } from './config/assets'

// import yourNameFlow from './public/data/your-name-flow.json'
import { data as yourNameFlow } from './config/data'

const gameScreen = assetsManifest.bundles[1] as { assets: UnresolvedAsset[] }
yourNameFlow.nodes.forEach((node) => {
  if (node.type === 'background') {
    if (node.name && node.src) {
      const asset: UnresolvedAsset = {
        alias: node.name,
        src: node.src,
      }
      gameScreen.assets.push(asset)
    }
  }
})

console.log(assetsManifest)

export default defineGameConfig({
  assets: {
    manifest: assetsManifest,
  },

  // title: yourName1.title,
  title: 'Your Name',
  characters: yourNameFlow.characters,

  chapters: [
    {
      id: 'intro',
      title: 'Introduction',
      description: 'Welcome to the world of AdvJS!',
      data: {
        nodes: yourNameFlow.nodes as any,
        edges: yourNameFlow.edges,
      },
    },
  ],
})
