import { cpSync, mkdirSync } from 'node:fs'
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
  const demos = [
    { name: 'starter', chapter: '1/仓鼠的笼子' },
    { name: 'love', chapter: '1/intro' },
  ]
  for (const { name, chapter } of demos) {
    const targetDir = `${targetFolder}/demo/${name}`
    mkdirSync(targetDir, { recursive: true })

    // Preserve the public URLs used by saved playground preferences.
    await copyFile(
      `${demoFolder}/${name}/public/md/chapters/${chapter}.adv.md`,
      `${targetDir}/index.adv.md`,
    )
  }

  // copy @advjs/examples
  cpSync(examplesFolder, targetFolder, { recursive: true, force: true })
}

main()
