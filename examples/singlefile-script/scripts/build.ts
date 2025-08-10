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
          storyId: '6c91aa92-3f4a-462e-89e8-05040602e768', // example storyId, replace with actual
        }),
      ],
    },
  })
}

main()
