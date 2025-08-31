import { pluginPominis } from '@advjs/plugin-pominis'
/**
 * 通过脚本打包
 */
// import { advBuild } from 'advjs'
import { advBuild } from '../../../packages/advjs/node'

async function main() {
  // todo set plugins
  await advBuild({
    singlefile: true,

    advConfig: {
      theme: 'pominis',

      features: {
        babylon: false,
      },

      plugins: [
        pluginPominis({
          /**
           * 三只小猪
           * @see https://play.pominis.com/start?pominisId=6c91aa92-3f4a-462e-89e8-05040602e768
           */
          // storyId: '6c91aa92-3f4a-462e-89e8-05040602e768', // example storyId, replace with actual
          // storyId: '903ac93a-cec0-4f8c-a91f-053317b5a03a', // example storyId, replace with actual
          // storyId: '404bfe4e-6d75-41a1-95c8-258d1fe7b2b5', // example storyId, replace with actual
          storyId: '608a2398-5574-4bad-a52c-7322a1f0ec97', // example storyId, replace with actual

          bundleAssets: {
            enable: true,
            audio: {
              concurrency: 3,
            },
          },
        }),
      ],
    },
  })
}

main()
