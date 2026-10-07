import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { access, copyFile, cp, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import process from 'node:process'
import { runCommand } from '../../../scripts/release/run-command.mjs'
import { prepareDesktopIcons } from './icons.mjs'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

export async function prepareDevelopmentExecutable() {
  const { default: electron } = await import('electron')
  try {
    await access(resolve(root, 'assets/generated/icon-dev.png'))
    await access(resolve(root, 'assets/generated/icon-dev.icns'))
  }
  catch (error) {
    if (error.code !== 'ENOENT')
      throw error
    await prepareDesktopIcons({ native: false })
  }
  if (process.platform !== 'darwin')
    return electron

  const icon = resolve(root, 'assets/generated/icon-dev.icns')
  const version = require('electron/package.json').version
  // Reuse a private, versioned host without changing the shared Electron install.
  const key = createHash('sha256').update(JSON.stringify([3, version, process.arch, electron])).update(await readFile(icon)).digest('hex').slice(0, 16)
  const cache = resolve(root, '.dev', key)
  const name = 'ADV.JS Editor Dev'
  const bundle = resolve(cache, `${name}.app`)
  // Electron uses the executable basename to determine app.isPackaged.
  const executable = resolve(bundle, 'Contents/MacOS/Electron')
  try {
    await access(executable, constants.X_OK)
    return executable
  }
  catch (error) {
    if (error.code !== 'ENOENT')
      throw error
  }

  await mkdir(cache, { recursive: true })
  const temporary = await mkdtemp(resolve(cache, 'prepare-'))
  try {
    const copy = resolve(temporary, `${name}.app`)
    await cp(resolve(electron, '../../..'), copy, { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE })
    await copyFile(icon, resolve(copy, 'Contents/Resources/electron.icns'))
    await updatePlist(resolve(copy, 'Contents/Info.plist'), {
      CFBundleName: name,
      CFBundleDisplayName: name,
      CFBundleIdentifier: 'org.advjs.editor.dev',
    })
    await runCommand('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', copy])
    await rename(copy, bundle)
    return executable
  }
  finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function updatePlist(path, fields) {
  for (const [field, value] of Object.entries(fields))
    await runCommand('/usr/bin/plutil', ['-replace', field, '-string', value, path])
}
