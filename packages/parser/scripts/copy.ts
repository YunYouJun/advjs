import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const demoFolder = path.resolve(__dirname, '../../../demo')
const examplesFolder = path.resolve(__dirname, '../../../examples/adv-format')
const targetFolder = path.resolve(__dirname, '../playground/public/examples')

async function main() {
  mkdirSync(targetFolder, { recursive: true })
  // copy demo
  const demos = ['starter', 'love']
  for (const name of demos) {
    const targetDir = `${targetFolder}/demo/${name}`
    mkdirSync(targetDir, { recursive: true })

    const sourceEntryFile = `${demoFolder}/${name}/index.adv.md`
    if (existsSync(sourceEntryFile)) {
      await copyFile(
        sourceEntryFile,
        `${targetDir}/index.adv.md`,
      )
    }
  }

  // copy @advjs/examples
  cpSync(examplesFolder, targetFolder, { recursive: true, force: true })
}

main()
