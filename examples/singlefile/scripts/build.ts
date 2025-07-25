/**
 * 通过脚本打包
 */
// import { advBuild } from 'advjs'
import { advBuild } from '../../../packages/advjs/node'

async function main() {
  await advBuild({
    singlefile: true,
    adapter: 'pominis',
    storyId: '6c91aa92-3f4a-462e-89e8-05040602e768',
  })
}

main()
