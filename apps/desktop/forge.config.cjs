const { existsSync } = require('node:fs')
const fs = require('node:fs/promises')
const path = require('node:path')
const process = require('node:process')

const icons = path.resolve(__dirname, 'assets/generated')
const catalog = path.join(icons, 'Assets.car')
const hasNativeCatalog = process.platform === 'darwin' && existsSync(catalog)

module.exports = {
  packagerConfig: {
    name: 'ADV.JS Editor',
    executableName: 'advjs-editor',
    appBundleId: 'org.advjs.editor',
    // Source icons are compiled during the build; legacy icons work on any runner.
    // A distinct .icon basename prevents Packager from compiling sources itself.
    extendInfo: hasNativeCatalog ? { CFBundleIconName: 'ADVJSEditor' } : {},
    icon: path.join(icons, 'icon'),
    asar: true,
    prune: false,
    extraResource: [
      path.resolve(__dirname, '.build/runtime'),
      path.join(icons, 'icon.png'),
      path.join(icons, 'icon.ico'),
      ...(hasNativeCatalog ? [catalog] : []),
    ],
    out: path.resolve(__dirname, 'out'),
  },
  hooks: {
    async packageAfterCopy(_config, buildPath) {
      const file = path.join(buildPath, 'package.json')
      const pkg = JSON.parse(await fs.readFile(file, 'utf8'))
      delete pkg.config
      delete pkg.devDependencies
      await fs.writeFile(file, JSON.stringify(pkg, null, 2))
    },
    async postMake(_config, results) {
      const { desktopArtifactName } = await import('./scripts/config.mjs')
      for (const result of results) {
        result.artifacts = await Promise.all(result.artifacts.map(async (artifact) => {
          if (!artifact.endsWith('.zip'))
            return artifact
          const destination = path.join(path.dirname(artifact), desktopArtifactName(result.packageJSON.version, result.platform, result.arch))
          if (artifact !== destination) {
            await fs.rm(destination, { force: true })
            await fs.rename(artifact, destination)
          }
          return destination
        }))
      }
      return results
    },
  },
  makers: [{ name: require.resolve('@electron-forge/maker-zip'), platforms: ['darwin', 'win32', 'linux'] }],
}
