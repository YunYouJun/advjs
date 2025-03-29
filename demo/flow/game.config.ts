// import type { UnresolvedAsset } from 'pixi.js'

import { defineGameConfig } from 'advjs'
import { assetsManifest } from './config/assets'

// // import yourNameFlow from './public/data/your-name-flow.json'
// import { data as yourNameFlow } from './config/data'

// const gameScreen = assetsManifest.bundles[1] as { assets: UnresolvedAsset[] }
// yourNameFlow.backgrounds.forEach((node) => {
//   if (node.id && node.src) {
//     const asset: UnresolvedAsset = {
//       alias: node.id,
//       src: node.src,
//     }
//     gameScreen.assets.push(asset)
//   }
// })

export default defineGameConfig({
  assets: {
    manifest: assetsManifest,
  },

  // title: yourName1.title,
  title: 'Your Name',
})
