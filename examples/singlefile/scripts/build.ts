/**
 * 通过脚本打包
 */
// import { advBuild } from 'advjs'
import { advBuild } from '../../../packages/advjs/node'

async function main() {
  // todo set plugins
  await advBuild({
    singlefile: true,
  })
}

main()
