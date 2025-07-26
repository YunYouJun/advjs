import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'

const __dirname = dirname(fileURLToPath(import.meta.url))

const demoFolder = path.resolve(__dirname, '../../../demo')
const examplesFolder = path.resolve(__dirname, '../../../examples/adv-format')
const targetFolder = path.resolve(__dirname, '../playground/public/examples')

function main() {
  fs.ensureDirSync(targetFolder)
  // copy demo
  const demos = ['starter', 'love']
  demos.forEach((name) => {
    const targetDir = `${targetFolder}/demo/${name}`
    fs.ensureDirSync(targetDir)

    const sourceEntryFile = `${demoFolder}/${name}/index.adv.md`
    if (fs.existsSync(sourceEntryFile)) {
      fs.copyFile(
        sourceEntryFile,
        `${targetDir}/index.adv.md`,
      )
    }
  })

  // copy @advjs/examples
  fs.copySync(`${examplesFolder}`, targetFolder, { overwrite: true })
}

main()
