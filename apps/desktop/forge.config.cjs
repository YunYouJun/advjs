const fs = require('node:fs/promises')
const path = require('node:path')

module.exports = {
  packagerConfig: {
    name: 'ADV.JS Editor',
    executableName: 'advjs-editor',
    appBundleId: 'org.advjs.editor',
    asar: true,
    prune: false,
    extraResource: [path.resolve(__dirname, '.build/runtime')],
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
  },
  makers: [{ name: require.resolve('@electron-forge/maker-zip'), platforms: ['darwin', 'win32', 'linux'] }],
}
