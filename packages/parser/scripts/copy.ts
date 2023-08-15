import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'

const __dirname = dirname(fileURLToPath(import.meta.url))

const demoFolder = path.resolve(__dirname, '../../../demo')
const examplesFolder = path.resolve(__dirname, '../../examples')
const targetFolder = path.resolve(__dirname, '../playground/public/examples')

function main() {
  fs.ensureDirSync(targetFolder)
  // copy demo
  const demos = ['starter', 'love']
  demos.forEach((name) => {
    const targetDir = `${targetFolder}/demo/${name}`
    fs.ensureDirSync(targetDir)
    fs.copyFile(
      `${demoFolder}/${name}/index.adv.md`,
      `${targetDir}/index.adv.md`,
    )
  })

  // copy @advjs/examples
  fs.copySync(`${examplesFolder}`, targetFolder, { overwrite: true })
}

main()
